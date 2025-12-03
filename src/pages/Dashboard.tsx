import { useState } from 'react';
import { 
  UserPlus, 
  MessageSquare, 
  Users, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  Calendar,
  Plus,
  BarChart3,
  DollarSign,
  ChevronDown,
  RotateCcw,
  Wallet
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';

// Mock data
const mockDashboardData = {
  wallet: 0.00,
  metrics: [
    {
      title: "Novos contatos",
      value: "1.056",
      change: "+12%",
      changeText: "vs mês anterior",
      trend: "up" as const,
      icon: UserPlus,
      gradient: "from-purple-500 to-pink-500"
    },
    {
      title: "Conversas respondidas",
      value: "849",
      change: "+5%",
      changeText: "vs mês anterior",
      trend: "up" as const,
      icon: MessageSquare,
      gradient: "from-blue-500 to-cyan-500"
    },
    {
      title: "Conversas interagidas",
      value: "1.625",
      change: "+8%",
      changeText: "vs mês anterior",
      trend: "up" as const,
      icon: Users,
      gradient: "from-green-500 to-emerald-500"
    },
    {
      title: "Tempo de resposta",
      value: "43 min",
      change: "-15%",
      changeText: "vs mês anterior",
      trend: "down" as const,
      icon: Clock,
      gradient: "from-orange-500 to-red-500"
    }
  ],
  chartData: [
    { date: '1/dez', newContacts: 420, answeredConversations: 310, interactedConversations: 500, responseTime: 125 },
    { date: '2/dez', newContacts: 380, answeredConversations: 320, interactedConversations: 650, responseTime: 95 },
    { date: '3/dez', newContacts: 256, answeredConversations: 219, interactedConversations: 475, responseTime: 150 },
  ],
  recentActivity: [
    { id: 1, text: 'Novo lead cadastrado', time: 'há 5 minutos' },
    { id: 2, text: 'Conversa iniciada', time: 'há 10 minutos' },
    { id: 3, text: 'Venda realizada', time: 'há 15 minutos' },
    { id: 4, text: 'Novo lead cadastrado', time: 'há 20 minutos' },
  ],
};

// Stat Card Component
interface StatCardProps {
  title: string;
  value: string;
  change: string;
  changeText: string;
  trend: 'up' | 'down';
  icon: React.ElementType;
  gradient: string;
}

function StatCard({ title, value, change, changeText, trend, icon: Icon, gradient }: StatCardProps) {
  const isPositive = trend === 'up';
  // For response time, down is good
  const isGoodTrend = title.includes('Tempo') ? trend === 'down' : trend === 'up';
  
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
              isGoodTrend ? 'text-success' : 'text-destructive'
            }`}>
              {isPositive ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              {change} {changeText}
            </p>
          </div>
        </div>
        <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  );
}

// Custom Tooltip for Chart
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 shadow-lg">
        <p className="font-semibold text-foreground mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-medium text-foreground">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { profile } = useAuth();
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(2025, 11, 1),
    to: new Date(2025, 11, 3),
  });
  const [selectedUser, setSelectedUser] = useState('all');
  const [selectedMetric, setSelectedMetric] = useState('conversations');

  const quickActions = [
    { title: 'Nova Conversa', icon: MessageSquare, gradient: 'from-blue-500 to-cyan-500', href: '/conversations' },
    { title: 'Adicionar Lead', icon: UserPlus, gradient: 'from-purple-500 to-pink-500', href: '/crm' },
    { title: 'Ver Relatório', icon: BarChart3, gradient: 'from-green-500 to-emerald-500', href: '/reports' },
    { title: 'Nova Venda', icon: DollarSign, gradient: 'from-pink-500 to-rose-500', href: '/crm' },
  ];

  return (
    <div className="space-y-8">
      {/* Header with Welcome + Wallet */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
        <div className="animate-slide-up">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Bem Vindo{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''} - Space Sports
          </h1>
          <p className="text-muted-foreground">
            Aqui estão algumas estatísticas da sua empresa
          </p>
        </div>
        
        {/* Wallet Card */}
        <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated w-full lg:w-auto lg:min-w-[280px] animate-scale-in">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-purple-100">
              <Wallet className="h-5 w-5 text-purple-600" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Minha carteira</p>
          </div>
          <p className="text-3xl font-bold text-foreground mb-4">
            R$ {mockDashboardData.wallet.toFixed(2).replace('.', ',')}
          </p>
          <Button className="w-full btn-gradient text-white rounded-xl hover:shadow-lg transition-all">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Saldo
          </Button>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="flex flex-wrap items-center gap-3 animate-fade-in">
        {/* Date Range Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              className="h-11 px-4 rounded-xl border-border/50 bg-card hover:bg-muted transition-all"
            >
              <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
              <span className="text-sm">
                {format(dateRange.from, 'dd/MM/yyyy', { locale: ptBR })} - {format(dateRange.to, 'dd/MM/yyyy', { locale: ptBR })}
              </span>
              <ChevronDown className="h-4 w-4 ml-2 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="range"
              selected={{ from: dateRange.from, to: dateRange.to }}
              onSelect={(range) => {
                if (range?.from && range?.to) {
                  setDateRange({ from: range.from, to: range.to });
                }
              }}
              numberOfMonths={2}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* User Filter */}
        <Select value={selectedUser} onValueChange={setSelectedUser}>
          <SelectTrigger className="h-11 w-[180px] rounded-xl border-border/50 bg-card">
            <SelectValue placeholder="Todos os usuários" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os usuários</SelectItem>
            <SelectItem value="diego">Diego</SelectItem>
            <SelectItem value="ian">Ian</SelectItem>
            <SelectItem value="lara">Lara</SelectItem>
          </SelectContent>
        </Select>

        {/* Reset Filters */}
        <Button variant="ghost" className="h-11 text-muted-foreground hover:text-primary">
          <RotateCcw className="h-4 w-4 mr-2" />
          Restaurar filtros
        </Button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right side buttons */}
        <Button className="h-11 btn-gradient text-white rounded-xl hover:shadow-lg transition-all">
          <Plus className="h-4 w-4 mr-2" />
          Métricas
        </Button>

        <Select value={selectedMetric} onValueChange={setSelectedMetric}>
          <SelectTrigger className="h-11 w-[150px] rounded-xl border-border/50 bg-card">
            <SelectValue placeholder="Conversas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="conversations">Conversas</SelectItem>
            <SelectItem value="sales">Vendas</SelectItem>
            <SelectItem value="leads">Leads</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {mockDashboardData.metrics.map((metric, index) => (
          <div 
            key={metric.title} 
            className="animate-slide-up"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <StatCard {...metric} />
          </div>
        ))}
      </div>

      {/* Main Chart */}
      <div className="bg-card rounded-2xl border border-border/50 p-6 md:p-8 shadow-elevated animate-fade-in">
        <h2 className="text-xl font-semibold text-foreground mb-6">Visão geral</h2>
        
        <div className="h-[350px] md:h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={mockDashboardData.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorInteracted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorContacts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorAnswered" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorResponse" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              
              <XAxis 
                dataKey="date" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              
              <Tooltip content={<CustomTooltip />} />
              
              <Legend 
                wrapperStyle={{ fontSize: '14px', paddingTop: '20px' }}
                iconType="circle"
              />
              
              <Area
                type="monotone"
                dataKey="interactedConversations"
                stroke="#10B981"
                strokeWidth={3}
                fill="url(#colorInteracted)"
                name="Conversas interagidas"
                dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
              
              <Area
                type="monotone"
                dataKey="newContacts"
                stroke="#3B82F6"
                strokeWidth={3}
                fill="url(#colorContacts)"
                name="Novos Contatos"
                dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
              
              <Area
                type="monotone"
                dataKey="answeredConversations"
                stroke="#F59E0B"
                strokeWidth={3}
                fill="url(#colorAnswered)"
                name="Conversas respondidas"
                dot={{ fill: '#F59E0B', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
              
              <Area
                type="monotone"
                dataKey="responseTime"
                stroke="#8B5CF6"
                strokeWidth={3}
                fill="url(#colorResponse)"
                name="Tempo de resposta"
                dot={{ fill: '#8B5CF6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated animate-slide-up">
          <h3 className="text-lg font-semibold text-foreground mb-4">Atividade Recente</h3>
          
          <div className="space-y-3">
            {mockDashboardData.recentActivity.map((activity) => (
              <div 
                key={activity.id} 
                className="flex items-center gap-4 p-3 hover:bg-muted/50 rounded-xl transition-colors cursor-pointer"
              >
                <div className="p-2.5 bg-purple-100 rounded-lg">
                  <UserPlus className="h-5 w-5 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{activity.text}</p>
                  <p className="text-xs text-muted-foreground">{activity.time}</p>
                </div>
                <div className="h-2.5 w-2.5 bg-success rounded-full animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated animate-slide-up" style={{ animationDelay: '100ms' }}>
          <h3 className="text-lg font-semibold text-foreground mb-4">Ações Rápidas</h3>
          
          <div className="grid grid-cols-2 gap-4">
            {quickActions.map((action) => (
              <button
                key={action.title}
                className="flex flex-col items-center justify-center p-6 rounded-xl bg-muted/50 hover:bg-muted border border-transparent hover:border-primary/20 transition-all duration-200 group"
              >
                <div className={`p-4 bg-gradient-to-br ${action.gradient} rounded-xl mb-3 group-hover:scale-110 transition-transform shadow-lg`}>
                  <action.icon className="h-6 w-6 text-white" />
                </div>
                <span className="text-sm font-medium text-foreground">{action.title}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
