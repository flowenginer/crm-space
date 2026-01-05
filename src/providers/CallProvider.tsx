import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
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
  
  const {
    state: callState,
    answerCall,
    rejectCall,
    hangup,
    initiateCall: initiate,
    toggleMute,
    cleanup,
  } = useWebRTCCall();

  // Listen for incoming calls via Supabase Realtime
  useEffect(() => {
    if (!user) return;

    console.log('[CallProvider] Setting up incoming call listener');

    const channel = supabase
      .channel('incoming-calls-listener')
      .on('broadcast', { event: 'incoming_call' }, (payload) => {
        console.log('[CallProvider] Received incoming call:', payload);
        
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
      .subscribe();

    // Also listen for call state changes
    const eventsChannel = supabase
      .channel('call-events-listener')
      .on('broadcast', { event: 'call_state_changed' }, (payload) => {
        console.log('[CallProvider] Call state changed:', payload);
        
        const { callId, status } = payload.payload as { callId: string; status: string };
        
        // If the incoming call was answered/rejected elsewhere
        if (incomingCall?.callId === callId && ['accepted', 'rejected', 'terminated'].includes(status)) {
          dismissIncomingCall();
        }
      })
      .subscribe();

    return () => {
      console.log('[CallProvider] Cleaning up call listeners');
      supabase.removeChannel(channel);
      supabase.removeChannel(eventsChannel);
    };
  }, [user, callState.status, incomingCall?.callId]);

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
