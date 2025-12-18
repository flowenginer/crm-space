import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import {
  Search,
  Plus,
  Upload,
  Download,
  Trash2,
  Tag,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowRight,
  MessageCircle,
  Edit3,
  UserCheck,
  RefreshCw,
  Calendar,
  Check,
  AlertTriangle,
  X,
  Users,
  Loader2,
} from 'lucide-react';
import { ContactRequestModal } from '@/components/conversations/ContactRequestModal';
import { ConversationPreviewDialog } from '@/components/conversations/ConversationPreviewDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useContactsCount, useCreateContact, useUpdateContact, useDeleteContact, useDeleteContactPermanently, type Contact } from '@/hooks/useContacts';
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
import { usePaginatedContacts, useContactsFilterCounts, useFilteredContactsCount } from '@/hooks/usePaginatedContacts';
import { useDebounce } from '@/hooks/useDebounce';
import { useTags, useCreateTag, useDeleteTag, useAddTagToContact, useRemoveTagFromContact } from '@/hooks/useTags';
import { useDepartments } from '@/hooks/useDepartments';
import { useTeam } from '@/hooks/useTeam';
import { useLeadStatuses } from '@/hooks/useLeadKanban';
import { usePermissions } from '@/hooks/usePermissions';
import { Skeleton } from '@/components/ui/skeleton';

const brazilianStates = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const getTagColorClass = (color: string | null) => {
  if (!color) return 'bg-muted text-muted-foreground';
  
  const colorMap: Record<string, string> = {
    '#EF4444': 'bg-red-100 text-red-700',
    '#F59E0B': 'bg-yellow-100 text-yellow-700',
    '#3B82F6': 'bg-blue-100 text-blue-700',
    '#10B981': 'bg-green-100 text-green-700',
    '#8B5CF6': 'bg-purple-100 text-purple-700',
    '#14B8A6': 'bg-teal-100 text-teal-700',
    '#EC4899': 'bg-pink-100 text-pink-700',
  };
  return colorMap[color] || 'bg-muted text-muted-foreground';
};

