import { Users, MessageSquare, TrendingUp, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react';

// Stats Card Component
interface StatCardProps {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative';
  icon: React.ElementType;
}

function StatCard({ title, value, change, changeType, icon: Icon }: StatCardProps) {
  return (
    <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated hover:shadow-elevated-lg transition-all duration-300 group">
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">
            {title}
          </p>
          <div className="space-y-1">
            <h3 className="text-3xl font-bold text-foreground tracking-tight">
              {value}
            </h3>
            <p className={`text-sm font-medium flex items-center gap-1 ${
              changeType === 'positive' ? 'text-success' : 'text-destructive'
            }`}>
              {changeType === 'positive' ? (
                <ArrowUpRight className="h-4 w-4" />
              ) : (
                <ArrowDownRight className="h-4 w-4" />
              )}
              {change} vs mês anterior
            </p>
          </div>
        </div>
        <div className="p-3 rounded-xl icon-gradient shadow-lg group-hover:scale-110 transition-transform duration-300">
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const stats = [
    { 
      title: 'Total de Leads', 
      value: '2,345', 
      change: '+12%',
      changeType: 'positive' as const,
      icon: Users 
    },
    { 
      title: 'Conversas Ativas', 
      value: '156', 
      change: '+5%',
      changeType: 'positive' as const,
      icon: MessageSquare 
    },
    { 
      title: 'Taxa de Conversão', 
      value: '23.5%', 
      change: '+2.1%',
      changeType: 'positive' as const,
      icon: TrendingUp 
    },
    { 
      title: 'Vendas do Mês', 
      value: 'R$ 45.2K', 
      change: '+18%',
      changeType: 'positive' as const,
      icon: DollarSign 
    },
  ];

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <div 
            key={stat.title} 
            className="animate-slide-up"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <StatCard {...stat} />
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
          <h2 className="text-xl font-semibold text-foreground mb-6">
            Atividade Recente
          </h2>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((item) => (
              <div 
                key={item}
                className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <Users className="h-5 w-5 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    Novo lead cadastrado
                  </p>
                  <p className="text-xs text-muted-foreground">
                    há {item * 5} minutos
                  </p>
                </div>
                <div className="h-2 w-2 rounded-full bg-success"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
          <h2 className="text-xl font-semibold text-foreground mb-6">
            Ações Rápidas
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: MessageSquare, label: 'Nova Conversa', color: 'bg-blue-500' },
              { icon: Users, label: 'Adicionar Lead', color: 'bg-purple-500' },
              { icon: TrendingUp, label: 'Ver Relatório', color: 'bg-green-500' },
              { icon: DollarSign, label: 'Nova Venda', color: 'bg-pink-500' },
            ].map((action) => (
              <button
                key={action.label}
                className="flex flex-col items-center gap-3 p-6 rounded-xl bg-muted/50 hover:bg-muted border border-transparent hover:border-primary/20 transition-all group"
              >
                <div className={`p-3 rounded-xl ${action.color} shadow-lg group-hover:scale-110 transition-transform`}>
                  <action.icon className="h-6 w-6 text-white" />
                </div>
                <span className="text-sm font-medium text-foreground">
                  {action.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Overview Section */}
      <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
        <h2 className="text-xl font-semibold text-foreground mb-6">
          Visão Geral
        </h2>
        <div className="flex h-64 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 rounded-2xl icon-gradient flex items-center justify-center mb-4">
              <TrendingUp className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Gráficos em desenvolvimento
            </h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm">
              Gráficos de vendas, conversão e métricas detalhadas serão adicionados em breve.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
