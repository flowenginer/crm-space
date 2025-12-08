import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  X, Phone, Loader2, Plus, Save, Send, Smartphone, ArrowRightLeft, Lock, Check
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScheduleMessageModal } from './ScheduleMessageModal';
import { TransferModal } from './TransferModal';
import { fetchContactProfile } from '@/lib/whatsapp/instance-creator';
import { useLeadStatuses } from '@/hooks/useLeadKanban';

interface ConversationSidebarProps {
  conversationId: string;
  onClose?: () => void;
  onNavigateAway?: () => void;
}

export function ConversationSidebar({ conversationId, onClose, onNavigateAway }: ConversationSidebarProps) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [isFetchingPhoto, setIsFetchingPhoto] = useState(false);
  const [newConversationPhone, setNewConversationPhone] = useState('');
  const [isStartingConversation, setIsStartingConversation] = useState(false);
  const [showChannelSelector, setShowChannelSelector] = useState(false);
  const [pendingContactForConversation, setPendingContactForConversation] = useState<{ id?: string; phone: string } | null>(null);
  const [localNegotiatedValue, setLocalNegotiatedValue] = useState<string>('');
  
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isAdmin } = usePermissions();

  // Fetch dynamic lead statuses
  const { data: leadStatuses = [] } = useLeadStatuses();

  // Fetch conversation with contact data - campos específicos para otimização
  const { data: conversation, isLoading: loadingConversation } = useQuery({
    queryKey: ['conversation-details', conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id, contact_id, channel_id, assigned_to, department_id,
          status, is_unread, unread_count, last_message_at, last_message_preview,
          lead_status, created_at, referral_source, referral_data,
          contact:contacts(
            id, full_name, phone, email, avatar_url, is_online, is_typing,
            street, number, complement, neighborhood, city, state, zip_code,
            cpf_cnpj, notes, birth_date, first_contact_at, last_interaction_at, created_at,
            origin, origin_campaign, referral_data, lead_status, assigned_to, negotiated_value,
            owner_agent:profiles!contacts_assigned_to_fkey(
              id, full_name, avatar_url
            ),
            tags:contact_tags(
              tag:tags(id, name, color)
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
    staleTime: 30000, // 30 segundos de cache
  });

  // Fetch all tags (with visibility filter) - campos específicos
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
        .select('id, name, color, visibility, department_id, created_by')
        .or(conditions.join(','))
        .order('name');
      
      if (error) throw error;
      return data;
    },
    staleTime: 60000, // 1 minuto de cache para tags
  });

  // Fetch team members - campos específicos
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
    staleTime: 60000, // 1 minuto de cache
  });

  // Fetch departments - campos específicos
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name, color, icon')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    staleTime: 60000, // 1 minuto de cache
  });

  // Fetch available WhatsApp channels - campos específicos
  const { data: whatsappChannels = [] } = useQuery({
    queryKey: ['whatsapp-channels-sidebar'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_channels')
        .select('id, name, phone, status')
        .eq('is_deleted', false)
        .order('name');
      if (error) throw error;
      return data;
    },
    staleTime: 60000, // 1 minuto de cache
  });

  // Mutation: Update lead status
  const updateLeadStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      // Handle contact being array or object
      const contact = Array.isArray(conversation?.contact) 
        ? conversation?.contact[0] 
        : conversation?.contact;
      
      if (!contact?.id) {
        console.error('[updateLeadStatus] No contact found:', conversation);
        throw new Error('No contact');
      }
      
      console.log('[updateLeadStatus] Updating contact', contact.id, 'to status:', newStatus);
      
      const { error } = await supabase
        .from('contacts')
        .update({ 
          lead_status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', contact.id);
      
      if (error) {
        console.error('[updateLeadStatus] Error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation-details', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['contacts-for-kanban'] });
      toast.success('Status atualizado!');
    },
    onError: (error) => {
      console.error('[updateLeadStatus] Mutation error:', error);
      toast.error('Erro ao atualizar status');
    }
  });

  // Mutation: Update negotiated value
  const updateNegotiatedValue = useMutation({
    mutationFn: async (value: number) => {
      const contact = Array.isArray(conversation?.contact) 
        ? conversation?.contact[0] 
        : conversation?.contact;
      
      if (!contact?.id) throw new Error('No contact');
      
      const { error } = await supabase
        .from('contacts')
        .update({ 
          negotiated_value: value,
          updated_at: new Date().toISOString()
        })
        .eq('id', contact.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation-details', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['contacts-for-kanban'] });
      toast.success('Valor negociado atualizado!');
    },
    onError: () => {
      toast.error('Erro ao atualizar valor');
    }
  });

  // Mutation: Update assigned user (current agent)
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
      queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
      toast.success('Atendente atual atualizado!');
    },
    onError: () => {
      toast.error('Erro ao atualizar atendente');
    }
  });

  // Mutation: Update owner agent (responsible for contact)
  const updateOwnerAgent = useMutation({
    mutationFn: async (userId: string | null) => {
      if (!conversation?.contact?.id) throw new Error('No contact');
      
      const { error } = await supabase
        .from('contacts')
        .update({ 
          assigned_to: userId,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversation.contact.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation-details', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Atendente responsável atualizado!');
    },
    onError: () => {
      toast.error('Erro ao atualizar atendente responsável');
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
      queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
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

  // Mutation: Close conversation with timer pause
  const closeConversation = useMutation({
    mutationFn: async (reason?: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // Get current conversation data for timer calculation
      const { data: currentConv, error: fetchError } = await supabase
        .from('conversations')
        .select('created_at, reopened_at, total_active_time_seconds')
        .eq('id', conversationId)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Calculate active time since last open/reopen
      const startTime = currentConv.reopened_at || currentConv.created_at;
      const activeSeconds = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
      const newTotalTime = (currentConv.total_active_time_seconds || 0) + activeSeconds;
      
      // Update conversation with timer data
      const { error } = await supabase
        .from('conversations')
        .update({ 
          status: 'closed',
          closed_at: new Date().toISOString(),
          closed_by: user.id,
          close_reason: reason,
          total_active_time_seconds: newTotalTime,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversationId);
      
      if (error) throw error;
      
      // Register close event
      await supabase.from('conversation_events').insert({
        conversation_id: conversationId,
        event_type: 'close',
        actor_id: user.id,
        data: {
          close_reason: reason,
          active_time_seconds: activeSeconds,
          total_time_seconds: newTotalTime,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation-details', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-total-counts'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-events', conversationId] });
      
      // Navigate away from the closed conversation
      if (onNavigateAway) {
        onNavigateAway();
      }
      
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

  // Start new conversation with phone number (same logic as StartConversation component)
  const handleStartNewConversation = async () => {
    if (!newConversationPhone.trim()) {
      toast.error('Digite um número de telefone');
      return;
    }

    // Clean phone number - remove all non-digits
    const cleanPhone = newConversationPhone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      toast.error('Número de telefone inválido');
      return;
    }

    // Format with country code (same as cleanBrazilianPhone)
    const formattedPhone = cleanPhone.startsWith('55') && cleanPhone.length >= 12 
      ? cleanPhone 
      : `55${cleanPhone}`;
    const phoneWithoutCountry = formattedPhone.slice(2);

    console.log('[Sidebar] Searching for phone:', { cleanPhone, formattedPhone, phoneWithoutCountry });

    setIsStartingConversation(true);
    try {
      // STEP 1: Search for contact with various phone formats (exact matches)
      const { data: contacts, error: contactError } = await supabase
        .from('contacts')
        .select('id, phone, full_name')
        .or(`phone.eq.${formattedPhone},phone.eq.${phoneWithoutCountry}`);

      if (contactError) {
        console.error('[Sidebar] Contact search error:', contactError);
        throw contactError;
      }

      console.log('[Sidebar] Found contacts:', contacts);

      const existingContact = contacts && contacts.length > 0 ? contacts[0] : null;

      if (existingContact) {
        // STEP 2: Check if this contact has an existing conversation (open or pending first, then any)
        const { data: existingConv, error: convError } = await supabase
          .from('conversations')
          .select('id, status')
          .eq('contact_id', existingContact.id)
          .in('status', ['open', 'pending'])
          .order('last_message_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (convError) {
          console.error('[Sidebar] Conversation search error:', convError);
          throw convError;
        }

        console.log('[Sidebar] Found conversation:', existingConv);

        if (existingConv) {
          // FOUND! Navigate directly to existing conversation
          navigate(`/conversations?id=${existingConv.id}`);
          toast.info('Conversa existente encontrada!');
          setNewConversationPhone('');
          setIsStartingConversation(false);
          return;
        }

        // No open/pending - check for any conversation (including closed)
        const { data: anyConv } = await supabase
          .from('conversations')
          .select('id, status')
          .eq('contact_id', existingContact.id)
          .order('last_message_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (anyConv) {
          // Reopen if closed
          if (anyConv.status === 'closed') {
            const { data: { user } } = await supabase.auth.getUser();
            await supabase
              .from('conversations')
              .update({ 
                status: 'open', 
                closed_at: null, 
                closed_by: null,
                close_reason: null,
                updated_at: new Date().toISOString()
              })
              .eq('id', anyConv.id);
            
            queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
            toast.success('Conversa reaberta!');
          } else {
            toast.info('Conversa encontrada!');
          }
          
          navigate(`/conversations?id=${anyConv.id}`);
          setNewConversationPhone('');
          setIsStartingConversation(false);
          return;
        }

        // Contact exists but NO conversation - show channel selector
        setPendingContactForConversation({ id: existingContact.id, phone: formattedPhone });
        setShowChannelSelector(true);
        setIsStartingConversation(false);
        return;
      }

      // STEP 3: No contact found - show channel selector to create both
      console.log('[Sidebar] No contact found, showing channel selector');
      setPendingContactForConversation({ phone: formattedPhone });
      setShowChannelSelector(true);
    } catch (error) {
      console.error('[Sidebar] Error searching contact:', error);
      toast.error('Erro ao buscar contato');
    } finally {
      setIsStartingConversation(false);
    }
  };

  // Create conversation with selected channel
  const handleCreateConversationWithChannel = async (channelId: string) => {
    if (!pendingContactForConversation) return;

    setIsStartingConversation(true);
    setShowChannelSelector(false);

    try {
      let contactId = pendingContactForConversation.id;

      // Create contact if doesn't exist
      if (!contactId) {
        const { data: newContact, error: contactError } = await supabase
          .from('contacts')
          .insert({
            phone: pendingContactForConversation.phone,
            full_name: `WhatsApp ${pendingContactForConversation.phone.slice(-4)}`,
          })
          .select('id')
          .single();

        if (contactError) throw contactError;
        contactId = newContact.id;
      }

      // Create new conversation with selected channel
      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({
          contact_id: contactId,
          status: 'open',
          channel_id: channelId,
        })
        .select('id')
        .single();

      if (convError) throw convError;
      
      navigate(`/conversations?id=${newConv.id}`);
      toast.success('Nova conversa criada!');

      setNewConversationPhone('');
      setPendingContactForConversation(null);
      queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast.error('Erro ao criar conversa');
    } finally {
      setIsStartingConversation(false);
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

  // Handle contact being array or object (Supabase can return either)
  const contact = Array.isArray(conversation.contact) 
    ? conversation.contact[0] 
    : conversation.contact;
  
  console.log('[ConversationSidebar] Contact data:', { 
    id: contact?.id, 
    negotiated_value: contact?.negotiated_value,
    lead_status: contact?.lead_status 
  });
  
  const contactTags = contact?.tags?.map((t: any) => t.tag).filter(Boolean) || [];

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
        {/* Valor Negociado - Campo para input de valor com botão confirmar */}
        <div className="p-3 border-b border-border bg-emerald-50/50 dark:bg-emerald-900/10">
          <label className="block text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span className="text-base">💰</span>
            Valor Negociado
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 dark:text-emerald-400 text-sm font-bold">R$</span>
              <Input
                type="number"
                value={localNegotiatedValue || (contact?.negotiated_value ?? '')}
                onChange={(e) => setLocalNegotiatedValue(e.target.value)}
                className="pl-10 h-10 text-sm font-medium border-emerald-200 dark:border-emerald-800 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="0,00"
                min={0}
                step={0.01}
                disabled={updateNegotiatedValue.isPending}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const value = parseFloat(localNegotiatedValue) || 0;
                    updateNegotiatedValue.mutate(value, {
                      onSuccess: () => setLocalNegotiatedValue('')
                    });
                  }
                }}
              />
            </div>
            <Button
              size="icon"
              variant="default"
              className="h-10 w-10 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
              disabled={updateNegotiatedValue.isPending || !localNegotiatedValue}
              onClick={() => {
                const value = parseFloat(localNegotiatedValue) || 0;
                updateNegotiatedValue.mutate(value, {
                  onSuccess: () => setLocalNegotiatedValue('')
                });
              }}
            >
              {updateNegotiatedValue.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
            </Button>
          </div>
          {contact?.negotiated_value > 0 && !localNegotiatedValue && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1.5">
              Valor atual: R$ {contact.negotiated_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          )}
        </div>

        {/* Lead Status */}
        <div className="p-3 border-b border-border">
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
            Status Lead
          </label>
          <Select 
            value={contact.lead_status || ''}
            onValueChange={(value) => updateLeadStatus.mutate(value)}
            disabled={updateLeadStatus.isPending}
          >
            <SelectTrigger className="w-full h-9 text-sm">
              <SelectValue placeholder="Selecione um status..." />
            </SelectTrigger>
            <SelectContent>
              {leadStatuses.map((status) => (
                <SelectItem key={status.id} value={status.name}>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: status.color || '#8B5CF6' }}
                    />
                    {status.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tags - REMOVED - Now in header */}

        {/* Current Agent (Atendente Atual) */}
        <div className="p-3 border-b border-border">
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
            Atendente Atual
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

        {/* Owner Agent (Atendente Responsável - do contato) */}
        <div className="p-3 border-b border-border">
          {(() => {
            const contactAssignedTo = (contact as any)?.assigned_to;
            const hasNoOwner = !contactAssignedTo;
            // Vendedores podem se atribuir se o contato não tem dono, admins podem sempre
            const canEditOwner = isAdmin || hasNoOwner;
            
            return (
              <>
                <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  Atendente Responsável
                  <span className="text-[10px] font-normal text-muted-foreground/70">(dono do contato)</span>
                  {!canEditOwner && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Lock className="h-3 w-3 text-muted-foreground/50" />
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p className="text-xs">Este contato já tem um responsável atribuído</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </label>
                <Select 
                  value={contactAssignedTo || 'unassigned'}
                  onValueChange={(value) => updateOwnerAgent.mutate(value === 'unassigned' ? null : value)}
                  disabled={updateOwnerAgent.isPending || !canEditOwner}
                >
                  <SelectTrigger className={`w-full h-9 text-sm ${!canEditOwner ? 'opacity-70 cursor-not-allowed' : ''}`}>
                    <SelectValue placeholder="Selecionar responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Não atribuído</SelectItem>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white text-[10px]">
                            {member.full_name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <span className="truncate">{member.full_name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            );
          })()}
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
                  {contact.origin?.replace(/_/g, ' ')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Meta Ads / Referral Data */}
        {(contact.origin === 'meta_ads' || contact.referral_data || conversation.referral_data) && (() => {
          const referralData = contact.referral_data || conversation.referral_data;
          if (!referralData || typeof referralData !== 'object') return null;
          
          const rd = referralData as Record<string, any>;
          const hasData = rd.adName || rd.headline || rd.sourceUrl || rd.body || rd.campaignName;
          if (!hasData) return null;
          
          return (
            <div className="p-3 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b border-border">
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span>📣</span> Origem do Anúncio
              </label>
              
              <div className="space-y-2">
                {/* Campaign Name */}
                {rd.campaignName && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-muted-foreground uppercase">Campanha</span>
                    <span className="text-xs text-foreground font-medium">{rd.campaignName}</span>
                  </div>
                )}
                
                {/* Ad Name */}
                {rd.adName && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-muted-foreground uppercase">Anúncio</span>
                    <span className="text-xs text-foreground font-medium">{rd.adName}</span>
                  </div>
                )}
                
                {/* Headline */}
                {rd.headline && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-muted-foreground uppercase">Título</span>
                    <span className="text-xs text-foreground">{rd.headline}</span>
                  </div>
                )}
                
                {/* Body */}
                {rd.body && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-muted-foreground uppercase">Texto</span>
                    <span className="text-xs text-muted-foreground line-clamp-3">{rd.body}</span>
                  </div>
                )}
                
                {/* Source URL - Link to Ad */}
                {rd.sourceUrl && typeof rd.sourceUrl === 'string' && rd.sourceUrl.startsWith('http') && (
                  <a 
                    href={rd.sourceUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 hover:underline mt-1"
                  >
                    <span>🔗</span> Ver anúncio original →
                  </a>
                )}
                
                {/* Thumbnail (if valid URL) - with fallback to imageUrl */}
                {(() => {
                  const validThumbnail = 
                    (typeof rd.thumbnailUrl === 'string' && rd.thumbnailUrl.startsWith('http')) 
                      ? rd.thumbnailUrl 
                      : (typeof rd.imageUrl === 'string' && rd.imageUrl.startsWith('http'))
                        ? rd.imageUrl 
                        : null;
                  
                  return validThumbnail ? (
                    <div className="mt-2">
                      <img 
                        src={validThumbnail} 
                        alt="Ad thumbnail" 
                        className="w-full h-auto rounded-lg border border-border max-h-32 object-cover"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    </div>
                  ) : null;
                })()}
              </div>
            </div>
          );
        })()}

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
      <div className="p-3 border-t border-border space-y-3">
        {/* Transfer & Close Buttons */}
        <div className="flex gap-2 pb-3 border-b border-border">
          <Button
            onClick={() => setShowTransferModal(true)}
            variant="outline"
            size="sm"
            className="flex-1 gap-2 h-9 text-xs"
          >
            <ArrowRightLeft size={14} />
            Transferir
          </Button>
          
          <Button
            onClick={() => setShowCloseModal(true)}
            variant="ghost"
            size="sm"
            className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10 gap-2 h-9 text-xs"
          >
            <X size={14} />
            Fechar
          </Button>
        </div>

        {/* Start New Conversation */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Iniciar nova conversa
          </label>
          <div className="flex gap-2">
            <div className="flex items-center gap-1 px-2 bg-muted rounded-lg text-xs text-muted-foreground flex-shrink-0">
              <span>BR</span>
              <span>+55</span>
            </div>
            <Input
              type="tel"
              placeholder="(00) 00000-0000"
              value={newConversationPhone}
              onChange={(e) => setNewConversationPhone(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleStartNewConversation()}
              className="h-9 text-sm flex-1"
            />
            <Button
              onClick={handleStartNewConversation}
              disabled={isStartingConversation || !newConversationPhone.trim()}
              size="sm"
              className="h-9 w-9 p-0 flex-shrink-0"
            >
              {isStartingConversation ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-1.5">
            Digite o número com DDD para iniciar uma conversa
          </p>
        </div>
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

      <TransferModal
        open={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        onTransferSuccess={onNavigateAway}
        conversationId={conversationId}
        currentAssignedTo={conversation?.assigned_to}
        currentDepartmentId={conversation?.department_id}
      />

      {/* Channel Selector Modal */}
      <Dialog open={showChannelSelector} onOpenChange={setShowChannelSelector}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Escolha o canal WhatsApp</DialogTitle>
            <DialogDescription>
              Selecione por qual conexão deseja iniciar a conversa
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-2 mt-4">
            {whatsappChannels.filter(c => c.status === 'connected').length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum canal conectado disponível
              </p>
            ) : (
              whatsappChannels.filter(c => c.status === 'connected').map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => handleCreateConversationWithChannel(channel.id)}
                  disabled={isStartingConversation}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Smartphone size={20} className="text-green-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{channel.name}</p>
                    <p className="text-xs text-muted-foreground">{channel.phone}</p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
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
      // Converter strings vazias em null para campos que o PostgreSQL não aceita vazio
      const updateData = {
        full_name: formData.full_name,
        email: formData.email || null,
        cpf_cnpj: formData.cpf_cnpj || null,
        birth_date: formData.birth_date || null,
        zip_code: formData.zip_code || null,
        street: formData.street || null,
        number: formData.number || null,
        complement: formData.complement || null,
        neighborhood: formData.neighborhood || null,
        city: formData.city || null,
        state: formData.state || null,
        notes: formData.notes || null,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('contacts')
        .update(updateData)
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
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [note, setNote] = useState('');

  // Fetch close reasons from database
  const { data: closeReasons = [] } = useQuery({
    queryKey: ['close-reasons-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('close_reasons')
        .select('id, name, value, color')
        .eq('is_active', true)
        .order('order_position', { ascending: true });
      if (error) throw error;
      return data;
    },
    staleTime: 60000,
  });

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setSelectedReason('');
      setNote('');
    }
  }, [open]);

  const handleConfirm = () => {
    // If a reason is selected, use it. Otherwise use note if provided
    const finalReason = selectedReason || (note ? note : undefined);
    onConfirm(finalReason);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Fechar Conversa</DialogTitle>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          <p className="text-muted-foreground text-sm">
            Selecione o motivo de fechamento:
          </p>
          
          {/* Reason Selection */}
          <div className="grid grid-cols-2 gap-2">
            {closeReasons.map((reason) => (
              <button
                key={reason.id}
                onClick={() => setSelectedReason(reason.value)}
                className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left ${
                  selectedReason === reason.value
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-muted-foreground'
                }`}
              >
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: reason.color }}
                />
                <span className="text-sm font-medium truncate">{reason.name}</span>
              </button>
            ))}
          </div>
          
          {/* Optional Note */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Observação (opcional)
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Adicione uma observação..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm}
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
