import { MessageCircle, Loader2, Search, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { MessageSearchResult } from '@/hooks/useGlobalSearch';

interface SearchResultsListProps {
  searchQuery: string;
  isLoading: boolean;
  messages: MessageSearchResult[];
  hasMoreMessages: boolean;
  isLoadingMore: boolean;
  onLoadMoreMessages: () => void;
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
  messages,
  hasMoreMessages,
  isLoadingMore,
  onLoadMoreMessages,
  onSelectMessage,
  selectedConversationId,
  isSelectionMode,
  selectedConversationIds,
  onToggleSelection,
}: SearchResultsListProps) {
  const hasResults = messages.length > 0;
  const showResults = searchQuery.length >= 3;

  // Highlight matching text
  const highlightMatch = (text: string, query: string) => {
    if (!query || query.length < 3 || !text) return text;
    
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
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-muted/80 sticky top-0 z-10 border-b border-border">
        <MessageCircle size={16} className="text-muted-foreground" />
        <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Resultados
        </span>
        <span className="text-xs text-muted-foreground/70 ml-1">
          ({messages.length}{hasMoreMessages ? '+' : ''})
        </span>
      </div>

      {/* Results List */}
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

            {/* Avatar */}
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-sm font-medium flex-shrink-0 overflow-hidden">
              {message.contactAvatarUrl ? (
                <img
                  src={message.contactAvatarUrl}
                  alt={message.contactName}
                  className="w-11 h-11 rounded-full object-cover"
                />
              ) : (
                message.contactName?.charAt(0).toUpperCase() || '?'
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-foreground truncate">
                    {message.matchType === 'contact' 
                      ? highlightMatch(message.contactName, searchQuery)
                      : message.contactName
                    }
                  </span>
                  {/* Match type indicator */}
                  {message.matchType === 'contact' && (
                    <span className="flex items-center gap-1 text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full flex-shrink-0">
                      <User size={10} />
                      contato
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">
                  {formatDistanceToNow(new Date(message.createdAt), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {message.isFromMe && <span className="text-primary font-medium">Você: </span>}
                {message.matchType === 'content' 
                  ? highlightMatch(message.matchHighlight || message.content, searchQuery)
                  : (message.matchHighlight || message.content)
                }
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
                'Carregar mais resultados'
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
