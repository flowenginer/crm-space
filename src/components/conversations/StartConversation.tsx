import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { MessageSquare, Send, Loader2, Phone, User, Smartphone, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { formatBrazilianPhone, normalizePhoneForStorage, getPhoneSearchVariations, isValidBrazilianPhone } from '@/utils/phone';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';

interface StartConversationProps {
  onConversationCreated?: (conversationId: string) => void;
}

export function StartConversation({ onConversationCreated }: StartConversationProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  const [showSearchResult, setShowSearchResult] = useState(false);
  const [showChannelSelector, setShowChannelSelector] = useState(false);
  const [pendingContact, setPendingContact] = useState<any>(null);
  
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

  // Check if user can access a conversation
  const checkConversationAccess = async (conversationId: string): Promise<{ canAccess: boolean; ownerName?: string }> => {
    // Admin/supervisor can access all
    if (can.viewAllConversations()) {
      return { canAccess: true };
    }

    // Check if conversation is assigned to current user or unassigned in their department
    const { data: conv } = await supabase
      .from('conversations')
      .select('assigned_to, department_id')
      .eq('id', conversationId)
      .single();

    if (!conv) {
      return { canAccess: false };
    }

    // User is the owner
    if (conv.assigned_to === user?.id) {
      return { canAccess: true };
    }

    // Conversation is unassigned - check department
    if (!conv.assigned_to) {
      // Get user's department
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('department_id')
        .eq('id', user?.id)
        .single();

      // If conversation has no department or same department as user
      if (!conv.department_id || conv.department_id === userProfile?.department_id) {
        return { canAccess: true };
      }
    }

    // Get owner name for the error message
    if (conv.assigned_to) {
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', conv.assigned_to)
        .single();
      
      return { canAccess: false, ownerName: ownerProfile?.full_name || 'outro atendente' };
    }

    return { canAccess: false, ownerName: 'outro departamento' };
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
      const searchVariations = getPhoneSearchVariations(normalizedPhone);
      
      // Search contact by phone using all variations
      const orConditions = searchVariations.map(v => `phone.eq.${v}`).join(',');
      const { data: contact, error } = await supabase
        .from('contacts')
        .select('*')
        .or(orConditions)
        .maybeSingle();

      if (error) throw error;

      if (contact) {
        // Check for existing conversation (open or pending first)
        const { data: openConv } = await supabase
          .from('conversations')
          .select('id')
          .eq('contact_id', contact.id)
          .in('status', ['open', 'pending'])
          .order('last_message_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (openConv) {
          // Check if user can access this conversation
          const { canAccess, ownerName } = await checkConversationAccess(openConv.id);
          
          if (!canAccess) {
            toast.error(`Este lead pertence a ${ownerName}`, {
              icon: <ShieldAlert className="text-destructive" size={18} />,
              description: 'Você não tem permissão para acessar conversas de outros atendentes.',
            });
            setPhoneNumber('');
            return;
          }

          // Navigate to existing open conversation
          toast.info('Conversa existente encontrada');
          if (onConversationCreated) {
            onConversationCreated(openConv.id);
          }
          setPhoneNumber('');
          return;
        }

        // Check for any conversation (including closed) and reopen it
        const { data: closedConv } = await supabase
          .from('conversations')
          .select('id, status, assigned_to')
          .eq('contact_id', contact.id)
          .order('last_message_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (closedConv) {
          // Check if user can access this conversation
          const { canAccess, ownerName } = await checkConversationAccess(closedConv.id);
          
          if (!canAccess) {
            toast.error(`Este lead pertence a ${ownerName}`, {
              icon: <ShieldAlert className="text-destructive" size={18} />,
              description: 'Você não tem permissão para reabrir conversas de outros atendentes.',
            });
            setPhoneNumber('');
            return;
          }

          // Reopen the conversation if it was closed
          if (closedConv.status === 'closed') {
            await supabase
              .from('conversations')
              .update({ 
                status: 'open', 
                closed_at: null, 
                closed_by: null,
                close_reason: null,
                updated_at: new Date().toISOString()
              })
              .eq('id', closedConv.id);
            
            toast.success('Conversa reaberta');
          } else {
            toast.info('Conversa existente encontrada');
          }
          
          // Invalidate correct query keys used by usePaginatedConversations
          queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
          queryClient.invalidateQueries({ queryKey: ['conversations-counts'] });
          
          if (onConversationCreated) {
            onConversationCreated(closedConv.id);
          }
          setPhoneNumber('');
          return;
        }

        // Contact exists but no conversation - show channel selector
        setSearchResult(contact);
        setShowSearchResult(true);
      } else {
        // No contact found - show channel selector to create both
        setPendingContact({ phone: normalizedPhone });
        setShowChannelSelector(true);
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro ao buscar contato');
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
        contactId = existingContact.id;
      } else {
        // Verificar duplicata uma última vez antes de criar
        const searchVariations = getPhoneSearchVariations(normalizedPhone);
        const orConditions = searchVariations.map(v => `phone.eq.${v}`).join(',');
        const { data: existingByPhone } = await supabase
          .from('contacts')
          .select('id, full_name')
          .or(orConditions)
          .maybeSingle();
        
        if (existingByPhone) {
          toast.info(`Contato já existe: ${existingByPhone.full_name}`);
          contactId = existingByPhone.id;
        } else {
          // Create new contact with normalized phone
          const { data: newContact, error: contactError } = await supabase
            .from('contacts')
            .insert({
              phone: normalizedPhone,
              full_name: `+${normalizedPhone}`,
              lead_status: 'new',
              origin: 'manual',
              first_contact_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (contactError) {
            // Se for erro de constraint de duplicata, buscar o existente
            if (contactError.code === '23505') {
              const { data: foundContact } = await supabase
                .from('contacts')
                .select('id, full_name')
                .or(orConditions)
                .maybeSingle();
              
              if (foundContact) {
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

      // Create new conversation with selected channel
      const { data: newConversation, error: createError } = await supabase
        .from('conversations')
        .insert({
          contact_id: contactId,
          channel_id: channelId,
          status: 'open',
          assigned_to: currentUser?.id,
          is_unread: false,
          unread_count: 0,
          last_message_at: new Date().toISOString(),
          last_message_preview: 'Nova conversa iniciada',
        })
        .select()
        .single();

      if (createError) throw createError;

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
    </div>
  );
}

export default StartConversation;