import { useState, useEffect, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  SlidersHorizontal,
  Search,
  TrendingUp,
  DollarSign,
  Target,
  BarChart3,
  Clock,
  MoreVertical,
  User,
  MessageCircle,
  Phone,
  Mail,
  Calendar,
  Paperclip,
  Users,
  X,
  Loader2,
  Edit,
  Trash2,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  usePipelines,
  usePipelineStages,
  useDeals as useDealsHook,
  useCreateDeal,
  useUpdateDeal,
  useDeleteDeal,
  useCreatePipeline,
  useCreatePipelineStage,
  type Deal as DealType,
  type PipelineStage,
} from '@/hooks/useDeals';
import { useTeam } from '@/hooks/useTeam';
import { useContacts } from '@/hooks/useContacts';
import { useTags } from '@/hooks/useTags';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

const DEFAULT_STAGE_COLORS = [
  '#FEF3C7', '#DDD6FE', '#DBEAFE', '#D1FAE5', '#FED7AA', '#BBF7D0',
  '#FECACA', '#E0E7FF', '#CCFBF1', '#FEE2E2'
];

export default function CRM() {
  const queryClient = useQueryClient();
  const [activeDeal, setActiveDeal] = useState<DealType | null>(null);
  const [showAddDealModal, setShowAddDealModal] = useState(false);
  const [showDealDetailsModal, setShowDealDetailsModal] = useState(false);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showPipelineModal, setShowPipelineModal] = useState(false);
  const [showStageModal, setShowStageModal] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<DealType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [initialStageId, setInitialStageId] = useState<string | null>(null);

  // Filters state
  const [filterAssignedTo, setFilterAssignedTo] = useState<string | null>(null);
  const [filterMinValue, setFilterMinValue] = useState<string>('');
  const [filterMaxValue, setFilterMaxValue] = useState<string>('');

  // Data hooks
  const { data: pipelines, isLoading: pipelinesLoading } = usePipelines();
  const { data: stages, isLoading: stagesLoading } = usePipelineStages(selectedPipelineId);
  const { data: deals, isLoading: dealsLoading } = useDealsHook(selectedPipelineId);
  const { data: teamMembers } = useTeam();
  const { data: contacts } = useContacts();

  const updateDeal = useUpdateDeal();

  // Auto-select first pipeline
  useEffect(() => {
    if (pipelines && pipelines.length > 0 && !selectedPipelineId) {
      setSelectedPipelineId(pipelines[0].id);
    }
  }, [pipelines, selectedPipelineId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor)
  );

  // Apply filters
  const filteredDeals = useMemo(() => {
    if (!deals) return [];
    return deals.filter(deal => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        deal.title.toLowerCase().includes(searchLower) ||
        deal.contact?.full_name?.toLowerCase().includes(searchLower);
      
      // Assigned to filter
      const matchesAssigned = !filterAssignedTo || filterAssignedTo === 'all' || 
        deal.assigned_to === filterAssignedTo;
      
      // Value filters
      const minVal = filterMinValue ? parseFloat(filterMinValue) : null;
      const maxVal = filterMaxValue ? parseFloat(filterMaxValue) : null;
      const dealValue = deal.value || 0;
      const matchesMinValue = !minVal || dealValue >= minVal;
      const matchesMaxValue = !maxVal || dealValue <= maxVal;

      return matchesSearch && matchesAssigned && matchesMinValue && matchesMaxValue;
    });
  }, [deals, searchQuery, filterAssignedTo, filterMinValue, filterMaxValue]);

  // Statistics
  const totalDeals = filteredDeals.length;
  const totalValue = filteredDeals.reduce((sum, deal) => sum + (deal.value || 0), 0);
  const avgTicket = totalDeals > 0 ? totalValue / totalDeals : 0;
  const wonDeals = filteredDeals.filter(d => d.status === 'won').length;
  const conversionRate = totalDeals > 0 ? ((wonDeals / totalDeals) * 100).toFixed(0) : '0';

  const handleDragStart = (event: DragStartEvent) => {
    const deal = filteredDeals.find((d) => d.id === event.active.id);
    if (deal) setActiveDeal(deal);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDeal(null);

    if (!over || !stages) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const targetStage = stages.find((s) => s.id === overId);
    if (targetStage) {
      const deal = filteredDeals.find(d => d.id === activeId);
      if (deal && deal.stage_id !== targetStage.id) {
        try {
          await updateDeal.mutateAsync({
            id: activeId,
            stage_id: targetStage.id,
          });
          toast({
            title: 'Negócio movido',
            description: `Movido para ${targetStage.name}`,
          });
        } catch {
          toast({
            title: 'Erro',
            description: 'Não foi possível mover o negócio',
            variant: 'destructive',
          });
        }
      }
    }
  };

  const handleOpenDealDetails = (deal: DealType) => {
    setSelectedDeal(deal);
    setShowDealDetailsModal(true);
  };

  const handleAddDealToStage = (stageId: string) => {
    setInitialStageId(stageId);
    setShowAddDealModal(true);
  };

  const getDealsForStage = (stageId: string) => {
    return filteredDeals.filter((deal) => deal.stage_id === stageId);
  };

  const clearFilters = () => {
    setFilterAssignedTo(null);
    setFilterMinValue('');
    setFilterMaxValue('');
    setShowFiltersModal(false);
  };

  const isLoading = pipelinesLoading || stagesLoading || dealsLoading;

  if (isLoading && !pipelines) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-foreground">CRM - Negócios</h1>

          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground font-medium">Pipeline:</Label>
            <Select value={selectedPipelineId || ''} onValueChange={setSelectedPipelineId}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {pipelines?.map((pipeline) => (
                  <SelectItem key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={() => setShowPipelineModal(true)}>
              <Plus size={18} />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" onClick={() => setShowFiltersModal(true)}>
            <SlidersHorizontal size={18} />
            Filtrar
          </Button>

          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar negócios..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64"
            />
          </div>

          <div className="flex items-center -space-x-2">
            {teamMembers?.slice(0, 5).map((member) => (
              <div
                key={member.id}
                className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-pink-500 border-2 border-background flex items-center justify-center text-white text-xs font-bold shadow-lg hover:z-10 transition-all cursor-pointer hover:scale-110"
                title={member.full_name || 'Usuário'}
              >
                {member.full_name?.charAt(0).toUpperCase() || 'U'}
              </div>
            ))}
          </div>

          <Button onClick={() => { setInitialStageId(null); setShowAddDealModal(true); }} className="btn-gradient">
            <Plus size={18} />
            Novo Negócio
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard icon={TrendingUp} label="Total de Negócios" value={totalDeals.toString()} iconColor="text-primary" />
        <StatCard
          icon={DollarSign}
          label="Valor Total"
          value={`R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          iconColor="text-green-600"
        />
        <StatCard icon={Target} label="Taxa de Conversão" value={`${conversionRate}%`} iconColor="text-blue-600" />
        <StatCard
          icon={BarChart3}
          label="Ticket Médio"
          value={`R$ ${avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          iconColor="text-orange-600"
        />
        <StatCard icon={Clock} label="Negócios Ganhos" value={wonDeals.toString()} iconColor="text-emerald-600" />
      </div>

      {/* Kanban Board */}
      {selectedPipelineId && stages && stages.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {stages.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                deals={getDealsForStage(stage.id)}
                onOpenDealDetails={handleOpenDealDetails}
                onAddDeal={() => handleAddDealToStage(stage.id)}
                pipelineId={selectedPipelineId}
              />
            ))}
            <AddStageButton onClick={() => setShowStageModal(true)} />
          </div>

          <DragOverlay>
            {activeDeal && <DealCard deal={activeDeal} isOverlay />}
          </DragOverlay>
        </DndContext>
      ) : selectedPipelineId && stages?.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Este pipeline não tem etapas ainda.</p>
          <Button onClick={() => setShowStageModal(true)} className="btn-gradient">
            <Plus size={18} />
            Criar primeira etapa
          </Button>
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Crie um pipeline para começar.</p>
          <Button onClick={() => setShowPipelineModal(true)} className="btn-gradient">
            <Plus size={18} />
            Criar Pipeline
          </Button>
        </div>
      )}

      {/* Modals */}
      <AddDealModal
        open={showAddDealModal}
        onOpenChange={setShowAddDealModal}
        stages={stages || []}
        pipelineId={selectedPipelineId}
        initialStageId={initialStageId}
        contacts={contacts || []}
        teamMembers={teamMembers || []}
      />

      <DealDetailsModal
        open={showDealDetailsModal}
        onOpenChange={setShowDealDetailsModal}
        deal={selectedDeal}
        stages={stages || []}
        teamMembers={teamMembers || []}
      />

      <FiltersModal
        open={showFiltersModal}
        onOpenChange={setShowFiltersModal}
        stages={stages || []}
        teamMembers={teamMembers || []}
        filterAssignedTo={filterAssignedTo}
        setFilterAssignedTo={setFilterAssignedTo}
        filterMinValue={filterMinValue}
        setFilterMinValue={setFilterMinValue}
        filterMaxValue={filterMaxValue}
        setFilterMaxValue={setFilterMaxValue}
        clearFilters={clearFilters}
      />

      <PipelineModal
        open={showPipelineModal}
        onOpenChange={setShowPipelineModal}
      />

      <StageModal
        open={showStageModal}
        onOpenChange={setShowStageModal}
        pipelineId={selectedPipelineId}
        existingStagesCount={stages?.length || 0}
      />
    </div>
  );
}

