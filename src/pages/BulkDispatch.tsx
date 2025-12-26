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
  MessageSquare,
  Calendar,
  Tag,
  User,
  Building,
  Target,
  Radio,
  ChevronDown,
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
  useBulkDispatchRealtime,
  type BulkDispatchFilters,
  type BulkDispatch as BulkDispatchType,
} from '@/hooks/useBulkDispatch';
import { useRescueTemplates } from '@/hooks/useRescueTemplates';
import { useChannels } from '@/hooks/useChannels';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import { useTags } from '@/hooks/useTags';
import { useSegments } from '@/hooks/useSegments';
import { useTeam } from '@/hooks/useTeam';
import { useDepartments } from '@/hooks/useDepartments';

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
  const [selectedDispatchId, setSelectedDispatchId] = useState<string | null>(null);
  
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [channelId, setChannelId] = useState('');
  const [intervalSeconds, setIntervalSeconds] = useState(10);
  const [filters, setFilters] = useState<BulkDispatchFilters>({ includeBlocked: false });

  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: dispatches = [], isLoading: dispatchesLoading } = useBulkDispatches();
  const { data: templates = [] } = useRescueTemplates();
  const { data: channels = [] } = useChannels();
  const { data: leadStatuses = [] } = useLeadStatuses();
  const { data: tags = [] } = useTags();
  const { data: segments = [] } = useSegments();
  const { data: team = [] } = useTeam();
  const { data: departments = [] } = useDepartments();
  
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

  useBulkDispatchRealtime(selectedDispatchId);

  const connectedChannels = useMemo(() => channels.filter(c => c.status === 'connected'), [channels]);
  const estimatedTime = useMemo(() => formatDuration(totalContacts * intervalSeconds), [totalContacts, intervalSeconds]);
  const leadStatusOptions = useMemo(() => leadStatuses.map(ls => ({ value: ls.id, label: ls.name })), [leadStatuses]);
  const tagOptions = useMemo(() => tags.map(t => ({ value: t.id, label: t.name })), [tags]);
  const teamOptions = useMemo(() => team.map(t => ({ value: t.id, label: t.full_name })), [team]);
  const departmentOptions = useMemo(() => departments.map(d => ({ value: d.id, label: d.name })), [departments]);

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
    if (!templateId) { toast.error('Selecione um template de resgate'); return; }
    if (!channelId) { toast.error('Selecione um canal de envio'); return; }
    if (totalContacts === 0) { toast.error('Nenhum contato selecionado'); return; }

    try {
      const dispatch = await createDispatch.mutateAsync({
        name, 
        template_id: templateId, 
        channel_id: channelId, 
        filters, 
        interval_seconds: intervalSeconds, 
        totalContacts,
      });
      await startDispatch.mutateAsync(dispatch.id);
      toast.success('Disparo em massa iniciado!');
      setActiveTab('history');
      setSelectedDispatchId(dispatch.id);
      setName(''); setTemplateId(''); setChannelId(''); setFilters({ includeBlocked: false });
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
                  <Label>Template de Resgate *</Label>
                  <Select value={templateId} onValueChange={setTemplateId}>
                    <SelectTrigger><SelectValue placeholder="Selecione um template" /></SelectTrigger>
                    <SelectContent>{templates.map(t => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5" />Filtros</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label><Calendar className="h-3 w-3 inline mr-1" />Data Inicial</Label>
                    <Input type="date" value={filters.firstContactStart || ''} onChange={(e) => setFilters(f => ({ ...f, firstContactStart: e.target.value || undefined }))} />
                  </div>
                  <div className="space-y-2">
                    <Label><Calendar className="h-3 w-3 inline mr-1" />Data Final</Label>
                    <Input type="date" value={filters.firstContactEnd || ''} onChange={(e) => setFilters(f => ({ ...f, firstContactEnd: e.target.value || undefined }))} />
                  </div>
                </div>
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
                  className="h-[250px]" 
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
                  disabled={!name || !templateId || !channelId || totalContacts === 0 || createDispatch.isPending || countLoading} 
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
            <CardHeader><CardTitle>Histórico</CardTitle></CardHeader>
            <CardContent>
              {dispatchesLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : dispatches.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-muted-foreground"><History className="h-12 w-12 mb-2 opacity-50" /><p>Nenhuma campanha</p></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campanha</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progresso</TableHead>
                      <TableHead className="text-center">Enviados</TableHead>
                      <TableHead className="text-center">Respondidos</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dispatches.map(d => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">{d.name}</TableCell>
                        <TableCell>{getStatusBadge(d.status)}</TableCell>
                        <TableCell className="min-w-[120px]">
                          <Progress value={d.total_contacts > 0 ? (d.processed_count / d.total_contacts) * 100 : 0} className="h-2" />
                          <p className="text-xs text-muted-foreground">{d.processed_count}/{d.total_contacts}</p>
                        </TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className="bg-green-500/10 text-green-500">{d.sent_count}</Badge></TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className="bg-blue-500/10 text-blue-500">{d.responded_count}</Badge></TableCell>
                        <TableCell>{format(new Date(d.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {d.status === 'running' && <Button variant="outline" size="sm" onClick={() => pauseDispatch.mutate(d.id)}><Pause className="h-4 w-4" /></Button>}
                            {d.status === 'paused' && <Button variant="outline" size="sm" onClick={() => resumeDispatch.mutate(d.id)}><Play className="h-4 w-4" /></Button>}
                            {(d.status === 'running' || d.status === 'paused') && <Button variant="outline" size="sm" className="text-destructive" onClick={() => cancelDispatch.mutate(d.id)}><X className="h-4 w-4" /></Button>}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
