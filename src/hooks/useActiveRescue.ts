import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import type { RescueStep } from './useRescueTemplates';
import { toast } from 'sonner';
import { sendWhatsAppMessage } from '@/lib/whatsapp/instance-creator';

export interface ActiveRescue {
  id: string;
  conversation_id: string;
  contact_id: string;
  template_id: string;
  current_step: number;
  next_send_at: string | null;
  status: 'active' | 'completed' | 'cancelled' | 'responded';
  activated_by: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  responded_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  template?: {
    title: string;
    steps: RescueStep[];
  };
}

export interface ScheduledRescueMessage {
  id: string;
  rescue_id: string;
  step_number: number;
  content: string;
  scheduled_for: string;
  status: 'pending' | 'sent' | 'cancelled';
  sent_at: string | null;
  cancelled_at: string | null;
  audio_url?: string | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
  attachment_name?: string | null;
}

export function useActiveRescue(conversationId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['active-rescue', conversationId],
    queryFn: async () => {
      if (!conversationId) return null;

      const { data, error } = await supabase
        .from('active_rescues')
        .select(`
          *,
          template:rescue_templates(title, steps)
        `)
        .eq('conversation_id', conversationId)
        .eq('status', 'active')
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        return {
          ...data,
          template: data.template ? {
            ...data.template,
            steps: (data.template.steps as unknown as RescueStep[]) || [],
          } : undefined,
        } as ActiveRescue;
      }
      
      return null;
    },
    enabled: !!conversationId,
  });

  // Subscribe to realtime updates for this conversation's rescue status
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`rescue-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'active_rescues',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['active-rescue', conversationId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  return query;
}

export function useScheduledMessages(rescueId: string | null) {
  return useQuery({
    queryKey: ['rescue-scheduled-messages', rescueId],
    queryFn: async () => {
      if (!rescueId) return [];

      const { data, error } = await supabase
        .from('rescue_scheduled_messages')
        .select('*')
        .eq('rescue_id', rescueId)
        .order('step_number', { ascending: true });

      if (error) throw error;
      return data as ScheduledRescueMessage[];
    },
    enabled: !!rescueId,
  });
}

export function useActivateRescue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      contactId,
      templateId,
      steps,
    }: {
      conversationId: string;
      contactId: string;
      templateId: string;
      steps: RescueStep[];
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const now = new Date();
      
      // Get conversation and contact info IN PARALLEL for faster execution
      const [conversationResult, contactResult] = await Promise.all([
        supabase.from('conversations').select('channel_id').eq('id', conversationId).single(),
        supabase.from('contacts').select('phone').eq('id', contactId).single(),
      ]);
      
      if (conversationResult.error || !conversationResult.data?.channel_id) {
        throw new Error('Conversa não encontrada ou sem canal associado');
      }
      
      if (contactResult.error || !contactResult.data?.phone) {
        throw new Error('Contato não encontrado ou sem telefone');
      }
      
      const channelId = conversationResult.data.channel_id;
      const phone = contactResult.data.phone;
      
      // Create active rescue FIRST (fast operation)
      const { data: rescue, error: rescueError } = await supabase
        .from('active_rescues')
        .insert({
          conversation_id: conversationId,
          contact_id: contactId,
          template_id: templateId,
          current_step: 0,
          next_send_at: now.toISOString(),
          status: 'active',
          activated_by: user?.id,
        } as any)
        .select()
        .single();

      if (rescueError) throw rescueError;

      // SEND FIRST MESSAGE IMMEDIATELY via WhatsApp
      // Send each media type SEPARATELY: text, audio, attachment
      const firstStep = steps[0];
      const hasContent = firstStep?.message || firstStep?.audio_url || firstStep?.attachment_url;
      
      if (hasContent) {
        console.log('[useActivateRescue] Sending first message immediately...');
        
        try {
          // Helper to: INSERT first (pending) -> SEND to WhatsApp -> UPDATE with messageId
          // This prevents race condition with webhook creating duplicates
          const sendMessageWithInsertFirst = async (
            type: 'text' | 'image' | 'audio' | 'video' | 'document',
            content: string,
            mediaUrl: string | null
          ) => {
            // 1. INSERT message first with status 'pending' (no whatsapp_message_id yet)
            const { data: insertedMsg, error: insertError } = await supabase
              .from('messages')
              .insert({
                conversation_id: conversationId,
                contact_id: contactId,
                content: content,
                is_from_me: true,
                message_type: type,
                media_url: mediaUrl,
                status: 'pending',
                whatsapp_message_id: null,
                tenant_id: null, // Auto-filled by trigger
              })
              .select('id')
              .single();

            if (insertError) {
              console.error(`[useActivateRescue] Error inserting ${type} message:`, insertError);
              throw insertError;
            }

            console.log(`[useActivateRescue] Inserted pending ${type} message:`, insertedMsg.id);

            // 2. SEND to WhatsApp (routes CloudAPI vs providers automatically)
            const sendResult = await sendWhatsAppMessage(
              channelId,
              phone,
              content,
              type,
              mediaUrl || undefined
            );

            if (!sendResult.success) {
              // Rollback: delete the pending message
              await supabase.from('messages').delete().eq('id', insertedMsg.id);
              throw new Error(sendResult.error || 'Erro ao enviar mensagem');
            }

            // 3. UPDATE message with whatsapp_message_id and status 'sent'
            const { error: updateError } = await supabase
              .from('messages')
              .update({
                whatsapp_message_id: sendResult.messageId,
                status: 'sent',
              })
              .eq('id', insertedMsg.id);

            if (updateError) {
              console.error(`[useActivateRescue] Error updating ${type} message:`, updateError);
            }

            console.log(`[useActivateRescue] ${type} message sent and updated:`, sendResult.messageId);
            return sendResult;
          };

          // Send messages SEQUENTIALLY to maintain order, each with insert-first pattern
          // 1. Send TEXT message first (if exists)
          if (firstStep.message?.trim()) {
            console.log('[useActivateRescue] Sending text message...');
            await sendMessageWithInsertFirst('text', firstStep.message, null);
          }
          
          // 2. Send AUDIO (if exists)
          if (firstStep.audio_url) {
            console.log('[useActivateRescue] Sending audio message...');
            await sendMessageWithInsertFirst('audio', '', firstStep.audio_url);
          }
          
          // 3. Send ATTACHMENT (if exists)
          if (firstStep.attachment_url) {
            console.log('[useActivateRescue] Sending attachment message...');
            const attachmentType: 'image' | 'video' | 'document' =
              firstStep.attachment_type === 'image' ||
              firstStep.attachment_type === 'video' ||
              firstStep.attachment_type === 'document'
                ? firstStep.attachment_type
                : 'document';
            await sendMessageWithInsertFirst(attachmentType, '', firstStep.attachment_url);
          }
          
          console.log('[useActivateRescue] All messages sent successfully');
            
        } catch (err) {
          console.error('[useActivateRescue] Error in first message flow:', err);
          // Rollback: delete the rescue if first message fails
          await supabase.from('active_rescues').delete().eq('id', rescue.id);
          throw err;
        }
      }

      // Schedule remaining messages (starting from step 1)
      // First message timer = time until SECOND message
      let accumulatedMinutes = steps[0]?.timer_minutes || 5; // First timer is for second message
      const scheduledMessages = [];
      
      // First message is already sent, mark it
      scheduledMessages.push({
        rescue_id: rescue.id,
        step_number: 0,
        content: steps[0]?.message || '',
        scheduled_for: now.toISOString(),
        status: 'sent' as const,
        sent_at: now.toISOString(),
        audio_url: steps[0]?.audio_url || null,
        attachment_url: steps[0]?.attachment_url || null,
        attachment_type: steps[0]?.attachment_type || null,
        attachment_name: steps[0]?.attachment_name || null,
      });
      
      // Schedule remaining messages
      for (let i = 1; i < steps.length; i++) {
        const scheduledTime = new Date(now.getTime() + accumulatedMinutes * 60 * 1000);
        scheduledMessages.push({
          rescue_id: rescue.id,
          step_number: i,
          content: steps[i].message,
          scheduled_for: scheduledTime.toISOString(),
          status: 'pending' as const,
          audio_url: steps[i].audio_url || null,
          attachment_url: steps[i].attachment_url || null,
          attachment_type: steps[i].attachment_type || null,
          attachment_name: steps[i].attachment_name || null,
        });
        accumulatedMinutes += steps[i].timer_minutes;
      }

      const { error: messagesError } = await supabase
        .from('rescue_scheduled_messages')
        .insert(scheduledMessages);

      if (messagesError) throw messagesError;

      // Update rescue with next send time (for second message)
      if (steps.length > 1) {
        const nextSendAt = new Date(now.getTime() + (steps[0]?.timer_minutes || 5) * 60 * 1000);
        await supabase
          .from('active_rescues')
          .update({ 
            current_step: 1, 
            next_send_at: nextSendAt.toISOString() 
          })
          .eq('id', rescue.id);
      } else {
        // Only one message, mark as completed
        await supabase
          .from('active_rescues')
          .update({ 
            status: 'completed', 
            completed_at: now.toISOString() 
          })
          .eq('id', rescue.id);
      }

      return rescue;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['active-rescue', variables.conversationId] });
      toast.success('Resgate ativado! Primeira mensagem enviada.');
    },
    onError: (error: any) => {
      console.error('[useActivateRescue] Error:', error);
      toast.error(error?.message || 'Erro ao ativar resgate');
    },
  });
}

export function useCancelRescue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      rescueId,
      conversationId,
    }: {
      rescueId: string;
      conversationId: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Cancel the active rescue - use .select() to verify if update happened
      const { data: updatedRescue, error: rescueError } = await supabase
        .from('active_rescues')
        .update({
          status: 'cancelled',
          cancelled_by: user?.id,
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', rescueId)
        .select('id')
        .maybeSingle();

      if (rescueError) throw rescueError;
      
      // If no rows were updated, it means RLS blocked the operation
      if (!updatedRescue) {
        throw new Error('Você não tem permissão para cancelar este resgate. Apenas o criador do resgate, o atendente da conversa ou administradores podem cancelá-lo.');
      }

      // Cancel all pending messages
      const { error: messagesError } = await supabase
        .from('rescue_scheduled_messages')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        })
        .eq('rescue_id', rescueId)
        .eq('status', 'pending');

      if (messagesError) throw messagesError;

      return { rescueId, conversationId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['active-rescue', result.conversationId] });
      toast.success('Resgate cancelado');
    },
    onError: (error: any) => {
      console.error('[useCancelRescue] Error:', error);
      toast.error(error?.message || 'Erro ao cancelar resgate');
    },
  });
}