// Stat Card Component
function StatCard({
  icon: Icon,
  label,
  value,
  iconColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  iconColor: string;
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-4 shadow-card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground font-medium">{label}</span>
        <Icon size={16} className={iconColor} />
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
    </div>
  );
}

// Add Stage Button
function AddStageButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 w-80 min-h-[200px] border-2 border-dashed border-muted-foreground/30 rounded-2xl flex items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-all"
    >
      <Plus size={20} />
      <span className="font-medium">Nova Etapa</span>
    </button>
  );
}

// Kanban Column Component
function KanbanColumn({
  stage,
  deals,
  onOpenDealDetails,
  onAddDeal,
  pipelineId,
}: {
  stage: PipelineStage;
  deals: DealType[];
  onOpenDealDetails: (deal: DealType) => void;
  onAddDeal: () => void;
  pipelineId: string;
}) {
  const { setNodeRef } = useSortable({ id: stage.id });
  const totalValue = deals.reduce((sum, deal) => sum + (deal.value || 0), 0);
  const queryClient = useQueryClient();

  const handleDeleteStage = async () => {
    if (deals.length > 0) {
      toast({
        title: 'Não é possível excluir',
        description: 'Esta etapa possui negócios. Mova-os antes de excluir.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase.from('pipeline_stages').delete().eq('id', stage.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['pipeline_stages', pipelineId] });
      toast({ title: 'Etapa excluída' });
    } catch {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    }
  };

  return (
    <div ref={setNodeRef} className="flex-shrink-0 w-80">
      <div
        className="rounded-t-2xl p-4 border-b-4"
        style={{
          backgroundColor: stage.color || '#DDD6FE',
          borderBottomColor: `${stage.color || '#DDD6FE'}CC`,
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-gray-900 text-sm uppercase tracking-wide">{stage.name}</h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 hover:bg-white/50 rounded transition-colors">
                <MoreVertical size={16} className="text-gray-700" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onAddDeal}>
                <Plus size={14} className="mr-2" />
                Adicionar negócio
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDeleteStage} className="text-destructive">
                <Trash2 size={14} className="mr-2" />
                Excluir etapa
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-700 font-medium">
            {deals.length} {deals.length === 1 ? 'negócio' : 'negócios'}
          </span>
          <span className="text-gray-900 font-bold">
            R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <div className="bg-muted/30 rounded-b-2xl p-4 min-h-[500px] space-y-3 border border-t-0 border-border">
        <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} onClick={() => onOpenDealDetails(deal)} />
          ))}
        </SortableContext>

        <button
          onClick={onAddDeal}
          className="w-full py-3 border-2 border-dashed border-muted-foreground/30 rounded-xl text-muted-foreground hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2 text-sm font-medium"
        >
          <Plus size={16} />
          Adicionar negócio
        </button>
      </div>
    </div>
  );
}