export default function Contacts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
const { isAdmin, isSupervisor, profile, canViewAllConversations } = usePermissions();
  const canAccessAllContacts = canViewAllConversations;
  
  // Modal de solicitação de acesso
  const [showContactRequestModal, setShowContactRequestModal] = useState(false);
  const [blockedContact, setBlockedContact] = useState<Contact | null>(null);
  const [blockedByAgent, setBlockedByAgent] = useState<{ id: string; full_name: string | null; avatar_url: string | null } | null>(null);
  const [blockedConversationId, setBlockedConversationId] = useState<string | null>(null);
  
  // Preview de conversa
  const [previewConversationId, setPreviewConversationId] = useState<string | null>(null);
  
  // Estados de filtro
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTagsDropdown, setShowTagsDropdown] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(50);

  // Debounce da busca para evitar muitas requisições
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Filtros para os hooks
  const filters = {
    searchQuery: debouncedSearch,
    stateFilter,
    statusFilter,
    assignedTo: assignedFilter,
    tagIds: selectedTags.length > 0 ? selectedTags : undefined,
  };

  // Busca paginada com filtros server-side (paginação direta no servidor)
  const { 
    data: paginatedData, 
    isLoading: contactsLoading, 
  } = usePaginatedContacts(filters, { page: currentPage, perPage });

  // Contagem total filtrada
  const { data: filteredCount = 0 } = useFilteredContactsCount(filters);

  // Contagem total geral
  const { data: totalContacts = 0 } = useContactsCount();

  // Contagens para os filtros (server-side)
  const { data: filterCounts } = useContactsFilterCounts();

  // Contatos da página atual (direto do servidor)
  const paginatedContacts = useMemo(() => {
    return paginatedData?.contacts ?? [];
  }, [paginatedData]);

  const totalPages = Math.ceil(filteredCount / perPage);

  // Reset para página 1 quando filtros mudam
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, stateFilter, statusFilter, assignedFilter, selectedTags]);

  const { data: tags = [], isLoading: tagsLoading } = useTags();
  const { data: team = [] } = useTeam();
  const { data: departments = [] } = useDepartments();
  const { data: leadStatuses = [] } = useLeadStatuses();

  // Funções para status do lead (dinâmico)
  const getLeadStatusLabel = (status: string | null) => {
    if (!status) return 'Sem status';
    const found = leadStatuses.find(s => s.name === status || s.id === status);
    return found?.name || status;
  };

  const getLeadStatusColor = (status: string | null) => {
    if (!status) return 'bg-muted text-muted-foreground';
    const found = leadStatuses.find(s => s.name === status || s.id === status);
    if (found?.color) {
      return `bg-[${found.color}]/10 text-[${found.color}]`;
    }
    return 'bg-muted text-muted-foreground';
  };

  // Usar contagens do servidor
  const contactCountByAssignee = filterCounts?.byAssignee ?? {};
  const contactCountByState = filterCounts?.byState ?? {};
  const contactCountByLeadStatus = filterCounts?.byStatus ?? {};
  
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();
  const deleteContactPermanently = useDeleteContactPermanently();
  const createTag = useCreateTag();
  const deleteTag = useDeleteTag();
  const addTagToContact = useAddTagToContact();
  const removeTagFromContact = useRemoveTagFromContact();
  
  const [isOpeningChat, setIsOpeningChat] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  
  // Estados para exclusão permanente (admin only)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  
  // Estado para seletor de canal WhatsApp
  const [showChannelSelector, setShowChannelSelector] = useState(false);
  const [selectedContactForChat, setSelectedContactForChat] = useState<Contact | null>(null);
  
  // Buscar canais WhatsApp ativos
  const { data: whatsappChannels = [] } = useQuery({
    queryKey: ['whatsapp-channels-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_channels')
        .select('id, name, phone, status')
        .eq('is_deleted', false)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Modal states
  const [showContactModal, setShowContactModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [importStep, setImportStep] = useState(1);

  // Form state
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    birth_date: '',
    cpf_cnpj: '',
    person_type: 'individual',
    contact_type: 'customer' as 'customer' | 'supplier' | 'both',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    zip_code: '',
    country: 'Brasil',
    lead_status: 'new',
    assigned_to: '',
    department_id: '',
    origin: '',
    notes: '',
  });

  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#8B5CF6');

  // Filtrar etiquetas pela busca
  const filteredTags = useMemo(() => {
    if (!tagSearchQuery.trim()) return tags;
    return tags.filter(tag => 
      tag.name.toLowerCase().includes(tagSearchQuery.toLowerCase())
    );
  }, [tags, tagSearchQuery]);

  const isLoading = contactsLoading || tagsLoading;

  const handleSelectAll = () => {
    if (selectedContacts.length === paginatedContacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(paginatedContacts.map((c) => c.id));
    }
  };

  const handleSelectContact = (contactId: string) => {
    setSelectedContacts((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
    );
  };

  const handleNewContact = () => {
    setIsEditing(false);
    setSelectedContact(null);
    setFormData({
      full_name: '',
      phone: '',
      email: '',
      birth_date: '',
      cpf_cnpj: '',
      person_type: 'individual',
      contact_type: 'customer',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      zip_code: '',
      country: 'Brasil',
      lead_status: 'new',
      assigned_to: '',
      department_id: '',
      origin: '',
      notes: '',
    });
    setShowContactModal(true);
  };

  const handleEditContact = (contact: Contact) => {
    setIsEditing(true);
    setSelectedContact(contact);
    setFormData({
      full_name: contact.full_name,
      phone: contact.phone,
      email: contact.email || '',
      birth_date: contact.birth_date || '',
      cpf_cnpj: contact.cpf_cnpj || '',
      person_type: contact.person_type || 'individual',
      contact_type: ((contact as any).contact_type || 'customer') as 'customer' | 'supplier' | 'both',
      street: contact.street || '',
      number: contact.number || '',
      complement: contact.complement || '',
      neighborhood: contact.neighborhood || '',
      city: contact.city || '',
      state: contact.state || '',
      zip_code: contact.zip_code || '',
      country: contact.country || 'Brasil',
      lead_status: contact.lead_status || 'new',
      assigned_to: contact.assigned_to || '',
      department_id: contact.department_id || '',
      origin: contact.origin || '',
      notes: contact.notes || '',
    });
    setShowContactModal(true);
  };

  const handleSaveContact = async () => {
    if (!formData.full_name || !formData.phone) {
      toast.error('Nome e telefone são obrigatórios');
      return;
    }

    try {
      if (isEditing && selectedContact) {
        await updateContact.mutateAsync({
          id: selectedContact.id,
          ...formData,
          email: formData.email || null,
          birth_date: formData.birth_date || null,
          assigned_to: formData.assigned_to || null,
          department_id: formData.department_id || null,
          contact_type: formData.contact_type,
        } as any);
        toast.success('Contato atualizado com sucesso!');
      } else {
        await createContact.mutateAsync({
          ...formData,
          email: formData.email || null,
          birth_date: formData.birth_date || null,
          assigned_to: formData.assigned_to || null,
          department_id: formData.department_id || null,
          contact_type: formData.contact_type,
        } as any);
        toast.success('Contato criado com sucesso!');
      }
      setShowContactModal(false);
    } catch (error) {
      toast.error('Erro ao salvar contato');
    }
  };

  const handleDeleteContact = (contact: Contact) => {
    if (isAdmin) {
      setContactToDelete(contact);
      setDeleteConfirmOpen(true);
    } else {
      toast.error('Apenas administradores podem excluir contatos');
    }
  };

  const confirmDeleteContact = async () => {
    if (!contactToDelete) return;
    try {
      await deleteContactPermanently.mutateAsync(contactToDelete.id);
      toast.success('Contato excluído permanentemente!');
      setDeleteConfirmOpen(false);
      setContactToDelete(null);
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao excluir contato');
    }
  };

  // Função para criar conversa com canal selecionado
  const createConversationWithChannel = async (contact: Contact, channelId: string, userId: string | undefined) => {
    // *** CRITICAL: Buscar departamento primário do usuário ***
    const { getUserPrimaryDepartment } = await import('@/hooks/useUserPrimaryDepartment');
    const userDepartmentId = userId ? await getUserPrimaryDepartment(userId) : null;

    const { data: newConversation, error: createError } = await supabase
      .from('conversations')
      .insert({
        contact_id: contact.id,
        channel_id: channelId,
        status: 'open',
        assigned_to: userId,
        department_id: userDepartmentId, // *** CRITICAL: Assign department ***
        is_unread: false,
        unread_count: 0,
        last_message_at: new Date().toISOString(),
        last_message_preview: 'Nova conversa iniciada',
      })
      .select('id')
      .single();

    if (createError) throw createError;
    
    setShowChannelSelector(false);
    setSelectedContactForChat(null);
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
    navigate(`/conversations?id=${newConversation.id}`);
  };

  const handleOpenChat = async (contact: Contact) => {
    if (isOpeningChat) return;
    
    setIsOpeningChat(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;

      // DEBUG LOG - Verificação de permissão
      console.log('[handleOpenChat DEBUG]', {
        isAdmin,
        currentUserId,
        contactId: contact.id,
        contactName: contact.full_name,
        contactAssignedTo: contact.assigned_to,
        willBlockByContact: !isAdmin && contact.assigned_to && contact.assigned_to !== currentUserId
      });

      // Verificar se existe conversa ativa
      const { data: existingConversation } = await supabase
        .from('conversations')
        .select('id, assigned_to')
        .eq('contact_id', contact.id)
        .in('status', ['open', 'pending'])
        .maybeSingle();

      // ============ VERIFICAÇÃO DE PERMISSÃO ============
      // Se NÃO for admin/supervisor, verificar se o contato está atribuído a outro vendedor
      if (!canAccessAllContacts && contact.assigned_to && contact.assigned_to !== currentUserId) {
        const assignedAgent = team.find(t => t.id === contact.assigned_to);
        setBlockedContact(contact);
        setBlockedByAgent({
          id: contact.assigned_to,
          full_name: assignedAgent?.full_name || null,
          avatar_url: assignedAgent?.avatar_url || null,
        });
        setBlockedConversationId(existingConversation?.id || null);
        setShowContactRequestModal(true);
        setIsOpeningChat(false);
        return;
      }

      // Verificar também se a conversa está atribuída a outro vendedor
      if (existingConversation && !canAccessAllContacts) {
        if (existingConversation.assigned_to && existingConversation.assigned_to !== currentUserId) {
          const assignedAgent = team.find(t => t.id === existingConversation.assigned_to);
          setBlockedContact(contact);
          setBlockedByAgent({
            id: existingConversation.assigned_to,
            full_name: assignedAgent?.full_name || null,
            avatar_url: assignedAgent?.avatar_url || null,
          });
          setBlockedConversationId(existingConversation.id);
          setShowContactRequestModal(true);
          setIsOpeningChat(false);
          return;
        }
      }
      // ============ FIM DA VERIFICAÇÃO ============

      if (existingConversation) {
        toast.info(`Abrindo conversa com ${contact.full_name}...`);
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        navigate(`/conversations?id=${existingConversation.id}`);
      } else {
        // Mostrar seletor de canal para criar nova conversa
        const connectedChannels = whatsappChannels.filter(c => c.status === 'connected');
        
        if (connectedChannels.length === 0) {
          toast.error('Nenhum canal WhatsApp conectado. Configure um canal primeiro.');
          return;
        }
        
        if (connectedChannels.length === 1) {
          // Se só tem um canal, criar diretamente
          await createConversationWithChannel(contact, connectedChannels[0].id, currentUserId);
        } else {
          // Mostrar seletor de canal
          setSelectedContactForChat(contact);
          setShowChannelSelector(true);
        }
      }
      
    } catch (error: any) {
      console.error('Error opening chat:', error);
      toast.error('Erro ao abrir conversa');
    } finally {
      setIsOpeningChat(false);
    }
  };

  // Função para abrir preview da conversa (sem navegar)
  const handlePreviewChat = async (contact: Contact) => {
    try {
      // Buscar conversa existente
      const { data: existingConversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('contact_id', contact.id)
        .in('status', ['open', 'pending', 'closed'])
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingConversation) {
        setPreviewConversationId(existingConversation.id);
      } else {
        toast.info('Nenhuma conversa encontrada para este contato');
      }
    } catch (error) {
      console.error('Error fetching conversation for preview:', error);
      toast.error('Erro ao buscar conversa');
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStateFilter('');
    setStatusFilter('');
    setAssignedFilter('');
    setSelectedTags([]);
  };

  const toggleTagFilter = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      toast.error('Digite o nome da etiqueta');
      return;
    }
    try {
      await createTag.mutateAsync({ name: newTagName, color: newTagColor });
      setNewTagName('');
      toast.success('Etiqueta criada com sucesso!');
    } catch (error) {
      toast.error('Erro ao criar etiqueta');
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    try {
      await deleteTag.mutateAsync(tagId);
      toast.success('Etiqueta excluída!');
    } catch (error) {
      toast.error('Erro ao excluir etiqueta');
    }
  };


  return (
    <div className="space-y-6">
      {/* Modal de Solicitação de Acesso */}
      {blockedContact && blockedByAgent && (
        <ContactRequestModal
          open={showContactRequestModal}
          onOpenChange={setShowContactRequestModal}
          contact={{
            id: blockedContact.id,
            full_name: blockedContact.full_name,
            phone: blockedContact.phone,
          }}
          currentOwner={blockedByAgent}
          conversationId={blockedConversationId}
        />
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Contatos</h1>
          <p className="text-muted-foreground">
            Total: <span className="font-bold text-primary">{totalContacts.toLocaleString('pt-BR')}</span> contatos
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 border border-border bg-card rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-all shadow-sm"
          >
            <Upload size={18} />
            Importar
          </button>

          <button className="flex items-center gap-2 px-4 py-2.5 border border-border bg-card rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-all shadow-sm">
            <Download size={18} />
            Exportar
          </button>

          <button
            onClick={() => setShowTagsModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 border border-border bg-card rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-all shadow-sm"
          >
            <Tag size={18} />
            Etiquetas
          </button>

          <button
            onClick={handleNewContact}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-primary to-pink-500 text-primary-foreground rounded-xl font-medium hover:shadow-lg transition-all"
          >
            <Plus size={18} />
            Adicionar Contato
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[300px]">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nome, telefone ou email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>

          {/* Tags Filter */}
          <div className="relative">
            <button
              onClick={() => setShowTagsDropdown(!showTagsDropdown)}
              className="flex items-center gap-2 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground hover:bg-muted transition-all"
            >
              <Tag size={16} />
              Etiquetas
              {selectedTags.length > 0 && (
                <span className="px-1.5 py-0.5 bg-primary text-primary-foreground rounded-full text-xs">
                  {selectedTags.length}
                </span>
              )}
              <ChevronDown size={16} />
            </button>

            {showTagsDropdown && (
              <div className="absolute top-full left-0 mt-2 w-72 bg-card rounded-xl border border-border shadow-elevated z-50">
                {/* Header com título e botão limpar */}
                <div className="flex items-center justify-between px-3 pt-3 pb-2">
                  <span className="text-sm font-medium text-foreground">Etiquetas</span>
                  {selectedTags.length > 0 && (
                    <button
                      onClick={() => setSelectedTags([])}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      Limpar ({selectedTags.length})
                    </button>
                  )}
                </div>
                
                {/* Campo de busca */}
                <div className="px-3 pb-2">
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Buscar etiqueta..."
                      value={tagSearchQuery}
                      onChange={(e) => setTagSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-muted/50 border border-border rounded-lg text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  </div>
                </div>
                
                {/* Lista com scroll - MESMO VISUAL ATUAL */}
                <div className="max-h-[250px] overflow-y-auto px-3 pb-3 space-y-1">
                  {filteredTags.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {tagSearchQuery ? 'Nenhuma etiqueta encontrada' : 'Nenhuma etiqueta cadastrada'}
                    </p>
                  ) : (
                    filteredTags.map((tag) => (
                      <label
                        key={tag.id}
                        className="flex items-center gap-2 p-2 hover:bg-muted rounded-lg cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedTags.includes(tag.id)}
                          onCheckedChange={() => toggleTagFilter(tag.id)}
                        />
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: tag.color || '#8B5CF6' }}
                        />
                        <span className="flex-1 text-sm text-foreground">{tag.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {filterCounts?.byTag?.[tag.id] || 0}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Assigned To Filter */}
          <select
            value={assignedFilter}
            onChange={(e) => setAssignedFilter(e.target.value)}
            className="px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Responsável</option>
            {team.map((member) => (
              <option key={member.id} value={member.id}>
                {member.full_name} ({contactCountByAssignee[member.id] || 0})
              </option>
            ))}
          </select>

          {/* State Filter */}
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Estado</option>
            {brazilianStates.map((state) => (
              <option key={state} value={state}>
                {state} ({contactCountByState[state] || 0})
              </option>
            ))}
          </select>

          {/* Status Filter - Dinâmico do CRM */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Status Lead</option>
            {leadStatuses.map((status) => (
              <option key={status.id} value={status.name}>
                {status.name} ({contactCountByLeadStatus[status.name] || 0})
              </option>
            ))}
          </select>

          {/* Date Range */}
          <button className="flex items-center gap-2 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground hover:bg-muted transition-all">
            <Calendar size={16} />
            Data de cadastro
            <ChevronDown size={16} />
          </button>

          {/* Clear Filters */}
          <button
            onClick={clearFilters}
            className="px-4 py-2.5 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
          >
            Limpar filtros
          </button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedContacts.length > 0 && (
        <div className="sticky top-0 z-20 bg-primary text-primary-foreground rounded-xl p-4 shadow-lg flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-medium">{selectedContacts.length} contatos selecionados</span>
            <button
              onClick={() => setSelectedContacts([])}
              className="text-sm text-primary-foreground/70 hover:text-primary-foreground underline"
            >
              Limpar seleção
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors">
              <UserCheck size={16} />
              Atribuir
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors">
              <Tag size={16} />
              Adicionar tags
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors">
              <RefreshCw size={16} />
              Mudar status
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors">
              <Download size={16} />
              Exportar
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-destructive/80 hover:bg-destructive rounded-lg text-sm font-medium transition-colors">
              <Trash2 size={16} />
              Excluir
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="bg-card rounded-2xl border border-border shadow-sm p-8">
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-muted-foreground">Carregando contatos...</span>
          </div>
        </div>
      ) : paginatedContacts.length === 0 ? (
        /* Empty State - No contacts at all */
        <div className="bg-card rounded-2xl border border-border shadow-sm">
          <div className="text-center py-16">
            <div className="mx-auto h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/20 to-pink-500/20 flex items-center justify-center mb-6">
              <Users className="h-10 w-10 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Nenhum contato cadastrado</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Comece adicionando seu primeiro contato ou importe uma lista de contatos de uma planilha.
            </p>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-6 py-3 border border-border bg-card rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-all"
              >
                <Upload size={18} />
                Importar Contatos
              </button>
              <button
                onClick={handleNewContact}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary to-pink-500 text-primary-foreground rounded-xl font-medium hover:shadow-lg transition-all"
              >
                <Plus size={18} />
                Adicionar Contato
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Contacts Table */
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="w-12 px-4 py-4">
                    <Checkbox
                      checked={selectedContacts.length === paginatedContacts.length && paginatedContacts.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </th>
                  <th className="text-left px-4 py-4">
                    <button className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground">
                      Nome
                      <ArrowUpDown size={14} />
                    </button>
                  </th>
                  <th className="text-left px-4 py-4">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      WhatsApp
                    </span>
                  </th>
                  <th className="text-left px-4 py-4">
                    <button className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground">
                      Estado
                      <ArrowUpDown size={14} />
                    </button>
                  </th>
                  <th className="text-left px-4 py-4">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Status
                    </span>
                  </th>
                  <th className="text-left px-4 py-4">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Etiquetas
                    </span>
                  </th>
                  <th className="text-left px-4 py-4">
                    <button className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground">
                      1ª Conexão
                      <ArrowUpDown size={14} />
                    </button>
                  </th>
                  <th className="text-left px-4 py-4">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Atendente
                    </span>
                  </th>
                  <th className="text-left px-4 py-4">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Dept.
                    </span>
                  </th>
                  <th className="text-center px-4 py-4">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Ações
                    </span>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border/50">
                {paginatedContacts.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-16">
                      <div className="mx-auto h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                        <Users className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground">Nenhum contato encontrado</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Ajuste os filtros ou adicione um novo contato
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedContacts.map((contact) => (
                    <tr key={contact.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-4">
                        <Checkbox
                          checked={selectedContacts.includes(contact.id)}
                          onCheckedChange={() => handleSelectContact(contact.id)}
                        />
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center text-primary-foreground font-semibold shadow-lg">
                              {contact.full_name.charAt(0)}
                            </div>
                            {contact.is_online && (
                              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-card" />
                            )}
                          </div>
                          <div>
                            <button
                              onClick={() => handleEditContact(contact)}
                              className="font-semibold text-foreground hover:text-primary transition-colors text-left"
                            >
                              {contact.full_name}
                            </button>
                            <p className="text-xs text-muted-foreground">{contact.email || '-'}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <button
                          onClick={() => handleOpenChat(contact)}
                          className="flex items-center gap-2 text-sm text-foreground hover:text-green-600 transition-colors"
                        >
                          <MessageCircle size={16} className="text-green-600" />
                          {contact.phone}
                        </button>
                      </td>

                      <td className="px-4 py-4">
                        <span className="text-sm text-foreground">{contact.state || '-'}</span>
                      </td>

                      <td className="px-4 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getLeadStatusColor(contact.lead_status)}`}>
                          {getLeadStatusLabel(contact.lead_status)}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1">
                          {(contact.tags || []).slice(0, 2).map((tag) => (
                            <span key={tag.id} className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTagColorClass(tag.color)}`}>
                              {tag.name}
                            </span>
                          ))}
                          {(contact.tags || []).length > 2 && (
                            <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded-full text-xs font-medium">
                              +{contact.tags!.length - 2}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <span className="text-sm text-foreground">
                          {contact.first_contact_at ? new Date(contact.first_contact_at).toLocaleDateString('pt-BR') : '-'}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        {contact.assignee ? (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center text-primary-foreground text-xs font-semibold">
                              {contact.assignee.full_name?.charAt(0) || '?'}
                            </div>
                            <span className="text-sm text-foreground">{contact.assignee.full_name}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        {contact.department ? (
                          <span className="px-2.5 py-1 bg-muted text-muted-foreground rounded-lg text-xs font-medium">
                            {contact.department.name}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handlePreviewChat(contact)}
                            className="p-2 hover:bg-green-500/10 rounded-lg transition-colors"
                            title="Visualizar conversa"
                          >
                            <MessageCircle size={18} className="text-green-600" />
                          </button>
                          <button
                            onClick={() => handleEditContact(contact)}
                            className="p-2 hover:bg-primary/10 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit3 size={18} className="text-primary" />
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteContact(contact)}
                              className="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                              title="Excluir permanentemente"
                            >
                              <Trash2 size={18} className="text-destructive" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredCount > 0 && (
            <div className="px-6 py-4 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Mostrando</span>
                <select
                  value={perPage}
                  onChange={(e) => setPerPage(Number(e.target.value))}
                  className="px-2 py-1 border border-border rounded-lg text-sm bg-background"
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
                <span>de {filteredCount.toLocaleString('pt-BR')} contatos</span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
                >
                  <ChevronLeft size={18} />
                </button>
                <button className="w-10 h-10 bg-primary text-primary-foreground rounded-lg font-medium">
                  {currentPage}
                </button>
                {currentPage < totalPages && (
                  <>
                    <button
                      onClick={() => setCurrentPage(currentPage + 1)}
                      className="w-10 h-10 hover:bg-muted rounded-lg font-medium text-foreground"
                    >
                      {currentPage + 1}
                    </button>
                    {currentPage + 1 < totalPages && (
                      <button
                        onClick={() => setCurrentPage(currentPage + 2)}
                        className="w-10 h-10 hover:bg-muted rounded-lg font-medium text-foreground"
                      >
                        {currentPage + 2}
                      </button>
                    )}
                    {currentPage + 3 < totalPages && <span className="px-2 text-muted-foreground">...</span>}
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      className="w-10 h-10 hover:bg-muted rounded-lg font-medium text-foreground"
                    >
                      {totalPages}
                    </button>
                  </>
                )}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Contact Modal */}
      <Dialog open={showContactModal} onOpenChange={setShowContactModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar Contato' : 'Novo Contato'}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="basic" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid grid-cols-4 w-full mb-4">
              <TabsTrigger value="basic">Informações Básicas</TabsTrigger>
              <TabsTrigger value="address">Endereço</TabsTrigger>
              <TabsTrigger value="crm">Detalhes CRM</TabsTrigger>
              <TabsTrigger value="custom">Campos Customizados</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto">
              <TabsContent value="basic" className="space-y-4">
                <div className="flex items-center gap-6">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center text-primary-foreground text-3xl font-bold shadow-xl">
                    {formData.full_name?.charAt(0) || 'N'}
                  </div>
                  <div>
                    <button className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted">
                      Alterar foto
                    </button>
                    <p className="text-xs text-muted-foreground mt-1">JPG, PNG. Máx 2MB</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Nome completo <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Fernando Silva Santos"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Telefone / WhatsApp <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="tel"
                      placeholder="+55 (00) 00000-0000"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Email</label>
                    <input
                      type="email"
                      placeholder="email@exemplo.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Data de nascimento</label>
                    <input
                      type="date"
                      value={formData.birth_date}
                      onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                      className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">CPF / CNPJ</label>
                    <input
                      type="text"
                      placeholder="000.000.000-00"
                      value={formData.cpf_cnpj}
                      onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value })}
                      className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Tipo de pessoa</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="personType"
                          value="individual"
                          checked={formData.person_type === 'individual'}
                          onChange={(e) => setFormData({ ...formData, person_type: e.target.value })}
                        />
                        <span className="text-sm text-foreground">Pessoa física</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="personType"
                          value="company"
                          checked={formData.person_type === 'company'}
                          onChange={(e) => setFormData({ ...formData, person_type: e.target.value })}
                        />
                        <span className="text-sm text-foreground">Pessoa jurídica</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Tipo de contato</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="contactType"
                          value="customer"
                          checked={formData.contact_type === 'customer'}
                          onChange={(e) => setFormData({ ...formData, contact_type: e.target.value as 'customer' | 'supplier' | 'both' })}
                        />
                        <span className="text-sm text-foreground">Cliente</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="contactType"
                          value="supplier"
                          checked={formData.contact_type === 'supplier'}
                          onChange={(e) => setFormData({ ...formData, contact_type: e.target.value as 'customer' | 'supplier' | 'both' })}
                        />
                        <span className="text-sm text-foreground">Fornecedor</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="contactType"
                          value="both"
                          checked={formData.contact_type === 'both'}
                          onChange={(e) => setFormData({ ...formData, contact_type: e.target.value as 'customer' | 'supplier' | 'both' })}
                        />
                        <span className="text-sm text-foreground">Ambos</span>
                      </label>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="address" className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">CEP</label>
                    <input
                      type="text"
                      placeholder="00000-000"
                      value={formData.zip_code}
                      onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                      className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-2">Logradouro</label>
                    <input
                      type="text"
                      placeholder="Rua, Avenida..."
                      value={formData.street}
                      onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                      className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Número</label>
                    <input
                      type="text"
                      placeholder="123"
                      value={formData.number}
                      onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                      className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-2">Complemento</label>
                    <input
                      type="text"
                      placeholder="Apto, Sala, Bloco..."
                      value={formData.complement}
                      onChange={(e) => setFormData({ ...formData, complement: e.target.value })}
                      className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Bairro</label>
                    <input
                      type="text"
                      placeholder="Centro"
                      value={formData.neighborhood}
                      onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                      className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Cidade</label>
                    <input
                      type="text"
                      placeholder="São Paulo"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Estado</label>
                    <select
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                    >
                      <option value="">Selecione</option>
                      {brazilianStates.map((state) => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">País</label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                  />
                </div>
              </TabsContent>

              <TabsContent value="crm" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Status do Lead</label>
                    <select
                      value={formData.lead_status}
                      onChange={(e) => setFormData({ ...formData, lead_status: e.target.value })}
                      className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                    >
                      <option value="">Selecione</option>
                      {leadStatuses.map((status) => (
                        <option key={status.id} value={status.name}>
                          {status.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Origem</label>
                    <select
                      value={formData.origin}
                      onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                      className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                    >
                      <option value="">Selecione</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="instagram">Instagram</option>
                      <option value="facebook">Facebook</option>
                      <option value="website">Website</option>
                      <option value="indicacao">Indicação</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Atendente responsável</label>
                    <select
                      value={formData.assigned_to}
                      onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                      className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                    >
                      <option value="">Selecione</option>
                      {team.map((member) => (
                        <option key={member.id} value={member.id}>{member.full_name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Departamento</label>
                    <select
                      value={formData.department_id}
                      onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                      className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                    >
                      <option value="">Selecione</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-2">Etiquetas</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {(selectedContact?.tags || []).map((tag) => (
                        <span
                          key={tag.id}
                          className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium flex items-center gap-1"
                        >
                          {tag.name}
                          <button 
                            className="hover:text-primary/70"
                            onClick={() => removeTagFromContact.mutate({ contactId: selectedContact!.id, tagId: tag.id })}
                          >
                            <X size={14} />
                          </button>
                        </span>
                      ))}
                    </div>
                    <button className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1">
                      <Plus size={14} />
                      Adicionar etiqueta
                    </button>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-2">Observações</label>
                    <textarea
                      rows={4}
                      placeholder="Anotações sobre o contato..."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none bg-background"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="custom" className="space-y-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Campos customizados definidos nas configurações do sistema.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Tamanho de camisa</label>
                    <select className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background">
                      <option value="">Selecione</option>
                      <option value="P">P</option>
                      <option value="M">M</option>
                      <option value="G">G</option>
                      <option value="GG">GG</option>
                      <option value="G1">G1</option>
                      <option value="G2">G2</option>
                      <option value="G3">G3</option>
                      <option value="G4">G4</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Esporte preferido</label>
                    <input
                      type="text"
                      placeholder="Ex: Futebol, Vôlei..."
                      className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Time/Equipe</label>
                    <input
                      type="text"
                      placeholder="Nome do time"
                      className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Quantidade usual de pedido</label>
                    <input
                      type="number"
                      placeholder="Ex: 50"
                      className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                    />
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter className="border-t border-border pt-4 mt-4">
            <button
              onClick={() => setShowContactModal(false)}
              className="px-4 py-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveContact}
              disabled={createContact.isPending || updateContact.isPending}
              className="px-6 py-2 bg-gradient-to-r from-primary to-pink-500 text-primary-foreground rounded-lg font-medium hover:shadow-lg transition-all disabled:opacity-50"
            >
              {(createContact.isPending || updateContact.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin inline" />}
              {isEditing ? 'Salvar alterações' : 'Criar contato'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Modal */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar Contatos</DialogTitle>
            <DialogDescription>Importe contatos de uma planilha CSV ou Excel</DialogDescription>
          </DialogHeader>

          <div className="py-6">
            {importStep === 1 && (
              <div className="text-center">
                <div className="border-2 border-dashed border-border rounded-2xl p-12 hover:border-primary transition-colors cursor-pointer">
                  <Upload size={48} className="mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Arraste seu arquivo ou clique para selecionar
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Formatos aceitos: CSV, XLSX, XLS (máx. 10MB)
                  </p>
                  <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90">
                    Selecionar arquivo
                  </button>
                </div>

                <div className="mt-6 flex justify-center">
                  <button className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1">
                    <Download size={16} />
                    Baixar template de exemplo
                  </button>
                </div>
              </div>
            )}

            {importStep === 2 && (
              <div>
                <h3 className="font-semibold text-foreground mb-4">Mapeie as colunas</h3>
                <div className="space-y-3">
                  {[
                    { source: 'Nome', target: 'Nome completo' },
                    { source: 'Telefone', target: 'Telefone' },
                    { source: 'E-mail', target: 'Email' },
                    { source: 'Endereço', target: 'Logradouro' },
                  ].map((mapping, idx) => (
                    <div key={idx} className="flex items-center gap-4">
                      <div className="flex-1 px-4 py-2 bg-muted rounded-lg text-sm text-foreground">
                        {mapping.source}
                      </div>
                      <ArrowRight size={18} className="text-muted-foreground" />
                      <select className="flex-1 px-4 py-2 border border-border rounded-lg text-sm bg-background">
                        <option>{mapping.target}</option>
                        <option>Ignorar</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {importStep === 3 && (
              <div>
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-2 text-green-600">
                    <Check size={18} />
                    <span className="font-medium">1.000 contatos prontos para importar</span>
                  </div>
                </div>

                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-yellow-600 mb-2">
                    <AlertTriangle size={18} />
                    <span className="font-medium">23 contatos com problemas</span>
                  </div>
                  <ul className="text-sm text-yellow-600 list-disc list-inside">
                    <li>15 telefones duplicados</li>
                    <li>8 emails inválidos</li>
                  </ul>
                </div>
              </div>
            )}

            {importStep === 4 && (
              <div className="text-center py-8">
                <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-6" />
                <h3 className="text-lg font-semibold text-foreground mb-2">Importando contatos...</h3>
                <p className="text-sm text-muted-foreground mb-4">234 de 1.000 contatos importados</p>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full" style={{ width: '23.4%' }} />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <button
              onClick={() => {
                setImportStep(1);
                setShowImportModal(false);
              }}
              className="px-4 py-2 text-muted-foreground hover:bg-muted rounded-lg"
            >
              Cancelar
            </button>
            <button
              onClick={() => setImportStep((s) => Math.min(4, s + 1))}
              className="px-6 py-2 bg-gradient-to-r from-primary to-pink-500 text-primary-foreground rounded-lg font-medium hover:shadow-lg"
            >
              {importStep === 3 ? 'Importar contatos' : 'Continuar'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tags Management Modal */}
      <Dialog open={showTagsModal} onOpenChange={setShowTagsModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerenciar Etiquetas</DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {tagsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : tags.length === 0 ? (
              <div className="text-center py-8">
                <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhuma etiqueta cadastrada</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tags.map((tag) => (
                  <div key={tag.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: tag.color || '#8B5CF6' }} />
                      <span className="font-medium text-foreground">{tag.name}</span>
                      <span className="text-xs text-muted-foreground">({tag.usage_count || 0} contatos)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                        <Edit3 size={14} className="text-muted-foreground" />
                      </button>
                      <button 
                        onClick={() => handleDeleteTag(tag.id)}
                        className="p-1.5 hover:bg-destructive/10 rounded-lg transition-colors"
                      >
                        <Trash2 size={14} className="text-destructive" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-4 border-t border-border">
              <label className="block text-sm font-medium text-foreground mb-2">Nova etiqueta</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="w-12 h-10 rounded-lg border border-border cursor-pointer"
                />
                <input
                  type="text"
                  placeholder="Nome da etiqueta"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="flex-1 px-4 py-2 border border-border rounded-lg bg-background"
                />
                <button
                  onClick={handleCreateTag}
                  disabled={createTag.isPending}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50"
                >
                  {createTag.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus size={18} />}
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de seleção de canal WhatsApp */}
      <Dialog open={showChannelSelector} onOpenChange={setShowChannelSelector}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Selecione o Canal WhatsApp</DialogTitle>
            <DialogDescription>
              Escolha por qual número deseja iniciar a conversa com {selectedContactForChat?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {whatsappChannels.filter(c => c.status === 'connected').map(channel => (
              <Button
                key={channel.id}
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={async () => {
                  if (selectedContactForChat) {
                    const { data: { user } } = await supabase.auth.getUser();
                    await createConversationWithChannel(selectedContactForChat, channel.id, user?.id);
                  }
                }}
              >
                <MessageCircle className="h-4 w-4 text-green-500" />
                <span>{channel.name}</span>
                <span className="text-xs text-muted-foreground ml-auto">{channel.phone}</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Conversation Preview Dialog */}
      <ConversationPreviewDialog
        conversationId={previewConversationId}
        isOpen={!!previewConversationId}
        onClose={() => setPreviewConversationId(null)}
      />

      {/* Delete Confirmation Dialog (Admin Only) */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Excluir Contato Permanentemente
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Você está prestes a excluir <strong>{contactToDelete?.full_name}</strong> permanentemente.
                </p>
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm">
                  <p className="font-medium text-destructive mb-2">Esta ação irá excluir:</p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Todas as conversas e mensagens</li>
                    <li>Todos os orçamentos</li>
                    <li>Todos os pedidos</li>
                    <li>Histórico financeiro</li>
                    <li>Tags e notas</li>
                  </ul>
                </div>
                <p className="font-semibold text-destructive">
                  Esta ação NÃO pode ser desfeita!
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteContact}
              className="bg-destructive hover:bg-destructive/90"
              disabled={deleteContactPermanently.isPending}
            >
              {deleteContactPermanently.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Excluir Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Click outside to close tags dropdown */}
      {showTagsDropdown && (
        <div className="fixed inset-0 z-40" onClick={() => {
          setShowTagsDropdown(false);
          setTagSearchQuery('');
        }} />
      )}
    </div>
  );
}
