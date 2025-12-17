import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import type { RescueStep } from './useRescueTemplates';
import { toast } from 'sonner';

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
      
      // Get conversation and channel info for sending message
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .select('channel_id')
        .eq('id', conversationId)
        .single();
      
      if (convError || !conversation?.channel_id) {
        throw new Error('Conversa não encontrada ou sem canal associado');
      }
      
      // Get contact phone
      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .select('phone')
        .eq('id', contactId)
        .single();
      
      if (contactError || !contact?.phone) {
        throw new Error('Contato não encontrado ou sem telefone');
      }
      
      // Create active rescue
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
        })
        .select()
        .single();

      if (rescueError) throw rescueError;

      // SEND FIRST MESSAGE IMMEDIATELY via WhatsApp
      const firstMessage = steps[0]?.message;
      if (firstMessage) {
        console.log('[useActivateRescue] Sending first message immediately...');
        
        try {
          // Send via WhatsApp API
          const { data: sendResult, error: sendError } = await supabase.functions.invoke('whatsapp-instance', {
            body: {
              action: 'send',
              channelId: conversation.channel_id,
              phone: contact.phone,
              content: firstMessage,
              type: 'text',
            },
          });
          
          if (sendError) {
            console.error('[useActivateRescue] Error sending first message:', sendError);
            throw new Error('Falha ao enviar primeira mensagem');
          }
          
          console.log('[useActivateRescue] First message sent successfully:', sendResult);
          
          // Insert message into messages table
          await supabase
            .from('messages')
            .insert({
              conversation_id: conversationId,
              contact_id: contactId,
              content: firstMessage,
              is_from_me: true,
              message_type: 'text',
              status: 'sent',
              whatsapp_message_id: sendResult?.messageId,
            });
            
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
      
      // Cancel the active rescue
      const { error: rescueError } = await supabase
        .from('active_rescues')
        .update({
          status: 'cancelled',
          cancelled_by: user?.id,
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', rescueId);

      if (rescueError) throw rescueError;

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
  });
}
