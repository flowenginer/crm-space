import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  useSupportDashboardMetrics,
  useTechnicianRanking,
  useTicketsByTenant,
  useTicketsEvolution,
  useSupportTickets,
  useIsSupportTechnician,
} from '@/hooks/useSupportTickets';
import { SupportKPICards } from '@/components/support/SupportKPICards';
import { TicketCard } from '@/components/support/TicketCard';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  CalendarIcon, 
  Users, 
  Building, 
  TrendingUp,
  ArrowLeft,
  Settings,
  Clock,
  CheckCircle2
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function SupportDashboard() {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(subMonths(new Date(), 2)),
    to: endOfMonth(new Date()),
  });

  const { data: isTechnician, isLoading: checkingTechnician } = useIsSupportTechnician();
  const { data: metrics, isLoading: metricsLoading } = useSupportDashboardMetrics(dateRange.from, dateRange.to);
  const { data: technicianRanking, isLoading: rankingLoading } = useTechnicianRanking(dateRange.from, dateRange.to);
  const { data: ticketsByTenant, isLoading: tenantsLoading } = useTicketsByTenant();
  const { data: evolution, isLoading: evolutionLoading } = useTicketsEvolution(6);
  const { data: recentTickets, isLoading: ticketsLoading } = useSupportTickets();

  const quickFilters = [
    { label: 'Este mês', from: startOfMonth(new Date()), to: endOfMonth(new Date()) },
    { label: 'Últimos 3 meses', from: startOfMonth(subMonths(new Date(), 2)), to: endOfMonth(new Date()) },
    { label: 'Últimos 6 meses', from: startOfMonth(subMonths(new Date(), 5)), to: endOfMonth(new Date()) },
  ];

  // Prepare category data for pie chart
  const categoryData = metrics ? [
    { name: 'Bug', value: metrics.by_category.bug },
    { name: 'Feature', value: metrics.by_category.feature },
    { name: 'Dúvida', value: metrics.by_category.question },
    { name: 'Melhoria', value: metrics.by_category.improvement },
    { name: 'Performance', value: metrics.by_category.performance },
    { name: 'Segurança', value: metrics.by_category.security },
  ].filter(d => d.value > 0) : [];

  if (checkingTechnician) {
    return (
      <div className="container mx-auto py-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (!isTechnician) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              Você não tem permissão para acessar o dashboard de suporte.
            </p>
            <Button onClick={() => navigate('/suporte')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para Suporte
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6" />
            Dashboard de Suporte
          </h1>
          <p className="text-muted-foreground">
            Métricas e gestão de tickets
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {quickFilters.map((filter) => (
            <Button
              key={filter.label}
              variant={dateRange.from.getTime() === filter.from.getTime() ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateRange({ from: filter.from, to: filter.to })}
            >
              {filter.label}
            </Button>
          ))}
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("w-[200px] justify-start text-left font-normal")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(dateRange.from, 'dd/MM', { locale: ptBR })} - {format(dateRange.to, 'dd/MM', { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    setDateRange({ from: range.from, to: range.to });
                  }
                }}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>

          <Button variant="outline" size="sm" onClick={() => navigate('/admin/suporte/tecnicos')}>
            <Settings className="h-4 w-4 mr-2" />
            Técnicos
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <SupportKPICards metrics={metrics} isLoading={metricsLoading} />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Evolution Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Evolução Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            {evolutionLoading ? (
              <Skeleton className="h-[300px]" />
            ) : evolution && evolution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={evolution}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="created" 
                    name="Criados" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="resolved" 
                    name="Resolvidos" 
                    stroke="hsl(var(--chart-2))" 
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Sem dados disponíveis
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Tickets por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <Skeleton className="h-[300px]" />
            ) : categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Sem dados disponíveis
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Technician Ranking */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Ranking de Técnicos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rankingLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : technicianRanking && technicianRanking.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Técnico</TableHead>
                    <TableHead className="text-center">Atribuídos</TableHead>
                    <TableHead className="text-center">Resolvidos</TableHead>
                    <TableHead className="text-center">T. Médio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {technicianRanking.map((tech, index) => (
                    <TableRow key={tech.technician_id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {index < 3 && (
                            <Badge variant={index === 0 ? 'default' : 'secondary'}>
                              #{index + 1}
                            </Badge>
                          )}
                          {tech.technician_name}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{tech.tickets_assigned}</TableCell>
                      <TableCell className="text-center">
                        <span className="flex items-center justify-center gap-1">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          {tech.tickets_resolved}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="flex items-center justify-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          {tech.avg_resolution_hours}h
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                Nenhum técnico encontrado
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tickets by Tenant */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Tickets por Empresa
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tenantsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : ticketsByTenant && ticketsByTenant.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Abertos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ticketsByTenant.map((tenant) => (
                    <TableRow key={tenant.tenant_id}>
                      <TableCell className="font-medium">{tenant.tenant_name}</TableCell>
                      <TableCell className="text-center">{tenant.total_tickets}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={tenant.open_tickets > 5 ? 'destructive' : 'secondary'}>
                          {tenant.open_tickets}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                Nenhum ticket encontrado
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Tickets */}
      <Card>
        <CardHeader>
          <CardTitle>Tickets Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {ticketsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : recentTickets && recentTickets.length > 0 ? (
            <div className="space-y-4">
              {recentTickets.slice(0, 5).map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  onClick={() => navigate(`/suporte/${ticket.id}`)}
                  showTenant
                />
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              Nenhum ticket encontrado
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
