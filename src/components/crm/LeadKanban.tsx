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
  MoreVertical,
  User,
  Phone,
  Mail,
  Clock,
  Trash2,
  Loader2,
  X,
  DollarSign,
  Eye,
  MessageSquarePlus,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ConversationPreviewDialog } from '@/components/conversations/ConversationPreviewDialog';
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
import { cn, generateGradientColors } from '@/lib/utils';
import {
  useLeadStatuses,
  useLeadStatusSummary,
  useAllKanbanContacts,
  useUpdateContactLeadStatus,
  useCreateLeadStatus,
  useDeleteLeadStatus,
  type LeadStatus,
  type ContactForKanban,
} from '@/hooks/useLeadKanban';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getUserPrimaryDepartment } from '@/hooks/useUserPrimaryDepartment';

// Vibrant gradient colors for new statuses (lilac → pink)
const DEFAULT_COLORS = [
  // Blues & Cyans
  '#3B82F6', '#2563EB', '#0EA5E9', '#06B6D4', '#14B8A6',
  // Greens
  '#10B981', '#22C55E', '#84CC16', '#A3E635',
  // Yellows & Oranges
  '#F59E0B', '#FBBF24', '#F97316', '#FB923C',
  // Reds & Pinks
  '#EF4444', '#F43F5E', '#EC4899', '#D946EF',
  // Purples
  '#8B5CF6', '#A855F7', '#6366F1',
  // Neutrals
  '#64748B', '#78716C',
];

interface LeadKanbanProps {
  searchQuery?: string;
}

