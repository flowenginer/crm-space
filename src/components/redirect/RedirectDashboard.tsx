import { useState } from 'react';
import { format, subDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { 
  Eye, Users, ShoppingCart, TrendingUp, Target, Layers, 
  DollarSign, Download, AlertTriangle, Globe 
} from 'lucide-react';
import { useRedirectCampaigns } from '@/hooks/useRedirectCampaigns';
import { useRedirectDashboardEnhanced } from '@/hooks/useRedirectDashboardEnhanced';
import { DashboardFunnelChart } from './DashboardFunnelChart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DateRangePicker } from '@/components/reports/DateRangePicker';

export function RedirectDashboard() {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all');
  const [startDate, setStartDate] = useState(() => format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  const { data: campaigns = [] } = useRedirectCampaigns();
  const { data: dashboardData, isLoading } = useRedirectDashboardEnhanced({
    redirectCampaignId: selectedCampaignId === 'all' ? undefined : selectedCampaignId,
    startDate,
    endDate
  });

  const handleExportCSV = () => {
    if (!dashboardData?.utmBreakdown.length) return;

    const headers = ['UTM Source', 'UTM Campaign', 'UTM Content', 'Visitas', 'Leads', 'Catálogo', 'Layout', 'Fechados', 'Taxa Conv.'];
    const rows = dashboardData.utmBreakdown.map(row => [
      row.utm_source || '(direto)',
      row.utm_campaign || '-',
      row.utm_content || '-',
      row.visits,
      row.leads,
      row.catalogo,
      row.layout,
      row.fechados,
      `${row.conversionRate.toFixed(1)}%`
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `redirect-dashboard-${startDate}-${endDate}.csv`;
    link.click();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const summary = dashboardData?.summary;
  const utmBreakdown = dashboardData?.utmBreakdown || [];
  const hasUntracked = dashboardData?.hasUntracked;

  // Dados para o gráfico de funil
  const funnelData = [
    { name: 'Visitas', value: summary?.totalVisits || 0, color: 'hsl(var(--chart-1))' },
    { name: 'Leads', value: summary?.totalLeads || 0, color: 'hsl(var(--chart-2))' },
    { name: 'Catálogo', value: summary?.leadsInCatalogo || 0, color: 'hsl(var(--chart-3))' },
    { name: 'Layout', value: summary?.leadsInLayout || 0, color: 'hsl(var(--chart-4))' },
    { name: 'Fechados', value: summary?.pedidosFechados || 0, color: 'hsl(var(--chart-5))' },
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value);
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-muted-foreground">Página Redirect:</span>
          <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Selecione uma página" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as páginas</SelectItem>
              {campaigns.map(campaign => (
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
        />
      </div>

      {/* Cards de Métricas Principais - Linha 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                <Eye className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Visitas</p>
                <p className="text-xl font-bold">{formatNumber(summary?.totalVisits || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900/30">
                <Users className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Leads</p>
                <p className="text-xl font-bold">{formatNumber(summary?.totalLeads || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Conversão</p>
                <p className="text-xl font-bold">{(summary?.conversionRate || 0).toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/30">
                <DollarSign className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Custo por Lead</p>
                <p className="text-xl font-bold">{formatCurrency(summary?.costPerLead || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cards de Status - Linha 2 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
                <Target className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Catálogo</p>
                <p className="text-xl font-bold">{formatNumber(summary?.leadsInCatalogo || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-orange-100 dark:bg-orange-900/30">
                <Layers className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Layout</p>
                <p className="text-xl font-bold">{formatNumber(summary?.leadsInLayout || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
                <ShoppingCart className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fechados</p>
                <p className="text-xl font-bold">{formatNumber(summary?.pedidosFechados || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-indigo-100 dark:bg-indigo-900/30">
                <Globe className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fontes</p>
                <p className="text-xl font-bold">{formatNumber(summary?.uniqueSources || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerta de tráfego sem rastreamento */}
      {hasUntracked && (
        <Alert variant="default" className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            Parte do tráfego está chegando sem parâmetros UTM. Configure corretamente os links das campanhas para melhor rastreamento.
          </AlertDescription>
        </Alert>
      )}

      {/* Gráfico de Funil */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Funil de Conversão</CardTitle>
        </CardHeader>
        <CardContent>
          <DashboardFunnelChart data={funnelData} />
        </CardContent>
      </Card>

      {/* Tabela de UTM Breakdown */}
      {utmBreakdown.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Detalhamento por UTM</CardTitle>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>UTM Source</TableHead>
                    <TableHead>UTM Campaign</TableHead>
                    <TableHead>UTM Content</TableHead>
                    <TableHead className="text-right">Visitas</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Catálogo</TableHead>
                    <TableHead className="text-right">Layout</TableHead>
                    <TableHead className="text-right">Fechados</TableHead>
                    <TableHead className="text-right">Taxa Conv.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {utmBreakdown.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        {row.utm_source ? (
                          <Badge variant="outline" className="font-mono text-xs">
                            {row.utm_source}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">(direto)</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate" title={row.utm_campaign || undefined}>
                        {row.utm_campaign || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate" title={row.utm_content || undefined}>
                        {row.utm_content || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatNumber(row.visits)}</TableCell>
                      <TableCell className="text-right font-medium">{formatNumber(row.leads)}</TableCell>
                      <TableCell className="text-right">{formatNumber(row.catalogo)}</TableCell>
                      <TableCell className="text-right">{formatNumber(row.layout)}</TableCell>
                      <TableCell className="text-right">{formatNumber(row.fechados)}</TableCell>
                      <TableCell className="text-right">
                        <Badge 
                          variant={row.conversionRate >= 20 ? 'default' : row.conversionRate >= 10 ? 'secondary' : 'outline'}
                          className={row.conversionRate >= 20 ? 'bg-green-500' : ''}
                        >
                          {row.conversionRate.toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
