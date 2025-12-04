import { useState, useEffect } from 'react';
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
import { usePipelines, usePipelineStages, useDeals as useDealsHook, useCreateDeal, useUpdateDeal } from '@/hooks/useDeals';
import { useTeam } from '@/hooks/useTeam';

interface Stage {
  id: string;
  name: string;
  order: number;
  color: string;
}

interface Deal {
  id: string;
  contactName: string;
  value: number | null;
  stageId: string;
  description: string;
  lastActivity: string;
  contactId: string;
  tags: string[];
}

const mockStages: Stage[] = [
  { id: '1', name: 'CATÁLOGO', order: 1, color: '#FEF3C7' },
  { id: '2', name: 'LAYOUT', order: 2, color: '#DDD6FE' },
  { id: '3', name: 'APROVAÇÃO', order: 3, color: '#DBEAFE' },
  { id: '4', name: 'PRODUÇÃO', order: 4, color: '#D1FAE5' },
  { id: '5', name: 'ENTREGA', order: 5, color: '#FED7AA' },
  { id: '6', name: 'FECHADO', order: 6, color: '#BBF7D0' },
];

const initialDeals: Deal[] = [];

const teamMembers = ['D', 'I', 'L', 'M', 'R'];

export default function CRM() {
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [showAddDealModal, setShowAddDealModal] = useState(false);
  const [showDealDetailsModal, setShowDealDetailsModal] = useState(false);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPipeline, setSelectedPipeline] = useState('sales');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const totalDeals = deals.length;
  const totalValue = deals.reduce((sum, deal) => sum + (deal.value || 0), 0);
  const avgTicket = totalDeals > 0 ? totalValue / totalDeals : 0;

  const handleDragStart = (event: DragStartEvent) => {
    const deal = deals.find((d) => d.id === event.active.id);
    if (deal) setActiveDeal(deal);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDeal(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if dropped over a stage
    const targetStage = mockStages.find((s) => s.id === overId);
    if (targetStage) {
      setDeals((prev) =>
        prev.map((deal) =>
          deal.id === activeId
            ? { ...deal, stageId: targetStage.id, lastActivity: new Date().toISOString() }
            : deal
        )
      );
      toast({
        title: 'Negócio movido',
        description: `Movido para ${targetStage.name}`,
      });
    }
  };

  const handleOpenDealDetails = (deal: Deal) => {
    setSelectedDeal(deal);
    setShowDealDetailsModal(true);
  };

  const getDealsForStage = (stageId: string) => {
    return deals.filter(
      (deal) =>
        deal.stageId === stageId &&
        deal.contactName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-foreground">CRM - Negócios</h1>

          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground font-medium">Pipeline:</Label>
            <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sales">Venda</SelectItem>
                <SelectItem value="post-sales">Pós-venda</SelectItem>
                <SelectItem value="prospecting">Prospecção</SelectItem>
                <SelectItem value="renewal">Renovação</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon">
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
            {teamMembers.map((initial, idx) => (
              <div
                key={idx}
                className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-pink-500 border-2 border-background flex items-center justify-center text-white text-xs font-bold shadow-lg hover:z-10 transition-all cursor-pointer hover:scale-110"
              >
                {initial}
              </div>
            ))}
          </div>

          <Button onClick={() => setShowAddDealModal(true)} className="btn-gradient">
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
        <StatCard icon={Target} label="Taxa de Conversão" value="25%" iconColor="text-blue-600" />
        <StatCard
          icon={BarChart3}
          label="Ticket Médio"
          value={`R$ ${avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          iconColor="text-orange-600"
        />
        <StatCard icon={Clock} label="Tempo Médio" value="5 dias" iconColor="text-red-600" />
      </div>

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {mockStages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              deals={getDealsForStage(stage.id)}
              onOpenDealDetails={handleOpenDealDetails}
              onAddDeal={() => setShowAddDealModal(true)}
            />
          ))}
        </div>

        <DragOverlay>
          {activeDeal && <DealCard deal={activeDeal} isOverlay />}
        </DragOverlay>
      </DndContext>

      {/* Add Deal Modal */}
      <AddDealModal open={showAddDealModal} onOpenChange={setShowAddDealModal} stages={mockStages} />

      {/* Deal Details Modal */}
      <DealDetailsModal
        open={showDealDetailsModal}
        onOpenChange={setShowDealDetailsModal}
        deal={selectedDeal}
        stages={mockStages}
      />

      {/* Filters Modal */}
      <FiltersModal open={showFiltersModal} onOpenChange={setShowFiltersModal} stages={mockStages} />
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

// Kanban Column Component
function KanbanColumn({
  stage,
  deals,
  onOpenDealDetails,
  onAddDeal,
}: {
  stage: Stage;
  deals: Deal[];
  onOpenDealDetails: (deal: Deal) => void;
  onAddDeal: () => void;
}) {
  const { setNodeRef } = useSortable({ id: stage.id });
  const totalValue = deals.reduce((sum, deal) => sum + (deal.value || 0), 0);

  return (
    <div ref={setNodeRef} className="flex-shrink-0 w-80">
      {/* Column Header */}
      <div
        className="rounded-t-2xl p-4 border-b-4"
        style={{
          backgroundColor: stage.color,
          borderBottomColor: `${stage.color}CC`,
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
              <DropdownMenuItem>Editar coluna</DropdownMenuItem>
              <DropdownMenuItem>Ordenar por valor</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">Excluir coluna</DropdownMenuItem>
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

      {/* Cards Container */}
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
  deal: Deal;
  onClick?: () => void;
  isOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getTimeInfo = () => {
    const now = new Date();
    const lastActivity = new Date(deal.lastActivity);
    const hours = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60));

    if (hours < 24) return { text: `${hours}h`, level: 'ok' as const };
    if (hours < 48) return { text: `${Math.floor(hours / 24)}d`, level: 'warning' as const };
    return { text: `${Math.floor(hours / 24)}d`, level: 'critical' as const };
  };

  const timeInfo = getTimeInfo();

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
      {/* Card Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-semibold text-foreground text-sm mb-1 line-clamp-1">{deal.contactName}</h4>
          {deal.description && <p className="text-xs text-muted-foreground mb-2">{deal.description}</p>}
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
            <DropdownMenuItem>Editar</DropdownMenuItem>
            <DropdownMenuItem>Duplicar</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">Arquivar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Value */}
      {deal.value ? (
        <div className="mb-3">
          <span className="text-2xl font-bold text-primary">
            R$ {deal.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>
      ) : (
        <button
          onClick={(e) => e.stopPropagation()}
          className="w-full py-2 mb-3 border border-dashed border-muted-foreground/30 rounded-lg text-muted-foreground hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-1 text-sm"
        >
          <Plus size={14} />
          Adicionar valor
        </button>
      )}

      {/* Quick Actions */}
      <div className="flex items-center gap-1 mb-3">
        {[
          { icon: User, title: 'Ver perfil' },
          { icon: MessageCircle, title: 'WhatsApp' },
          { icon: Phone, title: 'Ligar' },
          { icon: Mail, title: 'Email' },
          { icon: Calendar, title: 'Agendar' },
          { icon: Paperclip, title: 'Anexar' },
        ].map(({ icon: Icon, title }) => (
          <button
            key={title}
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 hover:bg-muted rounded transition-colors"
            title={title}
          >
            <Icon size={16} className="text-muted-foreground" />
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        {deal.tags.length > 0 && (
          <div className="flex gap-1">
            {deal.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div
          className={cn(
            'px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 ml-auto',
            timeInfo.level === 'ok' && 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
            timeInfo.level === 'warning' &&
              'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: Stage[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo Negócio</DialogTitle>
          <DialogDescription>Adicione um novo negócio ao pipeline de vendas</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="dealName">
              Nome do negócio <span className="text-destructive">*</span>
            </Label>
            <Input id="dealName" placeholder="Ex: Uniformes para time de futebol" className="mt-2" />
          </div>

          <div>
            <Label>
              Contato <span className="text-destructive">*</span>
            </Label>
            <div className="relative mt-2">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input type="text" placeholder="Buscar ou criar contato..." className="pl-10" />
            </div>
            <button className="mt-2 text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1">
              <Plus size={14} />
              Criar novo contato
            </button>
          </div>

          <div>
            <Label htmlFor="dealValue">Valor do negócio</Label>
            <div className="relative mt-2">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                R$
              </span>
              <Input id="dealValue" type="number" step="0.01" placeholder="0,00" className="pl-10" />
            </div>
          </div>

          <div>
            <Label>Etapa inicial</Label>
            <Select defaultValue="1">
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
            <Label htmlFor="dealDescription">Descrição</Label>
            <Textarea
              id="dealDescription"
              rows={3}
              placeholder="Detalhes adicionais sobre o negócio..."
              className="mt-2"
            />
          </div>

          <div>
            <Label>Etiquetas</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {['Urgente', 'VIP', 'Follow-up', 'Cliente', 'Lead'].map((tag) => (
                <button
                  key={tag}
                  className="px-3 py-1.5 border border-border rounded-lg text-sm hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Responsável</Label>
            <Select>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Não atribuído" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="diego">Diego</SelectItem>
                <SelectItem value="ian">Ian</SelectItem>
                <SelectItem value="lara">Lara</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="btn-gradient">Criar negócio</Button>
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: Deal | null;
  stages: Stage[];
}) {
  if (!deal) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do Negócio</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="info" className="py-4">
          <TabsList className="mb-6">
            <TabsTrigger value="info">Informações</TabsTrigger>
            <TabsTrigger value="activity">Atividades</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
            <TabsTrigger value="files">Arquivos</TabsTrigger>
            <TabsTrigger value="notes">Notas</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label>Nome do negócio</Label>
                  <Input defaultValue={deal.contactName} className="mt-2" />
                </div>

                <div>
                  <Label>Valor</Label>
                  <Input
                    defaultValue={deal.value?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || ''}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label>Etapa atual</Label>
                  <Select defaultValue={deal.stageId}>
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
                  <Select defaultValue="diego">
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="diego">Diego</SelectItem>
                      <SelectItem value="ian">Ian</SelectItem>
                      <SelectItem value="lara">Lara</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Contato</Label>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg mt-2">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center text-white font-bold">
                      {deal.contactName.charAt(0)}
                    </div>
                    <div>
                      <div className="font-semibold text-foreground">{deal.contactName}</div>
                      <div className="text-sm text-muted-foreground">+55 (21) 98765-4321</div>
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Data de criação</Label>
                  <Input value="02/12/2025 16:00" disabled className="mt-2 bg-muted/50" />
                </div>

                <div>
                  <Label>Data prevista de fechamento</Label>
                  <Input type="date" className="mt-2" />
                </div>

                <div>
                  <Label>Etiquetas</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {deal.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium flex items-center gap-1"
                      >
                        {tag}
                        <X size={14} className="cursor-pointer hover:text-primary/70" />
                      </span>
                    ))}
                    <button className="px-3 py-1 border border-dashed border-muted-foreground/30 rounded-full text-sm text-muted-foreground hover:border-primary hover:text-primary">
                      + Adicionar
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <Label>Descrição</Label>
              <Textarea rows={4} placeholder="Adicionar descrição..." className="mt-2" />
            </div>
          </TabsContent>

          <TabsContent value="activity">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Atividades Vinculadas</h3>
                <Button size="sm" className="btn-gradient">
                  <Plus size={16} />
                  Nova Atividade
                </Button>
              </div>

              <div className="space-y-3">
                {[
                  { type: 'call', title: 'Ligação com cliente', date: '03/12/2025 14:30', status: 'completed' },
                  { type: 'meeting', title: 'Reunião de apresentação', date: '05/12/2025 10:00', status: 'scheduled' },
                  { type: 'email', title: 'Enviar proposta', date: '04/12/2025 09:00', status: 'pending' },
                ].map((activity, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-4 bg-muted/50 rounded-xl">
                    <div
                      className={cn(
                        'p-2 rounded-lg',
                        activity.status === 'completed' && 'bg-green-100 dark:bg-green-950',
                        activity.status === 'scheduled' && 'bg-blue-100 dark:bg-blue-950',
                        activity.status === 'pending' && 'bg-yellow-100 dark:bg-yellow-950'
                      )}
                    >
                      {activity.type === 'call' && <Phone size={18} className="text-green-700 dark:text-green-300" />}
                      {activity.type === 'meeting' && <Users size={18} className="text-blue-700 dark:text-blue-300" />}
                      {activity.type === 'email' && <Mail size={18} className="text-yellow-700 dark:text-yellow-300" />}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-foreground">{activity.title}</div>
                      <div className="text-sm text-muted-foreground">{activity.date}</div>
                    </div>
                    <span
                      className={cn(
                        'px-2 py-1 rounded-full text-xs font-medium',
                        activity.status === 'completed' && 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
                        activity.status === 'scheduled' && 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
                        activity.status === 'pending' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300'
                      )}
                    >
                      {activity.status === 'completed' && 'Concluído'}
                      {activity.status === 'scheduled' && 'Agendado'}
                      {activity.status === 'pending' && 'Pendente'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history">
            <div className="space-y-4">
              <h3 className="font-semibold text-foreground">Histórico de Movimentações</h3>

              <div className="relative border-l-2 border-border pl-6 space-y-6">
                {[
                  { action: 'Negócio criado', stage: 'Catálogo', date: '01/12/2025 10:00', user: 'Diego' },
                  { action: 'Movido para', stage: 'Layout', date: '02/12/2025 14:30', user: 'Diego' },
                  { action: 'Valor adicionado', stage: 'R$ 899,00', date: '02/12/2025 16:00', user: 'Ian' },
                ].map((item, idx) => (
                  <div key={idx} className="relative">
                    <div className="absolute -left-[30px] w-4 h-4 bg-primary rounded-full border-4 border-background"></div>
                    <div className="bg-muted/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-foreground">{item.action}</span>
                        <span className="text-xs text-muted-foreground">{item.date}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">{item.stage}</div>
                      <div className="text-xs text-muted-foreground mt-1">Por {item.user}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="files">
            <div className="text-center py-12 text-muted-foreground">
              <Paperclip size={48} className="mx-auto mb-4 opacity-50" />
              <p>Nenhum arquivo anexado</p>
              <Button variant="outline" className="mt-4">
                <Plus size={16} />
                Adicionar arquivo
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="notes">
            <div className="space-y-4">
              <Textarea rows={4} placeholder="Adicionar nota..." />
              <Button className="btn-gradient">Salvar nota</Button>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" className="text-destructive hover:bg-destructive/10">
            Arquivar negócio
          </Button>
          <Button className="btn-gradient">Salvar alterações</Button>
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: Stage[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Filtros Avançados</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label className="mb-2 block">Etapa do funil</Label>
            <div className="space-y-2">
              {stages.map((stage) => (
                <label key={stage.id} className="flex items-center gap-2">
                  <Checkbox defaultChecked />
                  <span className="text-sm text-foreground">{stage.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label>Responsável</Label>
            <Select>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="diego">Diego</SelectItem>
                <SelectItem value="ian">Ian</SelectItem>
                <SelectItem value="lara">Lara</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-2 block">Valor do negócio</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" placeholder="Mínimo (R$)" />
              <Input type="number" placeholder="Máximo (R$)" />
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Data de criação</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" />
              <Input type="date" />
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Etiquetas</Label>
            <div className="flex flex-wrap gap-2">
              {['Urgente', 'VIP', 'Follow-up', 'Cliente'].map((tag) => (
                <button
                  key={tag}
                  className="px-3 py-1 border border-border rounded-lg text-sm hover:border-primary hover:bg-primary/5"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Status do alerta</Label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <Checkbox />
                <span className="text-sm text-green-700 dark:text-green-300">✓ Ok</span>
              </label>
              <label className="flex items-center gap-2">
                <Checkbox />
                <span className="text-sm text-yellow-700 dark:text-yellow-300">⚠ Atenção</span>
              </label>
              <label className="flex items-center gap-2">
                <Checkbox />
                <span className="text-sm text-red-700 dark:text-red-300">⚠ Crítico</span>
              </label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline">Limpar filtros</Button>
          <Button className="btn-gradient">Aplicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
