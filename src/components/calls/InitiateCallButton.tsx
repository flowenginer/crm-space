import { Phone, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCallContext } from '@/providers/CallProvider';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface InitiateCallButtonProps {
  contactPhone: string;
  contactId?: string;
  contactName?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  showLabel?: boolean;
}

export function InitiateCallButton({
  contactPhone,
  contactId,
  contactName,
  variant = 'ghost',
  size = 'icon',
  className,
  showLabel = false,
}: InitiateCallButtonProps) {
  const { initiateCall, isInCall, callState } = useCallContext();

  const handleClick = async () => {
    if (isInCall) {
      toast.error('Você já está em uma chamada');
      return;
    }

    await initiateCall(contactPhone, contactId, contactName);
  };

  const isLoading = callState.status === 'connecting' || callState.status === 'ringing';

  if (size === 'icon' && !showLabel) {
    return (
      <Button
        variant={variant}
        size={size}
        className={cn("h-9 w-9", className)}
        onClick={handleClick}
        disabled={isInCall || isLoading}
        title="Iniciar chamada"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Phone className="h-4 w-4" />
        )}
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
      disabled={isInCall || isLoading}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
      ) : (
        <Phone className="h-4 w-4 mr-2" />
      )}
      {showLabel && 'Ligar'}
    </Button>
  );
}
