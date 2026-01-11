import { KPICard } from '@/components/dashboard/KPICard';
import { type CommercialKPIs } from '@/hooks/useBusinessKPIs';
import { 
  ShoppingCart, 
  TrendingUp, 
  TrendingDown,
  DollarSign, 
  Receipt,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface CommercialKPISectionProps {
  data?: CommercialKPIs;
  isLoading: boolean;
}

export function CommercialKPISection({ data, isLoading }: CommercialKPISectionProps) {
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

  const maxChannelValue = Math.max(...(data?.salesByChannel?.map(c => c.value) || [1]));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500">
          <ShoppingCart className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Comercial</h2>
          <p className="text-sm text-muted-foreground">Métricas de vendas e faturamento</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard
          title="Faturamento Total"
          value={formatCurrency(data?.totalRevenue || 0)}
          subtitle={`${data?.totalOrders || 0} pedidos fechados`}
          icon={DollarSign}
          color="green"
          isLoading={isLoading}
        />

        <KPICard
          title="Ticket Médio"
          value={formatCurrency(data?.avgTicket || 0)}
          subtitle="Valor médio por venda"
          icon={Receipt}
          color="blue"
          isLoading={isLoading}
        />

        <KPICard
          title="Taxa de Conversão"
          value={formatPercent(data?.salesConversionRate || 0)}
          subtitle="Leads convertidos em vendas"
          icon={TrendingUp}
          color="purple"
          isLoading={isLoading}
        />

        <KPICard
          title="Crescimento MoM"
          value={formatPercent(Math.abs(data?.growthMoM || 0))}
          subtitle="Comparado ao mês anterior"
          icon={(data?.growthMoM || 0) >= 0 ? ArrowUpRight : ArrowDownRight}
          color={(data?.growthMoM || 0) >= 0 ? 'green' : 'orange'}
          trend={{
            value: Math.abs(data?.growthMoM || 0),
            isPositive: (data?.growthMoM || 0) >= 0,
          }}
          isLoading={isLoading}
        />

        <KPICard
          title="Crescimento YoY"
          value={formatPercent(Math.abs(data?.growthYoY || 0))}
          subtitle="Comparado ao ano anterior"
          icon={(data?.growthYoY || 0) >= 0 ? ArrowUpRight : ArrowDownRight}
          color={(data?.growthYoY || 0) >= 0 ? 'green' : 'orange'}
          trend={{
            value: Math.abs(data?.growthYoY || 0),
            isPositive: (data?.growthYoY || 0) >= 0,
          }}
          isLoading={isLoading}
        />

        <KPICard
          title="Total de Pedidos"
          value={data?.totalOrders?.toString() || '0'}
          subtitle="Vendas realizadas"
          icon={ShoppingCart}
          color="cyan"
          isLoading={isLoading}
        />
      </div>

      {/* Sales by Channel */}
      {data?.salesByChannel && data.salesByChannel.length > 0 && (
        <Card className="bg-card border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Vendas por Canal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.salesByChannel.slice(0, 5).map((channel) => (
              <div key={channel.channel} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground font-medium">{channel.channel}</span>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>{channel.orders} pedidos</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(channel.value)}
                    </span>
                  </div>
                </div>
                <Progress 
                  value={(channel.value / maxChannelValue) * 100} 
                  className="h-2"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
