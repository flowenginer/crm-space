import { useState, useMemo } from 'react';
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
  Search,
  MoreVertical,
  User,
  Phone,
  Mail,
  Clock,
  Trash2,
  Loader2,
  X,
  DollarSign,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  useLeadStatuses,
  useLeadStatusSummary,
  useContactsByLeadStatus,
  useUpdateContactLeadStatus,
  useCreateLeadStatus,
  useDeleteLeadStatus,
  type LeadStatus,
  type ContactForKanban,
} from '@/hooks/useLeadKanban';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const DEFAULT_COLORS = [
  '#FEF3C7', '#DDD6FE', '#DBEAFE', '#D1FAE5', '#FED7AA', '#BBF7D0',
  '#FECACA', '#E0E7FF', '#CCFBF1', '#86EFAC', '#A78BFA', '#F87171',
  '#93C5FD', '#34D399'
];

export default function LeadKanban() {
  const navigate = useNavigate();
  const [activeContact, setActiveContact] = useState<ContactForKanban | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddStatusModal, setShowAddStatusModal] = useState(false);

  const { data: leadStatuses, isLoading: statusesLoading } = useLeadStatuses();
  const { data: summaryMap, isLoading: summaryLoading } = useLeadStatusSummary();
  const updateLeadStatus = useUpdateContactLeadStatus();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
    // We need to find the contact from the currently loaded contacts in the columns
    setActiveContact(null); // Will be set when column provides data
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveContact(null);

    if (!over || !leadStatuses) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if dropped on a status column
    const targetStatus = leadStatuses.find((s) => s.id === overId);
    const isNoStatusColumn = overId === 'no-status';
    
    if (targetStatus || isNoStatusColumn) {
      try {
        // Get the target status name
        const targetStatusName = isNoStatusColumn ? '' : targetStatus!.name;
        
        await updateLeadStatus.mutateAsync({
          contactId: activeId,
          leadStatus: targetStatusName,
        });
        toast({
          title: 'Status atualizado',
          description: targetStatus ? `Movido para ${targetStatus.name}` : 'Status removido',
        });
      } catch {
        toast({
          title: 'Erro',
          description: 'Não foi possível mover o contato',
          variant: 'destructive',
        });
      }
    }
  };

  const handleOpenConversation = async (contact: ContactForKanban) => {
    try {
      const { data: conversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('contact_id', contact.id)
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (conversation) {
        navigate(`/conversations?id=${conversation.id}`);
      } else {
        toast({
          title: 'Sem conversa',
          description: 'Este contato não possui conversa ativa.',
        });
      }
    } catch {
      toast({
        title: 'Erro',
        description: 'Não foi possível abrir a conversa',
        variant: 'destructive',
      });
    }
  };

  const isLoading = statusesLoading || summaryLoading;

  // Get summary for "no status"
  const noStatusSummary = summaryMap?.['__no_status__'];
  const hasNoStatusContacts = noStatusSummary && noStatusSummary.contact_count > 0;

  if (isLoading && !leadStatuses) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar contatos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Kanban Board */}
      {leadStatuses && leadStatuses.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-wrap gap-4">
            {/* Sem Status column */}
            {hasNoStatusContacts && (
              <LeadKanbanColumn
                status={{ id: 'no-status', name: 'Sem Status', order_position: -1, color: '#9CA3AF', is_active: true, created_at: '' }}
                statusKey="__no_status__"
                count={noStatusSummary.contact_count}
                totalValue={noStatusSummary.total_value}
                onOpenConversation={handleOpenConversation}
                canDelete={false}
                searchQuery={searchQuery}
              />
            )}

            {leadStatuses.map((status) => {
              const summary = summaryMap?.[status.name];
              return (
                <LeadKanbanColumn
                  key={status.id}
                  status={status}
                  statusKey={status.name}
                  count={summary?.contact_count || 0}
                  totalValue={summary?.total_value || 0}
                  onOpenConversation={handleOpenConversation}
                  canDelete={true}
                  searchQuery={searchQuery}
                />
              );
            })}
            
            <AddStatusButton onClick={() => setShowAddStatusModal(true)} />
          </div>

          <DragOverlay>
            {activeContact && <ContactCard contact={activeContact} isOverlay />}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Nenhum status de lead configurado.</p>
          <Button onClick={() => setShowAddStatusModal(true)} className="btn-gradient">
            <Plus size={18} />
            Criar primeiro status
          </Button>
        </div>
      )}

      {/* Add Status Modal */}
      <AddStatusModal
        open={showAddStatusModal}
        onOpenChange={setShowAddStatusModal}
        existingCount={leadStatuses?.length || 0}
      />
    </div>
  );
}

// Kanban Column Component - Now loads its own contacts
const CONTACTS_LIMIT = 20;

