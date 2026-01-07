import { User, MessageCircle, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ContactSearchResult, MessageSearchResult } from '@/hooks/useGlobalSearch';

interface SearchResultsListProps {
  searchQuery: string;
  isLoading: boolean;
  contacts: ContactSearchResult[];
  messages: MessageSearchResult[];
  hasMoreMessages: boolean;
  isLoadingMore: boolean;
  onLoadMoreMessages: () => void;
  onSelectContact: (contactId: string, conversationId?: string) => void;
  onSelectMessage: (conversationId: string, messageId: string) => void;
  selectedConversationId?: string;
  // Selection mode props
  isSelectionMode?: boolean;
  selectedConversationIds?: Set<string>;
  onToggleSelection?: (conversationId: string) => void;
}

export function SearchResultsList({
  searchQuery,
  isLoading,
  contacts,
  messages,
  hasMoreMessages,
  isLoadingMore,
  onLoadMoreMessages,
  onSelectContact,
  onSelectMessage,
  selectedConversationId,
  isSelectionMode,
  selectedConversationIds,
  onToggleSelection,
}: SearchResultsListProps) {
  const hasResults = contacts.length > 0 || messages.length > 0;
  const showResults = searchQuery.length >= 3;

  // Highlight matching text
  const highlightMatch = (text: string, query: string) => {
    if (!query || query.length < 3) return text;
    
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);
    
    if (index === -1) return text;
    
    return (
      <>
        {text.substring(0, index)}
        <mark className="bg-yellow-300/50 dark:bg-yellow-500/30 text-foreground rounded-sm px-0.5">
          {text.substring(index, index + query.length)}
        </mark>
        {text.substring(index + query.length)}
      </>
    );
  };

  if (!showResults) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <Search size={48} className="text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground text-sm">
          Digite pelo menos 3 caracteres para buscar
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
        <span className="ml-3 text-sm text-muted-foreground">Buscando...</span>
      </div>
    );
  }

  if (!hasResults) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-4">
        <MessageCircle size={48} className="text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground text-sm">
          Nenhum resultado encontrado para "{searchQuery}"
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {/* Contacts Section */}
      {contacts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 px-4 py-3 bg-primary/10 sticky top-0 z-10 border-b border-primary/20">
            <User size={16} className="text-primary" />
            <span className="text-sm font-semibold text-primary uppercase tracking-wide">
              Contatos
            </span>
            <span className="text-xs text-primary/70 ml-1">
              ({contacts.length})
            </span>
          </div>
          <div>
            {contacts.map((contact) => (
              <button
                key={contact.id}
                onClick={() => onSelectContact(contact.id, contact.conversationId)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left border-b border-border/50",
                  contact.conversationId === selectedConversationId && "bg-primary/10"
                )}
              >
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-sm font-medium flex-shrink-0">
                  {contact.avatar_url ? (
                    <img
                      src={contact.avatar_url}
                      alt={contact.full_name}
                      className="w-11 h-11 rounded-full object-cover"
                    />
                  ) : (
                    contact.full_name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {highlightMatch(contact.full_name, searchQuery)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {highlightMatch(contact.phone, searchQuery)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages Section */}
      {messages.length > 0 && (
        <div>
          <div className="flex items-center gap-2 px-4 py-3 bg-muted/80 sticky top-0 z-10 border-b border-border">
            <MessageCircle size={16} className="text-muted-foreground" />
            <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Mensagens
            </span>
            <span className="text-xs text-muted-foreground/70 ml-1">
              ({messages.length}{hasMoreMessages ? '+' : ''})
            </span>
          </div>
          <div>
            {messages.map((message) => (
              <button
                key={`${message.conversationId}-${message.messageId}`}
                onClick={() => {
                  if (isSelectionMode && onToggleSelection) {
                    onToggleSelection(message.conversationId);
                  } else {
                    onSelectMessage(message.conversationId, message.messageId);
                  }
                }}
                className={cn(
                  "w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left border-b border-border/30",
                  message.conversationId === selectedConversationId && "bg-muted/50",
                  selectedConversationIds?.has(message.conversationId) && "bg-primary/10"
                )}
              >
                {/* Checkbox when in selection mode */}
                {isSelectionMode && (
                  <div className="flex items-center h-11 flex-shrink-0">
                    <Checkbox
                      checked={selectedConversationIds?.has(message.conversationId)}
                      onCheckedChange={() => onToggleSelection?.(message.conversationId)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-muted-foreground/30 to-muted-foreground/10 flex items-center justify-center text-muted-foreground text-sm font-medium flex-shrink-0">
                  {message.contactName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground truncate">
                      {message.contactName}
                    </span>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {formatDistanceToNow(new Date(message.createdAt), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {message.isFromMe && <span className="text-primary font-medium">Você: </span>}
                    {highlightMatch(message.matchHighlight || message.content, searchQuery)}
                  </div>
                </div>
              </button>
            ))}
            
            {/* Load More Button */}
            {hasMoreMessages && (
              <div className="px-4 py-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={onLoadMoreMessages}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 size={14} className="mr-2 animate-spin" />
                      Carregando...
                    </>
                  ) : (
                    'Carregar mais mensagens'
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
