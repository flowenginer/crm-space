import { KPICard } from '@/components/dashboard/KPICard';
import { type CustomerSuccessKPIs } from '@/hooks/useBusinessKPIs';
import { 
  Heart, 
  UserMinus, 
  UserPlus, 
  Smile, 
  Star,
  Activity,
  Users
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface CustomerSuccessKPISectionProps {
  data?: CustomerSuccessKPIs;
  isLoading: boolean;
}

export function CustomerSuccessKPISection({ data, isLoading }: CustomerSuccessKPISectionProps) {
  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getNPSColor = (nps: number) => {
    if (nps >= 50) return 'text-success';
    if (nps >= 0) return 'text-warning';
    return 'text-destructive';
  };

  const getNPSLabel = (nps: number) => {
    if (nps >= 75) return 'Excelente';
    if (nps >= 50) return 'Muito Bom';
    if (nps >= 0) return 'Bom';
    if (nps >= -50) return 'Ruim';
    return 'Crítico';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500">
          <Heart className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Sucesso do Cliente</h2>
          <p className="text-sm text-muted-foreground">Métricas de retenção e satisfação</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard
          title="Taxa de Churn"
          value={formatPercent(data?.churnRate || 0)}
          subtitle={`${data?.churnedContacts || 0} clientes perdidos`}
          icon={UserMinus}
          color="orange"
          trend={data?.churnRate ? {
            value: data.churnRate,
            isPositive: false, // Lower is better for churn
          } : undefined}
          isLoading={isLoading}
        />

        <KPICard
          title="Taxa de Reativação"
          value={formatPercent(data?.reactivationRate || 0)}
          subtitle={`${data?.reactivatedContacts || 0} clientes reativados`}
          icon={UserPlus}
          color="green"
          trend={data?.reactivationRate ? {
            value: data.reactivationRate,
            isPositive: true,
          } : undefined}
          isLoading={isLoading}
        />

        <KPICard
          title="CSAT"
          value={formatPercent(data?.csat || 0)}
          subtitle="Satisfação do cliente"
          icon={Smile}
          color="cyan"
          isLoading={isLoading}
        />

        <KPICard
          title="Base Ativa"
          value={data?.totalActiveContacts?.toLocaleString('pt-BR') || '0'}
          subtitle="Total de clientes ativos"
          icon={Users}
          color="purple"
          isLoading={isLoading}
        />
      </div>

      {/* NPS and Health Score Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* NPS Card */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" />
              NPS (Net Promoter Score)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className={`text-4xl font-bold ${getNPSColor(data?.nps || 0)}`}>
                {data?.nps || 0}
              </div>
              <div className="flex-1">
                <div className="text-sm text-muted-foreground mb-2">
                  {getNPSLabel(data?.nps || 0)}
                </div>
                <Progress 
                  value={((data?.nps || 0) + 100) / 2} 
                  className="h-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>-100</span>
                  <span>0</span>
                  <span>+100</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Health Score Card */}
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Health Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="relative">
                <svg className="w-20 h-20 transform -rotate-90">
                  <circle
                    cx="40"
                    cy="40"
                    r="36"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    className="text-muted"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="36"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="transparent"
                    strokeDasharray={`${((data?.healthScore || 0) / 100) * 226} 226`}
                    className="text-primary transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold text-foreground">
                    {data?.healthScore || 0}
                  </span>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <div className="text-sm">
                  <span className="text-muted-foreground">Baseado em:</span>
                </div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Taxa de Churn (40%)</li>
                  <li>• Reativação (20%)</li>
                  <li>• NPS (20%)</li>
                  <li>• CSAT (20%)</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
