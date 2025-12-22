import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, UserCheck, Contact } from 'lucide-react';
import { TenantWithStats } from '@/hooks/useSuperAdminTenants';

interface TenantStatsCardsProps {
  tenants: TenantWithStats[];
}

export function TenantStatsCards({ tenants }: TenantStatsCardsProps) {
  const totalTenants = tenants.length;
  const activeTenants = tenants.filter(t => t.is_active).length;
  const totalUsers = tenants.reduce((acc, t) => acc + t.user_count, 0);
  const totalContacts = tenants.reduce((acc, t) => acc + t.contact_count, 0);

  const stats = [
    {
      title: 'Tenants',
      value: totalTenants,
      icon: Building2,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Ativos',
      value: activeTenants,
      icon: UserCheck,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Usuários',
      value: totalUsers,
      icon: Users,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Contatos',
      value: totalContacts.toLocaleString('pt-BR'),
      icon: Contact,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <div className={`p-2 rounded-lg ${stat.bgColor}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
