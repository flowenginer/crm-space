import { KPICard } from '@/components/dashboard/KPICard';
import { type MarketingKPIs } from '@/hooks/useBusinessKPIs';
import { 
  DollarSign, 
  TrendingUp, 
  Target, 
  MousePointerClick,
  Users,
  BadgeCheck
} from 'lucide-react';

interface MarketingKPISectionProps {
  data?: MarketingKPIs;
  isLoading: boolean;
}

export function MarketingKPISection({ data, isLoading }: MarketingKPISectionProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500">
          <Target className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Marketing</h2>
          <p className="text-sm text-muted-foreground">Métricas de aquisição e performance de campanhas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard
          title="CAC (Custo de Aquisição)"
          value={formatCurrency(data?.cac || 0)}
          subtitle="Custo por cliente convertido"
          icon={DollarSign}
          color="blue"
          isLoading={isLoading}
        />

        <KPICard
          title="ROI de Marketing"
          value={formatPercent(data?.roi || 0)}
          subtitle="Retorno sobre investimento"
          icon={TrendingUp}
          color="green"
          trend={data?.roi ? {
            value: Math.abs(data.roi),
            isPositive: data.roi > 0,
          } : undefined}
          isLoading={isLoading}
        />

        <KPICard
          title="Taxa de Conversão"
          value={formatPercent(data?.conversionRate || 0)}
          subtitle={`${data?.conversions || 0} conversões de ${data?.leads || 0} leads`}
          icon={BadgeCheck}
          color="purple"
          isLoading={isLoading}
        />

        <KPICard
          title="CTR (Click-Through Rate)"
          value={formatPercent(data?.ctr || 0)}
          subtitle="Taxa de cliques nos anúncios"
          icon={MousePointerClick}
          color="cyan"
          isLoading={isLoading}
        />

        <KPICard
          title="Investimento Total"
          value={formatCurrency(data?.spend || 0)}
          subtitle="Gasto em Meta Ads"
          icon={DollarSign}
          color="orange"
          isLoading={isLoading}
        />

        <KPICard
          title="Leads Gerados"
          value={data?.leads?.toString() || '0'}
          subtitle="Novos contatos no período"
          icon={Users}
          color="pink"
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
