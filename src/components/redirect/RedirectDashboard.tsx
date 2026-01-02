import { useState } from 'react';
import { format, subDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, Users, ShoppingCart, TrendingUp, Target, Layers, MousePointerClick, Percent, DollarSign } from 'lucide-react';
import { useMetaAdsDashboard, useAllMetaCampaigns } from '@/hooks/useMetaAdsDashboard';
import { DashboardFunnelChart } from './DashboardFunnelChart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DateRangePicker } from '@/components/reports/DateRangePicker';

export function RedirectDashboard() {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all');
  const [startDate, setStartDate] = useState(() => format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  const { data: campaigns = [] } = useAllMetaCampaigns();
  const { data: dashboardData, isLoading } = useMetaAdsDashboard({
    selectedCampaignId: selectedCampaignId === 'all' ? undefined : selectedCampaignId,
    startDate,
    endDate
  });

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
  const metaInsights = dashboardData?.metaInsights;
  const byCampaign = dashboardData?.byCampaign || [];
  const byAd = dashboardData?.byAd || [];

  // Dados para o gráfico de funil
  const funnelData = [
    { name: 'Impressões', value: metaInsights?.impressions || 0, color: 'hsl(var(--chart-1))' },
    { name: 'Cliques', value: metaInsights?.clicks || 0, color: 'hsl(var(--chart-2))' },
    { name: 'Leads', value: summary?.totalLeads || 0, color: 'hsl(var(--chart-3))' },
    { name: 'Catálogo', value: summary?.leadsInCatalogo || 0, color: 'hsl(var(--chart-4))' },
    { name: 'Pedido Fechado', value: summary?.pedidosFechados || 0, color: 'hsl(var(--chart-5))' },
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
          <span className="text-sm font-medium text-muted-foreground">Campanha:</span>
          <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Selecione uma campanha" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as campanhas</SelectItem>
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

      {/* Cards de Métricas do Meta Ads */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/30">
                <Eye className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Impressões</p>
                <p className="text-xl font-bold">{formatNumber(metaInsights?.impressions || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                <MousePointerClick className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cliques</p>
                <p className="text-xl font-bold">{formatNumber(metaInsights?.clicks || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
                <Percent className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">CTR</p>
                <p className="text-xl font-bold">{(metaInsights?.ctr || 0).toFixed(2)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Investimento</p>
                <p className="text-xl font-bold">{formatCurrency(metaInsights?.spend || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cards de Leads */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Leads</p>
                <p className="text-xl font-bold">{summary?.totalLeads || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
                <Target className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Em Catálogo</p>
                <p className="text-xl font-bold">{summary?.leadsInCatalogo || 0}</p>
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
                <p className="text-xs text-muted-foreground">Em Layout</p>
                <p className="text-xl font-bold">{summary?.leadsInLayout || 0}</p>
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
                <p className="text-xs text-muted-foreground">Pedidos Fechados</p>
                <p className="text-xl font-bold">{summary?.pedidosFechados || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Conversão</p>
                <p className="text-xl font-bold">{(summary?.conversionRate || 0).toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Funil */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Funil de Conversão</CardTitle>
        </CardHeader>
        <CardContent>
          <DashboardFunnelChart data={funnelData} />
        </CardContent>
      </Card>

      {/* Breakdown por Status */}
      {summary?.statusBreakdown && summary.statusBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {summary.statusBreakdown
                .filter(s => s.count > 0)
                .sort((a, b) => b.count - a.count)
                .map(status => (
                  <Badge
                    key={status.statusId}
                    variant="outline"
                    className="text-sm py-1.5 px-3"
                    style={{ 
                      borderColor: status.color || undefined,
                      backgroundColor: status.color ? `${status.color}20` : undefined
                    }}
                  >
                    {status.statusName}: <span className="font-bold ml-1">{status.count}</span>
                  </Badge>
                ))
              }
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela por Anúncio */}
      {byAd.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Detalhamento por Anúncio</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Anúncio (Content)</TableHead>
                    <TableHead>Plataforma (Source)</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Catálogo</TableHead>
                    <TableHead className="text-right">Layout</TableHead>
                    <TableHead className="text-right">Fechados</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byAd.map(ad => (
                    <TableRow key={ad.adId}>
                      <TableCell className="font-medium max-w-[200px] truncate" title={ad.adName}>
                        {ad.adName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {ad.platform}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{ad.leads}</TableCell>
                      <TableCell className="text-right">{ad.catalogo}</TableCell>
                      <TableCell className="text-right">{ad.layout}</TableCell>
                      <TableCell className="text-right">{ad.fechados}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Tabela por Campanha */}
      {byCampaign.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Detalhamento por Campanha</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campanha</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Catálogo</TableHead>
                    <TableHead className="text-right">Layout</TableHead>
                    <TableHead className="text-right">Fechados</TableHead>
                    <TableHead className="text-right">Conversão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byCampaign.map(campaign => {
                    const catalogo = campaign.statusBreakdown.find(s => 
                      s.statusName.toLowerCase().includes('catálogo') || 
                      s.statusName.toLowerCase().includes('catalogo')
                    )?.count || 0;
                    const layout = campaign.statusBreakdown.find(s => 
                      s.statusName.toLowerCase().includes('layout')
                    )?.count || 0;
                    const fechados = campaign.statusBreakdown.find(s => 
                      s.statusName.toLowerCase().includes('fechado') || 
                      s.statusName.toLowerCase().includes('pedido fechado')
                    )?.count || 0;

                    return (
                      <TableRow key={campaign.campaignId}>
                        <TableCell className="font-medium">{campaign.campaignName}</TableCell>
                        <TableCell className="text-right">{campaign.leads}</TableCell>
                        <TableCell className="text-right">{catalogo}</TableCell>
                        <TableCell className="text-right">{layout}</TableCell>
                        <TableCell className="text-right">{fechados}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={campaign.conversionRate > 0 ? 'default' : 'secondary'}>
                            {campaign.conversionRate.toFixed(1)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
