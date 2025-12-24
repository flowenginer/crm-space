import { useSuperAdminTenants } from '@/hooks/useSuperAdminTenants';
import { useAllSuperAdmins } from '@/hooks/useSuperAdminManagement';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, Crown, Activity, TrendingUp, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function PlatformDashboard() {
  const { data: tenants = [], isLoading: tenantsLoading } = useSuperAdminTenants();
  const { data: superAdmins = [], isLoading: adminsLoading } = useAllSuperAdmins();

  const isLoading = tenantsLoading || adminsLoading;

  // Calculate stats
  const activeTenants = tenants.filter(t => t.is_active).length;
  const inactiveTenants = tenants.filter(t => !t.is_active).length;
  const totalUsers = tenants.reduce((sum, t) => sum + (t.user_count || 0), 0);
  const totalContacts = tenants.reduce((sum, t) => sum + (t.contact_count || 0), 0);

  const stats = [
    {
      title: 'Total de Tenants',
      value: tenants.length,
      description: `${activeTenants} ativos, ${inactiveTenants} inativos`,
      icon: Building2,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Super Admins',
      value: superAdmins.length,
      description: 'Administradores da plataforma',
      icon: Crown,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      title: 'Total de Usuários',
      value: totalUsers.toLocaleString(),
      description: 'Em todos os tenants',
      icon: Users,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Total de Contatos',
      value: totalContacts.toLocaleString(),
      description: 'Em todos os tenants',
      icon: Activity,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
  ];

  // Tenants by plan
  const planCounts = tenants.reduce((acc, t) => {
    const plan = t.plan_type || 'free';
    acc[plan] = (acc[plan] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Recent tenants (last 5)
  const recentTenants = [...tenants]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  // Tenants with warnings (near limits)
  const tenantsWithWarnings = tenants.filter(t => {
    const userPercent = (t.user_count || 0) / (t.max_users || 10) * 100;
    const contactPercent = (t.contact_count || 0) / (t.max_contacts || 1000) * 100;
    return userPercent > 80 || contactPercent > 80;
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard da Plataforma</h1>
        <p className="text-muted-foreground">
          Visão geral de todos os tenants e métricas da plataforma
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Grid with more details */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Tenants by Plan */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Tenants por Plano
            </CardTitle>
            <CardDescription>Distribuição de planos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(planCounts).map(([plan, count]) => (
              <div key={plan} className="flex items-center justify-between">
                <span className="capitalize font-medium">{plan}</span>
                <span className="text-muted-foreground">{count} tenants</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Tenants */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Tenants Recentes
            </CardTitle>
            <CardDescription>Últimos tenants criados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentTenants.map((tenant) => (
              <div key={tenant.id} className="flex items-center justify-between">
                <span className="font-medium truncate">{tenant.name}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(tenant.created_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Warnings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              Alertas
            </CardTitle>
            <CardDescription>Tenants próximos dos limites</CardDescription>
          </CardHeader>
          <CardContent>
            {tenantsWithWarnings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum alerta no momento
              </p>
            ) : (
              <div className="space-y-3">
                {tenantsWithWarnings.slice(0, 5).map((tenant) => (
                  <div key={tenant.id} className="flex items-center justify-between">
                    <span className="font-medium truncate">{tenant.name}</span>
                    <span className="text-xs text-warning">
                      {Math.round((tenant.user_count || 0) / (tenant.max_users || 10) * 100)}% usuários
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Total Conversations */}
      <Card>
        <CardHeader>
          <CardTitle>Métricas Agregadas</CardTitle>
          <CardDescription>Totais da plataforma</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-3xl font-bold text-primary">
                {totalContacts.toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground">Contatos Totais</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-3xl font-bold text-primary">
                {totalUsers.toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground">Usuários Totais</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
