import { useMemo } from 'react';
import { format } from 'date-fns';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  CreditCard,
  PiggyBank,
  AlertTriangle,
  Package,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useFinancialComparison,
  useFinancialTimeline,
  useCategoryBreakdown,
  useCashFlowProjection,
  useOrdersRevenue,
  useReceivablesAging,
  useAgentSalesPerformance,
  type FinancialReportFilters,
} from '@/hooks/useFinancialReports';

interface FinancialDashboardProps {
  filters: FinancialReportFilters;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatCompact = (value: number) =>
  new Intl.NumberFormat('pt-BR', { notation: 'compact', compactDisplay: 'short' }).format(value);

export function FinancialDashboard({ filters }: FinancialDashboardProps) {
  const { data: comparison, isLoading: loadingComparison } = useFinancialComparison(filters);
  const { data: timeline, isLoading: loadingTimeline } = useFinancialTimeline(filters, 'daily');
  const { data: categories, isLoading: loadingCategories } = useCategoryBreakdown(filters);
  const { data: cashflow, isLoading: loadingCashflow } = useCashFlowProjection();
  const { data: ordersData, isLoading: loadingOrders } = useOrdersRevenue(filters);
  const { data: agingData, isLoading: loadingAging } = useReceivablesAging();
  const { data: agentPerformance, isLoading: loadingAgents } = useAgentSalesPerformance(filters);

  const kpiCards = useMemo(() => {
    if (!comparison) return [];
    return [
      {
        title: 'Receitas',
        value: comparison.current.income,
        change: comparison.changes.income,
        icon: ArrowUpRight,
        color: 'text-emerald-500',
        bgColor: 'bg-emerald-500/10',
      },
      {
        title: 'Despesas',
        value: comparison.current.expense,
        change: comparison.changes.expense,
        icon: ArrowDownRight,
        color: 'text-rose-500',
        bgColor: 'bg-rose-500/10',
        invertChange: true,
      },
      {
        title: 'Saldo',
        value: comparison.current.balance,
        change: comparison.changes.balance,
        icon: Wallet,
        color: comparison.current.balance >= 0 ? 'text-emerald-500' : 'text-rose-500',
        bgColor: comparison.current.balance >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10',
      },
      {
        title: 'Saldo Atual (Contas)',
        value: cashflow?.currentBalance || 0,
        icon: PiggyBank,
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/10',
      },
    ];
  }, [comparison, cashflow]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loadingComparison ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-32 mb-1" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))
        ) : (
          kpiCards.map((kpi) => (
            <Card key={kpi.title} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-muted-foreground">{kpi.title}</span>
                  <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
                    <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                  </div>
                </div>
                <p className={`text-2xl font-bold ${kpi.color}`}>
                  {formatCurrency(kpi.value)}
                </p>
                {kpi.change !== undefined && (
                  <div className="flex items-center gap-1 mt-1">
                    {(kpi.invertChange ? -kpi.change : kpi.change) > 0 ? (
                      <TrendingUp className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-rose-500" />
                    )}
                    <span className={`text-xs ${
                      (kpi.invertChange ? -kpi.change : kpi.change) > 0 ? 'text-emerald-500' : 'text-rose-500'
                    }`}>
                      {Math.abs(kpi.change).toFixed(1)}% vs período anterior
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Timeline Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Receitas vs Despesas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTimeline ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis 
                  tickFormatter={(v) => formatCompact(v)} 
                  tick={{ fontSize: 12 }} 
                  stroke="hsl(var(--muted-foreground))" 
                />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar dataKey="receitas" name="Receitas" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesas" name="Despesas" fill="#EF4444" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="saldo" name="Saldo" stroke="#8B5CF6" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown - Income */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-500">
              <ArrowUpRight className="h-5 w-5" />
              Receitas por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingCategories ? (
              <Skeleton className="h-[250px] w-full" />
            ) : categories?.income && categories.income.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={categories.income}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {categories.income.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Nenhuma receita no período
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category Breakdown - Expense */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-rose-500">
              <ArrowDownRight className="h-5 w-5" />
              Despesas por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingCategories ? (
              <Skeleton className="h-[250px] w-full" />
            ) : categories?.expense && categories.expense.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={categories.expense}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {categories.expense.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Nenhuma despesa no período
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cash Flow Projection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Projeção de Fluxo de Caixa (Próximos 3 meses)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingCashflow ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={cashflow?.projection}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis 
                  tickFormatter={(v) => formatCompact(v)} 
                  tick={{ fontSize: 12 }} 
                  stroke="hsl(var(--muted-foreground))" 
                />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="saldoProjetado" 
                  name="Saldo Projetado" 
                  stroke="#8B5CF6" 
                  fill="#8B5CF6" 
                  fillOpacity={0.3} 
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders Revenue */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Vendas (Pedidos)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingOrders ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Faturamento</p>
                    <p className="text-xl font-bold text-emerald-500">
                      {formatCurrency(ordersData?.totalRevenue || 0)}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Ticket Médio</p>
                    <p className="text-xl font-bold">
                      {formatCurrency(ordersData?.avgTicket || 0)}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-lg bg-emerald-500/10">
                    <p className="text-lg font-semibold text-emerald-500">{ordersData?.completedOrders || 0}</p>
                    <p className="text-xs text-muted-foreground">Finalizados</p>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-500/10">
                    <p className="text-lg font-semibold text-amber-500">{ordersData?.pendingOrders || 0}</p>
                    <p className="text-xs text-muted-foreground">Pendentes</p>
                  </div>
                  <div className="p-3 rounded-lg bg-rose-500/10">
                    <p className="text-lg font-semibold text-rose-500">{ordersData?.canceledOrders || 0}</p>
                    <p className="text-xs text-muted-foreground">Cancelados</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Accounts Receivable Aging */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Contas a Receber (Aging)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingAging ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10">
                  <span className="text-sm">A vencer</span>
                  <span className="font-semibold text-emerald-500">
                    {formatCurrency(agingData?.aging.current || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10">
                  <span className="text-sm">1-30 dias vencido</span>
                  <span className="font-semibold text-amber-500">
                    {formatCurrency(agingData?.aging.overdue1to30 || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-orange-500/10">
                  <span className="text-sm">31-60 dias vencido</span>
                  <span className="font-semibold text-orange-500">
                    {formatCurrency(agingData?.aging.overdue31to60 || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-rose-500/10">
                  <span className="text-sm">61-90 dias vencido</span>
                  <span className="font-semibold text-rose-500">
                    {formatCurrency(agingData?.aging.overdue61to90 || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-red-600/10">
                  <span className="text-sm">90+ dias vencido</span>
                  <span className="font-semibold text-red-600">
                    {formatCurrency(agingData?.aging.overdue90plus || 0)}
                  </span>
                </div>
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Total em Atraso</span>
                    <span className="font-bold text-rose-500">
                      {formatCurrency(agingData?.totalOverdue || 0)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Agent Sales Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Performance de Vendas por Agente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingAgents ? (
            <Skeleton className="h-[200px] w-full" />
          ) : agentPerformance && agentPerformance.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">Agente</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Pedidos</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Faturamento</th>
                    <th className="text-right py-3 px-2 text-sm font-medium text-muted-foreground">Ticket Médio</th>
                  </tr>
                </thead>
                <tbody>
                  {agentPerformance.map((agent, index) => (
                    <tr key={agent.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                            index === 0 ? 'bg-amber-500 text-white' :
                            index === 1 ? 'bg-gray-400 text-white' :
                            index === 2 ? 'bg-amber-700 text-white' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {index + 1}
                          </span>
                          <span className="font-medium">{agent.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right">{agent.orders}</td>
                      <td className="py-3 px-2 text-right font-semibold text-emerald-500">
                        {formatCurrency(agent.revenue)}
                      </td>
                      <td className="py-3 px-2 text-right text-muted-foreground">
                        {formatCurrency(agent.avgTicket)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              Nenhuma venda no período selecionado
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
