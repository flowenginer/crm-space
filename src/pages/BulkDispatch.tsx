import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
  Send, 
  Filter, 
  Users, 
  Clock, 
  Play, 
  Pause, 
  X, 
  History,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Trash2,
  MessageSquare,
  Calendar,
  Tag,
  User,
  Building,
  Target,
  Radio,
  ChevronDown,
  Eye,
  Shield,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { MultiSelect } from '@/components/ui/multi-select';
import { 
  useBulkDispatches,
  useInfinitePreviewContacts,
  usePreviewContactsCount,
  useCreateBulkDispatch,
  useStartBulkDispatch,
  usePauseBulkDispatch,
  useResumeBulkDispatch,
  useCancelBulkDispatch,
  useDeleteBulkDispatch,
  useDeleteBulkDispatches,
  useBulkDispatchRealtime,
  useBulkDispatchesRealtime,
  type BulkDispatchFilters,
  type BulkDispatch as BulkDispatchType,
  type ScheduleOverride,
} from '@/hooks/useBulkDispatch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { formatBusinessHoursSummary, businessHoursToOverride } from '@/lib/schedule-utils';
import { CompactScheduleEditor } from '@/components/settings/BusinessHoursEditor';
import { useRescueTemplates } from '@/hooks/useRescueTemplates';
import { useChannels } from '@/hooks/useChannels';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import { useTags } from '@/hooks/useTags';
import { useSegments } from '@/hooks/useSegments';
import { useTeam } from '@/hooks/useTeam';
import { useDepartments } from '@/hooks/useDepartments';
import { useMarketingCampaigns } from '@/hooks/useMarketingCampaigns';
import { useCloseReasons } from '@/hooks/useCloseReasons';
import { BulkDispatchDetailsDialog } from '@/components/bulk-dispatch/BulkDispatchDetailsDialog';
import { MetaTemplateSelector } from '@/components/meta-templates';
import { type MetaMessageTemplate } from '@/hooks/useMetaTemplates';

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) return `${hours}h ${mins}min`;
  if (mins > 0) return `${mins}min ${secs}s`;
  return `${secs}s`;
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function getStatusBadge(status: BulkDispatchType['status']) {
  switch (status) {
    case 'draft':
      return <Badge variant="secondary"><AlertCircle className="w-3 h-3 mr-1" />Rascunho</Badge>;
    case 'running':
      return <Badge className="bg-green-500"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Em Execução</Badge>;
    case 'paused':
      return <Badge variant="outline" className="border-yellow-500 text-yellow-500"><Pause className="w-3 h-3 mr-1" />Pausado</Badge>;
    case 'completed':
      return <Badge className="bg-blue-500"><CheckCircle2 className="w-3 h-3 mr-1" />Concluído</Badge>;
    case 'cancelled':
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Cancelado</Badge>;
  }
}

