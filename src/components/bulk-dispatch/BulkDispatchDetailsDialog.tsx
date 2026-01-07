import { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Clock, 
  Filter, 
  Calendar, 
  Tag, 
  User, 
  Building, 
  Target,
  Radio,
  MessageSquare,
  Send,
  Ban,
  CheckCircle2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { type BulkDispatch } from '@/hooks/useBulkDispatch';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import { useTags } from '@/hooks/useTags';
import { useSegments } from '@/hooks/useSegments';
import { useTeam } from '@/hooks/useTeam';
import { useDepartments } from '@/hooks/useDepartments';
import { useChannels } from '@/hooks/useChannels';
import { useRescueTemplates } from '@/hooks/useRescueTemplates';
import { useMarketingCampaigns } from '@/hooks/useMarketingCampaigns';

interface BulkDispatchDetailsDialogProps {
  dispatch: BulkDispatch | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function BulkDispatchDetailsDialog({
  dispatch,
  open,
  onOpenChange,
}: BulkDispatchDetailsDialogProps) {
  const { data: leadStatuses = [] } = useLeadStatuses();
  const { data: tags = [] } = useTags();
  const { data: segments = [] } = useSegments();
  const { data: team = [] } = useTeam();
  const { data: departments = [] } = useDepartments();
  const { data: channels = [] } = useChannels();
  const { data: templates = [] } = useRescueTemplates();
  const { data: marketingCampaigns = [] } = useMarketingCampaigns();

  const filters = useMemo(() => dispatch?.filters || {}, [dispatch?.filters]);

  // Resolve IDs to names
  const resolvedLeadStatuses = useMemo(() => {
    if (!filters.leadStatusIds?.length) return null;
    return filters.leadStatusIds
      .map((id: string) => leadStatuses.find(ls => ls.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  }, [filters.leadStatusIds, leadStatuses]);

  const resolvedTags = useMemo(() => {
    if (!filters.tagIds?.length) return null;
    return filters.tagIds
      .map((id: string) => tags.find(t => t.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  }, [filters.tagIds, tags]);

  const resolvedSegment = useMemo(() => {
    if (!filters.segmentId) return null;
    return segments.find(s => s.id === filters.segmentId)?.name;
  }, [filters.segmentId, segments]);

  const resolvedAssignedTo = useMemo(() => {
    if (!filters.assignedTo?.length) return null;
    return filters.assignedTo
      .map((id: string) => team.find(t => t.id === id)?.full_name)
      .filter(Boolean)
      .join(', ');
  }, [filters.assignedTo, team]);

  const resolvedDepartments = useMemo(() => {
    if (!filters.departmentIds?.length) return null;
    return filters.departmentIds
      .map((id: string) => departments.find(d => d.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  }, [filters.departmentIds, departments]);

  const resolvedChannel = useMemo(() => {
    if (!dispatch?.channel_id || dispatch.channel_id === '__existing__') {
      return 'Canal da conversa existente';
    }
    return channels.find(c => c.id === dispatch.channel_id)?.name || dispatch.channel_id;
  }, [dispatch?.channel_id, channels]);

  const resolvedTemplate = useMemo(() => {
    if (!dispatch) return null;
    if (dispatch.campaign_type === 'marketing') {
      return marketingCampaigns.find(c => c.id === dispatch.marketing_campaign_id)?.title;
    }
    return templates.find(t => t.id === dispatch.template_id)?.title;
  }, [dispatch, templates, marketingCampaigns]);

  const scheduleInfo = useMemo(() => {
    if (!dispatch?.schedule_enabled) {
      return 'Desabilitado (envia a qualquer hora)';
    }
    
    if (dispatch.schedule_override) {
      const override = dispatch.schedule_override;
      const enabledDays = (override.days || [1, 2, 3, 4, 5])
        .sort((a: number, b: number) => a - b)
        .map((d: number) => dayNames[d])
        .join(', ');
      return `${enabledDays}, ${override.start || '08:00'} - ${override.end || '18:00'}`;
    }
    
    return 'Horário comercial da empresa';
  }, [dispatch?.schedule_enabled, dispatch?.schedule_override]);

  const formatInterval = (seconds: number) => {
    if (seconds >= 60) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return secs > 0 ? `${mins}min ${secs}s` : `${mins}min`;
    }
    return `${seconds}s`;
  };

  if (!dispatch) return null;

  const hasFilters = resolvedLeadStatuses || resolvedTags || resolvedSegment || 
    resolvedAssignedTo || resolvedDepartments || filters.lastClientMessageDaysAgo ||
    filters.firstContactStart || filters.firstContactEnd || filters.includeBlocked;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {dispatch.name}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-4 pr-4">
            {/* Configuration Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Configuração
              </h4>
              
              <div className="grid gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Send className="h-3 w-3" />
                    Tipo
                  </span>
                  <Badge variant="secondary">
                    {dispatch.campaign_type === 'marketing' ? 'Marketing' : 'Follow-up'}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Target className="h-3 w-3" />
                    {dispatch.campaign_type === 'marketing' ? 'Campanha' : 'Template'}
                  </span>
                  <span className="font-medium text-right max-w-[200px] truncate">
                    {resolvedTemplate || '-'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Radio className="h-3 w-3" />
                    Canal
                  </span>
                  <span className="font-medium text-right max-w-[200px] truncate">
                    {resolvedChannel}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    Intervalo
                  </span>
                  <span className="font-medium">
                    {formatInterval(dispatch.interval_seconds)}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Schedule Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Horário
              </h4>
              
              <div className="text-sm">
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <span>{scheduleInfo}</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Filters Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filtros Aplicados
              </h4>
              
              {!hasFilters ? (
                <p className="text-sm text-muted-foreground italic">
                  Nenhum filtro aplicado (todos os contatos)
                </p>
              ) : (
                <div className="space-y-2 text-sm">
                  {resolvedLeadStatuses && (
                    <div className="flex items-start gap-2">
                      <Target className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div>
                        <span className="text-muted-foreground">Status do Lead: </span>
                        <span className="font-medium">{resolvedLeadStatuses}</span>
                      </div>
                    </div>
                  )}
                  
                  {filters.lastClientMessageDaysAgo && (
                    <div className="flex items-start gap-2">
                      <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div>
                        <span className="text-muted-foreground">Cliente não fala há: </span>
                        <span className="font-medium">{filters.lastClientMessageDaysAgo} dias ou mais</span>
                      </div>
                    </div>
                  )}
                  
                  {resolvedTags && (
                    <div className="flex items-start gap-2">
                      <Tag className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div>
                        <span className="text-muted-foreground">Etiquetas: </span>
                        <span className="font-medium">{resolvedTags}</span>
                      </div>
                    </div>
                  )}
                  
                  {resolvedSegment && (
                    <div className="flex items-start gap-2">
                      <User className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div>
                        <span className="text-muted-foreground">Segmento: </span>
                        <span className="font-medium">{resolvedSegment}</span>
                      </div>
                    </div>
                  )}
                  
                  {resolvedAssignedTo && (
                    <div className="flex items-start gap-2">
                      <User className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div>
                        <span className="text-muted-foreground">Atribuído a: </span>
                        <span className="font-medium">{resolvedAssignedTo}</span>
                      </div>
                    </div>
                  )}
                  
                  {resolvedDepartments && (
                    <div className="flex items-start gap-2">
                      <Building className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div>
                        <span className="text-muted-foreground">Departamento: </span>
                        <span className="font-medium">{resolvedDepartments}</span>
                      </div>
                    </div>
                  )}
                  
                  {(filters.firstContactStart || filters.firstContactEnd) && (
                    <div className="flex items-start gap-2">
                      <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div>
                        <span className="text-muted-foreground">Primeiro contato: </span>
                        <span className="font-medium">
                          {filters.firstContactStart && format(new Date(filters.firstContactStart), 'dd/MM/yyyy', { locale: ptBR })}
                          {filters.firstContactStart && filters.firstContactEnd && ' - '}
                          {filters.firstContactEnd && format(new Date(filters.firstContactEnd), 'dd/MM/yyyy', { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2">
                    {filters.includeBlocked ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span>Incluindo contatos bloqueados</span>
                      </>
                    ) : (
                      <>
                        <Ban className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Excluindo contatos bloqueados</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Stats Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Estatísticas
              </h4>
              
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-muted">
                  <p className="text-lg font-bold">{dispatch.total_contacts}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div className="p-2 rounded-lg bg-green-500/10">
                  <p className="text-lg font-bold text-green-600">{dispatch.sent_count}</p>
                  <p className="text-xs text-muted-foreground">Enviados</p>
                </div>
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <p className="text-lg font-bold text-blue-600">{dispatch.responded_count}</p>
                  <p className="text-xs text-muted-foreground">Respondidos</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-center">
                {(dispatch.skipped_count || 0) > 0 && (
                  <div className="p-2 rounded-lg bg-yellow-500/10 text-center">
                    <p className="text-lg font-bold text-yellow-600">{dispatch.skipped_count}</p>
                    <p className="text-xs text-muted-foreground">Pulados</p>
                  </div>
                )}
                {dispatch.error_count > 0 && (
                  <div className="p-2 rounded-lg bg-destructive/10 text-center">
                    <p className="text-lg font-bold text-destructive">{dispatch.error_count}</p>
                    <p className="text-xs text-muted-foreground">Erros</p>
                  </div>
                )}
              </div>
            </div>

            {/* Timestamps */}
            <div className="text-xs text-muted-foreground pt-2 border-t">
              <p>Criado em: {format(new Date(dispatch.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
              {dispatch.started_at && (
                <p>Iniciado em: {format(new Date(dispatch.started_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
              )}
              {dispatch.completed_at && (
                <p>Concluído em: {format(new Date(dispatch.completed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
