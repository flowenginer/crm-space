import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { MessageSquare, Send, Loader2, Phone, User, Smartphone, ShieldAlert, UserPlus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { formatBrazilianPhone, normalizePhoneForStorage, isValidBrazilianPhone, extractLast8Digits } from '@/utils/phone';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { ContactRequestModal } from './ContactRequestModal';
import { getUserPrimaryDepartment } from '@/hooks/useUserPrimaryDepartment';

interface StartConversationProps {
  onConversationCreated?: (conversationId: string) => void;
}

interface BlockedContactInfo {
  contact: { id: string; full_name: string; phone: string };
  owner: { id: string; full_name: string | null; avatar_url: string | null };
  conversationId?: string | null;
}

interface OpenConversation {
  id: string;
  assigned_to: string | null;
  department_id: string | null;
  channel_id: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  channel: { id: string; name: string; phone: string } | null;
}

export function StartConversation({ onConversationCreated }: StartConversationProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  const [showSearchResult, setShowSearchResult] = useState(false);
  const [showChannelSelector, setShowChannelSelector] = useState(false);
  const [pendingContact, setPendingContact] = useState<any>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [blockedContactInfo, setBlockedContactInfo] = useState<BlockedContactInfo | null>(null);
  
  // New states for improved flow
  const [showCreateContactModal, setShowCreateContactModal] = useState(false);
  const [showMultipleConversationsModal, setShowMultipleConversationsModal] = useState(false);
  const [openConversations, setOpenConversations] = useState<OpenConversation[]>([]);
  const [newContactName, setNewContactName] = useState('');
  
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const { user } = useAuth();

  // Fetch available WhatsApp channels
  const { data: channels = [] } = useQuery({
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

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatBrazilianPhone(e.target.value);
    setPhoneNumber(formatted);
    setShowSearchResult(false);
    setSearchResult(null);
  };

  const isValidPhone = () => isValidBrazilianPhone(phoneNumber);

  // Check if user can access a CONTACT (not just conversation)
  const checkContactAccess = async (contact: { id: string; assigned_to: string | null; department_id: string | null }): Promise<{ 
    canAccess: boolean; 
    ownerName?: string;
    ownerId?: string;
    ownerAvatar?: string | null;
  }> => {
    // Admin/supervisor can access all
    if (can.viewAllConversations()) {
      return { canAccess: true };
    }

    // If contact has an owner (assigned_to), check if it's the current user
    if (contact.assigned_to) {
      if (contact.assigned_to === user?.id) {
        return { canAccess: true };
      }
      
      // EXCEÇÃO: Verificar se alguma conversa deste contato foi compartilhada COM o usuário
      const { data: sharedConvs } = await supabase
        .from('shared_conversations')
        .select('conversation_id, conversations!inner(contact_id)')
        .eq('conversations.contact_id', contact.id)
        .eq('shared_with', user?.id!)
        .limit(1);

      if (sharedConvs && sharedConvs.length > 0) {
        return { canAccess: true };
      }
      
      // Contact belongs to another user - get owner info
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', contact.assigned_to)
        .single();
      
      return { 
        canAccess: false, 
        ownerName: ownerProfile?.full_name || 'outro atendente',
        ownerId: ownerProfile?.id,
        ownerAvatar: ownerProfile?.avatar_url
      };
    }

    // Contact has no owner - check department access
    if (contact.department_id) {
      const { data: userDepartments } = await supabase
        .from('user_departments')
        .select('department_id')
        .eq('user_id', user?.id!);

      const userDeptIds = userDepartments?.map(d => d.department_id) || [];
      
      if (!userDeptIds.includes(contact.department_id)) {
        return { canAccess: false, ownerName: 'outro departamento' };
      }
    }

    // Contact is accessible (no owner, or user has department access)
    return { canAccess: true };
  };

  // Search for existing contact and conversation
  const searchContact = async () => {
    if (!isValidPhone()) {
      toast.error('Digite um número válido');
      return;
    }

    setIsLoading(true);
    try {
      const normalizedPhone = normalizePhoneForStorage(phoneNumber);
      
      // Search contact by last 8 digits to prevent duplicates from 9th digit variation
      const last8Digits = extractLast8Digits(normalizedPhone);
      const { data: contactResult, error } = await supabase
        .rpc('find_contact_by_phone_suffix', { phone_suffix: last8Digits });

      if (error) throw error;
      
      // RPC returns array, get the first match (most recent)
      const contact = contactResult && contactResult.length > 0 ? contactResult[0] : null;

      if (contact) {
        // *** CRITICAL: First check if user can access the CONTACT itself ***
        const contactAccessResult = await checkContactAccess({
          id: contact.id,
          assigned_to: contact.assigned_to,
          department_id: contact.department_id
        });

        if (!contactAccessResult.canAccess) {
          // Contact belongs to another user - show request modal immediately
          const { data: anyConv } = await supabase
            .from('conversations')
            .select('id')
            .eq('contact_id', contact.id)
            .order('last_message_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          setBlockedContactInfo({
            contact: { id: contact.id, full_name: contact.full_name, phone: contact.phone },
            owner: { 
              id: contactAccessResult.ownerId!, 
              full_name: contactAccessResult.ownerName || null, 
              avatar_url: contactAccessResult.ownerAvatar || null 
            },
            conversationId: anyConv?.id || null,
          });
          setShowRequestModal(true);
          toast.error(`Este contato pertence a ${contactAccessResult.ownerName}. Você precisa solicitar acesso.`);
          return;
        }

        // User CAN access this contact - now check for ALL existing open conversations
        const { data: openConvs } = await supabase
          .from('conversations')
          .select(`
            id, 
            assigned_to, 
            department_id, 
            channel_id,
            last_message_at,
            last_message_preview,
            channel:whatsapp_channels(id, name, phone)
          `)
          .eq('contact_id', contact.id)
          .in('status', ['open', 'pending'])
          .order('last_message_at', { ascending: false });

        // Get current user for assignment
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        const sellerDepartmentId = currentUser?.id ? await getUserPrimaryDepartment(currentUser.id) : null;

        if (openConvs && openConvs.length > 0) {
          if (openConvs.length === 1) {
            // Only ONE open conversation - open it directly
            const openConv = openConvs[0];
            
            // If conversation has no owner, assign to current user
            if (!openConv.assigned_to && currentUser?.id) {
              await supabase
                .from('conversations')
                .update({ 
                  assigned_to: currentUser.id,
                  department_id: sellerDepartmentId,
                  updated_at: new Date().toISOString()
                })
                .eq('id', openConv.id);

              // Update contact too if no owner
              await supabase
                .from('contacts')
                .update({ 
                  assigned_to: currentUser.id,
                  department_id: sellerDepartmentId,
                })
                .eq('id', contact.id)
                .is('assigned_to', null);

              queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
              queryClient.invalidateQueries({ queryKey: ['contacts'] });
              toast.success('Conversa atribuída a você');
            } else {
              toast.info('Conversa existente encontrada');
            }
            
            if (onConversationCreated) {
              onConversationCreated(openConv.id);
            }
            setPhoneNumber('');
            return;
          } else {
            // MULTIPLE open conversations - show selection modal
            setOpenConversations(openConvs as OpenConversation[]);
            setSearchResult(contact);
            setShowMultipleConversationsModal(true);
            toast.info(`${openConvs.length} conversas abertas encontradas`);
            return;
          }
        }

        // No open conversations - check for closed ones to reopen
        const { data: closedConv } = await supabase
          .from('conversations')
          .select('id, status, assigned_to, close_reason, closed_at, closed_by, reopen_count')
          .eq('contact_id', contact.id)
          .eq('status', 'closed')
          .order('last_message_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (closedConv) {
          // Reopen the conversation
          await supabase
            .from('conversations')
            .update({ 
              status: 'open', 
              assigned_to: currentUser?.id,
              department_id: sellerDepartmentId,
              reopened_at: new Date().toISOString(),
              reopen_count: (closedConv.reopen_count || 0) + 1,
              previous_close_reason: closedConv.close_reason,
              previous_closed_at: closedConv.closed_at,
              previous_closed_by: closedConv.closed_by,
              closed_at: null, 
              closed_by: null,
              close_reason: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', closedConv.id);

          // Update contact too if no owner
          await supabase
            .from('contacts')
            .update({ 
              assigned_to: currentUser?.id,
              department_id: sellerDepartmentId,
            })
            .eq('id', contact.id)
            .is('assigned_to', null);
          
          // Register reopen event
          await supabase.from('conversation_events').insert({
            conversation_id: closedConv.id,
            event_type: 'reopen',
            actor_id: user?.id || null,
            data: {
              previous_close_reason: closedConv.close_reason,
              previous_closed_at: closedConv.closed_at,
              trigger: 'manual',
            },
          });

          queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
          queryClient.invalidateQueries({ queryKey: ['conversations-counts'] });
          queryClient.invalidateQueries({ queryKey: ['contacts'] });
          queryClient.invalidateQueries({ queryKey: ['conversation-events', closedConv.id] });
          
          toast.success('Conversa reaberta e atribuída a você');
          
          if (onConversationCreated) {
            onConversationCreated(closedConv.id);
          }
          setPhoneNumber('');
          return;
        }

        // Contact exists but no conversation - show channel selector
        setSearchResult(contact);
        setPendingContact(contact);
        setShowSearchResult(true);
      } else {
        // *** NO CONTACT FOUND - Show create contact modal ***
        setPendingContact({ phone: normalizedPhone });
        setNewContactName('');
        setShowCreateContactModal(true);
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro ao buscar contato');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle creating contact and showing channel selector
  const handleCreateContactAndShowChannels = () => {
    if (!newContactName.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    
    // Save the name along with the phone
    setPendingContact({
      phone: pendingContact?.phone,
      full_name: newContactName.trim()
    });
    
    setShowCreateContactModal(false);
    setShowChannelSelector(true);
  };

  // Handle selecting a conversation from multiple open ones
  const handleSelectConversation = async (conv: OpenConversation) => {
    setIsLoading(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      // Assign to user if no owner
      if (!conv.assigned_to && currentUser?.id) {
        const departmentId = await getUserPrimaryDepartment(currentUser.id);
        await supabase
          .from('conversations')
          .update({ 
            assigned_to: currentUser.id,
            department_id: departmentId,
            updated_at: new Date().toISOString()
          })
          .eq('id', conv.id);
        
        // Update contact too
        if (searchResult?.id) {
          await supabase
            .from('contacts')
            .update({ 
              assigned_to: currentUser.id,
              department_id: departmentId,
            })
            .eq('id', searchResult.id)
            .is('assigned_to', null);
        }
        
        queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
        queryClient.invalidateQueries({ queryKey: ['contacts'] });
        toast.success('Conversa atribuída a você');
      }
      
      setShowMultipleConversationsModal(false);
      setOpenConversations([]);
      setSearchResult(null);
      setPhoneNumber('');
      
      if (onConversationCreated) {
        onConversationCreated(conv.id);
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro ao abrir conversa');
    } finally {
      setIsLoading(false);
    }
  };

  // Start conversation with selected channel
  const startConversationWithChannel = async (channelId: string, existingContact: any) => {
    setIsLoading(true);
    setShowChannelSelector(false);
    
    try {
      const normalizedPhone = normalizePhoneForStorage(phoneNumber);
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      let contactId: string;

      if (existingContact?.id) {
        // *** CRITICAL: Double-check contact access before proceeding ***
        const accessCheck = await checkContactAccess({
          id: existingContact.id,
          assigned_to: existingContact.assigned_to,
          department_id: existingContact.department_id
        });

        if (!accessCheck.canAccess) {
          toast.error(`Este contato pertence a ${accessCheck.ownerName}. Você precisa solicitar acesso.`);
          setBlockedContactInfo({
            contact: { id: existingContact.id, full_name: existingContact.full_name, phone: existingContact.phone },
            owner: { 
              id: accessCheck.ownerId!, 
              full_name: accessCheck.ownerName || null, 
              avatar_url: accessCheck.ownerAvatar || null 
            },
            conversationId: null,
          });
          setShowRequestModal(true);
          setIsLoading(false);
          return;
        }

        contactId = existingContact.id;

        // Check if conversation already exists for this contact ON THIS SPECIFIC CHANNEL
        const { data: existingConvSameChannel } = await supabase
          .from('conversations')
          .select('id')
          .eq('contact_id', contactId)
          .eq('channel_id', channelId)
          .in('status', ['open', 'pending'])
          .limit(1)
          .maybeSingle();

        if (existingConvSameChannel) {
          toast.info('Já existe conversa aberta neste canal');
          if (onConversationCreated) {
            onConversationCreated(existingConvSameChannel.id);
          }
          setPhoneNumber('');
          setSearchResult(null);
          setShowSearchResult(false);
          setPendingContact(null);
          setIsLoading(false);
          return;
        }
      } else {
        // Verify duplicate one last time before creating using RPC
        const last8Digits = extractLast8Digits(normalizedPhone);
        const { data: existingByPhoneResult } = await supabase
          .rpc('find_contact_by_phone_suffix', { phone_suffix: last8Digits });
        
        const existingByPhone = existingByPhoneResult && existingByPhoneResult.length > 0 
          ? existingByPhoneResult[0] 
          : null;
        
        if (existingByPhone) {
          // *** CRITICAL: Check if this existing contact belongs to another user ***
          const accessCheck = await checkContactAccess({
            id: existingByPhone.id,
            assigned_to: existingByPhone.assigned_to,
            department_id: existingByPhone.department_id
          });

          if (!accessCheck.canAccess) {
            toast.error(`Este contato pertence a ${accessCheck.ownerName}. Você precisa solicitar acesso.`);
            setBlockedContactInfo({
              contact: { id: existingByPhone.id, full_name: existingByPhone.full_name, phone: normalizedPhone },
              owner: { 
                id: accessCheck.ownerId!, 
                full_name: accessCheck.ownerName || null, 
                avatar_url: accessCheck.ownerAvatar || null 
              },
              conversationId: null,
            });
            setShowRequestModal(true);
            setIsLoading(false);
            return;
          }

          toast.info(`Contato já existe: ${existingByPhone.full_name}`);
          contactId = existingByPhone.id;

          // Check for existing conversation ON THIS SPECIFIC CHANNEL to prevent duplicates
          const { data: existingConvSameChannel } = await supabase
            .from('conversations')
            .select('id')
            .eq('contact_id', contactId)
            .eq('channel_id', channelId)
            .in('status', ['open', 'pending'])
            .limit(1)
            .maybeSingle();

          if (existingConvSameChannel) {
            toast.info('Já existe conversa aberta neste canal');
            if (onConversationCreated) {
              onConversationCreated(existingConvSameChannel.id);
            }
            setPhoneNumber('');
            setSearchResult(null);
            setShowSearchResult(false);
            setPendingContact(null);
            setIsLoading(false);
            return;
          }
        } else {
          // *** CRITICAL: Get user's primary department before creating contact ***
          const userDepartmentId = currentUser?.id ? await getUserPrimaryDepartment(currentUser.id) : null;

          // Create new contact with normalized phone - assign to current user AND department
          // *** USE THE PROVIDED NAME FROM MODAL ***
          const { data: newContact, error: contactError } = await supabase
            .from('contacts')
            .insert({
              phone: normalizedPhone,
              full_name: pendingContact?.full_name || `+${normalizedPhone}`,
              lead_status: 'new',
              origin: 'manual',
              first_contact_at: new Date().toISOString(),
              assigned_to: currentUser?.id,
              department_id: userDepartmentId,
            })
            .select()
            .single();

          if (contactError) {
            // If duplicate constraint error, find the existing one using RPC
            if (contactError.code === '23505') {
              const { data: foundContactResult } = await supabase
                .rpc('find_contact_by_phone_suffix', { phone_suffix: last8Digits });
              
              const foundContact = foundContactResult && foundContactResult.length > 0 
                ? foundContactResult[0] 
                : null;
              
              if (foundContact) {
                // Check access for this found contact
                const accessCheck = await checkContactAccess({
                  id: foundContact.id,
                  assigned_to: foundContact.assigned_to,
                  department_id: foundContact.department_id
                });

                if (!accessCheck.canAccess) {
                  toast.error(`Este contato pertence a ${accessCheck.ownerName}.`);
                  setBlockedContactInfo({
                    contact: { id: foundContact.id, full_name: foundContact.full_name, phone: normalizedPhone },
                    owner: { 
                      id: accessCheck.ownerId!, 
                      full_name: accessCheck.ownerName || null, 
                      avatar_url: accessCheck.ownerAvatar || null 
                    },
                    conversationId: null,
                  });
                  setShowRequestModal(true);
                  setIsLoading(false);
                  return;
                }

                toast.info(`Contato encontrado: ${foundContact.full_name}`);
                contactId = foundContact.id;
              } else {
                throw contactError;
              }
            } else {
              throw contactError;
            }
          } else {
            contactId = newContact.id;
            toast.success('Novo contato criado!');
          }
        }
      }

      // *** CRITICAL: Get primary department for conversation ***
      const convDepartmentId = currentUser?.id ? await getUserPrimaryDepartment(currentUser.id) : null;

      // Create new conversation with selected channel AND department
      const { data: newConversation, error: createError } = await supabase
        .from('conversations')
        .insert({
          contact_id: contactId,
          channel_id: channelId,
          status: 'open',
          assigned_to: currentUser?.id,
          department_id: convDepartmentId,
          is_unread: false,
          unread_count: 0,
          last_message_at: new Date().toISOString(),
          last_message_preview: 'Nova conversa iniciada',
        })
        .select()
        .single();

      if (createError) throw createError;

      // Also update the contact's assigned_to and department_id if not already set
      await supabase
        .from('contacts')
        .update({ 
          assigned_to: currentUser?.id,
          department_id: convDepartmentId,
        })
        .eq('id', contactId)
        .is('assigned_to', null);

      queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-counts'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });

      toast.success('Conversa criada!');
      
      if (onConversationCreated) {
        onConversationCreated(newConversation.id);
      }

      // Reset form
      setPhoneNumber('');
      setSearchResult(null);
      setShowSearchResult(false);
      setPendingContact(null);

    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Erro ao criar conversa');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValidPhone()) {
      toast.error('Digite um número de telefone válido');
      return;
    }

    searchContact();
  };

  const handleStartWithContact = (contact: any) => {
    setPendingContact(contact);
    setShowChannelSelector(true);
  };

  const connectedChannels = channels.filter(c => c.status === 'connected');

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 bg-gradient-to-br from-primary/5 to-secondary/5">
      {/* Icon */}
      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mb-6 shadow-lg shadow-primary/25">
        <MessageSquare size={40} className="text-primary-foreground" />
      </div>

      {/* Title */}
      <h2 className="text-2xl font-bold text-foreground mb-2">
        Selecione uma conversa
      </h2>
      <p className="text-muted-foreground text-center mb-8 max-w-sm">
        Escolha uma conversa da lista ou inicie uma nova para começar
      </p>

      {/* Start Conversation Form */}
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl p-5 shadow-xl border border-border">
          <label className="block text-sm font-medium text-foreground mb-3">
            Iniciar nova conversa
          </label>
          
          <form onSubmit={handleSubmit}>
            <div className="flex gap-2">
              {/* Country Code */}
              <div className="flex items-center gap-2 bg-muted rounded-xl px-4 py-3 text-muted-foreground">
                <span className="text-sm">🇧🇷</span>
                <span className="text-sm font-medium">+55</span>
              </div>

              {/* Phone Input */}
              <div className="flex-1">
                <Input
                  type="tel"
                  placeholder="(00) 00000-0000"
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  className="w-full bg-muted border-0 rounded-xl py-3 px-4 text-base h-12"
                  disabled={isLoading}
                />
              </div>

              {/* Send Button */}
              <Button
                type="submit"
                disabled={!isValidPhone() || isLoading}
                className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 rounded-xl px-4 h-12"
              >
                {isLoading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Send size={20} />
                )}
              </Button>
            </div>
          </form>

          {/* Search Result */}
          {showSearchResult && searchResult && (
            <div className="mt-4 p-4 bg-muted rounded-xl">
              <p className="text-xs text-muted-foreground mb-3">Contato encontrado (sem conversa ativa):</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-semibold">
                    {searchResult.full_name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <div className="text-foreground font-medium">{searchResult.full_name}</div>
                    <div className="text-sm text-muted-foreground">{searchResult.phone}</div>
                  </div>
                </div>
                <Button
                  onClick={() => handleStartWithContact(searchResult)}
                  disabled={isLoading}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    'Escolher canal'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Helper Text */}
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Digite o número com DDD para iniciar uma conversa
          </p>
        </div>
      </div>

      {/* Quick Tips */}
      <div className="mt-8 grid grid-cols-3 gap-4 w-full max-w-lg">
        <div className="text-center p-4 bg-card rounded-xl border border-border">
          <Phone size={24} className="mx-auto mb-2 text-primary" />
          <p className="text-xs text-muted-foreground">Digite o número</p>
        </div>
        <div className="text-center p-4 bg-card rounded-xl border border-border">
          <User size={24} className="mx-auto mb-2 text-primary" />
          <p className="text-xs text-muted-foreground">Contato criado</p>
        </div>
        <div className="text-center p-4 bg-card rounded-xl border border-border">
          <MessageSquare size={24} className="mx-auto mb-2 text-primary" />
          <p className="text-xs text-muted-foreground">Conversa aberta</p>
        </div>
      </div>

      {/* ==================== CREATE CONTACT MODAL ==================== */}
      <Dialog open={showCreateContactModal} onOpenChange={setShowCreateContactModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Criar Novo Contato
            </DialogTitle>
            <DialogDescription>
              Este número não está cadastrado. Informe o nome para criar o contato.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Phone className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium text-foreground">+55 {phoneNumber}</span>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="contact-name">
                Nome do contato <span className="text-destructive">*</span>
              </Label>
              <Input
                id="contact-name"
                placeholder="Ex: João da Silva"
                value={newContactName}
                onChange={(e) => setNewContactName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newContactName.trim()) {
                    handleCreateContactAndShowChannels();
                  }
                }}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowCreateContactModal(false);
                setPhoneNumber('');
              }}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateContactAndShowChannels}
              disabled={!newContactName.trim() || isLoading}
            >
              {isLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== MULTIPLE CONVERSATIONS MODAL ==================== */}
      <Dialog open={showMultipleConversationsModal} onOpenChange={setShowMultipleConversationsModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Conversas Abertas
            </DialogTitle>
            <DialogDescription>
              {searchResult && (
                <span className="flex items-center gap-2 mt-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-xs font-semibold">
                    {searchResult.full_name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <span className="font-medium text-foreground">{searchResult.full_name}</span>
                  <span className="text-muted-foreground">possui {openConversations.length} conversas abertas</span>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-2 max-h-[300px] overflow-y-auto py-2">
            {openConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => handleSelectConversation(conv)}
                disabled={isLoading}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted transition-colors text-left disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                  <Smartphone className="h-5 w-5 text-green-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {conv.channel?.name || 'Canal desconhecido'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {conv.last_message_preview || 'Sem mensagens'}
                  </p>
                  {conv.last_message_at && (
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(conv.last_message_at), { locale: ptBR, addSuffix: true })}
                    </p>
                  )}
                </div>
                <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
              </button>
            ))}
          </div>
          
          <div className="border-t border-border pt-4">
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => {
                setShowMultipleConversationsModal(false);
                setPendingContact(searchResult);
                setShowChannelSelector(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Iniciar nova conversa em outro canal
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Channel Selector Dialog */}
      <Dialog open={showChannelSelector} onOpenChange={setShowChannelSelector}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Escolha o canal WhatsApp</DialogTitle>
            <DialogDescription>
              Selecione por qual conexão deseja iniciar a conversa
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-2 mt-4">
            {connectedChannels.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum canal conectado disponível
              </p>
            ) : (
              connectedChannels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => startConversationWithChannel(channel.id, pendingContact)}
                  disabled={isLoading}
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

      {/* Contact Request Modal */}
      {blockedContactInfo && (
        <ContactRequestModal
          open={showRequestModal}
          onOpenChange={(open) => {
            setShowRequestModal(open);
            if (!open) {
              setBlockedContactInfo(null);
              setPhoneNumber('');
            }
          }}
          contact={blockedContactInfo.contact}
          currentOwner={blockedContactInfo.owner}
          conversationId={blockedContactInfo.conversationId}
        />
      )}
    </div>
  );
}

export default StartConversation;
