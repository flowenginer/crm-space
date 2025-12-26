import { useState } from 'react';
import { 
  UserPlus, 
  Users, 
  Clock, 
  TrendingUp, 
  MessageSquare, 
  Target,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { LeadJourneyMetrics, ReturningLeadsMetrics, formatDuration } from '@/hooks/useLeadJourneyDashboard';
import { AssignmentTimeDistributionDialog } from './AssignmentTimeDistributionDialog';

interface JourneyKPICardsProps {
  metrics: LeadJourneyMetrics | undefined;
  returningMetrics?: ReturningLeadsMetrics;
  isLoading?: boolean;
}

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: 'primary' | 'green' | 'blue' | 'orange' | 'purple' | 'red';
  isLoading?: boolean;
  onClick?: () => void;
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

function KPICard({ title, value, subtitle, icon, color, isLoading, onClick }: KPICardProps) {
  const colors = colorVariants[color];
  const isClickable = !!onClick;

  return (
    <Card 
      className={`relative overflow-hidden bg-gradient-to-br ${colors.gradient} border-0 ${
        isClickable ? 'cursor-pointer hover:scale-[1.02] transition-transform duration-200' : ''
      }`}
      onClick={onClick}
    >
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

// Helper function to format currency
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function JourneyKPICards({ 
  metrics, 
  returningMetrics,
  isLoading 
}: JourneyKPICardsProps) {
  const [showDistributionDialog, setShowDistributionDialog] = useState(false);
  
  const totalConversations = returningMetrics?.totalConversations || 0;
  const newContacts = returningMetrics?.newContacts || 0;
  const returningContacts = returningMetrics?.returningContacts || 0;
  const conversions = metrics?.conversions || 0;
  const totalConvertedValue = metrics?.totalConvertedValue || 0;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard
          title="Conversas Iniciadas"
          value={totalConversations}
          subtitle="No período"
          icon={<MessageSquare className="h-5 w-5" />}
          color="primary"
          isLoading={isLoading}
        />

        <KPICard
          title="Novos Contatos"
          value={newContacts}
          subtitle={`${returningMetrics?.newContactRate?.toFixed(0) ?? 0}% do total`}
          icon={<UserPlus className="h-5 w-5" />}
          color="green"
          isLoading={isLoading}
        />

        <KPICard
          title="Retornantes"
          value={returningContacts}
          subtitle="Já tinham histórico"
          icon={<RefreshCw className="h-5 w-5" />}
          color="orange"
          isLoading={isLoading}
        />
        
        <KPICard
          title="Taxa Atribuição"
          value={`${metrics?.assignmentRate?.toFixed(0) ?? 0}%`}
          subtitle={`${metrics?.totalAssigned || 0} atribuídos`}
          icon={<Users className="h-5 w-5" />}
          color="blue"
          isLoading={isLoading}
        />
        
        <KPICard
          title="Tempo p/ Atribuição"
          value={formatDuration(metrics?.medianTimeToAssignment || 0)}
          subtitle="Mediana • Clique para detalhes"
          icon={<Clock className="h-5 w-5" />}
          color="purple"
          isLoading={isLoading}
          onClick={() => setShowDistributionDialog(true)}
        />
        
        <KPICard
          title="Conversões"
          value={conversions}
          subtitle={formatCurrency(totalConvertedValue)}
          icon={<Target className="h-5 w-5" />}
          color="green"
          isLoading={isLoading}
        />
      </div>

      <AssignmentTimeDistributionDialog
        open={showDistributionDialog}
        onOpenChange={setShowDistributionDialog}
        distribution={metrics?.assignmentTimeDistribution || []}
        median={metrics?.medianTimeToAssignment || 0}
        total={metrics?.assignmentDistributionTotal || 0}
      />
    </>
  );
}
