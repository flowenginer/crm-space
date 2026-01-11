import { KPICard } from '@/components/dashboard/KPICard';
import { type FinancialKPIs } from '@/hooks/useBusinessKPIs';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Wallet,
  CreditCard,
  PiggyBank,
  BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface FinancialKPISectionProps {
  data?: FinancialKPIs;
  isLoading: boolean;
}

export function FinancialKPISection({ data, isLoading }: FinancialKPISectionProps) {
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

  const netBalance = data?.netBalance || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500">
          <DollarSign className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Financeiro</h2>
          <p className="text-sm text-muted-foreground">Métricas de receitas, despesas e fluxo de caixa</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard
          title="Receita Total"
          value={formatCurrency(data?.totalRevenue || 0)}
          subtitle="Receitas recebidas"
          icon={TrendingUp}
          color="green"
          isLoading={isLoading}
        />

        <KPICard
          title="Despesas Totais"
          value={formatCurrency(data?.totalExpenses || 0)}
          subtitle="Despesas pagas"
          icon={TrendingDown}
          color="orange"
          isLoading={isLoading}
        />

        <KPICard
          title="Saldo Líquido"
          value={formatCurrency(netBalance)}
          subtitle={netBalance >= 0 ? 'Resultado positivo' : 'Resultado negativo'}
          icon={Wallet}
          color={netBalance >= 0 ? 'green' : 'orange'}
          trend={{
            value: Math.abs(data?.operatingMargin || 0),
            isPositive: netBalance >= 0,
          }}
          isLoading={isLoading}
        />

        <KPICard
          title="A Receber"
          value={formatCurrency(data?.pendingReceivables || 0)}
          subtitle="Valores pendentes"
          icon={PiggyBank}
          color="blue"
          isLoading={isLoading}
        />

        <KPICard
          title="A Pagar"
          value={formatCurrency(data?.pendingPayables || 0)}
          subtitle="Contas pendentes"
          icon={CreditCard}
          color="pink"
          isLoading={isLoading}
        />

        <KPICard
          title="Margem Operacional"
          value={formatPercent(data?.operatingMargin || 0)}
          subtitle="Lucro / Receita"
          icon={BarChart3}
          color="purple"
          trend={{
            value: Math.abs(data?.operatingMargin || 0),
            isPositive: (data?.operatingMargin || 0) >= 0,
          }}
          isLoading={isLoading}
        />
      </div>

      {/* Financial Summary Card */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Resumo Financeiro
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-success/10 rounded-lg">
              <div className="text-2xl font-bold text-success">
                {formatCurrency(data?.totalRevenue || 0)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Recebido</div>
            </div>
            <div className="text-center p-4 bg-destructive/10 rounded-lg">
              <div className="text-2xl font-bold text-destructive">
                {formatCurrency(data?.totalExpenses || 0)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Pago</div>
            </div>
            <div className="text-center p-4 bg-info/10 rounded-lg">
              <div className="text-2xl font-bold text-info">
                {formatCurrency(data?.pendingReceivables || 0)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">A Receber</div>
            </div>
            <div className="text-center p-4 bg-warning/10 rounded-lg">
              <div className="text-2xl font-bold text-warning">
                {formatCurrency(data?.pendingPayables || 0)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">A Pagar</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