export default function LeadKanban({ searchQuery: externalSearchQuery = '' }: LeadKanbanProps) {
  const navigate = useNavigate();
  const [activeContact, setActiveContact] = useState<ContactForKanban | null>(null);
  const [showAddStatusModal, setShowAddStatusModal] = useState(false);
  const [previewConversationId, setPreviewConversationId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Use external search query from Header
  const searchQuery = externalSearchQuery;

  const handlePreviewConversation = (conversationId: string | null) => {
    if (conversationId) {
      setPreviewConversationId(conversationId);
      setShowPreview(true);
    }
  };

  const { data: leadStatuses, isLoading: statusesLoading } = useLeadStatuses();
  const { data: summaryMap, isLoading: summaryLoading } = useLeadStatusSummary();
  const { data: allContacts, isLoading: contactsLoading } = useAllKanbanContacts(20);
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
        // Se não tem conversa, criar uma nova
        await handleStartConversation(contact);
      }
    } catch {
      toast({
        title: 'Erro',
        description: 'Não foi possível abrir a conversa',
        variant: 'destructive',
      });
    }
  };

  const handleStartConversation = async (contact: ContactForKanban) => {
    try {
      // Verificar se já existe uma conversa
      const { data: existingConversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('contact_id', contact.id)
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingConversation) {
        navigate(`/conversations?id=${existingConversation.id}`);
        return;
      }

      // Get current user
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const userId = currentUser?.id;
      
      // *** CRITICAL: Buscar departamento primário do usuário ***
      const userDepartmentId = userId ? await getUserPrimaryDepartment(userId) : null;

      // Criar nova conversa com assigned_to e department_id
      const { data: newConversation, error } = await supabase
        .from('conversations')
        .insert({
          contact_id: contact.id,
          status: 'open',
          is_unread: false,
          unread_count: 0,
          lead_status: contact.lead_status || null,
          assigned_to: userId, // *** CRITICAL: Assign to current user ***
          department_id: userDepartmentId, // *** CRITICAL: Assign department ***
        } as any)
        .select('id')
        .single();

      if (error) throw error;

      toast({
        title: 'Conversa criada',
        description: `Nova conversa iniciada com ${contact.full_name}`,
      });

      navigate(`/conversations?id=${newConversation.id}`);
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar a conversa',
        variant: 'destructive',
      });
    }
  };

  const isLoading = statusesLoading || summaryLoading || contactsLoading;

  // Generate gradient colors for all statuses
  const gradientColors = generateGradientColors((leadStatuses?.length || 0) + 1); // +1 for "no status"

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
                status={{ id: 'no-status', name: 'Sem Status', order_position: -1, color: gradientColors[0], is_active: true, created_at: '' }}
                statusKey="__no_status__"
                count={noStatusSummary.contact_count}
                totalValue={noStatusSummary.total_value}
                contacts={allContacts?.['__no_status__'] || []}
                onOpenConversation={handleOpenConversation}
                onPreviewConversation={handlePreviewConversation}
                onStartConversation={handleStartConversation}
                canDelete={false}
                searchQuery={searchQuery}
                gradientColor={gradientColors[0]}
              />
            )}

            {leadStatuses.map((status, index) => {
              const summary = summaryMap?.[status.name];
              const colorIndex = hasNoStatusContacts ? index + 1 : index;
              // CORREÇÃO: Usar cor personalizada do status se existir, senão usar gradiente
              const statusColor = status.color || gradientColors[colorIndex];
              return (
                <LeadKanbanColumn
                  key={status.id}
                  status={status}
                  statusKey={status.name}
                  count={summary?.contact_count || 0}
                  totalValue={summary?.total_value || 0}
                  contacts={allContacts?.[status.name] || []}
                  onOpenConversation={handleOpenConversation}
                  onPreviewConversation={handlePreviewConversation}
                  onStartConversation={handleStartConversation}
                  canDelete={true}
                  searchQuery={searchQuery}
                  gradientColor={statusColor}
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

      {/* Conversation Preview Dialog */}
      <ConversationPreviewDialog
        conversationId={previewConversationId}
        isOpen={showPreview}
        onClose={() => {
          setShowPreview(false);
          setPreviewConversationId(null);
        }}
      />
    </div>
  );
}

// Kanban Column Component - Now receives contacts from parent
function LeadKanbanColumn({
  status,
  statusKey,
  count,
  totalValue,
  contacts,
  onOpenConversation,
  onPreviewConversation,
  onStartConversation,
  canDelete,
  searchQuery,
  gradientColor,
}: {
  status: LeadStatus;
  statusKey: string;
  count: number;
  totalValue: number;
  contacts: ContactForKanban[];
  onOpenConversation: (contact: ContactForKanban) => void;
  onPreviewConversation: (conversationId: string | null) => void;
  onStartConversation: (contact: ContactForKanban) => void;
  canDelete: boolean;
  searchQuery: string;
  gradientColor: string;
}) {
  const { setNodeRef } = useSortable({ id: status.id });
  const deleteStatus = useDeleteLeadStatus();

  // Filter contacts by search query (client-side)
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
  const hasMore = count > filteredContacts.length;

  return (
    <div ref={setNodeRef} className="flex-shrink-0 w-72">
      <div
        className="rounded-t-2xl p-3 border-b-4"
        style={{
          backgroundColor: gradientColor,
          borderBottomColor: gradientColor,
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

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-700 font-medium bg-white/50 px-1.5 py-0.5 rounded">
            👤 {count.toLocaleString('pt-BR')}
          </span>
          <span className="text-xs font-bold bg-emerald-500/40 text-emerald-950 px-1.5 py-0.5 rounded flex items-center gap-0.5">
            <DollarSign size={10} />
            R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <div className="bg-muted/30 rounded-b-2xl border border-t-0 border-border max-h-[400px] overflow-y-auto">
        <div className="p-3 space-y-2">
          <SortableContext items={visibleContacts.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {visibleContacts.map((contact) => (
              <ContactCard
                key={contact.id}
                contact={contact}
                onClick={() => onOpenConversation(contact)}
                onPreview={() => onPreviewConversation(contact.conversation_id)}
                onStartConversation={() => onStartConversation(contact)}
              />
            ))}
          </SortableContext>
          
          {visibleContacts.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Nenhum contato
            </p>
          )}
          
          {hasMore && (
            <p className="text-xs text-muted-foreground text-center py-2">
              +{count - filteredContacts.length} contatos
            </p>
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
  onPreview,
  onStartConversation,
  isOverlay = false,
}: {
  contact: ContactForKanban;
  onClick?: () => void;
  onPreview?: () => void;
  onStartConversation?: () => void;
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
        <div className="flex items-center gap-1">
          {/* Preview button or Start conversation button */}
          {contact.conversation_id ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPreview?.();
              }}
              className="p-1 hover:bg-muted rounded transition-colors"
              title="Visualizar conversa"
            >
              <Eye size={12} className="text-muted-foreground hover:text-foreground" />
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStartConversation?.();
              }}
              className="p-1 hover:bg-emerald-500/20 rounded transition-colors"
              title="Iniciar conversa"
            >
              <MessageSquarePlus size={12} className="text-emerald-500 hover:text-emerald-600" />
            </button>
          )}
          {/* Unread badge */}
          {contact.unread_count > 0 && (
            <Badge 
              className="h-5 min-w-[20px] px-1.5 text-[10px] bg-emerald-500 hover:bg-emerald-600 text-white border-0"
            >
              {contact.unread_count > 99 ? '99+' : contact.unread_count}
            </Badge>
          )}
          {/* Time in status */}
          {getTimeInStatus() && (
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex items-center gap-1">
              <Clock size={10} />
              {getTimeInStatus()}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 min-w-0">
            <Phone size={10} className="shrink-0" />
            <span className="truncate">{contact.phone}</span>
          </div>
          {(contact.negotiated_value ?? 0) > 0 && (
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold shrink-0 text-[10px]">
              R$ {contact.negotiated_value!.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          )}
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
