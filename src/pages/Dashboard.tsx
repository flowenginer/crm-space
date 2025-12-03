import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LayoutDashboard, Users, MessageSquare, TrendingUp } from 'lucide-react';

export default function Dashboard() {
  const stats = [
    { title: 'Total de Leads', value: '2,345', icon: Users, change: '+12%' },
    { title: 'Conversas Ativas', value: '156', icon: MessageSquare, change: '+5%' },
    { title: 'Taxa de Conversão', value: '23.5%', icon: TrendingUp, change: '+2.1%' },
    { title: 'Vendas do Mês', value: 'R$ 45.2K', icon: LayoutDashboard, change: '+18%' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="shadow-card hover:shadow-card-hover transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-success mt-1">{stat.change} vs mês anterior</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Placeholder Content */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Visão Geral</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-muted">
            <div className="text-center">
              <LayoutDashboard className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">Dashboard em construção</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Gráficos e métricas detalhadas serão adicionados em breve.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
