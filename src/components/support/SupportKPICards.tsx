import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SupportDashboardMetrics } from '@/types/support';
import { 
  Ticket, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Timer, 
  MessageSquare,
  Hourglass,
  XCircle
} from 'lucide-react';

interface SupportKPICardsProps {
  metrics?: SupportDashboardMetrics | null;
  isLoading?: boolean;
}

interface KPICardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

function KPICard({ title, value, icon, description, variant = 'default' }: KPICardProps) {
  const variantStyles = {
    default: 'bg-card',
    success: 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800',
    warning: 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800',
    danger: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',
  };

  return (
    <Card className={variantStyles[variant]}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SupportKPICards({ metrics, isLoading }: SupportKPICardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  const criticalCount = metrics.by_priority.critical;

  return (
    <div className="space-y-4">
      {/* Main KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPICard
          title="Total de Tickets"
          value={metrics.total_tickets}
          icon={<Ticket className="h-5 w-5 text-primary" />}
        />
        <KPICard
          title="Abertos"
          value={metrics.open_tickets}
          icon={<MessageSquare className="h-5 w-5 text-blue-500" />}
          variant={metrics.open_tickets > 20 ? 'warning' : 'default'}
        />
        <KPICard
          title="Em Andamento"
          value={metrics.in_progress}
          icon={<Hourglass className="h-5 w-5 text-yellow-500" />}
        />
        <KPICard
          title="Resolvidos"
          value={metrics.resolved}
          icon={<CheckCircle2 className="h-5 w-5 text-green-500" />}
          variant="success"
        />
        <KPICard
          title="Fechados"
          value={metrics.closed}
          icon={<XCircle className="h-5 w-5 text-gray-500" />}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          title="Críticos Pendentes"
          value={criticalCount}
          icon={<AlertCircle className="h-5 w-5 text-red-500" />}
          variant={criticalCount > 0 ? 'danger' : 'default'}
        />
        <KPICard
          title="T. Primeira Resposta"
          value={`${metrics.avg_first_response_hours}h`}
          icon={<Timer className="h-5 w-5 text-purple-500" />}
          description="Média de tempo"
        />
        <KPICard
          title="T. Resolução"
          value={`${metrics.avg_resolution_hours}h`}
          icon={<Clock className="h-5 w-5 text-orange-500" />}
          description="Média de tempo"
        />
        <KPICard
          title="Aguardando Resposta"
          value={metrics.waiting_response}
          icon={<MessageSquare className="h-5 w-5 text-purple-500" />}
        />
      </div>
    </div>
  );
}
