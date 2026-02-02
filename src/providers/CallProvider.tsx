import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWebRTCCall, WebRTCCallState } from '@/hooks/useWebRTCCall';
import { useAuth } from '@/hooks/useAuth';

export interface IncomingCall {
  callId: string;
  callLogId?: string;
  phone: string;
  contactId?: string;
  contactName: string;
  contactAvatar?: string;
  channelId: string;
  tenantId: string;
  mediaType: 'audio' | 'video';
  sdpOffer: string | null;
  timestamp: string;
}

interface CallContextValue {
  // Current call state
  callState: WebRTCCallState;
  
  // Incoming call that's ringing
  incomingCall: IncomingCall | null;
  
  // Actions
  answerIncomingCall: () => Promise<void>;
  rejectIncomingCall: () => Promise<void>;
  hangupCall: () => Promise<void>;
  initiateCall: (toNumber: string, contactId?: string, contactName?: string) => Promise<void>;
  toggleMute: () => void;
  dismissIncomingCall: () => void;
  
  // Status
  isInCall: boolean;
  hasIncomingCall: boolean;
}

const CallContext = createContext<CallContextValue | null>(null);

export function useCallContext() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCallContext must be used within a CallProvider');
  }
  return context;
}

interface CallProviderProps {
  children: ReactNode;
}

export function CallProvider({ children }: CallProviderProps) {
  const { user } = useAuth();
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  
  // Track channel subscription status
  const isEventsChannelReady = useRef(false);
  const isIncomingChannelReady = useRef(false);
  
  const {
    state: callState,
    answerCall,
    rejectCall,
    hangup,
    initiateCall: initiate,
    toggleMute,
    cleanup,
    setSdpAnswer,
  } = useWebRTCCall();

  // Listen for incoming calls via Supabase Realtime
  useEffect(() => {
    if (!user) return;

    console.log('[CallProvider] Setting up incoming call listener');

    // Reset channel status
    isEventsChannelReady.current = false;
    isIncomingChannelReady.current = false;

    // IMPORTANTE: Os nomes dos canais devem ser EXATAMENTE os mesmos do backend
    const channel = supabase
      .channel('incoming-calls')
      .on('broadcast', { event: 'incoming_call' }, (payload) => {
        console.log('[CallProvider] 📞 Received incoming call:', payload);
        
        const callData = payload.payload as IncomingCall;
        
        // Only show if not already in a call
        if (callState.status === 'idle') {
          setIncomingCall(callData);
          
          // Play ringtone
          try {
            const audio = new Audio('/sounds/ringtone.mp3');
            audio.loop = true;
            audio.play().catch(() => {
              console.log('[CallProvider] Could not play ringtone');
            });
            
            // Store audio reference to stop later
            (window as any).__callRingtone = audio;
          } catch (e) {
            console.log('[CallProvider] Ringtone not available');
          }
        }
      })
      .subscribe((status) => {
        console.log('[CallProvider] incoming-calls channel status:', status);
        isIncomingChannelReady.current = status === 'SUBSCRIBED';
      });

    // Also listen for call state changes - nome IGUAL ao usado no webhook
    const eventsChannel = supabase
      .channel('call-events')
      .on('broadcast', { event: 'call_state_changed' }, async (payload) => {
        console.log('[CallProvider] 📥 Call state changed:', payload);
        
        // Aceitar tanto callId quanto call_id (diferentes edge functions usam formatos diferentes)
        const data = payload.payload as { 
          callId?: string;
          call_id?: string; 
          status: string; 
          sdpAnswer?: string;
          sdpType?: string;
        };
        
        const receivedCallId = data.callId || data.call_id;
        const { status, sdpAnswer, sdpType } = data;
        
        console.log('[CallProvider] Parsed call event:', { 
          receivedCallId, 
          status, 
          hasSdpAnswer: !!sdpAnswer,
          sdpAnswerLength: sdpAnswer?.length || 0,
          sdpType,
          myCallId: callState.callId,
          myDirection: callState.direction,
          willProcess: sdpAnswer && callState.callId === receivedCallId && callState.direction === 'outbound',
        });
        
        // If we received SDP answer for our outbound call, set it on the peer connection
        if (sdpAnswer && callState.callId === receivedCallId && callState.direction === 'outbound') {
          console.log('[CallProvider] ✅ Received SDP answer via Realtime for outbound call, setting remote description');
          try {
            await setSdpAnswer(sdpAnswer);
            console.log('[CallProvider] ✅ SDP answer set successfully via Realtime');
          } catch (error) {
            console.error('[CallProvider] ❌ Error setting SDP answer:', error);
          }
        }
        
        // If the incoming call was answered/rejected elsewhere
        // Normalizar status para lowercase para comparação
        const normalizedStatus = String(status || '').toLowerCase();
        if (incomingCall?.callId === receivedCallId && ['accepted', 'rejected', 'terminated'].includes(normalizedStatus)) {
          dismissIncomingCall();
        }
      })
      .subscribe((status) => {
        console.log('[CallProvider] call-events channel status:', status);
        isEventsChannelReady.current = status === 'SUBSCRIBED';
      });

    return () => {
      console.log('[CallProvider] Cleaning up call listeners');
      isEventsChannelReady.current = false;
      isIncomingChannelReady.current = false;
      supabase.removeChannel(channel);
      supabase.removeChannel(eventsChannel);
    };
  }, [user, callState.status, callState.callId, callState.direction, incomingCall?.callId, setSdpAnswer]);

  // Stop ringtone helper
  const stopRingtone = useCallback(() => {
    const audio = (window as any).__callRingtone;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      delete (window as any).__callRingtone;
    }
  }, []);

  // Dismiss incoming call notification
  const dismissIncomingCall = useCallback(() => {
    stopRingtone();
    setIncomingCall(null);
  }, [stopRingtone]);

  // Answer the current incoming call
  const answerIncomingCall = useCallback(async () => {
    if (!incomingCall) return;
    
    stopRingtone();
    
    if (!incomingCall.sdpOffer) {
      console.error('[CallProvider] No SDP offer in incoming call');
      // Still try to answer - Meta might send SDP later
    }
    
    await answerCall(
      incomingCall.callId,
      incomingCall.callLogId || '',
      incomingCall.channelId,
      incomingCall.sdpOffer || '',
      {
        name: incomingCall.contactName,
        phone: incomingCall.phone,
        avatar: incomingCall.contactAvatar,
      }
    );
    
    setIncomingCall(null);
  }, [incomingCall, answerCall, stopRingtone]);

  // Reject the current incoming call
  const rejectIncomingCall = useCallback(async () => {
    if (!incomingCall) return;
    
    stopRingtone();
    await rejectCall(incomingCall.callId, incomingCall.channelId);
    setIncomingCall(null);
  }, [incomingCall, rejectCall, stopRingtone]);

  // Hangup current call
  const hangupCall = useCallback(async () => {
    await hangup();
  }, [hangup]);

  // Initiate a new call via Cloud API
  const initiateCall = useCallback(async (
    toNumber: string,
    contactId?: string,
    contactName?: string
  ) => {
    await initiate(toNumber, contactId, contactName);
  }, [initiate]);

  const value: CallContextValue = {
    callState,
    incomingCall,
    answerIncomingCall,
    rejectIncomingCall,
    hangupCall,
    initiateCall,
    toggleMute,
    dismissIncomingCall,
    isInCall: callState.status !== 'idle',
    hasIncomingCall: !!incomingCall,
  };

  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  );
}
