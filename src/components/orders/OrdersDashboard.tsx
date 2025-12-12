import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ShoppingCart, DollarSign, TrendingUp, Package, Clock, CheckCircle } from 'lucide-react';
import { Order } from '@/hooks/useOrders';

interface OrdersDashboardProps {
  orders: Order[];
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatCompact = (value: number) =>
  new Intl.NumberFormat('pt-BR', { notation: 'compact', compactDisplay: 'short' }).format(value);

export function OrdersDashboard({ orders }: OrdersDashboardProps) {
  // Calcular métricas
  const totalOrders = orders.length;
  const totalRevenue = orders
    .filter(o => o.status !== 'canceled')
    .reduce((sum, o) => sum + (o.total || 0), 0);
  const avgTicket = totalOrders > 0 ? totalRevenue / orders.filter(o => o.status !== 'canceled').length : 0;
  const pendingOrders = orders.filter(o => ['draft', 'pending', 'confirmed', 'processing'].includes(o.status)).length;
  const deliveredOrders = orders.filter(o => o.status === 'delivered').length;
  const canceledOrders = orders.filter(o => o.status === 'canceled').length;

  // Dados para o gráfico dos últimos 7 dias
  const last7Days: Record<string, { date: string; pedidos: number; faturamento: number }> = {};
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const key = date.toISOString().split('T')[0];
    const label = date.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' });
    last7Days[key] = { date: label, pedidos: 0, faturamento: 0 };
  }

  orders.forEach(order => {
    if (!order.created_at || order.status === 'canceled') return;
    const dateKey = order.created_at.split('T')[0];
    if (last7Days[dateKey]) {
      last7Days[dateKey].pedidos += 1;
      last7Days[dateKey].faturamento += order.total || 0;
    }
  });

  const chartData = Object.values(last7Days);

  // Top produtos (simulado - baseado nos pedidos)
  const productCount: Record<string, number> = {};
  // Em produção, isso viria dos order_items

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Total Pedidos</span>
            </div>
            <p className="text-2xl font-bold">{totalOrders}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Faturamento</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalRevenue)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Ticket Médio</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(avgTicket)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Pendentes</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{pendingOrders}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Entregues</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{deliveredOrders}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4 text-rose-500" />
              <span className="text-xs text-muted-foreground">Cancelados</span>
            </div>
            <p className="text-2xl font-bold text-rose-600">{canceledOrders}</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Vendas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vendas dos Últimos 7 Dias</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis 
                yAxisId="left"
                tickFormatter={formatCompact} 
                tick={{ fontSize: 12 }} 
                stroke="hsl(var(--muted-foreground))" 
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 12 }} 
                stroke="hsl(var(--muted-foreground))" 
              />
              <Tooltip
                formatter={(value: number, name: string) => 
                  name === 'faturamento' ? formatCurrency(value) : value
                }
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Bar yAxisId="left" dataKey="faturamento" name="Faturamento" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="pedidos" name="Pedidos" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