export default function BulkDispatch() {
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [isStarting, setIsStarting] = useState(false);
  const [selectedDispatchId, setSelectedDispatchId] = useState<string | null>(null);
  const [detailsDispatch, setDetailsDispatch] = useState<BulkDispatchType | null>(null);
  const [dispatchToDelete, setDispatchToDelete] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const [name, setName] = useState('');
  const [campaignType, setCampaignType] = useState<'followup' | 'marketing' | 'template_meta'>('followup');
  const [templateId, setTemplateId] = useState('');
  const [metaTemplateId, setMetaTemplateId] = useState<string | undefined>();
  const [metaVariables, setMetaVariables] = useState<Record<string, string>>({});
  const [channelId, setChannelId] = useState('');
  const [intervalSeconds, setIntervalSeconds] = useState(10);
  const [filters, setFilters] = useState<BulkDispatchFilters>({ includeBlocked: false });
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [useCustomSchedule, setUseCustomSchedule] = useState(false);
  const [scheduleOverride, setScheduleOverride] = useState<ScheduleOverride>({
    start: '08:00',
    end: '18:00',
    days: [1, 2, 3, 4, 5],
    timezone: 'America/Sao_Paulo',
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: dispatches = [], isLoading: dispatchesLoading } = useBulkDispatches();
  const { data: templates = [] } = useRescueTemplates();
  const { data: marketingCampaigns = [] } = useMarketingCampaigns();
  const { data: channels = [] } = useChannels();
  const { data: leadStatuses = [] } = useLeadStatuses();
  const { data: tags = [] } = useTags();
  const { data: segments = [] } = useSegments();
  const { data: team = [] } = useTeam();
  const { data: departments = [] } = useDepartments();
  const { data: closeReasons = [] } = useCloseReasons(true);
  const { data: companySettings } = useCompanySettings();
  
  // Contagem exata via COUNT
  const { data: totalContacts = 0, isLoading: countLoading } = usePreviewContactsCount(filters);
  
  // Preview com scroll infinito
  const {
    data: previewPages,
    isLoading: previewLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfinitePreviewContacts(filters);

  const previewContacts = useMemo(() => previewPages?.pages.flat() || [], [previewPages]);

  const createDispatch = useCreateBulkDispatch();
  const startDispatch = useStartBulkDispatch();
  const pauseDispatch = usePauseBulkDispatch();
  const resumeDispatch = useResumeBulkDispatch();
  const cancelDispatch = useCancelBulkDispatch();
  const deleteDispatch = useDeleteBulkDispatch();
  const deleteDispatches = useDeleteBulkDispatches();

  // Dispatches filtrados por status
  const filteredDispatches = useMemo(() => {
    if (statusFilter === 'all') return dispatches;
    return dispatches.filter(d => d.status === statusFilter);
  }, [dispatches, statusFilter]);

  // Dispatches que podem ser deletados (concluídos ou cancelados) - dentro do filtro atual
  const deletableDispatches = useMemo(() => 
    filteredDispatches.filter(d => d.status === 'completed' || d.status === 'cancelled'),
    [filteredDispatches]
  );
  
  const allDeletableSelected = deletableDispatches.length > 0 && 
    deletableDispatches.every(d => selectedIds.includes(d.id));
  
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(deletableDispatches.map(d => d.id));
    } else {
      setSelectedIds([]);
    }
  };
  
  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(i => i !== id));
    }
  };

  useBulkDispatchRealtime(selectedDispatchId);
  useBulkDispatchesRealtime(); // Realtime para TODA a lista

  const connectedChannels = useMemo(() => channels.filter(c => c.status === 'connected'), [channels]);
  const estimatedTime = useMemo(() => formatDuration(totalContacts * intervalSeconds), [totalContacts, intervalSeconds]);
  const leadStatusOptions = useMemo(() => leadStatuses.map(ls => ({ value: ls.id, label: ls.name })), [leadStatuses]);
  const tagOptions = useMemo(() => tags.map(t => ({ value: t.id, label: t.name })), [tags]);
  const teamOptions = useMemo(() => team.map(t => ({ value: t.id, label: t.full_name })), [team]);
  const departmentOptions = useMemo(() => departments.map(d => ({ value: d.id, label: d.name })), [departments]);
  const closeReasonOptions = useMemo(() => closeReasons.map(cr => ({ value: cr.id, label: cr.name })), [closeReasons]);

  // Scroll infinito - carregar mais ao chegar no final
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const isNearBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100;
    
    if (isNearBottom && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleCreateAndStart = async () => {
    if (!name.trim()) { toast.error('Digite um nome para a campanha'); return; }
    if (campaignType !== 'template_meta' && !templateId) { 
      toast.error(campaignType === 'followup' ? 'Selecione um template de follow-up' : 'Selecione uma campanha de marketing'); 
      return; 
    }
    if (campaignType === 'template_meta' && !metaTemplateId) {
      toast.error('Selecione um template Meta aprovado');
      return;
    }
    if (!channelId) { toast.error('Selecione um canal de envio'); return; }
    if (totalContacts === 0) { toast.error('Nenhum contato selecionado'); return; }

    try {
      const dispatch = await createDispatch.mutateAsync({
        name, 
        template_id: campaignType === 'followup' ? templateId : null,
        marketing_campaign_id: campaignType === 'marketing' ? templateId : null,
        meta_template_id: campaignType === 'template_meta' ? metaTemplateId : null,
        meta_template_variables: campaignType === 'template_meta' ? metaVariables : null,
        campaign_type: campaignType,
        channel_id: channelId,
        filters, 
        interval_seconds: intervalSeconds, 
        totalContacts,
        schedule_enabled: scheduleEnabled,
        schedule_override: useCustomSchedule ? scheduleOverride : null,
      });
      await startDispatch.mutateAsync(dispatch.id);
      toast.success('Disparo em massa iniciado!');
      setActiveTab('history');
      setSelectedDispatchId(dispatch.id);
      setName(''); setTemplateId(''); setChannelId(''); setFilters({ includeBlocked: false });
      setCampaignType('followup'); setScheduleEnabled(true); setUseCustomSchedule(false);
      setMetaTemplateId(undefined); setMetaVariables({});
    } catch (error) {
      toast.error('Erro ao criar disparo em massa');
    }
  };

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Send className="h-8 w-8 text-primary" />
            Disparo em Massa
          </h1>
          <p className="text-muted-foreground">Envie mensagens de resgate para múltiplos contatos</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'new' | 'history')}>
        <TabsList>
          <TabsTrigger value="new" className="gap-2"><Send className="h-4 w-4" />Nova Campanha</TabsTrigger>
          <TabsTrigger value="history" className="gap-2"><History className="h-4 w-4" />Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" />Configuração</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome da Campanha *</Label>
                  <Input placeholder="Ex: Resgate Black Friday" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Campanha *</Label>
                  <Select value={campaignType} onValueChange={(v) => {
                    setCampaignType(v as 'followup' | 'marketing' | 'template_meta');
                    setTemplateId('');
                    setMetaTemplateId(undefined);
                    setMetaVariables({});
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="followup">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-orange-500" />
                          Follow-up / Resgate
                        </div>
                      </SelectItem>
                      <SelectItem value="marketing">
                        <div className="flex items-center gap-2">
                          <Send className="h-4 w-4 text-purple-500" />
                          Marketing
                        </div>
                      </SelectItem>
                      <SelectItem value="template_meta">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-green-500" />
                          Template Meta (API Oficial)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {campaignType !== 'template_meta' && (
                <div className="space-y-2">
                  <Label>{campaignType === 'followup' ? 'Template de Follow-up *' : 'Campanha de Marketing *'}</Label>
                  <Select value={templateId} onValueChange={setTemplateId}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {campaignType === 'followup' 
                        ? templates.map(t => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)
                        : marketingCampaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)
                      }
                    </SelectContent>
                  </Select>
                </div>
                )}
                {campaignType === 'template_meta' && (
                  <MetaTemplateSelector
                    selectedTemplateId={metaTemplateId}
                    onTemplateSelect={(template) => {
                      setMetaTemplateId(template?.id);
                      setMetaVariables({});
                    }}
                    variableValues={metaVariables}
                    onVariableChange={setMetaVariables}
                  />
                )}
                <div className="space-y-2">
                  <Label>Canal de Envio *</Label>
                  <Select value={channelId} onValueChange={setChannelId}>
                    <SelectTrigger><SelectValue placeholder="Selecione um canal" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__existing__">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-blue-500" />
                          Canal da conversa existente
                        </div>
                      </SelectItem>
                      {connectedChannels.map(c => <SelectItem key={c.id} value={c.id}><div className="flex items-center gap-2"><Radio className="h-4 w-4 text-green-500" />{c.name}</div></SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Intervalo: {intervalSeconds >= 60 ? `${Math.floor(intervalSeconds / 60)}min ${intervalSeconds % 60}s` : `${intervalSeconds}s`}</Label>
                  <Slider value={[intervalSeconds]} onValueChange={([v]) => setIntervalSeconds(v)} min={5} max={600} step={15} />
                </div>

                {/* Schedule Section */}
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Respeitar horário comercial
                    </Label>
                    <Switch checked={scheduleEnabled} onCheckedChange={setScheduleEnabled} />
                  </div>
                  {scheduleEnabled && companySettings?.business_hours && (
                    <p className="text-sm text-muted-foreground">
                      {formatBusinessHoursSummary(companySettings.business_hours, companySettings.timezone || 'America/Sao_Paulo')}
                    </p>
                  )}
                  {scheduleEnabled && (
                    <div className="flex items-center justify-between pt-2">
                      <Label className="text-sm">Personalizar horário</Label>
                      <Switch checked={useCustomSchedule} onCheckedChange={setUseCustomSchedule} />
                    </div>
                  )}
                  {scheduleEnabled && useCustomSchedule && (
                    <CompactScheduleEditor
                      start={scheduleOverride.start}
                      end={scheduleOverride.end}
                      days={scheduleOverride.days}
                      timezone={scheduleOverride.timezone}
                      onStartChange={(v) => setScheduleOverride(s => ({ ...s, start: v }))}
                      onEndChange={(v) => setScheduleOverride(s => ({ ...s, end: v }))}
                      onDaysChange={(v) => setScheduleOverride(s => ({ ...s, days: v }))}
                      onTimezoneChange={(v) => setScheduleOverride(s => ({ ...s, timezone: v }))}
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5" />Filtros</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <Label className="text-xs text-muted-foreground uppercase">Data do Primeiro Contato</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label><Calendar className="h-3 w-3 inline mr-1" />De</Label>
                      <Input type="date" value={filters.firstContactStart || ''} onChange={(e) => setFilters(f => ({ ...f, firstContactStart: e.target.value || undefined }))} />
                    </div>
                    <div className="space-y-2">
                      <Label><Calendar className="h-3 w-3 inline mr-1" />Até</Label>
                      <Input type="date" value={filters.firstContactEnd || ''} onChange={(e) => setFilters(f => ({ ...f, firstContactEnd: e.target.value || undefined }))} />
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    Cliente não fala há
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      type="number" 
                      min={1}
                      placeholder="Ex: 5"
                      value={filters.lastClientMessageDaysAgo || ''} 
                      onChange={(e) => setFilters(f => ({ 
                        ...f, 
                        lastClientMessageDaysAgo: e.target.value ? parseInt(e.target.value) : undefined 
                      }))} 
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">dias ou mais</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Filtra contatos cuja última mensagem foi há X dias ou mais
                  </p>
                </div>
                
                <Separator />
                <div className="space-y-2">
                  <Label><Target className="h-3 w-3 inline mr-1" />Status do Lead</Label>
                  <MultiSelect options={leadStatusOptions} value={filters.leadStatusIds || []} onChange={(v) => setFilters(f => ({ ...f, leadStatusIds: v.length > 0 ? v : undefined }))} placeholder="Todos" />
                </div>
                <div className="space-y-2">
                  <Label><Tag className="h-3 w-3 inline mr-1" />Etiquetas</Label>
                  <MultiSelect options={tagOptions} value={filters.tagIds || []} onChange={(v) => setFilters(f => ({ ...f, tagIds: v.length > 0 ? v : undefined }))} placeholder="Todas" />
                </div>
                <div className="space-y-2">
                  <Label>Segmento</Label>
                  <Select value={filters.segmentId || '__all__'} onValueChange={(v) => setFilters(f => ({ ...f, segmentId: v === '__all__' ? undefined : v }))}>
                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent><SelectItem value="__all__">Todos</SelectItem>{segments.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label><User className="h-3 w-3 inline mr-1" />Atribuído a</Label>
                  <MultiSelect options={teamOptions} value={filters.assignedTo || []} onChange={(v) => setFilters(f => ({ ...f, assignedTo: v.length > 0 ? v : undefined }))} placeholder="Todos" />
                </div>
                <div className="space-y-2">
                  <Label><Building className="h-3 w-3 inline mr-1" />Departamento</Label>
                  <MultiSelect options={departmentOptions} value={filters.departmentIds || []} onChange={(v) => setFilters(f => ({ ...f, departmentIds: v.length > 0 ? v : undefined }))} placeholder="Todos" />
                </div>
                <div className="space-y-2">
                  <Label><XCircle className="h-3 w-3 inline mr-1" />Motivo de Fechamento</Label>
                  <MultiSelect 
                    options={closeReasonOptions} 
                    value={filters.closeReasonIds || []} 
                    onChange={(v) => setFilters(f => ({ ...f, closeReasonIds: v.length > 0 ? v : undefined }))} 
                    placeholder="Todos os motivos"
                    searchable
                    searchPlaceholder="Buscar motivo..."
                  />
                  {filters.closeReasonIds && filters.closeReasonIds.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Filtra contatos com conversas fechadas pelo motivo selecionado
                    </p>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <Label>Incluir Bloqueados</Label>
                  <Switch checked={filters.includeBlocked || false} onCheckedChange={(v) => setFilters(f => ({ ...f, includeBlocked: v }))} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-primary/10 text-center">
                    <p className="text-3xl font-bold text-primary">
                      {countLoading ? <Loader2 className="h-8 w-8 animate-spin mx-auto" /> : totalContacts.toLocaleString('pt-BR')}
                    </p>
                    <p className="text-sm text-muted-foreground">Contatos</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted text-center">
                    <p className="text-3xl font-bold flex items-center justify-center gap-1"><Clock className="h-6 w-6" />{estimatedTime}</p>
                    <p className="text-sm text-muted-foreground">Tempo estimado</p>
                  </div>
                </div>
                
                {/* Indicador de carregados vs total */}
                {!countLoading && totalContacts > 0 && (
                  <div className="text-center text-xs text-muted-foreground">
                    Mostrando {previewContacts.length.toLocaleString('pt-BR')} de {totalContacts.toLocaleString('pt-BR')}
                  </div>
                )}
                
                <Separator />
                
                <ScrollArea 
                  className="h-[450px]" 
                  onScrollCapture={handleScroll}
                >
                  {previewLoading ? (
                    <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>
                  ) : previewContacts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground"><Users className="h-12 w-12 mb-2 opacity-50" /><p>Nenhum contato</p></div>
                  ) : (
                    <div className="space-y-2">
                      {previewContacts.map((c: any) => (
                        <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                          <Avatar className="h-8 w-8"><AvatarImage src={c.avatar_url || undefined} /><AvatarFallback className="text-xs">{getInitials(c.full_name)}</AvatarFallback></Avatar>
                          <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{c.full_name}</p><p className="text-xs text-muted-foreground">{c.phone}</p></div>
                        </div>
                      ))}
                      
                      {/* Botão para carregar mais */}
                      {hasNextPage && (
                        <div className="flex justify-center py-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => fetchNextPage()}
                            disabled={isFetchingNextPage}
                          >
                            {isFetchingNextPage ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <ChevronDown className="h-4 w-4 mr-2" />
                            )}
                            Carregar mais
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </ScrollArea>
                
                <Button 
                  className="w-full" 
                  size="lg" 
                  disabled={!name || (campaignType !== 'template_meta' && !templateId) || (campaignType === 'template_meta' && !metaTemplateId) || !channelId || totalContacts === 0 || createDispatch.isPending || countLoading} 
                  onClick={handleCreateAndStart}
                >
                  {createDispatch.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                  Iniciar Disparo ({totalContacts.toLocaleString('pt-BR')} contatos)
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <CardTitle>Histórico</CardTitle>
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setSelectedIds([]); }}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filtrar por status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="running">Em Execução</SelectItem>
                    <SelectItem value="paused">Pausados</SelectItem>
                    <SelectItem value="completed">Concluídos</SelectItem>
                    <SelectItem value="cancelled">Cancelados</SelectItem>
                    <SelectItem value="draft">Rascunhos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {selectedIds.length > 0 && (
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => setShowBulkDeleteConfirm(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir {selectedIds.length} selecionado{selectedIds.length > 1 ? 's' : ''}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {dispatchesLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : filteredDispatches.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-muted-foreground"><History className="h-12 w-12 mb-2 opacity-50" /><p>{statusFilter === 'all' ? 'Nenhuma campanha' : 'Nenhuma campanha com este status'}</p></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox 
                          checked={allDeletableSelected}
                          onCheckedChange={handleSelectAll}
                          disabled={deletableDispatches.length === 0}
                        />
                      </TableHead>
                      <TableHead>Campanha</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progresso</TableHead>
                      <TableHead className="text-center">Enviados</TableHead>
                      <TableHead className="text-center">Respondidos</TableHead>
                      <TableHead className="text-center">Pulados</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDispatches.map(d => {
                      const processedCount = d.sent_count + d.error_count + (d.skipped_count || 0);
                      const isDeletable = d.status === 'completed' || d.status === 'cancelled';
                      return (
                        <TableRow key={d.id}>
                          <TableCell>
                            <Checkbox 
                              checked={selectedIds.includes(d.id)}
                              onCheckedChange={(checked) => handleSelectOne(d.id, !!checked)}
                              disabled={!isDeletable}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{d.name}</TableCell>
                          <TableCell>{getStatusBadge(d.status)}</TableCell>
                          <TableCell className="min-w-[120px]">
                            <Progress value={d.total_contacts > 0 ? (processedCount / d.total_contacts) * 100 : 0} className="h-2" />
                            <p className="text-xs text-muted-foreground">{processedCount}/{d.total_contacts}</p>
                          </TableCell>
                          <TableCell className="text-center"><Badge variant="outline" className="bg-green-500/10 text-green-500">{d.sent_count}</Badge></TableCell>
                          <TableCell className="text-center"><Badge variant="outline" className="bg-blue-500/10 text-blue-500">{d.responded_count}</Badge></TableCell>
                          <TableCell className="text-center">
                            {(d.skipped_count || 0) > 0 ? (
                              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600">{d.skipped_count}</Badge>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell>{format(new Date(d.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={() => setDetailsDispatch(d)} title="Ver detalhes">
                                <Eye className="h-4 w-4" />
                              </Button>
                              {d.status === 'running' && <Button variant="outline" size="sm" onClick={() => pauseDispatch.mutate(d.id)}><Pause className="h-4 w-4" /></Button>}
                              {d.status === 'paused' && <Button variant="outline" size="sm" onClick={() => resumeDispatch.mutate(d.id)}><Play className="h-4 w-4" /></Button>}
                              {(d.status === 'running' || d.status === 'paused') && <Button variant="outline" size="sm" className="text-destructive" onClick={() => cancelDispatch.mutate(d.id)}><X className="h-4 w-4" /></Button>}
                              {isDeletable && (
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-destructive hover:text-destructive" 
                                  onClick={() => setDispatchToDelete(d.id)}
                                  title="Excluir"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <BulkDispatchDetailsDialog
        dispatch={detailsDispatch}
        open={!!detailsDispatch}
        onOpenChange={(open) => !open && setDetailsDispatch(null)}
      />

      <AlertDialog open={!!dispatchToDelete} onOpenChange={(open) => !open && setDispatchToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir disparo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os registros de contatos associados a este disparo também serão excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (dispatchToDelete) {
                  deleteDispatch.mutate(dispatchToDelete, {
                    onSuccess: () => {
                      toast.success('Disparo excluído com sucesso');
                      setDispatchToDelete(null);
                    },
                    onError: () => {
                      toast.error('Erro ao excluir disparo');
                    },
                  });
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedIds.length} disparo{selectedIds.length > 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os registros de contatos associados aos disparos selecionados também serão excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                deleteDispatches.mutate(selectedIds, {
                  onSuccess: () => {
                    toast.success(`${selectedIds.length} disparo${selectedIds.length > 1 ? 's' : ''} excluído${selectedIds.length > 1 ? 's' : ''} com sucesso`);
                    setSelectedIds([]);
                    setShowBulkDeleteConfirm(false);
                  },
                  onError: () => {
                    toast.error('Erro ao excluir disparos');
                  },
                });
              }}
            >
              Excluir Todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
