import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import type { RescueStep } from './useRescueTemplates';

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
      
      // Calculate next send time for first message (immediate)
      const now = new Date();
      
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

      // Schedule all messages with calculated times
      let accumulatedMinutes = 0;
      const scheduledMessages = steps.map((step, index) => {
        const scheduledTime = new Date(now.getTime() + accumulatedMinutes * 60 * 1000);
        accumulatedMinutes += step.timer_minutes;
        
        return {
          rescue_id: rescue.id,
          step_number: index,
          content: step.message,
          scheduled_for: scheduledTime.toISOString(),
          status: 'pending' as const,
        };
      });

      const { error: messagesError } = await supabase
        .from('rescue_scheduled_messages')
        .insert(scheduledMessages);

      if (messagesError) throw messagesError;

      return rescue;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['active-rescue', variables.conversationId] });
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
    },
  });
}
