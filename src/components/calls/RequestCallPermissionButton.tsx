import { PhoneForwarded, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCallPermission } from '@/hooks/useCallPermission';
import { cn } from '@/lib/utils';

interface RequestCallPermissionButtonProps {
  contactId: string;
  contactPhone: string;
  conversationId: string;
  channelId?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  showLabel?: boolean;
}

export function RequestCallPermissionButton({
  contactId,
  contactPhone,
  conversationId,
  channelId,
  variant = 'outline',
  size = 'sm',
  className,
  showLabel = true,
}: RequestCallPermissionButtonProps) {
  const {
    hasPermission,
    isPending,
    canRequestAgain,
    requestPermission,
    isRequesting,
  } = useCallPermission({
    contactId,
    contactPhone,
    conversationId,
    channelId,
  });

  // Don't show if already has permission
  if (hasPermission) {
    return null;
  }

  // Don't show if pending and can't request again
  if (isPending && !canRequestAgain) {
    return null;
  }

  const handleClick = () => {
    requestPermission(undefined);
  };

  if (size === 'icon' && !showLabel) {
    return (
      <Button
        variant={variant}
        size={size}
        className={cn("h-9 w-9", className)}
        onClick={handleClick}
        disabled={isRequesting}
        title="Solicitar permissão para chamada"
      >
        {isRequesting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <PhoneForwarded className="h-4 w-4" />
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
      disabled={isRequesting}
    >
      {isRequesting ? (
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
      ) : (
        <PhoneForwarded className="h-4 w-4 mr-2" />
      )}
      {showLabel && 'Solicitar permissão'}
    </Button>
  );
}
