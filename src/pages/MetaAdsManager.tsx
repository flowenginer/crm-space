import { useState, useMemo } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  RefreshCw, Calendar as CalendarIcon, TrendingUp, DollarSign, 
  MousePointer, Eye, Users, Target, Loader2, Unplug, Facebook,
  ChevronUp, ChevronDown, MessageCircle
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, startOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { 
  useMetaAccounts, 
  useMetaAccountInsights, 
  useCampaignsWithInsights,
  useDailyInsights,
  useSyncMetaAccount,
  useDeleteMetaAccount 
} from '@/hooks/useMetaAds';
import { MetaConnect } from '@/components/meta/MetaConnect';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip
} from 'recharts';
import { DashboardGrid, DashboardCardConfig } from '@/components/dashboard/DashboardGrid';

// Preset date ranges
const getPresetRanges = () => {
  const today = new Date();
  return [
    { label: 'Hoje', range: { from: startOfDay(today), to: endOfDay(today) } },
    { label: 'Ontem', range: { from: startOfDay(subDays(today, 1)), to: endOfDay(subDays(today, 1)) } },
    { label: 'Esta Semana', range: { from: startOfWeek(today, { weekStartsOn: 1 }), to: endOfDay(today) } },
    { label: 'Este Mês', range: { from: startOfMonth(today), to: endOfMonth(today) } },
    { label: 'Últimos 7 dias', range: { from: startOfDay(subDays(today, 6)), to: endOfDay(today) } },
    { label: 'Últimos 30 dias', range: { from: startOfDay(subDays(today, 29)), to: endOfDay(today) } },
  ];
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const chartConfig = {
  spend: { label: 'Gasto', color: '#3b82f6' },
  clicks: { label: 'Cliques', color: '#10b981' },
  conversions: { label: 'Conversões', color: '#f59e0b' },
  impressions: { label: 'Impressões', color: '#8b5cf6' }
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

function StatCard({ title, value, icon: Icon, description, trend }: {
  title: string;
  value: string;
  icon: React.ElementType;
  description?: string;
  trend?: { value: number; positive: boolean };
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <p className={cn(
            "text-xs mt-1",
            trend.positive ? "text-green-600" : "text-red-600"
          )}>
            {trend.positive ? "+" : ""}{trend.value}% vs período anterior
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function MetaAdsManager() {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date()
  });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const { data: accounts, isLoading: accountsLoading } = useMetaAccounts();
  const { mutate: syncAccount, isPending: isSyncing } = useSyncMetaAccount();
  const { mutate: deleteAccount } = useDeleteMetaAccount();

  // Use startOfDay to ensure correct local timezone interpretation
  const dateFrom = dateRange?.from ? format(startOfDay(dateRange.from), 'yyyy-MM-dd') : undefined;
  const dateTo = dateRange?.to ? format(startOfDay(dateRange.to), 'yyyy-MM-dd') : undefined;

  const presetRanges = getPresetRanges();

  const { data: insights, isLoading: insightsLoading } = useMetaAccountInsights(
    selectedAccountId, dateFrom, dateTo
  );
  const { data: campaigns, isLoading: campaignsLoading } = useCampaignsWithInsights(
    selectedAccountId, dateFrom, dateTo
  );
  const { data: dailyData, isLoading: dailyLoading } = useDailyInsights(
    selectedAccountId, dateFrom, dateTo
  );

  // Auto-select first account
  if (accounts && accounts.length > 0 && !selectedAccountId) {
    setSelectedAccountId(accounts[0].id);
  }

  const selectedAccount = accounts?.find(a => a.id === selectedAccountId);

  const handleSync = () => {
    if (selectedAccountId) {
      syncAccount({ accountId: selectedAccountId, dateFrom, dateTo });
    }
  };

  const handleDisconnect = () => {
    if (selectedAccountId && confirm('Deseja realmente desconectar esta conta?')) {
      deleteAccount(selectedAccountId);
      setSelectedAccountId(null);
    }
  };

  // Prepare pie chart data
  const pieData = campaigns?.slice(0, 6).map(c => ({
    name: c.name.length > 20 ? c.name.substring(0, 20) + '...' : c.name,
    value: c.insights?.spend || 0
  })) || [];

  // Prepare daily chart data
  const chartData = dailyData?.map(d => ({
    date: format(new Date(d.date), 'dd/MM'),
    spend: d.spend,
    clicks: d.clicks,
    conversions: d.conversions
  })) || [];

  // Filter and sort campaigns
  const filteredAndSortedCampaigns = useMemo(() => {
    if (!campaigns) return [];
    
    let result = statusFilter === 'all' 
      ? campaigns 
      : campaigns.filter(c => c.status === statusFilter);
    
    if (sortConfig) {
      result = [...result].sort((a, b) => {
        let aValue: any, bValue: any;
        
        switch (sortConfig.key) {
          case 'name': aValue = a.name || ''; bValue = b.name || ''; break;
          case 'status': aValue = a.status || ''; bValue = b.status || ''; break;
          case 'impressions': aValue = a.insights?.impressions || 0; bValue = b.insights?.impressions || 0; break;
          case 'clicks': aValue = a.insights?.clicks || 0; bValue = b.insights?.clicks || 0; break;
          case 'ctr': aValue = a.insights?.ctr || 0; bValue = b.insights?.ctr || 0; break;
          case 'spend': aValue = a.insights?.spend || 0; bValue = b.insights?.spend || 0; break;
          case 'conversations': aValue = a.conversationsStarted || 0; bValue = b.conversationsStarted || 0; break;
          case 'ctwLeads': aValue = a.ctwLeads || 0; bValue = b.ctwLeads || 0; break;
          case 'realCpl': aValue = a.realCpl || 0; bValue = b.realCpl || 0; break;
          default: return 0;
        }
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return result;
  }, [campaigns, statusFilter, sortConfig]);

  // Sortable header component
  const SortableHeader = ({ children, sortKey, className }: { 
    children: React.ReactNode; 
    sortKey: string; 
    className?: string;
  }) => {
    const isActive = sortConfig?.key === sortKey;
    const direction = isActive ? sortConfig.direction : null;
    
    const handleSort = () => {
      if (!isActive) {
        setSortConfig({ key: sortKey, direction: 'desc' });
      } else if (direction === 'desc') {
        setSortConfig({ key: sortKey, direction: 'asc' });
      } else {
        setSortConfig(null);
      }
    };
    
    return (
      <TableHead 
        className={cn("cursor-pointer hover:bg-muted/50 select-none", className)}
        onClick={handleSort}
      >
        <div className="flex items-center gap-1">
          {children}
          <div className="flex flex-col">
            <ChevronUp className={cn(
              "h-3 w-3 -mb-1",
              isActive && direction === 'asc' ? 'text-primary' : 'text-muted-foreground/40'
            )} />
            <ChevronDown className={cn(
              "h-3 w-3",
              isActive && direction === 'desc' ? 'text-primary' : 'text-muted-foreground/40'
            )} />
          </div>
        </div>
      </TableHead>
    );
  };

  return (
    <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Facebook className="h-6 w-6 text-blue-600" />
              Meta Ads Manager
            </h1>
            <p className="text-muted-foreground">
              Gerencie e analise suas campanhas do Meta Ads
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Account Selector */}
            {accounts && accounts.length > 0 && (
              <Select value={selectedAccountId || ''} onValueChange={setSelectedAccountId}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Selecione uma conta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.account_name || account.account_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="ACTIVE">Ativas</SelectItem>
                <SelectItem value="PAUSED">Pausadas</SelectItem>
                <SelectItem value="ARCHIVED">Arquivadas</SelectItem>
                <SelectItem value="DELETED">Deletadas</SelectItem>
              </SelectContent>
            </Select>

            {/* Date Range Picker with Presets */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal min-w-[200px]">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "dd/MM/yy")} - {format(dateRange.to, "dd/MM/yy")}
                      </>
                    ) : (
                      format(dateRange.from, "dd/MM/yyyy")
                    )
                  ) : (
                    "Selecione o período"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <div className="flex">
                  {/* Preset shortcuts */}
                  <div className="border-r p-2 space-y-1">
                    {presetRanges.map((preset) => (
                      <Button
                        key={preset.label}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-left"
                        onClick={() => setDateRange(preset.range)}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>
                  {/* Calendar */}
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </div>
              </PopoverContent>
            </Popover>

            {/* Sync Button */}
            {selectedAccountId && (
              <Button onClick={handleSync} disabled={isSyncing} variant="outline">
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sincronizar
              </Button>
            )}

            {/* Connect Button */}
            <MetaConnect />
          </div>
        </div>

        {/* Last sync info */}
        {selectedAccount?.last_sync_at && (
          <p className="text-sm text-muted-foreground">
            Última sincronização: {format(new Date(selectedAccount.last_sync_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        )}

        {/* No accounts state */}
        {!accountsLoading && (!accounts || accounts.length === 0) && (
          <Card className="p-12">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <Facebook className="h-16 w-16 text-blue-600/50" />
              <div>
                <h3 className="text-lg font-semibold">Nenhuma conta conectada</h3>
                <p className="text-muted-foreground">
                  Conecte sua conta Meta Ads para visualizar campanhas e métricas.
                </p>
              </div>
              <MetaConnect />
            </div>
          </Card>
        )}

        {/* Dashboard Grid */}
        {selectedAccountId && (
          <DashboardGrid 
            storageKey="meta-ads-card-order"
            cards={[
              {
                id: 'stats-cards',
                fullWidth: true,
                component: (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                    {insightsLoading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <Card key={i}>
                          <CardHeader className="pb-2">
                            <Skeleton className="h-4 w-20" />
                          </CardHeader>
                          <CardContent>
                            <Skeleton className="h-8 w-24" />
                          </CardContent>
                        </Card>
                      ))
                    ) : insights ? (
                      <>
                        <StatCard
                          title="Gasto Total"
                          value={formatCurrency(insights.totalSpend)}
                          icon={DollarSign}
                          description="No período selecionado"
                        />
                        <StatCard
                          title="Impressões"
                          value={formatNumber(insights.totalImpressions)}
                          icon={Eye}
                        />
                        <StatCard
                          title="Cliques"
                          value={formatNumber(insights.totalClicks)}
                          icon={MousePointer}
                        />
                        <StatCard
                          title="Conversas Iniciadas"
                          value={formatNumber(insights.conversationsStarted)}
                          icon={MessageCircle}
                          description="Via Meta Ads"
                        />
                        <StatCard
                          title="Leads CTWA"
                          value={formatNumber(insights.ctwLeads)}
                          icon={Users}
                          description="Via WhatsApp"
                        />
                        <StatCard
                          title="CPL Real"
                          value={insights.realCpl ? formatCurrency(insights.realCpl) : '-'}
                          icon={Target}
                          description="Custo por lead real"
                        />
                      </>
                    ) : null}
                  </div>
                ),
              },
              {
                id: 'daily-performance',
                component: (
                  <Card className="h-full">
                    <CardHeader>
                      <CardTitle>Performance Diária</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {dailyLoading ? (
                        <Skeleton className="h-[300px] w-full" />
                      ) : chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <AreaChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="date" className="text-xs" />
                            <YAxis className="text-xs" />
                            <Tooltip 
                              formatter={(value: number, name: string) => [
                                name === 'spend' ? formatCurrency(value) : formatNumber(value),
                                name === 'spend' ? 'Gasto' : 'Cliques'
                              ]} 
                            />
                            <Area 
                              type="monotone" 
                              dataKey="spend" 
                              stroke="#3b82f6" 
                              fill="#3b82f6" 
                              fillOpacity={0.2}
                              name="spend"
                            />
                            <Area 
                              type="monotone" 
                              dataKey="clicks" 
                              stroke="#10b981" 
                              fill="#10b981" 
                              fillOpacity={0.2}
                              name="clicks"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                          Nenhum dado disponível
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ),
              },
              {
                id: 'spend-distribution',
                component: (
                  <Card className="h-full">
                    <CardHeader>
                      <CardTitle>Distribuição de Gastos</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {campaignsLoading ? (
                        <Skeleton className="h-[300px] w-full" />
                      ) : pieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              outerRadius={100}
                              fill="#8884d8"
                              dataKey="value"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            >
                              {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => formatCurrency(value)} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                          Nenhum dado disponível
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ),
              },
              {
                id: 'campaigns-table',
                fullWidth: true,
                component: (
                  <Card>
                    <CardHeader>
                      <CardTitle>Campanhas</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {campaignsLoading ? (
                        <div className="space-y-3">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                          ))}
                        </div>
                      ) : filteredAndSortedCampaigns.length > 0 ? (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <SortableHeader sortKey="name">Campanha</SortableHeader>
                                <SortableHeader sortKey="status">Status</SortableHeader>
                                <SortableHeader sortKey="impressions" className="text-right">Impressões</SortableHeader>
                                <SortableHeader sortKey="clicks" className="text-right">Cliques</SortableHeader>
                                <SortableHeader sortKey="ctr" className="text-right">CTR</SortableHeader>
                                <SortableHeader sortKey="spend" className="text-right">Gasto</SortableHeader>
                                <SortableHeader sortKey="conversations" className="text-right">Conversas</SortableHeader>
                                <SortableHeader sortKey="ctwLeads" className="text-right">Leads CTWA</SortableHeader>
                                <SortableHeader sortKey="realCpl" className="text-right">CPL Real</SortableHeader>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredAndSortedCampaigns.map((campaign) => (
                                <TableRow key={campaign.id}>
                                  <TableCell className="font-medium max-w-[200px] truncate">
                                    {campaign.name}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={campaign.status === 'ACTIVE' ? 'default' : 'secondary'}>
                                      {campaign.status === 'ACTIVE' ? 'Ativa' : 
                                       campaign.status === 'PAUSED' ? 'Pausada' : campaign.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNumber(campaign.insights?.impressions || 0)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatNumber(campaign.insights?.clicks || 0)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatPercent(campaign.insights?.ctr || 0)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatCurrency(campaign.insights?.spend || 0)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {campaign.conversationsStarted || 0}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {campaign.ctwLeads || 0}
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {campaign.realCpl ? (
                                      <span className={campaign.realCpl < 50 ? 'text-green-600' : campaign.realCpl > 100 ? 'text-red-600' : ''}>
                                        {formatCurrency(campaign.realCpl)}
                                      </span>
                                    ) : '-'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <p>Nenhuma campanha encontrada.</p>
                          <p className="text-sm">Clique em "Sincronizar" para buscar campanhas.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ),
              },
            ] as DashboardCardConfig[]}
          />
        )}

        {/* Account Actions */}
        {selectedAccountId && (
          <div className="flex justify-end">
            <Button variant="destructive" size="sm" onClick={handleDisconnect}>
              <Unplug className="h-4 w-4 mr-2" />
              Desconectar conta
            </Button>
          </div>
        )}
      </div>
  );
}
