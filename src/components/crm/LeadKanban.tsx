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
  MessageCircle,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  useLeadStatuses,
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
  const [expandedColumns, setExpandedColumns] = useState<Set<string>>(new Set());

  const { data: leadStatuses, isLoading: statusesLoading } = useLeadStatuses();
  const { data: contacts, isLoading: contactsLoading } = useContactsByLeadStatus();
  const updateLeadStatus = useUpdateContactLeadStatus();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor)
  );

  const toggleColumnExpansion = (statusId: string) => {
    setExpandedColumns(prev => {
      const next = new Set(prev);
      if (next.has(statusId)) {
        next.delete(statusId);
      } else {
        next.add(statusId);
      }
      return next;
    });
  };

  // Filter contacts
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

  const handleDragStart = (event: DragStartEvent) => {
    const contact = filteredContacts.find((c) => c.id === event.active.id);
    if (contact) setActiveContact(contact);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveContact(null);

    if (!over || !leadStatuses) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if dropped on a status column
    const targetStatus = leadStatuses.find((s) => s.id === overId);
    if (targetStatus) {
      const contact = filteredContacts.find(c => c.id === activeId);
      if (contact && contact.lead_status !== targetStatus.name) {
        try {
          await updateLeadStatus.mutateAsync({
            contactId: activeId,
            leadStatus: targetStatus.name,
          });
          toast({
            title: 'Status atualizado',
            description: `Movido para ${targetStatus.name}`,
          });
        } catch {
          toast({
            title: 'Erro',
            description: 'Não foi possível mover o contato',
            variant: 'destructive',
          });
        }
      }
    }
  };

  const getContactsForStatus = (statusName: string) => {
    return filteredContacts.filter((c) => c.lead_status === statusName);
  };

  // Calculate total value for a list of contacts
  const getTotalValue = (contactsList: ContactForKanban[]) => {
    return contactsList.reduce((sum, c) => sum + (c.negotiated_value || 0), 0);
  };

  // Handle contacts without status (new leads)
  const getContactsWithoutStatus = () => {
    return filteredContacts.filter((c) => 
      !c.lead_status || 
      !leadStatuses?.some(s => s.name === c.lead_status)
    );
  };

  const handleOpenConversation = async (contact: ContactForKanban) => {
    try {
      // Find existing conversation for this contact
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

  const isLoading = statusesLoading || contactsLoading;

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
            {/* Sem Status column (optional) */}
            {getContactsWithoutStatus().length > 0 && (
              <LeadKanbanColumn
                status={{ id: 'no-status', name: 'Sem Status', order_position: -1, color: '#9CA3AF', is_active: true, created_at: '' }}
                contacts={getContactsWithoutStatus()}
                totalValue={getTotalValue(getContactsWithoutStatus())}
                onOpenConversation={handleOpenConversation}
                canDelete={false}
                isExpanded={expandedColumns.has('no-status')}
                onToggleExpand={() => toggleColumnExpansion('no-status')}
              />
            )}

            {leadStatuses.map((status) => {
              const statusContacts = getContactsForStatus(status.name);
              return (
                <LeadKanbanColumn
                  key={status.id}
                  status={status}
                  contacts={statusContacts}
                  totalValue={getTotalValue(statusContacts)}
                  onOpenConversation={handleOpenConversation}
                  canDelete={true}
                  isExpanded={expandedColumns.has(status.id)}
                  onToggleExpand={() => toggleColumnExpansion(status.id)}
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

// Kanban Column Component
const CONTACTS_LIMIT = 5;

function LeadKanbanColumn({
  status,
  contacts,
  totalValue,
  onOpenConversation,
  canDelete,
  isExpanded,
  onToggleExpand,
}: {
  status: LeadStatus;
  contacts: ContactForKanban[];
  totalValue: number;
  onOpenConversation: (contact: ContactForKanban) => void;
  canDelete: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const { setNodeRef } = useSortable({ id: status.id });
  const deleteStatus = useDeleteLeadStatus();

  const handleDeleteStatus = async () => {
    if (contacts.length > 0) {
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

  const visibleContacts = isExpanded ? contacts : contacts.slice(0, CONTACTS_LIMIT);
  const hiddenCount = contacts.length - CONTACTS_LIMIT;

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
          <span className="text-xs text-gray-700 font-medium bg-white/50 px-1.5 py-0.5 rounded">
            👤 {contacts.length}
          </span>
          {totalValue > 0 && (
            <span className="text-xs font-semibold bg-emerald-500/20 text-emerald-800 px-1.5 py-0.5 rounded flex items-center gap-0.5">
              <DollarSign size={10} />
              R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          )}
        </div>
      </div>

      <div className="bg-muted/30 rounded-b-2xl border border-t-0 border-border max-h-[calc(100vh-280px)] overflow-y-auto">
        <div className="p-3 space-y-2">
          <SortableContext items={visibleContacts.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {visibleContacts.map((contact) => (
              <ContactCard
                key={contact.id}
                contact={contact}
                onClick={() => onOpenConversation(contact)}
              />
            ))}
          </SortableContext>
          
          {/* Ver mais / Ver menos button */}
          {hiddenCount > 0 && (
            <button
              onClick={onToggleExpand}
              className="w-full py-2 text-xs text-primary hover:text-primary/80 font-medium transition-colors flex items-center justify-center gap-1"
            >
              {isExpanded ? (
                <>
                  <X size={12} />
                  Ver menos
                </>
              ) : (
                <>
                  <Plus size={12} />
                  Ver mais {hiddenCount} contatos
                </>
              )}
            </button>
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
      className="flex-shrink-0 w-72 min-h-[200px] border-2 border-dashed border-muted-foreground/30 rounded-2xl flex items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-all"
    >
      <Plus size={20} />
      <span className="font-medium">Nova Etapa</span>
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
  const [color, setColor] = useState(DEFAULT_COLORS[0]);
  const createStatus = useCreateLeadStatus();

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }

    try {
      await createStatus.mutateAsync({
        name,
        color,
        order_position: existingCount + 1,
      });
      toast({ title: 'Status criado!' });
      onOpenChange(false);
      setName('');
      setColor(DEFAULT_COLORS[0]);
    } catch {
      toast({ title: 'Erro ao criar status', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Etapa de Lead</DialogTitle>
          <DialogDescription>Adicione uma nova etapa para gerenciar seus leads</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Nome da Etapa *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Em negociação, Proposta enviada..."
              className="mt-2"
            />
          </div>
          <div>
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {DEFAULT_COLORS.map((c) => (
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
          <Button onClick={handleCreate} disabled={createStatus.isPending} className="btn-gradient">
            {createStatus.isPending && <Loader2 size={16} className="mr-2 animate-spin" />}
            Criar Etapa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
