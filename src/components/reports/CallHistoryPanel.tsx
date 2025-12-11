import { useState, useMemo } from 'react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Phone,
  PhoneCall,
  PhoneMissed,
  PhoneOff,
  TrendingUp,
  Users,
  Calendar,
  Download,
  Filter,
  Search,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useAllCallLogs, useCallResults, useCallStats } from '@/hooks/useCallLogs';
import { useTeam } from '@/hooks/useTeam';
import { DateRange } from 'react-day-picker';

interface CallHistoryPanelProps {
  dateRange?: DateRange;
}

export function CallHistoryPanel({ dateRange }: CallHistoryPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUserId, setFilterUserId] = useState<string>('all');
  const [filterResultId, setFilterResultId] = useState<string>('all');

  const startDate = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const endDate = dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');

  const { data: callLogs = [], isLoading } = useAllCallLogs({
    startDate,
    endDate,
    userId: filterUserId !== 'all' ? filterUserId : undefined,
    resultId: filterResultId !== 'all' ? filterResultId : undefined,
  });
  const { data: callResults = [] } = useCallResults();
  const { data: callStats } = useCallStats({ startDate, endDate });
  const { data: team = [] } = useTeam();

  // Filter by search
  const filteredLogs = useMemo(() => {
    if (!searchQuery) return callLogs;
    const query = searchQuery.toLowerCase();
    return callLogs.filter(log =>
      log.contact?.full_name?.toLowerCase().includes(query) ||
      log.contact?.phone?.includes(query) ||
      log.notes?.toLowerCase().includes(query)
    );
  }, [callLogs, searchQuery]);

  // Stats calculations
  const stats = useMemo(() => {
    const total = callLogs.length;
    const answered = callLogs.filter(l => l.result?.name?.includes('Atendeu')).length;
    const noAnswer = callLogs.filter(l => l.result?.name === 'Não atendeu').length;
    const busy = callLogs.filter(l => l.result?.name === 'Ocupado').length;
    const answerRate = total > 0 ? Math.round((answered / total) * 100) : 0;

    return { total, answered, noAnswer, busy, answerRate };
  }, [callLogs]);

  // Chart data - results distribution
  const resultChartData = useMemo(() => {
    return callStats?.byResult || [];
  }, [callStats]);

  // Chart data - calls per day
  const dailyChartData = useMemo(() => {
    return callStats?.byDate?.map(item => ({
      date: format(new Date(item.date), 'dd/MM', { locale: ptBR }),
      ligações: item.count,
    })) || [];
  }, [callStats]);

  // Chart data - by agent
  const agentChartData = useMemo(() => {
    if (!callStats?.byUser) return [];
    
    return Object.entries(callStats.byUser).map(([userId, count]) => {
      const user = team.find(t => t.id === userId);
      return {
        name: user?.full_name || 'N/A',
        ligações: count,
      };
    }).sort((a, b) => b.ligações - a.ligações).slice(0, 10);
  }, [callStats, team]);

  const handleExport = () => {
    // Create CSV
    const headers = ['Data', 'Hora', 'Cliente', 'Telefone', 'Resultado', 'Agente', 'Observações'];
    const rows = filteredLogs.map(log => [
      format(new Date(log.call_date), 'dd/MM/yyyy'),
      log.call_time.substring(0, 5),
      log.contact?.full_name || '',
      log.contact?.phone || '',
      log.result?.name || '',
      log.user?.full_name || '',
      log.notes || '',
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `historico-ligacoes-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground font-medium">Total de Ligações</span>
            <div className="p-2 bg-primary/10 rounded-lg">
              <Phone size={20} className="text-primary" />
            </div>
          </div>
          <div className="text-3xl font-bold text-foreground mb-1">{stats.total}</div>
          <div className="text-sm text-muted-foreground">no período</div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground font-medium">Atendidas</span>
            <div className="p-2 bg-green-500/10 rounded-lg">
              <PhoneCall size={20} className="text-green-500" />
            </div>
          </div>
          <div className="text-3xl font-bold text-green-500 mb-1">{stats.answered}</div>
          <div className="text-sm text-muted-foreground">{stats.answerRate}% de sucesso</div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground font-medium">Não Atendeu</span>
            <div className="p-2 bg-red-500/10 rounded-lg">
              <PhoneMissed size={20} className="text-red-500" />
            </div>
          </div>
          <div className="text-3xl font-bold text-red-500 mb-1">{stats.noAnswer}</div>
          <div className="text-sm text-muted-foreground">tentativas</div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted-foreground font-medium">Ocupado/Outros</span>
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <PhoneOff size={20} className="text-amber-500" />
            </div>
          </div>
          <div className="text-3xl font-bold text-amber-500 mb-1">{stats.busy}</div>
          <div className="text-sm text-muted-foreground">tentativas</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-6">
        {/* Daily calls chart */}
        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-foreground mb-4">Ligações por Dia</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={dailyChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Line 
                type="monotone" 
                dataKey="ligações" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Results distribution */}
        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-foreground mb-4">Distribuição de Resultados</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={resultChartData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={2}
                dataKey="count"
                nameKey="name"
              >
                {resultChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* By agent */}
        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-foreground mb-4">Ligações por Agente</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={agentChartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis 
                type="category" 
                dataKey="name" 
                tick={{ fontSize: 12 }} 
                stroke="hsl(var(--muted-foreground))"
                width={80}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="ligações" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters and Table */}
      <div className="bg-card rounded-2xl border border-border shadow-sm">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente ou telefone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-[250px]"
              />
            </div>

            <Select value={filterUserId} onValueChange={setFilterUserId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por agente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os agentes</SelectItem>
                {team.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterResultId} onValueChange={setFilterResultId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por resultado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os resultados</SelectItem>
                {callResults.map(result => (
                  <SelectItem key={result.id} value={result.id}>
                    {result.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        </div>

        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Hora</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead>Agente</TableHead>
                <TableHead>Observações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhuma ligação encontrada no período selecionado.
                  </TableCell>
                </TableRow>
              ) : filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    {format(new Date(log.call_date), 'dd/MM/yyyy', { locale: ptBR })}
                  </TableCell>
                  <TableCell>{log.call_time.substring(0, 5)}</TableCell>
                  <TableCell className="font-medium">
                    {log.contact?.full_name || '-'}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {log.contact?.phone || '-'}
                  </TableCell>
                  <TableCell>
                    {log.result ? (
                      <Badge
                        variant="outline"
                        style={{ 
                          borderColor: log.result.color,
                          color: log.result.color,
                          backgroundColor: `${log.result.color}10`
                        }}
                      >
                        {log.result.name}
                      </Badge>
                    ) : '-'}
                  </TableCell>
                  <TableCell>{log.user?.full_name || '-'}</TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {log.notes || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
    </div>
  );
}