function LeadKanbanColumn({
  status,
  statusKey,
  count,
  totalValue,
  onOpenConversation,
  canDelete,
  searchQuery,
}: {
  status: LeadStatus;
  statusKey: string;
  count: number;
  totalValue: number;
  onOpenConversation: (contact: ContactForKanban) => void;
  canDelete: boolean;
  searchQuery: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const { setNodeRef } = useSortable({ id: status.id });
  const deleteStatus = useDeleteLeadStatus();

  // Load contacts for this specific status
  const { data: contacts, isLoading } = useContactsByLeadStatus(statusKey, showAll ? 100 : CONTACTS_LIMIT);

  // Filter contacts by search query (client-side for loaded contacts)
  const filteredContacts = useMemo(() => {
    if (!contacts) return [];
    if (!searchQuery) return contacts;
    
    const search = searchQuery.toLowerCase();
    return contacts.filter(c =>
      c.full_name.toLowerCase().includes(search) ||
      c.phone.includes(search) ||
      c.email?.toLowerCase().includes(search)
    );
  }, [contacts, searchQuery]);

  const handleDeleteStatus = async () => {
    if (count > 0) {
      toast({
        title: 'Não é possível excluir',
        description: 'Este status possui contatos. Mova-os antes de excluir.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await deleteStatus.mutateAsync(status.id);
      toast({ title: 'Status excluído' });
    } catch {
      toast({ title: 'Erro ao excluir', variant: 'destructive' });
    }
  };

  const visibleContacts = filteredContacts;
  const hasMore = count > filteredContacts.length && !showAll;

  return (
    <div ref={setNodeRef} className="flex-shrink-0 w-72">
      <div
        className="rounded-t-2xl p-3 border-b-4"
        style={{
          backgroundColor: status.color || '#DDD6FE',
          borderBottomColor: `${status.color || '#DDD6FE'}CC`,
        }}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-gray-900 text-xs uppercase tracking-wide truncate">
            {status.name}
          </h3>
          {canDelete && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 hover:bg-white/50 rounded transition-colors">
                  <MoreVertical size={14} className="text-gray-700" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDeleteStatus} className="text-destructive">
                  <Trash2 size={14} className="mr-2" />
                  Excluir status
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Real count from database */}
          <span className="text-xs text-gray-700 font-medium bg-white/50 px-1.5 py-0.5 rounded">
            👤 {count.toLocaleString('pt-BR')}
          </span>
          {/* Real value from database */}
          <span className="text-xs font-semibold bg-emerald-500/20 text-emerald-800 px-1.5 py-0.5 rounded flex items-center gap-0.5">
            <DollarSign size={10} />
            R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <div className="bg-muted/30 rounded-b-2xl border border-t-0 border-border max-h-[calc(100vh-280px)] overflow-y-auto">
        <div className="p-3 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <SortableContext items={visibleContacts.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                {visibleContacts.map((contact) => (
                  <ContactCard
                    key={contact.id}
                    contact={contact}
                    onClick={() => onOpenConversation(contact)}
                  />
                ))}
              </SortableContext>
              
              {/* Ver mais button */}
              {hasMore && (
                <button
                  onClick={() => setShowAll(true)}
                  className="w-full py-2 text-xs text-primary hover:text-primary/80 font-medium transition-colors flex items-center justify-center gap-1"
                >
                  <Plus size={12} />
                  Ver mais ({count - filteredContacts.length} restantes)
                </button>
              )}
              
              {/* Show fewer button */}
              {showAll && count > CONTACTS_LIMIT && (
                <button
                  onClick={() => setShowAll(false)}
                  className="w-full py-2 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors flex items-center justify-center gap-1"
                >
                  <X size={12} />
                  Ver menos
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Contact Card Component
function ContactCard({
  contact,
  onClick,
  isOverlay = false,
}: {
  contact: ContactForKanban;
  onClick?: () => void;
  isOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: contact.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getTimeInStatus = () => {
    if (!contact.updated_at) return null;
    const now = new Date();
    const updated = new Date(contact.updated_at);
    const hours = Math.floor((now.getTime() - updated.getTime()) / (1000 * 60 * 60));

    if (hours < 1) return 'Agora';
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  return (
    <div
      ref={setNodeRef}
      style={isOverlay ? undefined : style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        'bg-card rounded-lg border border-border p-3 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing',
        isOverlay && 'shadow-elevated rotate-2'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {contact.full_name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-semibold text-foreground text-sm truncate">
              {contact.full_name}
            </h4>
          </div>
        </div>
        {getTimeInStatus() && (
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex items-center gap-1">
            <Clock size={10} />
            {getTimeInStatus()}
          </span>
        )}
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Phone size={10} />
          <span className="truncate">{contact.phone}</span>
        </div>
        {contact.email && (
          <div className="flex items-center gap-1">
            <Mail size={10} />
            <span className="truncate">{contact.email}</span>
          </div>
        )}
      </div>

      {contact.assignee && (
        <div className="mt-2 pt-2 border-t border-border">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <User size={10} />
            <span className="truncate">{contact.assignee.full_name}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Add Status Button
function AddStatusButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 w-72 h-32 rounded-2xl border-2 border-dashed border-border hover:border-primary/50 flex items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-colors"
    >
      <Plus size={20} />
      <span className="font-medium">Novo Status</span>
    </button>
  );
}

// Add Status Modal
function AddStatusModal({
  open,
  onOpenChange,
  existingCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingCount: number;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_COLORS[existingCount % DEFAULT_COLORS.length]);
  const createStatus = useCreateLeadStatus();

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({ title: 'Digite um nome para o status', variant: 'destructive' });
      return;
    }

    try {
      await createStatus.mutateAsync({
        name: name.trim(),
        color,
        order_position: existingCount,
      });
      toast({ title: 'Status criado com sucesso' });
      setName('');
      onOpenChange(false);
    } catch {
      toast({ title: 'Erro ao criar status', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo Status de Lead</DialogTitle>
          <DialogDescription>
            Crie um novo status para organizar seus leads no kanban.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="status-name">Nome do Status</Label>
            <Input
              id="status-name"
              placeholder="Ex: Qualificado, Em Negociação..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    'w-8 h-8 rounded-full border-2 transition-all',
                    color === c ? 'border-primary scale-110' : 'border-transparent'
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
          <Button onClick={handleSubmit} disabled={createStatus.isPending}>
            {createStatus.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : null}
            Criar Status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
