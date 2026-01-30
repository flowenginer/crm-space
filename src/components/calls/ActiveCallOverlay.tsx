import { useRef, useEffect, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCallContext } from '@/providers/CallProvider';
import { cn } from '@/lib/utils';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function ActiveCallOverlay() {
  const { callState, hangupCall, toggleMute, isInCall } = useCallContext();
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [needsAudioEnable, setNeedsAudioEnable] = useState(false);

  // Connect remote stream to audio element for playback
  useEffect(() => {
    const audioEl = remoteAudioRef.current;
    const stream = callState.remoteStream;
    
    if (audioEl && stream) {
      console.log('[ActiveCall] Connecting remote stream to audio element, tracks:', stream.getAudioTracks().length);
      stream.getAudioTracks().forEach(track => {
        console.log('[ActiveCall] Remote audio track:', track.kind, 'enabled:', track.enabled, 'readyState:', track.readyState);
      });
      
      // Garantir que audio não está mudo
      audioEl.muted = false;
      audioEl.volume = 1;
      audioEl.srcObject = stream;
      
      audioEl.play()
        .then(() => {
          console.log('[ActiveCall] ✅ Audio playback started successfully');
          setNeedsAudioEnable(false);
        })
        .catch(err => {
          console.error('[ActiveCall] ❌ Failed to play remote audio:', err);
          // Se for erro de autoplay (NotAllowedError), mostrar botão
          if (err.name === 'NotAllowedError') {
            console.log('[ActiveCall] Autoplay blocked, showing enable button');
            setNeedsAudioEnable(true);
          }
        });
    }
    
    return () => {
      if (audioEl) {
        audioEl.srcObject = null;
      }
    };
  }, [callState.remoteStream]);

  // Handler para ativar áudio manualmente (bypass autoplay)
  const handleEnableAudio = () => {
    const audioEl = remoteAudioRef.current;
    if (audioEl) {
      audioEl.muted = false;
      audioEl.volume = 1;
      audioEl.play()
        .then(() => {
          console.log('[ActiveCall] ✅ Manual audio playback started');
          setNeedsAudioEnable(false);
        })
        .catch(err => {
          console.error('[ActiveCall] ❌ Manual audio failed:', err);
        });
    }
  };

  if (!isInCall || callState.status === 'idle') {
    return null;
  }

  const statusText = {
    ringing: 'Chamando...',
    connecting: 'Conectando...',
    active: formatDuration(callState.duration),
    ended: 'Chamada encerrada',
  }[callState.status];

  const initials = callState.contactName
    ? callState.contactName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      {/* Hidden audio element for remote stream playback */}
      <audio ref={remoteAudioRef} autoPlay playsInline />
      
      <div className="bg-card border border-border rounded-2xl shadow-xl p-4 min-w-[280px]">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={callState.contactAvatar || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">
              {callState.contactName || 'Desconhecido'}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              {callState.contactPhone}
            </p>
          </div>

          <div className={cn(
            "px-2 py-1 rounded-full text-xs font-medium",
            callState.status === 'active' && "bg-green-500/10 text-green-600",
            callState.status === 'connecting' && "bg-yellow-500/10 text-yellow-600",
            callState.status === 'ringing' && "bg-blue-500/10 text-blue-600",
          )}>
            {statusText}
          </div>
        </div>

        {/* Call direction indicator */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mb-4">
          <Phone className="h-3 w-3" />
          <span>
            {callState.direction === 'inbound' ? 'Chamada recebida' : 'Chamada realizada'}
          </span>
        </div>

        {/* Audio enable button (shows when autoplay is blocked) */}
        {needsAudioEnable && callState.status === 'active' && (
          <div className="mb-4">
            <Button 
              variant="outline" 
              className="w-full gap-2 bg-yellow-500/10 border-yellow-500/30 text-yellow-700 hover:bg-yellow-500/20"
              onClick={handleEnableAudio}
            >
              <Volume2 className="h-4 w-4" />
              Ativar áudio
            </Button>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          {/* Mute button */}
          <Button
            variant={callState.isMuted ? "destructive" : "secondary"}
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={toggleMute}
            disabled={callState.status !== 'active'}
          >
            {callState.isMuted ? (
              <MicOff className="h-5 w-5" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </Button>

          {/* Hangup button */}
          <Button
            variant="destructive"
            size="icon"
            className="h-14 w-14 rounded-full"
            onClick={hangupCall}
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
        </div>

        {/* Audio indicator */}
        {callState.status === 'active' && (
          <div className="mt-4 flex items-center justify-center gap-1">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-1 bg-green-500 rounded-full animate-pulse",
                  i === 0 && "h-2 animation-delay-0",
                  i === 1 && "h-4 animation-delay-100",
                  i === 2 && "h-6 animation-delay-200",
                  i === 3 && "h-4 animation-delay-300",
                  i === 4 && "h-2 animation-delay-400",
                )}
                style={{
                  animationDelay: `${i * 100}ms`,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
