import { Badge } from '@/components/ui/badge';
import { TicketStatus, STATUS_CONFIG } from '@/types/support';

interface TicketStatusBadgeProps {
  status: TicketStatus;
  className?: string;
}

export function TicketStatusBadge({ status, className }: TicketStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  
  return (
    <Badge variant="secondary" className={`${config.color} ${className}`}>
      {config.label}
    </Badge>
  );
}
