import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface RedirectCountdownProps {
  seconds: number;
  onComplete: () => void;
  channelName?: string;
}

export function RedirectCountdown({ seconds, onComplete, channelName }: RedirectCountdownProps) {
  const [countdown, setCountdown] = useState(seconds);

  useEffect(() => {
    if (countdown <= 0) {
      onComplete();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, onComplete]);

  return (
    <div className="text-center space-y-4 animate-fade-in">
      <div className="relative inline-flex items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <span className="absolute text-2xl font-bold">{countdown}</span>
      </div>
      
      <div className="space-y-1">
        <p className="text-lg font-medium">Redirecionando para o WhatsApp...</p>
        {channelName && (
          <p className="text-sm text-muted-foreground">
            Você será atendido por: {channelName}
          </p>
        )}
      </div>
      
      <p className="text-xs text-muted-foreground">
        Aguarde {countdown} segundo{countdown !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
