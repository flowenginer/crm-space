import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type CallStatus = 'idle' | 'ringing' | 'connecting' | 'active' | 'ended';

export interface WebRTCCallState {
  status: CallStatus;
  callId: string | null;
  callLogId: string | null;
  channelId: string | null;
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
  duration: number;
  isMuted: boolean;
  isVideo: boolean;
  contactName: string | null;
  contactPhone: string | null;
  contactAvatar: string | null;
  direction: 'inbound' | 'outbound' | null;
}

const initialState: WebRTCCallState = {
  status: 'idle',
  callId: null,
  callLogId: null,
  channelId: null,
  remoteStream: null,
  localStream: null,
  duration: 0,
  isMuted: false,
  isVideo: false,
  contactName: null,
  contactPhone: null,
  contactAvatar: null,
  direction: null,
};

// ICE servers for WebRTC connection
const iceServers: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export function useWebRTCCall() {
  const [state, setState] = useState<WebRTCCallState>(initialState);
  
  // All refs declared at the top - consistent order
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Sync localStreamRef with state (avoids stale closure in cleanup)
  useEffect(() => {
    localStreamRef.current = state.localStream;
  }, [state.localStream]);

  // Cleanup function - uses ref to avoid state dependency
  const cleanup = useCallback(() => {
    console.log('[WebRTC] Cleaning up call resources');
    
    // Stop duration timer
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    
    // Stop local stream tracks using ref
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    startTimeRef.current = null;
    setState(initialState);
  }, []); // No dependencies - uses refs

  // Start duration timer
  const startDurationTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    durationIntervalRef.current = setInterval(() => {
      if (startTimeRef.current) {
        setState(prev => ({
          ...prev,
          duration: Math.floor((Date.now() - startTimeRef.current!) / 1000),
        }));
      }
    }, 1000);
  }, []);

  // Get local media stream with permission diagnostics
  const getLocalStream = useCallback(async (video: boolean = false): Promise<MediaStream> => {
    try {
      // Tentar verificar permissão antes de solicitar
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          console.log('[WebRTC] Microphone permission status:', permissionStatus.state);
          
          if (permissionStatus.state === 'denied') {
            toast.error('Microfone bloqueado. Clique no cadeado ao lado da URL e permita o acesso.');
            throw new Error('Microphone permission denied');
          }
        } catch (permError) {
          // navigator.permissions.query pode não suportar 'microphone' em alguns browsers
          console.log('[WebRTC] Could not query microphone permission:', permError);
        }
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: video,
      });
      
      // Log detalhes do stream para diagnóstico
      const audioTracks = stream.getAudioTracks();
      console.log('[WebRTC] ✅ Got local stream with', audioTracks.length, 'audio track(s)');
      audioTracks.forEach((track, i) => {
        console.log(`[WebRTC] Audio track ${i}:`, {
          label: track.label,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
        });
      });
      
      return stream;
    } catch (error) {
      console.error('[WebRTC] ❌ Error getting local stream:', error);
      
      // Mensagens mais específicas baseadas no tipo de erro
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.message.includes('denied')) {
          toast.error('Microfone bloqueado. Clique no cadeado ao lado da URL e permita o acesso.');
        } else if (error.name === 'NotFoundError') {
          toast.error('Nenhum microfone encontrado. Conecte um microfone e tente novamente.');
        } else {
          toast.error('Não foi possível acessar o microfone. Verifique as permissões.');
        }
      }
      throw error;
    }
  }, []);

  // Create RTCPeerConnection and set SDP answer
  const createPeerConnection = useCallback(async (
    sdpOffer: string,
    localStream: MediaStream
  ): Promise<string> => {
    console.log('[WebRTC] Creating peer connection');
    
    const pc = new RTCPeerConnection({ iceServers });
    peerConnectionRef.current = pc;

    // Add local tracks to connection
    localStream.getTracks().forEach(track => {
      console.log('[WebRTC] Adding local track:', track.kind, 'enabled:', track.enabled, 'readyState:', track.readyState);
      pc.addTrack(track, localStream);
    });

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('[WebRTC] Received remote track');
      if (event.streams && event.streams[0]) {
        setState(prev => ({
          ...prev,
          remoteStream: event.streams[0],
        }));
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTC] ICE candidate:', event.candidate.candidate);
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setState(prev => ({ ...prev, status: 'active' }));
        startDurationTimer();
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        cleanup();
      }
    };

    // Set remote SDP offer
    await pc.setRemoteDescription({
      type: 'offer',
      sdp: sdpOffer,
    });

    // Create answer
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    console.log('[WebRTC] Created SDP answer');
    return answer.sdp || '';
  }, [cleanup, startDurationTimer]);

  // Answer incoming call
  const answerCall = useCallback(async (
    callId: string,
    callLogId: string,
    channelId: string,
    sdpOffer: string,
    contactInfo: { name: string; phone: string; avatar?: string }
  ) => {
    console.log('[WebRTC] Answering call:', callId);
    
    try {
      setState(prev => ({
        ...prev,
        status: 'connecting',
        callId,
        callLogId,
        channelId,
        contactName: contactInfo.name,
        contactPhone: contactInfo.phone,
        contactAvatar: contactInfo.avatar || null,
        direction: 'inbound',
      }));

      // Get local stream
      const localStream = await getLocalStream();
      setState(prev => ({ ...prev, localStream }));

      // Create peer connection and get SDP answer
      const sdpAnswer = await createPeerConnection(sdpOffer, localStream);

      // Send answer to Meta via edge function
      const { error } = await supabase.functions.invoke('cloudapi-call-action', {
        body: {
          channel_id: channelId,
          call_id: callId,
          action: 'answer',
          sdp_answer: sdpAnswer,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      console.log('[WebRTC] Call answered successfully');
      toast.success('Chamada atendida');

    } catch (error) {
      console.error('[WebRTC] Error answering call:', error);
      toast.error('Erro ao atender chamada');
      cleanup();
    }
  }, [getLocalStream, createPeerConnection, cleanup]);

  // Reject incoming call
  const rejectCall = useCallback(async (callId: string, channelId: string) => {
    console.log('[WebRTC] Rejecting call:', callId);
    
    try {
      const { error } = await supabase.functions.invoke('cloudapi-call-action', {
        body: {
          channel_id: channelId,
          call_id: callId,
          action: 'reject',
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      console.log('[WebRTC] Call rejected');
      cleanup();
    } catch (error) {
      console.error('[WebRTC] Error rejecting call:', error);
      toast.error('Erro ao rejeitar chamada');
    }
  }, [cleanup]);

  // Hangup active call
  const hangup = useCallback(async () => {
    console.log('[WebRTC] Hanging up call');
    
    if (!state.callId || !state.channelId) {
      cleanup();
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('cloudapi-call-action', {
        body: {
          channel_id: state.channelId,
          call_id: state.callId,
          action: 'hangup',
        },
      });

      if (error) {
        console.error('[WebRTC] Error hanging up:', error);
      }
    } catch (error) {
      console.error('[WebRTC] Error hanging up:', error);
    }

    cleanup();
    toast.info('Chamada encerrada');
  }, [state.callId, state.channelId, cleanup]);

  // Create SDP offer for outbound call
  const createSdpOffer = useCallback(async (localStream: MediaStream): Promise<string> => {
    console.log('[WebRTC] Creating SDP offer for outbound call');
    
    const pc = new RTCPeerConnection({ iceServers });
    peerConnectionRef.current = pc;

    // Add local tracks to connection
    localStream.getTracks().forEach(track => {
      console.log('[WebRTC] [Outbound] Adding local track:', track.kind, 'enabled:', track.enabled, 'readyState:', track.readyState);
      pc.addTrack(track, localStream);
    });

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('[WebRTC] Received remote track:', event.track.kind, 'enabled:', event.track.enabled);
      if (event.streams && event.streams[0]) {
        console.log('[WebRTC] Remote stream has', event.streams[0].getAudioTracks().length, 'audio tracks');
        setState(prev => ({
          ...prev,
          remoteStream: event.streams[0],
        }));
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTC] ICE candidate:', event.candidate.candidate);
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setState(prev => ({ ...prev, status: 'active' }));
        startDurationTimer();
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        cleanup();
      }
    };

    // Create offer
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: false,
    });
    await pc.setLocalDescription(offer);

    // Wait for ICE gathering to complete
    await new Promise<void>((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
      } else {
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === 'complete') {
            resolve();
          }
        };
        // Timeout after 5 seconds
        setTimeout(resolve, 5000);
      }
    });

    console.log('[WebRTC] SDP offer created');
    return pc.localDescription?.sdp || offer.sdp || '';
  }, [cleanup, startDurationTimer]);

  // Set SDP answer from Meta
  const setSdpAnswer = useCallback(async (sdpAnswer: string) => {
    if (!peerConnectionRef.current) {
      console.error('[WebRTC] No peer connection to set answer');
      return;
    }

    console.log('[WebRTC] Setting SDP answer');
    await peerConnectionRef.current.setRemoteDescription({
      type: 'answer',
      sdp: sdpAnswer,
    });
  }, []);

  // Initiate outbound call via Cloud API (uses tenant's active config)
  const initiateCall = useCallback(async (
    toNumber: string,
    contactId?: string,
    contactName?: string
  ) => {
    console.log('[WebRTC] Initiating call to:', toNumber);
    
    try {
      setState(prev => ({
        ...prev,
        status: 'connecting',
        contactPhone: toNumber,
        contactName: contactName || toNumber,
        direction: 'outbound',
      }));

      // Get local stream first to ensure permissions
      const localStream = await getLocalStream();
      setState(prev => ({ ...prev, localStream }));

      // Create WebRTC peer connection and generate SDP offer
      const sdpOffer = await createSdpOffer(localStream);
      console.log('[WebRTC] Generated SDP offer, length:', sdpOffer.length);

      // Initiate call via edge function with SDP offer
      const { data, error } = await supabase.functions.invoke('cloudapi-initiate-call', {
        body: {
          to: toNumber,
          contact_id: contactId,
          contact_name: contactName,
          sdp_offer: sdpOffer,
        },
      });

      if (error || !data?.success) {
        const details = (data as any)?.details;
        const metaUserMsg = details?.error_user_msg || details?.error_user_title;
        const baseMsg = metaUserMsg || (data as any)?.error || error?.message || 'Failed to initiate call';
        const suggestion = (data as any)?.suggestion;
        const message = suggestion ? `${baseMsg} — ${suggestion}` : baseMsg;
        throw new Error(message);
      }

      setState(prev => ({
        ...prev,
        callId: data.call_id,
        callLogId: data.call_log_id,
        channelId: data.channel_id || null,
        status: 'ringing',
      }));

      // If we got an SDP answer back, set it
      if (data.sdp_answer) {
        await setSdpAnswer(data.sdp_answer);
      }

      console.log('[WebRTC] Call initiated:', data.call_id);
      toast.info('Ligando...');

    } catch (error) {
      console.error('[WebRTC] Error initiating call:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao iniciar chamada');
      cleanup();
    }
  }, [getLocalStream, createSdpOffer, setSdpAnswer, cleanup]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (state.localStream) {
      const audioTrack = state.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setState(prev => ({ ...prev, isMuted: !audioTrack.enabled }));
      }
    }
  }, [state.localStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    state,
    answerCall,
    rejectCall,
    hangup,
    initiateCall,
    toggleMute,
    cleanup,
    setSdpAnswer,
  };
}
