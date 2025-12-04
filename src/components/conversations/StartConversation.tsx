import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MessageSquare, Send, Loader2, Phone, User } from 'lucide-react';
import { toast } from 'sonner';
import { formatBrazilianPhone, cleanBrazilianPhone, isValidBrazilianPhone } from '@/utils/phone';

interface StartConversationProps {
  onConversationCreated?: (conversationId: string) => void;
}

export function StartConversation({ onConversationCreated }: StartConversationProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);
  const [showSearchResult, setShowSearchResult] = useState(false);
  
  const queryClient = useQueryClient();

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatBrazilianPhone(e.target.value);
    setPhoneNumber(formatted);
    setShowSearchResult(false);
    setSearchResult(null);
  };

  const isValidPhone = () => isValidBrazilianPhone(phoneNumber);

  // Search for existing contact
  const searchContact = async () => {
    if (!isValidPhone()) {
      toast.error('Digite um número válido');
      return;
    }

    setIsLoading(true);
    try {
      const cleanPhone = cleanBrazilianPhone(phoneNumber);
      
      // Search by phone (with and without country code)
      const { data: contact, error } = await supabase
        .from('contacts')
        .select('*')
        .or(`phone.eq.${cleanPhone},phone.eq.${cleanPhone.slice(2)}`)
        .maybeSingle();

      if (error) throw error;

      if (contact) {
        setSearchResult(contact);
        setShowSearchResult(true);
      } else {
        // No contact found, proceed to create
        await startConversation(null);
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro ao buscar contato');
    } finally {
      setIsLoading(false);
    }
  };

  // Start conversation (create contact if needed)
  const startConversation = async (existingContact: any) => {
    setIsLoading(true);
    
    try {
      const cleanPhone = cleanBrazilianPhone(phoneNumber);
      const { data: { user } } = await supabase.auth.getUser();
      
      let contactId: string;

      // Step 1: Get or create contact
      if (existingContact) {
        contactId = existingContact.id;
      } else {
        // Create new contact
        const { data: newContact, error: contactError } = await supabase
          .from('contacts')
          .insert({
            phone: cleanPhone,
            full_name: `+${cleanPhone}`,
            lead_status: 'new',
            origin: 'manual',
            first_contact_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (contactError) throw contactError;
        
        contactId = newContact.id;
        toast.success('Novo contato criado!');
      }

      // Step 2: Check for existing open conversation
      const { data: existingConversation, error: convError } = await supabase
        .from('conversations')
        .select('id')
        .eq('contact_id', contactId)
        .in('status', ['open', 'pending'])
        .maybeSingle();

      if (convError) throw convError;

      let conversationId: string;

      if (existingConversation) {
        conversationId = existingConversation.id;
        toast.info('Conversa existente encontrada');
      } else {
        // Step 3: Create new conversation
        const { data: newConversation, error: createError } = await supabase
          .from('conversations')
          .insert({
            contact_id: contactId,
            status: 'open',
            assigned_to: user?.id,
            is_unread: false,
            unread_count: 0,
            last_message_at: new Date().toISOString(),
            last_message_preview: 'Nova conversa iniciada',
          })
          .select()
          .single();

        if (createError) throw createError;
        
        conversationId = newConversation.id;
        toast.success('Conversa criada!');
      }

      // Step 4: Invalidate queries to refresh lists
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });

      // Step 5: Callback
      if (onConversationCreated) {
        onConversationCreated(conversationId);
      }

      // Reset form
      setPhoneNumber('');
      setSearchResult(null);
      setShowSearchResult(false);

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
              <p className="text-xs text-muted-foreground mb-3">Contato encontrado:</p>
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
                  onClick={() => startConversation(searchResult)}
                  disabled={isLoading}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isLoading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    'Iniciar'
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
    </div>
  );
}

export default StartConversation;
