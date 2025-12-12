import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { FinancialTransaction, FinancialCategory } from '@/hooks/useFinancial';

interface FinancialChartsProps {
  transactions: FinancialTransaction[];
  categories: FinancialCategory[];
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatCompact = (value: number) =>
  new Intl.NumberFormat('pt-BR', { notation: 'compact', compactDisplay: 'short' }).format(value);

export function FinancialCharts({ transactions, categories }: FinancialChartsProps) {
  // Agrupar por categoria
  const incomeByCategory = transactions
    .filter(t => t.type === 'income' && t.status !== 'canceled')
    .reduce((acc, t) => {
      const catName = (t.category as FinancialCategory)?.name || 'Sem categoria';
      const catColor = (t.category as FinancialCategory)?.color || '#10B981';
      if (!acc[catName]) {
        acc[catName] = { name: catName, value: 0, color: catColor };
      }
      acc[catName].value += t.amount;
      return acc;
    }, {} as Record<string, { name: string; value: number; color: string }>);

  const expenseByCategory = transactions
    .filter(t => t.type === 'expense' && t.status !== 'canceled')
    .reduce((acc, t) => {
      const catName = (t.category as FinancialCategory)?.name || 'Sem categoria';
      const catColor = (t.category as FinancialCategory)?.color || '#EF4444';
      if (!acc[catName]) {
        acc[catName] = { name: catName, value: 0, color: catColor };
      }
      acc[catName].value += t.amount;
      return acc;
    }, {} as Record<string, { name: string; value: number; color: string }>);

  const incomeData = Object.values(incomeByCategory);
  const expenseData = Object.values(expenseByCategory);

  // Agrupar por dia (últimos 7 dias)
  const last7Days: Record<string, { date: string; receitas: number; despesas: number }> = {};
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const key = date.toISOString().split('T')[0];
    const label = date.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' });
    last7Days[key] = { date: label, receitas: 0, despesas: 0 };
  }

  transactions
    .filter(t => t.status !== 'canceled')
    .forEach(t => {
      const dateKey = t.due_date.split('T')[0];
      if (last7Days[dateKey]) {
        if (t.type === 'income') {
          last7Days[dateKey].receitas += t.amount;
        } else {
          last7Days[dateKey].despesas += t.amount;
        }
      }
    });

  const dailyData = Object.values(last7Days);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Receitas vs Despesas - Últimos 7 dias */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Movimentação dos Últimos 7 Dias</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tickFormatter={formatCompact} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
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
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Receitas por Categoria */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-emerald-600">
            <TrendingUp className="h-4 w-4" />
            Receitas por Categoria
          </CardTitle>
        </CardHeader>
        <CardContent>
          {incomeData.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              Nenhuma receita no período
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={incomeData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={false}
                >
                  {incomeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Despesas por Categoria */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-rose-600">
            <TrendingDown className="h-4 w-4" />
            Despesas por Categoria
          </CardTitle>
        </CardHeader>
        <CardContent>
          {expenseData.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              Nenhuma despesa no período
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={expenseData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  labelLine={false}
                >
                  {expenseData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
