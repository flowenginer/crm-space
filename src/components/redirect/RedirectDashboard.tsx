import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { format, subDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Eye, Users, ShoppingCart, TrendingUp, Target, Layers, 
  DollarSign, Download, AlertTriangle, Globe, Filter, X, Search, ChevronDown, ChevronUp, HelpCircle
} from 'lucide-react';
import { useRedirectCampaigns } from '@/hooks/useRedirectCampaigns';
import { useRedirectDashboardEnhanced } from '@/hooks/useRedirectDashboardEnhanced';
import { useMetaAdsWithCampaigns, useMetaAccounts, MetaAd } from '@/hooks/useMetaAds';
import { DashboardFunnelChart } from './DashboardFunnelChart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DateRangePicker } from '@/components/reports/DateRangePicker';

export function RedirectDashboard() {
  const { profile } = useAuth();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('all');
  const [selectedMetaAccountId, setSelectedMetaAccountId] = useState<string | null>(null);
  const [selectedMetaAds, setSelectedMetaAds] = useState<string[]>([]);
  const [draftMetaAds, setDraftMetaAds] = useState<string[]>([]);
  const [adSearchQuery, setAdSearchQuery] = useState('');
  const [adPopoverOpen, setAdPopoverOpen] = useState(false);
  const [startDate, setStartDate] = useState(() => format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [unmappedOpen, setUnmappedOpen] = useState(false);

  const { data: campaigns = [] } = useRedirectCampaigns();
  const { data: metaAccounts = [] } = useMetaAccounts();
  const { data: metaAds = [] } = useMetaAdsWithCampaigns(profile?.tenant_id || null, selectedMetaAccountId);

  // Auto-selecionar primeira conta Meta Ads
  useEffect(() => {
    if (metaAccounts.length > 0 && !selectedMetaAccountId) {
      setSelectedMetaAccountId(metaAccounts[0].id);
    }
  }, [metaAccounts, selectedMetaAccountId]);

  // Limpar seleção de anúncios ao mudar de conta
  useEffect(() => {
    setSelectedMetaAds([]);
    setDraftMetaAds([]);
  }, [selectedMetaAccountId]);

  // Sincronizar draft quando popover abre
  useEffect(() => {
    if (adPopoverOpen) {
      setDraftMetaAds(selectedMetaAds);
    }
  }, [adPopoverOpen, selectedMetaAds]);
  
  const { data: dashboardData, isLoading, isFetching } = useRedirectDashboardEnhanced({
    redirectCampaignId: selectedCampaignId === 'all' ? undefined : selectedCampaignId,
    startDate,
    endDate,
    selectedMetaAdNames: selectedMetaAds
  });

  // Agrupar anúncios por ADSET (conjunto) para exibição
  const adsGroupedByAdset = useMemo(() => {
    const grouped: Record<string, { adsetName: string; campaignName: string; ads: MetaAd[] }> = {};
    metaAds.forEach(ad => {
      const adsetName = (ad.adset as any)?.name || ad.name;
      const campaignName = (ad.campaign as any)?.name || 'Sem campanha';
      const key = adsetName;
      if (!grouped[key]) {
        grouped[key] = { adsetName, campaignName, ads: [] };
      }
      grouped[key].ads.push(ad);
    });
    return Object.values(grouped).sort((a, b) => a.adsetName.localeCompare(b.adsetName));
  }, [metaAds]);

  // Filtrar anúncios pela busca
  const filteredAdsGrouped = useMemo(() => {
    if (!adSearchQuery.trim()) return adsGroupedByAdset;
    
    const query = adSearchQuery.toLowerCase();
    return adsGroupedByAdset
      .map(group => ({
        ...group,
        ads: group.ads.filter(ad => 
          ad.name.toLowerCase().includes(query) ||
          group.adsetName.toLowerCase().includes(query) ||
          group.campaignName.toLowerCase().includes(query)
        )
      }))
      .filter(group => group.ads.length > 0);
  }, [adsGroupedByAdset, adSearchQuery]);

  // Os dados já vêm filtrados do hook, não precisa mais filtrar aqui
  const filteredData = dashboardData;

  // Funções para draft (dentro do popover)
  const toggleDraftAd = (adName: string) => {
    setDraftMetaAds(prev => 
      prev.includes(adName) 
        ? prev.filter(n => n !== adName)
        : [...prev, adName]
    );
  };

  const clearDraftAds = () => {
    setDraftMetaAds([]);
  };

  const selectAllFromCampaignDraft = (ads: MetaAd[]) => {
    const adNames = ads.map(ad => ad.name);
    setDraftMetaAds(prev => {
      const newSelection = new Set(prev);
      adNames.forEach(name => newSelection.add(name));
      return Array.from(newSelection);
    });
  };

  const deselectAllFromCampaignDraft = (ads: MetaAd[]) => {
    const adNames = new Set(ads.map(ad => ad.name));
    setDraftMetaAds(prev => prev.filter(name => !adNames.has(name)));
  };

  const isCampaignFullySelectedDraft = (ads: MetaAd[]) => {
    return ads.every(ad => draftMetaAds.includes(ad.name));
  };

  // Ações do popover
  const applyDraftSelection = () => {
    setSelectedMetaAds(draftMetaAds);
    setAdPopoverOpen(false);
  };

  const cancelDraftSelection = () => {
    setDraftMetaAds(selectedMetaAds);
    setAdPopoverOpen(false);
  };

  // Remover anúncio da seleção aplicada (badges)
  const removeFromApplied = (adName: string) => {
    setSelectedMetaAds(prev => prev.filter(n => n !== adName));
  };

  const clearAppliedAds = () => {
    setSelectedMetaAds([]);
  };

  const handleExportCSV = () => {
    if (!filteredData?.utmBreakdown.length) return;

    const headers = ['UTM Source', 'UTM Campaign', 'UTM Content', 'Visitas', 'Leads', 'Catálogo', 'Layout', 'Fechados', 'Taxa Conv.'];
    const rows = filteredData.utmBreakdown.map(row => [
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

  // Só mostra skeleton no primeiro carregamento (sem dados anteriores)
  const showFullSkeleton = isLoading && !dashboardData;

  if (showFullSkeleton) {
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

  const summary = filteredData?.summary;
  const utmBreakdown = filteredData?.utmBreakdown || [];
  const unmappedBreakdown = filteredData?.unmappedBreakdown || [];
  const unmappedSummary = filteredData?.unmappedSummary;
  const hasUntracked = filteredData?.hasUntracked;
  
  // Calcular porcentagem de tráfego não mapeado
  const totalTraffic = (summary?.totalVisits || 0) + (unmappedSummary?.totalVisits || 0);
  const unmappedPercentage = totalTraffic > 0 
    ? ((unmappedSummary?.totalVisits || 0) / totalTraffic * 100).toFixed(1) 
    : '0';

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
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Página:</span>
            <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
              <SelectTrigger className="w-[180px]">
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

          {/* Seletor de Conta Meta Ads */}
          {metaAccounts.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Conta:</span>
              <Select value={selectedMetaAccountId || ''} onValueChange={setSelectedMetaAccountId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Selecione uma conta" />
                </SelectTrigger>
                <SelectContent>
                  {metaAccounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.account_name || account.account_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Seletor de Anúncios do Meta Ads */}
          {metaAds.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Anúncios:</span>
              <Popover open={adPopoverOpen} onOpenChange={setAdPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="min-w-[200px] justify-start">
                    <Filter className="h-4 w-4 mr-2" />
                    {selectedMetaAds.length === 0 
                      ? 'Todos os anúncios' 
                      : `${selectedMetaAds.length} anúncio(s)`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-[500px] p-0" 
                  align="start"
                  onInteractOutside={(e) => e.preventDefault()}
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  {/* Header fixo com busca */}
                  <div className="p-3 border-b space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        Selecionar Anúncios ({metaAds.length} disponíveis)
                      </span>
                      <div className="flex items-center gap-2">
                        {draftMetaAds.length > 0 && (
                          <Button variant="ghost" size="sm" onClick={clearDraftAds} className="h-7 text-xs">
                            <X className="h-3 w-3 mr-1" />
                            Limpar ({draftMetaAds.length})
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {/* Campo de busca */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar anúncios ou campanhas..."
                        value={adSearchQuery}
                        onChange={(e) => setAdSearchQuery(e.target.value)}
                        className="pl-9 h-9"
                      />
                    </div>
                  </div>
                  
                  {/* Lista com scroll - altura fixa para scroll funcionar */}
                  <div className="overflow-y-auto p-2 space-y-3" style={{ maxHeight: '400px' }}>
                    {filteredAdsGrouped.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        Nenhum anúncio encontrado para "{adSearchQuery}"
                      </div>
                    ) : (
                      filteredAdsGrouped.map(group => {
                        const isFullySelected = isCampaignFullySelectedDraft(group.ads);
                        return (
                          <div key={group.adsetName} className="space-y-1">
                            {/* Header do conjunto (adset) com ação de seleção */}
                            <div className="px-2 py-1.5 text-xs font-semibold bg-muted/50 rounded flex items-center justify-between gap-2">
                              <div className="flex flex-col min-w-0 flex-1">
                                <span className="truncate text-foreground" title={group.adsetName}>
                                  {group.adsetName}
                                </span>
                                <span className="truncate text-muted-foreground text-[10px]" title={group.campaignName}>
                                  {group.campaignName}
                                </span>
                              </div>
                              <button 
                                className="text-primary hover:underline text-[10px] whitespace-nowrap flex-shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  isFullySelected 
                                    ? deselectAllFromCampaignDraft(group.ads) 
                                    : selectAllFromCampaignDraft(group.ads);
                                }}
                              >
                                {isFullySelected ? 'Desmarcar' : 'Selecionar'} ({group.ads.length})
                              </button>
                            </div>
                            {/* Lista de anúncios */}
                            {group.ads.map(ad => (
                              <div 
                                key={ad.id} 
                                className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer ml-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleDraftAd(ad.name);
                                }}
                              >
                                <Checkbox 
                                  checked={draftMetaAds.includes(ad.name)}
                                  onCheckedChange={() => toggleDraftAd(ad.name)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <span className="text-sm truncate flex-1" title={ad.name}>
                                  {ad.name}
                                </span>
                                {ad.status && (
                                  <Badge 
                                    variant={ad.status === 'ACTIVE' ? 'default' : 'secondary'} 
                                    className="text-[10px] px-1.5 flex-shrink-0"
                                  >
                                    {ad.status === 'ACTIVE' ? 'Ativo' : ad.status}
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        );
                      })
                    )}
                  </div>
                  
                  {/* Footer com botões Aplicar e Cancelar */}
                  <div className="p-3 border-t flex items-center justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={cancelDraftSelection}>
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={applyDraftSelection}>
                      Aplicar ({draftMetaAds.length})
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>

        {/* Anúncios selecionados como badges */}
        {selectedMetaAds.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedMetaAds.map(adName => (
              <Badge 
                key={adName} 
                variant="secondary" 
                className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground max-w-[250px]"
                onClick={() => removeFromApplied(adName)}
              >
                <span className="truncate">{adName}</span>
                <X className="h-3 w-3 ml-1 flex-shrink-0" />
              </Badge>
            ))}
          </div>
        )}

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

      {/* Card de Tráfego Não Mapeado */}
      {selectedMetaAds.length > 0 && unmappedBreakdown.length > 0 && (
        <Collapsible open={unmappedOpen} onOpenChange={setUnmappedOpen}>
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
            <CardHeader className="pb-3">
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
                      <HelpCircle className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        Tráfego Não Atribuído
                        <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                          {unmappedPercentage}% do total
                        </Badge>
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {formatNumber(unmappedSummary?.totalVisits || 0)} visitas e {formatNumber(unmappedSummary?.totalLeads || 0)} leads não correspondem aos anúncios selecionados
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    {unmappedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    {unmappedOpen ? 'Ocultar' : 'Ver detalhes'}
                  </Button>
                </div>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>UTM Source</TableHead>
                        <TableHead>UTM Campaign</TableHead>
                        <TableHead>UTM Content</TableHead>
                        <TableHead className="text-right">Visitas</TableHead>
                        <TableHead className="text-right">Leads</TableHead>
                        <TableHead className="text-right">Taxa Conv.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unmappedBreakdown.map((row, index) => (
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
                          <TableCell className="max-w-[200px] truncate" title={row.utm_content || undefined}>
                            {row.utm_content || <span className="text-muted-foreground">-</span>}
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatNumber(row.visits)}</TableCell>
                          <TableCell className="text-right font-medium">{formatNumber(row.leads)}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline">
                              {row.conversionRate.toFixed(1)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
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
