import { Badge } from '@/components/ui/badge';
import { TicketCategory, CATEGORY_CONFIG } from '@/types/support';
import { Bug, Lightbulb, HelpCircle, TrendingUp, Zap, Shield } from 'lucide-react';

interface TicketCategoryBadgeProps {
  category: TicketCategory;
  className?: string;
  showIcon?: boolean;
}

const CATEGORY_ICONS: Record<TicketCategory, React.ReactNode> = {
  bug: <Bug className="h-3 w-3" />,
  feature: <Lightbulb className="h-3 w-3" />,
  question: <HelpCircle className="h-3 w-3" />,
  improvement: <TrendingUp className="h-3 w-3" />,
  performance: <Zap className="h-3 w-3" />,
  security: <Shield className="h-3 w-3" />,
};

export function TicketCategoryBadge({ category, className, showIcon = true }: TicketCategoryBadgeProps) {
  const config = CATEGORY_CONFIG[category];
  
  return (
    <Badge variant="secondary" className={`${config.color} ${className}`}>
      {showIcon && <span className="mr-1">{CATEGORY_ICONS[category]}</span>}
      {config.label}
    </Badge>
  );
}
