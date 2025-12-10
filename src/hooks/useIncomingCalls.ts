import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface IncomingCall {
  callId: string;
  phone: string;
  contactName: string;
  contactId?: string;
  conversationId?: string;
  assignedTo?: string;
  channelId: string;
  channelName: string;
  departmentId?: string;
  isVideo: boolean;
  timestamp: string;
}

export function useIncomingCalls() {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile?.id) return;

    const channel = supabase
      .channel('incoming-calls')
      .on('broadcast', { event: 'incoming_call' }, ({ payload }) => {
        console.log('[IncomingCalls] Received call notification:', payload);
        
        // Verificar se a notificação é relevante para este usuário:
        // 1. Conversa atribuída a mim
        // 2. OU conversa sem atribuição no meu departamento
        // 3. OU sou admin/supervisor
        const isMyConversation = payload.assignedTo === profile.id;
        const isUnassignedInMyDepartment = !payload.assignedTo && 
          payload.departmentId === profile.department_id;
        const isAdminOrSupervisor = profile.role === 'admin' || profile.role === 'supervisor';
        
        const shouldNotify = isMyConversation || isUnassignedInMyDepartment || isAdminOrSupervisor;
        
        if (shouldNotify) {
          console.log('[IncomingCalls] Showing notification for user:', profile.id);
          setIncomingCall(payload as IncomingCall);
          
          // Tentar tocar som de notificação
          try {
            const audio = new Audio('/sounds/incoming-call.mp3');
            audio.volume = 0.5;
            audio.play().catch(() => {
              console.log('[IncomingCalls] Could not play sound (autoplay blocked)');
            });
          } catch (e) {
            // Ignorar erros de áudio
          }
          
          // Auto-dismiss após 30 segundos
          setTimeout(() => setIncomingCall(null), 30000);
        }
      })
      .subscribe((status) => {
        console.log('[IncomingCalls] Channel subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, profile?.department_id, profile?.role]);

  const dismissCall = useCallback(() => {
    setIncomingCall(null);
  }, []);

  return { incomingCall, dismissCall };
}
