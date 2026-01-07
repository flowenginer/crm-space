import { Users, MessageCircle, CheckCircle2, Target, XCircle, TrendingUp, Loader2 } from 'lucide-react';
import type { CampaignKPIs } from '@/hooks/useMarketingDashboard';

interface MarketingKPICardsProps {
  kpis: CampaignKPIs | undefined;
  isLoading: boolean;
}

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  gradient: string;
  isLoading?: boolean;
}

function KPICard({ title, value, subtitle, icon: Icon, gradient, isLoading }: KPICardProps) {
  return (
    <div className="bg-card rounded-2xl border border-border/50 p-5 shadow-elevated hover:shadow-elevated-lg transition-all duration-300 group">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="space-y-1">
            {isLoading ? (
              <div className="h-8 flex items-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <h3 className="text-2xl font-bold text-foreground tracking-tight">{value}</h3>
                {subtitle && (
                  <p className="text-xs text-muted-foreground">{subtitle}</p>
                )}
              </>
            )}
          </div>
        </div>
        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${gradient} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );
}

export function MarketingKPICards({ kpis, isLoading }: MarketingKPICardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <KPICard
        title="Total de Contatos"
        value={kpis?.totalContacts.toLocaleString('pt-BR') || '0'}
        subtitle="Entraram na campanha"
        icon={Users}
        gradient="from-blue-500 to-blue-600"
        isLoading={isLoading}
      />
      <KPICard
        title="Taxa de Resposta"
        value={`${kpis?.responseRate.toFixed(1) || '0'}%`}
        subtitle={`${kpis?.respondedContacts || 0} responderam`}
        icon={MessageCircle}
        gradient="from-green-500 to-emerald-500"
        isLoading={isLoading}
      />
      <KPICard
        title="Taxa de Conclusão"
        value={`${kpis?.completionRate.toFixed(1) || '0'}%`}
        subtitle={`${kpis?.completedContacts || 0} completaram`}
        icon={CheckCircle2}
        gradient="from-emerald-500 to-teal-500"
        isLoading={isLoading}
      />
      <KPICard
        title="Conversões"
        value={kpis?.conversions.toLocaleString('pt-BR') || '0'}
        subtitle={`${kpis?.conversionRate.toFixed(1) || '0'}% taxa`}
        icon={Target}
        gradient="from-purple-500 to-pink-500"
        isLoading={isLoading}
      />
      <KPICard
        title="Ativos"
        value={kpis?.activeContacts.toLocaleString('pt-BR') || '0'}
        subtitle="Aguardando resposta"
        icon={TrendingUp}
        gradient="from-orange-500 to-amber-500"
        isLoading={isLoading}
      />
      <KPICard
        title="Cancelados"
        value={kpis?.cancelledContacts.toLocaleString('pt-BR') || '0'}
        subtitle="Saíram da campanha"
        icon={XCircle}
        gradient="from-rose-500 to-red-500"
        isLoading={isLoading}
      />
    </div>
  );
}
