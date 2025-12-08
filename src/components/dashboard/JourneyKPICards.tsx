import { 
  UserPlus, 
  Users, 
  Clock, 
  TrendingUp, 
  MessageSquare, 
  Target,
  Loader2 
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { LeadJourneyMetrics, formatDuration } from '@/hooks/useLeadJourneyDashboard';

interface JourneyKPICardsProps {
  metrics: LeadJourneyMetrics | undefined;
  totalLeads: number;
  conversions: number;
  conversionRate: number;
  isLoading?: boolean;
}

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: 'primary' | 'green' | 'blue' | 'orange' | 'purple' | 'red';
  isLoading?: boolean;
}

const colorVariants = {
  primary: {
    gradient: 'from-primary/20 to-primary/5',
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary',
  },
  green: {
    gradient: 'from-green-500/20 to-green-500/5',
    iconBg: 'bg-green-500/10',
    iconColor: 'text-green-500',
  },
  blue: {
    gradient: 'from-blue-500/20 to-blue-500/5',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-500',
  },
  orange: {
    gradient: 'from-orange-500/20 to-orange-500/5',
    iconBg: 'bg-orange-500/10',
    iconColor: 'text-orange-500',
  },
  purple: {
    gradient: 'from-purple-500/20 to-purple-500/5',
    iconBg: 'bg-purple-500/10',
    iconColor: 'text-purple-500',
  },
  red: {
    gradient: 'from-red-500/20 to-red-500/5',
    iconBg: 'bg-red-500/10',
    iconColor: 'text-red-500',
  },
};

function KPICard({ title, value, subtitle, icon, color, isLoading }: KPICardProps) {
  const colors = colorVariants[color];

  return (
    <Card className={`relative overflow-hidden bg-gradient-to-br ${colors.gradient} border-0`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {title}
            </p>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <>
                <p className="text-2xl font-bold text-foreground">{value}</p>
                {subtitle && (
                  <p className="text-xs text-muted-foreground">{subtitle}</p>
                )}
              </>
            )}
          </div>
          <div className={`p-2 rounded-lg ${colors.iconBg}`}>
            <div className={colors.iconColor}>{icon}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function JourneyKPICards({ 
  metrics, 
  totalLeads, 
  conversions, 
  conversionRate,
  isLoading 
}: JourneyKPICardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <KPICard
        title="Leads no Período"
        value={totalLeads}
        icon={<UserPlus className="h-5 w-5" />}
        color="primary"
        isLoading={isLoading}
      />
      
      <KPICard
        title="Taxa Atribuição"
        value={`${metrics?.assignmentRate.toFixed(0) || 0}%`}
        subtitle={`${metrics?.totalAssigned || 0} atribuídos`}
        icon={<Users className="h-5 w-5" />}
        color="blue"
        isLoading={isLoading}
      />
      
      <KPICard
        title="Tempo p/ Atribuição"
        value={formatDuration(metrics?.avgTimeToAssignment || 0)}
        subtitle="Média"
        icon={<Clock className="h-5 w-5" />}
        color="orange"
        isLoading={isLoading}
      />
      
      <KPICard
        title="Tempo p/ Resposta"
        value={formatDuration(metrics?.avgTimeToFirstResponse || 0)}
        subtitle="Primeira resposta"
        icon={<MessageSquare className="h-5 w-5" />}
        color="purple"
        isLoading={isLoading}
      />
      
      <KPICard
        title="Conversões"
        value={conversions}
        subtitle={`${conversionRate.toFixed(1)}% taxa`}
        icon={<Target className="h-5 w-5" />}
        color="green"
        isLoading={isLoading}
      />
      
      <KPICard
        title="Taxa Resposta Lead"
        value={`${metrics?.leadResponseRate.toFixed(0) || 0}%`}
        subtitle="Leads responderam"
        icon={<TrendingUp className="h-5 w-5" />}
        color="primary"
        isLoading={isLoading}
      />
    </div>
  );
}