// Deal Card Component
function DealCard({
  deal,
  onClick,
  isOverlay = false,
}: {
  deal: DealType;
  onClick?: () => void;
  isOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
  });
  const deleteDeal = useDeleteDeal();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getTimeInfo = () => {
    if (!deal.last_activity_at) return { text: 'Novo', level: 'ok' as const };
    const now = new Date();
    const lastActivity = new Date(deal.last_activity_at);
    const hours = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60));

    if (hours < 24) return { text: `${hours}h`, level: 'ok' as const };
    if (hours < 48) return { text: `${Math.floor(hours / 24)}d`, level: 'warning' as const };
    return { text: `${Math.floor(hours / 24)}d`, level: 'critical' as const };
  };

  const handleArchive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDeal.mutateAsync({ id: deal.id, pipelineId: deal.pipeline_id });
      toast({ title: 'Negócio arquivado' });
    } catch {
      toast({ title: 'Erro ao arquivar', variant: 'destructive' });
    }
  };

  const timeInfo = getTimeInfo();
  const displayName = deal.contact?.full_name || deal.title;

  return (
    <div
      ref={setNodeRef}
      style={isOverlay ? undefined : style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        'bg-card rounded-xl border border-border p-4 shadow-card hover:shadow-card-hover transition-all cursor-grab active:cursor-grabbing',
        isOverlay && 'shadow-elevated rotate-3'
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-semibold text-foreground text-sm mb-1 line-clamp-1">{deal.title}</h4>
          {deal.contact && (
            <p className="text-xs text-muted-foreground mb-1">{deal.contact.full_name}</p>
          )}
          {deal.description && <p className="text-xs text-muted-foreground line-clamp-1">{deal.description}</p>}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="p-1 hover:bg-muted rounded transition-colors"
            >
              <MoreVertical size={14} className="text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onClick}>
              <Edit size={14} className="mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleArchive} className="text-destructive">
              <Trash2 size={14} className="mr-2" />
              Arquivar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {deal.value ? (
        <div className="mb-3">
          <span className="text-2xl font-bold text-primary">
            R$ {deal.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>
      ) : (
        <div className="mb-3 text-sm text-muted-foreground">Sem valor definido</div>
      )}

      {deal.assignee && (
        <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
          <User size={12} />
          <span>{deal.assignee.full_name}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        {deal.expected_close_date && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar size={12} />
            <span>{new Date(deal.expected_close_date).toLocaleDateString('pt-BR')}</span>
          </div>
        )}

        <div
          className={cn(
            'px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 ml-auto',
            timeInfo.level === 'ok' && 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
            timeInfo.level === 'warning' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
            timeInfo.level === 'critical' && 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
          )}
        >
          <Clock size={12} />
          {timeInfo.text}
        </div>
      </div>
    </div>
  );
}

// Add Deal Modal
function AddDealModal({
  open,
  onOpenChange,
  stages,
  pipelineId,
  initialStageId,
  contacts,
  teamMembers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: PipelineStage[];
  pipelineId: string | null;
  initialStageId: string | null;
  contacts: { id: string; full_name: string; phone: string }[];
  teamMembers: { id: string; full_name: string | null }[];
}) {
  const [title, setTitle] = useState('');
  const [contactId, setContactId] = useState('');
  const [value, setValue] = useState('');
  const [stageId, setStageId] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [expectedCloseDate, setExpectedCloseDate] = useState('');
  const [contactSearch, setContactSearch] = useState('');

  const createDeal = useCreateDeal();

  useEffect(() => {
    if (open) {
      setStageId(initialStageId || stages[0]?.id || '');
    }
  }, [open, initialStageId, stages]);

  const filteredContacts = contacts.filter(c =>
    c.full_name.toLowerCase().includes(contactSearch.toLowerCase()) ||
    c.phone.includes(contactSearch)
  );

  const handleSubmit = async () => {
    if (!title || !pipelineId || !stageId) {
      toast({ title: 'Preencha os campos obrigatórios', variant: 'destructive' });
      return;
    }

    try {
      await createDeal.mutateAsync({
        title,
        pipeline_id: pipelineId,
        stage_id: stageId,
        value: value ? parseFloat(value) : null,
        contact_id: contactId || null,
        assigned_to: assignedTo || null,
        description: description || null,
        expected_close_date: expectedCloseDate || null,
      });
      toast({ title: 'Negócio criado com sucesso!' });
      onOpenChange(false);
      setTitle('');
      setContactId('');
      setValue('');
      setDescription('');
      setAssignedTo('');
      setExpectedCloseDate('');
      setContactSearch('');
    } catch {
      toast({ title: 'Erro ao criar negócio', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo Negócio</DialogTitle>
          <DialogDescription>Adicione um novo negócio ao pipeline</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="dealTitle">
              Título do negócio <span className="text-destructive">*</span>
            </Label>
            <Input
              id="dealTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Venda de uniformes"
              className="mt-2"
            />
          </div>

          <div>
            <Label>Contato</Label>
            <div className="relative mt-2">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar contato..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            {contactSearch && (
              <div className="mt-2 max-h-32 overflow-y-auto border border-border rounded-lg">
                {filteredContacts.slice(0, 5).map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => {
                      setContactId(contact.id);
                      setContactSearch(contact.full_name);
                    }}
                    className={cn(
                      'w-full px-3 py-2 text-left hover:bg-muted text-sm',
                      contactId === contact.id && 'bg-primary/10'
                    )}
                  >
                    <div className="font-medium">{contact.full_name}</div>
                    <div className="text-xs text-muted-foreground">{contact.phone}</div>
                  </button>
                ))}
                {filteredContacts.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum contato encontrado</div>
                )}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="dealValue">Valor do negócio</Label>
            <div className="relative mt-2">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">R$</span>
              <Input
                id="dealValue"
                type="number"
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0,00"
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <Label>Etapa inicial</Label>
            <Select value={stageId} onValueChange={setStageId}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {stages.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Responsável</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Não atribuído" />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.full_name || 'Sem nome'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="expectedClose">Data prevista de fechamento</Label>
            <Input
              id="expectedClose"
              type="date"
              value={expectedCloseDate}
              onChange={(e) => setExpectedCloseDate(e.target.value)}
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="dealDescription">Descrição</Label>
            <Textarea
              id="dealDescription"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes adicionais sobre o negócio..."
              className="mt-2"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={createDeal.isPending} className="btn-gradient">
            {createDeal.isPending && <Loader2 size={16} className="mr-2 animate-spin" />}
            Criar negócio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Deal Details Modal
function DealDetailsModal({
  open,
  onOpenChange,
  deal,
  stages,
  teamMembers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: DealType | null;
  stages: PipelineStage[];
  teamMembers: { id: string; full_name: string | null }[];
}) {
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [stageId, setStageId] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [description, setDescription] = useState('');
  const [expectedCloseDate, setExpectedCloseDate] = useState('');
  const [status, setStatus] = useState('open');

  const updateDeal = useUpdateDeal();
  const deleteDeal = useDeleteDeal();

  useEffect(() => {
    if (deal) {
      setTitle(deal.title);
      setValue(deal.value?.toString() || '');
      setStageId(deal.stage_id);
      setAssignedTo(deal.assigned_to || '');
      setDescription(deal.description || '');
      setExpectedCloseDate(deal.expected_close_date || '');
      setStatus(deal.status || 'open');
    }
  }, [deal]);

  if (!deal) return null;

  const handleSave = async () => {
    try {
      await updateDeal.mutateAsync({
        id: deal.id,
        title,
        value: value ? parseFloat(value) : null,
        stage_id: stageId,
        assigned_to: assignedTo || null,
        description: description || null,
        expected_close_date: expectedCloseDate || null,
        status,
      });
      toast({ title: 'Negócio atualizado!' });
      onOpenChange(false);
    } catch {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    }
  };

  const handleArchive = async () => {
    try {
      await deleteDeal.mutateAsync({ id: deal.id, pipelineId: deal.pipeline_id });
      toast({ title: 'Negócio arquivado' });
      onOpenChange(false);
    } catch {
      toast({ title: 'Erro ao arquivar', variant: 'destructive' });
    }
  };

  const handleMarkAsWon = async () => {
    try {
      await updateDeal.mutateAsync({
        id: deal.id,
        status: 'won',
        closed_at: new Date().toISOString(),
      });
      toast({ title: 'Negócio marcado como ganho!' });
      onOpenChange(false);
    } catch {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    }
  };

  const handleMarkAsLost = async () => {
    try {
      await updateDeal.mutateAsync({
        id: deal.id,
        status: 'lost',
        closed_at: new Date().toISOString(),
      });
      toast({ title: 'Negócio marcado como perdido' });
      onOpenChange(false);
    } catch {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do Negócio</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-2" />
            </div>

            <div>
              <Label>Valor</Label>
              <div className="relative mt-2">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                <Input
                  type="number"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label>Etapa atual</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Responsável</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Não atribuído" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name || 'Sem nome'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Data prevista de fechamento</Label>
              <Input
                type="date"
                value={expectedCloseDate}
                onChange={(e) => setExpectedCloseDate(e.target.value)}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Aberto</SelectItem>
                  <SelectItem value="won">Ganho</SelectItem>
                  <SelectItem value="lost">Perdido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {deal.contact && (
            <div>
              <Label>Contato vinculado</Label>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg mt-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center text-white font-bold">
                  {deal.contact.full_name.charAt(0)}
                </div>
                <div>
                  <div className="font-semibold text-foreground">{deal.contact.full_name}</div>
                  <div className="text-sm text-muted-foreground">{deal.contact.phone}</div>
                </div>
              </div>
            </div>
          )}

          <div>
            <Label>Descrição</Label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Adicionar descrição..."
              className="mt-2"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleMarkAsWon} variant="outline" className="text-green-600 hover:bg-green-50">
              <Check size={16} className="mr-2" />
              Marcar como Ganho
            </Button>
            <Button onClick={handleMarkAsLost} variant="outline" className="text-red-600 hover:bg-red-50">
              <X size={16} className="mr-2" />
              Marcar como Perdido
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleArchive} className="text-destructive hover:bg-destructive/10">
            Arquivar negócio
          </Button>
          <Button onClick={handleSave} disabled={updateDeal.isPending} className="btn-gradient">
            {updateDeal.isPending && <Loader2 size={16} className="mr-2 animate-spin" />}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Filters Modal
function FiltersModal({
  open,
  onOpenChange,
  stages,
  teamMembers,
  filterAssignedTo,
  setFilterAssignedTo,
  filterMinValue,
  setFilterMinValue,
  filterMaxValue,
  setFilterMaxValue,
  clearFilters,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: PipelineStage[];
  teamMembers: { id: string; full_name: string | null }[];
  filterAssignedTo: string | null;
  setFilterAssignedTo: (v: string | null) => void;
  filterMinValue: string;
  setFilterMinValue: (v: string) => void;
  filterMaxValue: string;
  setFilterMaxValue: (v: string) => void;
  clearFilters: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Filtros Avançados</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Responsável</Label>
            <Select value={filterAssignedTo || 'all'} onValueChange={setFilterAssignedTo}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {teamMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.full_name || 'Sem nome'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-2 block">Valor do negócio</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                placeholder="Mínimo (R$)"
                value={filterMinValue}
                onChange={(e) => setFilterMinValue(e.target.value)}
              />
              <Input
                type="number"
                placeholder="Máximo (R$)"
                value={filterMaxValue}
                onChange={(e) => setFilterMaxValue(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={clearFilters}>
            Limpar filtros
          </Button>
          <Button onClick={() => onOpenChange(false)} className="btn-gradient">
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Pipeline Modal
function PipelineModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const createPipeline = useCreatePipeline();

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }

    try {
      await createPipeline.mutateAsync({ name, description: description || null });
      toast({ title: 'Pipeline criado!' });
      onOpenChange(false);
      setName('');
      setDescription('');
    } catch {
      toast({ title: 'Erro ao criar pipeline', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Pipeline</DialogTitle>
          <DialogDescription>Crie um novo pipeline para organizar seus negócios</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Nome do Pipeline *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Vendas, Pós-venda..."
              className="mt-2"
            />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição opcional..."
              className="mt-2"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={createPipeline.isPending} className="btn-gradient">
            {createPipeline.isPending && <Loader2 size={16} className="mr-2 animate-spin" />}
            Criar Pipeline
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Stage Modal
function StageModal({
  open,
  onOpenChange,
  pipelineId,
  existingStagesCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineId: string | null;
  existingStagesCount: number;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_STAGE_COLORS[0]);
  const createStage = useCreatePipelineStage();

  const handleCreate = async () => {
    if (!name.trim() || !pipelineId) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }

    try {
      await createStage.mutateAsync({
        pipeline_id: pipelineId,
        name,
        color,
        order_position: existingStagesCount,
      });
      toast({ title: 'Etapa criada!' });
      onOpenChange(false);
      setName('');
      setColor(DEFAULT_STAGE_COLORS[0]);
    } catch {
      toast({ title: 'Erro ao criar etapa', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Etapa</DialogTitle>
          <DialogDescription>Adicione uma nova etapa ao pipeline</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Nome da Etapa *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Qualificação, Proposta..."
              className="mt-2"
            />
          </div>
          <div>
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {DEFAULT_STAGE_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    'w-8 h-8 rounded-lg border-2 transition-all',
                    color === c ? 'border-foreground scale-110' : 'border-transparent'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={createStage.isPending} className="btn-gradient">
            {createStage.isPending && <Loader2 size={16} className="mr-2 animate-spin" />}
            Criar Etapa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
