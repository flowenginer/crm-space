import { Badge } from '@/components/ui/badge';
import { TicketPriority, PRIORITY_CONFIG } from '@/types/support';
import { AlertCircle, AlertTriangle, Minus, ChevronDown } from 'lucide-react';

interface TicketPriorityBadgeProps {
  priority: TicketPriority;
  className?: string;
  showIcon?: boolean;
}

const PRIORITY_ICONS: Record<TicketPriority, React.ReactNode> = {
  critical: <AlertCircle className="h-3 w-3" />,
  high: <AlertTriangle className="h-3 w-3" />,
  medium: <Minus className="h-3 w-3" />,
  low: <ChevronDown className="h-3 w-3" />,
};

export function TicketPriorityBadge({ priority, className, showIcon = true }: TicketPriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority];
  
  return (
    <Badge variant="secondary" className={`${config.color} ${className}`}>
      {showIcon && <span className="mr-1">{PRIORITY_ICONS[priority]}</span>}
      {config.label}
    </Badge>
  );
}
