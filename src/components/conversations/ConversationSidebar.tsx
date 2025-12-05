import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
  X, Phone, Loader2, CalendarClock, Plus, Save
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScheduleMessageModal } from './ScheduleMessageModal';
import { fetchContactProfile } from '@/lib/whatsapp/instance-creator';

interface ConversationSidebarProps {
  conversationId: string;
  onClose?: () => void;
}

const leadStatusOptions = [
  { value: 'new', label: 'Novo Lead', color: 'bg-blue-500' },
  { value: 'contacted', label: 'Contatado', color: 'bg-yellow-500' },
  { value: 'qualified', label: 'Qualificado', color: 'bg-purple-500' },
  { value: 'negotiation', label: 'Negociação', color: 'bg-orange-500' },
  { value: 'client', label: 'Cliente', color: 'bg-green-500' },
  { value: 'lost', label: 'Perdido', color: 'bg-red-500' },
];

export function ConversationSidebar({ conversationId, onClose }: ConversationSidebarProps) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [isFetchingPhoto, setIsFetchingPhoto] = useState(false);
  
  const queryClient = useQueryClient();

  // Fetch conversation with contact data
  const { data: conversation, isLoading: loadingConversation } = useQuery({
    queryKey: ['conversation-details', conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          contact:contacts(
            *,
            tags:contact_tags(
              tag:tags(*)
            )
          ),
          assigned_user:profiles!conversations_assigned_to_fkey(
            id, full_name, avatar_url
          ),
          department:departments(
            id, name
          )
        `)
        .eq('id', conversationId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!conversationId,
  });

  // Fetch all tags (with visibility filter)
  const { data: allTags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get user's department
      const { data: profile } = await supabase
        .from('profiles')
        .select('department_id')
        .eq('id', user.id)
        .maybeSingle();

      // Build visibility filter
      const conditions = ['visibility.eq.public', 'visibility.is.null'];
      conditions.push(`and(visibility.eq.private,created_by.eq.${user.id})`);
      if (profile?.department_id) {
        conditions.push(`and(visibility.eq.department,department_id.eq.${profile.department_id})`);
      }

      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .or(conditions.join(','))
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch team members
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role, department_id')
        .eq('is_active', true)
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch departments
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Mutation: Update lead status
  const updateLeadStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      if (!conversation?.contact?.id) throw new Error('No contact');
      
      const { error } = await supabase
        .from('contacts')
        .update({ 
          lead_status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversation.contact.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation-details', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Status atualizado!');
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    }
  });

  // Mutation: Update assigned user
  const updateAssignedUser = useMutation({
    mutationFn: async (userId: string | null) => {
      const { error } = await supabase
        .from('conversations')
        .update({ 
          assigned_to: userId,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation-details', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Atendente atualizado!');
    },
    onError: () => {
      toast.error('Erro ao atualizar atendente');
    }
  });

  // Mutation: Update department
  const updateDepartment = useMutation({
    mutationFn: async (departmentId: string | null) => {
      const { error } = await supabase
        .from('conversations')
        .update({ 
          department_id: departmentId,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation-details', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Departamento atualizado!');
    },
    onError: () => {
      toast.error('Erro ao atualizar departamento');
    }
  });

  // Mutation: Add tag
  const addTag = useMutation({
    mutationFn: async (tagId: string) => {
      if (!conversation?.contact?.id) throw new Error('No contact');
      
      const { error } = await supabase
        .from('contact_tags')
        .insert({
          contact_id: conversation.contact.id,
          tag_id: tagId
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation-details', conversationId] });
      toast.success('Etiqueta adicionada!');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('Etiqueta já adicionada');
      } else {
        toast.error('Erro ao adicionar etiqueta');
      }
    }
  });

  // Mutation: Remove tag
  const removeTag = useMutation({
    mutationFn: async (tagId: string) => {
      if (!conversation?.contact?.id) throw new Error('No contact');
      
      const { error } = await supabase
        .from('contact_tags')
        .delete()
        .eq('contact_id', conversation.contact.id)
        .eq('tag_id', tagId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation-details', conversationId] });
      toast.success('Etiqueta removida!');
    },
    onError: () => {
      toast.error('Erro ao remover etiqueta');
    }
  });

  // Mutation: Close conversation
  const closeConversation = useMutation({
    mutationFn: async (reason?: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('conversations')
        .update({ 
          status: 'closed',
          closed_at: new Date().toISOString(),
          closed_by: user?.id,
          close_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation-details', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Conversa fechada!');
      setShowCloseModal(false);
    },
    onError: () => {
      toast.error('Erro ao fechar conversa');
    }
  });

  // Fetch profile photo from WhatsApp (hook must be before early returns)
  const fetchPhoto = async () => {
    if (!conversation?.channel_id || !conversation?.contact?.phone || conversation?.contact?.avatar_url) return;
    
    setIsFetchingPhoto(true);
    try {
      const result = await fetchContactProfile(conversation.channel_id, conversation.contact.phone);
      if (result.success && result.profilePictureUrl) {
        // Update contact avatar_url in database
        await supabase
          .from('contacts')
          .update({ avatar_url: result.profilePictureUrl })
          .eq('id', conversation.contact.id);
        
        queryClient.invalidateQueries({ queryKey: ['conversation-details', conversationId] });
      }
    } catch (error) {
      console.error('Error fetching profile photo:', error);
    } finally {
      setIsFetchingPhoto(false);
    }
  };

  // Fetch photo on mount if not already fetched (before early returns)
  useEffect(() => {
    if (conversation?.channel_id && conversation?.contact?.phone && !conversation?.contact?.avatar_url) {
      fetchPhoto();
    }
  }, [conversation?.channel_id, conversation?.contact?.phone, conversation?.contact?.avatar_url]);

  // Loading state
  if (loadingConversation) {
    return (
      <div className="w-[320px] bg-card border-l border-border flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!conversation || !conversation.contact) {
    return (
      <div className="w-[320px] bg-card border-l border-border flex items-center justify-center">
        <p className="text-muted-foreground">Conversa não encontrada</p>
      </div>
    );
  }

  const contact = conversation.contact;
  const contactTags = contact.tags?.map((t: any) => t.tag).filter(Boolean) || [];

  // Format phone for display
  const formatPhone = (phone: string) => {
    if (!phone) return '-';
    const digits = phone.replace(/\D/g, '');
    const local = digits.startsWith('55') ? digits.slice(2) : digits;
    if (local.length === 11) {
      return `+55 (${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
    }
    return phone;
  };

  // Format date
  const formatDate = (date: string) => {
    if (!date) return '-';
    return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
  };

  // Format datetime
  const formatDateTime = (date: string) => {
    if (!date) return '-';
    const d = new Date(date);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    
    if (isToday) {
      return `Hoje, ${format(d, "HH:mm", { locale: ptBR })}`;
    }
    return format(d, "dd/MM/yyyy, HH:mm", { locale: ptBR });
  };

  return (
    <div className="w-[320px] bg-card border-l border-border flex flex-col h-full overflow-hidden">
      {/* Header: Contact Info - Horizontal Layout */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-3">
          {/* Avatar - Left side */}
          {contact.avatar_url ? (
            <div 
              className="w-14 h-14 rounded-full flex-shrink-0 cursor-pointer overflow-hidden hover:ring-2 hover:ring-primary transition-all"
              onClick={() => setShowPhotoModal(true)}
            >
              <img 
                src={contact.avatar_url} 
                alt={contact.full_name || 'Avatar'} 
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-full flex-shrink-0 bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-lg font-bold relative">
              {contact.full_name?.charAt(0)?.toUpperCase() || '?'}
              {isFetchingPhoto && (
                <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                </div>
              )}
            </div>
          )}
          
          {/* Info - Centered in remaining space */}
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <h3 className="text-sm font-bold text-foreground line-clamp-2 leading-tight">
              {contact.full_name || 'Sem nome'}
            </h3>
            
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <Phone size={10} className="flex-shrink-0" />
              <span>{formatPhone(contact.phone)}</span>
            </p>
            
            <button 
              onClick={() => setShowEditModal(true)}
              className="text-primary hover:text-primary/80 text-xs font-medium mt-1"
            >
              Editar contato
            </button>
          </div>
        </div>
      </div>

      {/* Photo Modal */}
      <Dialog open={showPhotoModal} onOpenChange={setShowPhotoModal}>
        <DialogContent className="max-w-md p-2 bg-transparent border-none shadow-none">
          {contact.avatar_url && (
            <img 
              src={contact.avatar_url} 
              alt={contact.full_name || 'Avatar'} 
              className="w-full h-auto rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Lead Status */}
        <div className="p-3 border-b border-border">
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
            Status Lead
          </label>
          <Select 
            value={contact.lead_status || 'new'}
            onValueChange={(value) => updateLeadStatus.mutate(value)}
            disabled={updateLeadStatus.isPending}
          >
            <SelectTrigger className="w-full h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {leadStatusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${option.color}`} />
                    {option.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tags */}
        <div className="p-3 border-b border-border">
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
            Etiquetas
          </label>
          
          <div className="flex flex-wrap gap-1.5 mb-2">
            {contactTags.length === 0 ? (
              <span className="text-xs text-muted-foreground">Nenhuma etiqueta</span>
            ) : (
              contactTags.map((tag: any) => (
                <span 
                  key={tag.id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ 
                    backgroundColor: `${tag.color || '#8B5CF6'}20`,
                    color: tag.color || '#8B5CF6'
                  }}
                >
                  {tag.name}
                  <button 
                    onClick={() => removeTag.mutate(tag.id)}
                    className="hover:opacity-70"
                    disabled={removeTag.isPending}
                  >
                    <X size={10} />
                  </button>
                </span>
              ))
            )}
          </div>
          
          <button
            onClick={() => setShowTagModal(true)}
            className="text-primary hover:text-primary/80 text-xs font-medium flex items-center gap-1"
          >
            <Plus size={12} />
            Adicionar etiqueta
          </button>
        </div>

        {/* Assigned User */}
        <div className="p-3 border-b border-border">
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
            Atendente Responsável
          </label>
          <Select 
            value={conversation.assigned_to || 'unassigned'}
            onValueChange={(value) => updateAssignedUser.mutate(value === 'unassigned' ? null : value)}
            disabled={updateAssignedUser.isPending}
          >
            <SelectTrigger className="w-full h-9 text-sm">
              <SelectValue placeholder="Selecionar atendente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Não atribuído</SelectItem>
              {teamMembers.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-[10px]">
                      {member.full_name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <span className="truncate">{member.full_name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Department */}
        <div className="p-3 border-b border-border">
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
            Departamento
          </label>
          <Select 
            value={conversation.department_id || 'none'}
            onValueChange={(value) => updateDepartment.mutate(value === 'none' ? null : value)}
            disabled={updateDepartment.isPending}
          >
            <SelectTrigger className="w-full h-9 text-sm">
              <SelectValue placeholder="Selecionar departamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Additional Info */}
        <div className="p-3 border-b border-border">
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Informações Adicionais
          </label>
          
          <div className="space-y-2.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Email</span>
              <span className="text-sm text-foreground break-all">
                {contact.email || '-'}
              </span>
            </div>
            
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Primeiro contato</span>
              <span className="text-sm text-foreground">
                {formatDate(contact.first_contact_at)}
              </span>
            </div>
            
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">Última interação</span>
              <span className="text-sm text-foreground">
                {formatDateTime(contact.last_interaction_at || conversation.last_message_at)}
              </span>
            </div>

            {contact.origin && (
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">Origem</span>
                <span className="text-sm text-foreground capitalize">
                  {contact.origin}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        {contact.notes && (
          <div className="p-3 border-b border-border">
            <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Observações
            </label>
            <p className="text-xs text-muted-foreground bg-muted rounded-lg p-2">
              {contact.notes}
            </p>
          </div>
        )}
      </div>

      {/* Footer: Action Buttons */}
      <div className="p-3 border-t border-border space-y-1.5">
        <Button
          onClick={() => setShowScheduleModal(true)}
          variant="outline"
          size="sm"
          className="w-full gap-2 h-9 text-xs"
        >
          <CalendarClock size={14} />
          Agendar mensagem
        </Button>
        
        <Button
          onClick={() => setShowCloseModal(true)}
          variant="ghost"
          size="sm"
          className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 gap-2 h-9 text-xs"
        >
          <X size={14} />
          Fechar conversa
        </Button>
      </div>

      {/* Modals */}
      <EditContactModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        contact={contact}
        conversationId={conversationId}
      />

      <AddTagModal
        open={showTagModal}
        onClose={() => setShowTagModal(false)}
        allTags={allTags}
        currentTagIds={contactTags.map((t: any) => t.id)}
        onAddTag={(tagId) => addTag.mutate(tagId)}
      />

      <ScheduleMessageModal
        open={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        contactId={contact.id}
        conversationId={conversationId}
        channelId={conversation?.channel_id}
        contactName={contact.full_name}
      />

      <CloseConversationModal
        open={showCloseModal}
        onClose={() => setShowCloseModal(false)}
        onConfirm={(reason) => closeConversation.mutate(reason)}
        isLoading={closeConversation.isPending}
      />
    </div>
  );
}

// Edit Contact Modal
function EditContactModal({ 
  open, 
  onClose, 
  contact,
  conversationId 
}: { 
  open: boolean; 
  onClose: () => void;
  contact: any;
  conversationId: string;
}) {
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    cpf_cnpj: '',
    birth_date: '',
    zip_code: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    notes: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (contact) {
      setFormData({
        full_name: contact.full_name || '',
        phone: contact.phone || '',
        email: contact.email || '',
        cpf_cnpj: contact.cpf_cnpj || '',
        birth_date: contact.birth_date || '',
        zip_code: contact.zip_code || '',
        street: contact.street || '',
        number: contact.number || '',
        complement: contact.complement || '',
        neighborhood: contact.neighborhood || '',
        city: contact.city || '',
        state: contact.state || '',
        notes: contact.notes || '',
      });
    }
  }, [contact]);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('contacts')
        .update({
          ...formData,
          updated_at: new Date().toISOString()
        })
        .eq('id', contact.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['conversation-details', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contato atualizado!');
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao atualizar contato');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAddressByCep = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      
      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          street: data.logradouro || prev.street,
          neighborhood: data.bairro || prev.neighborhood,
          city: data.localidade || prev.city,
          state: data.uf || prev.state,
        }));
        toast.success('Endereço encontrado!');
      }
    } catch (error) {
      console.error('Error fetching CEP:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Contato</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Nome *</label>
            <Input
              value={formData.full_name}
              onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
              placeholder="Nome completo"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Telefone</label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+55..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Email</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="email@exemplo.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">CPF/CNPJ</label>
              <Input
                value={formData.cpf_cnpj}
                onChange={(e) => setFormData(prev => ({ ...prev, cpf_cnpj: e.target.value }))}
                placeholder="000.000.000-00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Data de Nascimento</label>
              <Input
                type="date"
                value={formData.birth_date}
                onChange={(e) => setFormData(prev => ({ ...prev, birth_date: e.target.value }))}
              />
            </div>
          </div>

          <div className="pt-2 border-t border-border">
            <h4 className="text-sm font-medium text-foreground mb-3">Endereço</h4>
            
            <div className="mb-3">
              <label className="block text-sm font-medium text-muted-foreground mb-1">CEP</label>
              <Input
                value={formData.zip_code}
                onChange={(e) => setFormData(prev => ({ ...prev, zip_code: e.target.value }))}
                onBlur={(e) => fetchAddressByCep(e.target.value)}
                placeholder="00000-000"
              />
            </div>

            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-muted-foreground mb-1">Rua</label>
                <Input
                  value={formData.street}
                  onChange={(e) => setFormData(prev => ({ ...prev, street: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Nº</label>
                <Input
                  value={formData.number}
                  onChange={(e) => setFormData(prev => ({ ...prev, number: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Complemento</label>
                <Input
                  value={formData.complement}
                  onChange={(e) => setFormData(prev => ({ ...prev, complement: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Bairro</label>
                <Input
                  value={formData.neighborhood}
                  onChange={(e) => setFormData(prev => ({ ...prev, neighborhood: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-muted-foreground mb-1">Cidade</label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">UF</label>
                <Input
                  value={formData.state}
                  onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                  maxLength={2}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Observações</label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              className="min-h-[80px]"
              placeholder="Anotações sobre o contato..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave}
            disabled={isLoading}
            className="btn-gradient"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Add Tag Modal with ability to create new tags
function AddTagModal({ 
  open, 
  onClose, 
  allTags,
  currentTagIds,
  onAddTag
}: { 
  open: boolean; 
  onClose: () => void;
  allTags: any[];
  currentTagIds: string[];
  onAddTag: (tagId: string) => void;
}) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#8B5CF6');
  const [newTagVisibility, setNewTagVisibility] = useState<'public' | 'private'>('private');
  const [isCreating, setIsCreating] = useState(false);
  const queryClient = useQueryClient();

  // Filter tags based on search and current tags
  const availableTags = allTags
    .filter(tag => !currentTagIds.includes(tag.id))
    .filter(tag => tag.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const colors = [
    '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16', 
    '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9',
    '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF', '#EC4899'
  ];

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      toast.error('Digite o nome da etiqueta');
      return;
    }

    setIsCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: newTag, error } = await supabase
        .from('tags')
        .insert({
          name: newTagName.trim(),
          color: newTagColor,
          visibility: newTagVisibility,
          created_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Immediately add the new tag to the contact
      onAddTag(newTag.id);
      
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      toast.success('Etiqueta criada e adicionada!');
      
      // Reset form
      setNewTagName('');
      setNewTagColor('#8B5CF6');
      setShowCreateForm(false);
      onClose();
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('Já existe uma etiqueta com este nome');
      } else {
        toast.error('Erro ao criar etiqueta');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setShowCreateForm(false);
    setSearchQuery('');
    setNewTagName('');
    setNewTagColor('#8B5CF6');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {showCreateForm ? 'Criar Nova Etiqueta' : 'Adicionar Etiqueta'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          {!showCreateForm ? (
            <>
              {/* Search Input */}
              <div className="relative mb-4">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar etiqueta..."
                  className="pl-9"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Tags List */}
              <div className="space-y-1 max-h-60 overflow-y-auto mb-4">
                {availableTags.length === 0 ? (
                  <div className="text-center py-4">
                    {searchQuery ? (
                      <p className="text-muted-foreground text-sm">
                        Nenhuma etiqueta encontrada para "{searchQuery}"
                      </p>
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        Todas as etiquetas já foram adicionadas
                      </p>
                    )}
                  </div>
                ) : (
                  availableTags.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => {
                        onAddTag(tag.id);
                        onClose();
                      }}
                      className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted hover:bg-accent transition-colors"
                    >
                      <div 
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tag.color || '#8B5CF6' }}
                      />
                      <span className="text-foreground flex-1 text-left">{tag.name}</span>
                      {tag.visibility === 'private' && (
                        <span className="text-xs text-muted-foreground">🔒</span>
                      )}
                      {tag.visibility === 'department' && (
                        <span className="text-xs text-muted-foreground">🏢</span>
                      )}
                    </button>
                  ))
                )}
              </div>

              {/* Quick create from search */}
              {searchQuery && availableTags.length === 0 && (
                <button
                  onClick={() => {
                    setNewTagName(searchQuery);
                    setShowCreateForm(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors mb-2"
                >
                  <Plus size={16} />
                  Criar "{searchQuery}"
                </button>
              )}
              
              {/* Create New Tag Button */}
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-accent/50 transition-colors text-primary"
              >
                <Plus size={18} />
                Criar nova etiqueta
              </button>
            </>
          ) : (
            <>
              {/* Create Tag Form */}
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Nome da etiqueta *
                  </label>
                  <Input
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="Ex: Cliente VIP, Urgente..."
                    autoFocus
                  />
                </div>

                {/* Color */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Cor
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {colors.map((color) => (
                      <button
                        key={color}
                        onClick={() => setNewTagColor(color)}
                        className={`w-7 h-7 rounded-full transition-transform ${
                          newTagColor === color ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110' : ''
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Visibility */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Visibilidade
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setNewTagVisibility('private')}
                      className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg border-2 transition-colors ${
                        newTagVisibility === 'private' 
                          ? 'border-purple-500 bg-purple-500/20 text-purple-400' 
                          : 'border-border text-muted-foreground hover:border-muted-foreground'
                      }`}
                    >
                      <span className="text-sm">🔒 Só eu</span>
                    </button>
                    <button
                      onClick={() => setNewTagVisibility('public')}
                      className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg border-2 transition-colors ${
                        newTagVisibility === 'public' 
                          ? 'border-green-500 bg-green-500/20 text-green-400' 
                          : 'border-border text-muted-foreground hover:border-muted-foreground'
                      }`}
                    >
                      <span className="text-sm">🌍 Todos</span>
                    </button>
                  </div>
                </div>

                {/* Preview */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Pré-visualização
                  </label>
                  <div className="p-3 bg-muted rounded-lg">
                    <span 
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-white"
                      style={{ backgroundColor: newTagColor }}
                    >
                      {newTagName || 'Nome da etiqueta'}
                      {newTagVisibility === 'private' && ' 🔒'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1"
                >
                  Voltar
                </Button>
                <Button 
                  onClick={handleCreateTag}
                  disabled={isCreating || !newTagName.trim()}
                  className="flex-1 btn-gradient"
                >
                  {isCreating ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    'Criar'
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Close Conversation Modal
function CloseConversationModal({ 
  open, 
  onClose,
  onConfirm,
  isLoading
}: { 
  open: boolean; 
  onClose: () => void;
  onConfirm: (reason?: string) => void;
  isLoading: boolean;
}) {
  const [reason, setReason] = useState('');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Fechar Conversa</DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          <p className="text-muted-foreground text-sm mb-4">
            Tem certeza que deseja fechar esta conversa?
          </p>
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Motivo (opcional)
            </label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Venda concluída, Não respondeu..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={() => onConfirm(reason || undefined)}
            disabled={isLoading}
            variant="destructive"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4 mr-2" />}
            Fechar Conversa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConversationSidebar;
