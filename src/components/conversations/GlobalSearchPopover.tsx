import { useState, useRef, useEffect } from 'react';
import { Search, User, MessageCircle, Loader2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useGlobalSearch, type ContactSearchResult, type MessageSearchResult, type SearchFilters } from '@/hooks/useGlobalSearch';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface GlobalSearchPopoverProps {
  onSelectContact: (contactId: string, conversationId?: string) => void;
  onSelectMessage: (conversationId: string, messageId: string) => void;
  onSearchChange?: (query: string) => void;
  className?: string;
  /** Filtros ativos para aplicar na busca */
  filters?: SearchFilters;
}

export function GlobalSearchPopover({
  onSelectContact,
  onSelectMessage,
  onSearchChange,
  className,
  filters,
}: GlobalSearchPopoverProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { 
    results, 
    isLoading, 
    hasResults, 
    isSearching,
    hasMoreMessages,
    isLoadingMore,
    loadMoreMessages,
    resetPagination,
  } = useGlobalSearch(searchQuery, isFocused, filters);

  // Notify parent of search changes for fallback filtering
  useEffect(() => {
    onSearchChange?.(searchQuery);
  }, [searchQuery, onSearchChange]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };

    if (isFocused) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFocused]);

  // Close on ESC
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFocused) {
        handleClose();
        inputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isFocused]);

  const handleClear = () => {
    setSearchQuery('');
    resetPagination();
    inputRef.current?.focus();
  };

  const handleClose = () => {
    setIsFocused(false);
    setSearchQuery('');
    resetPagination();
  };

  const handleContactClick = (contact: ContactSearchResult) => {
    onSelectContact(contact.id, contact.conversationId);
    handleClose();
  };

  const handleMessageClick = (message: MessageSearchResult) => {
    onSelectMessage(message.conversationId, message.messageId);
    handleClose();
  };

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

  const showResults = searchQuery.length >= 3;
  const showDropdown = isFocused && searchQuery.length > 0;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Search Input */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Buscar contatos e mensagens..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          className={cn(
            "pl-9 pr-8 h-9 rounded-xl bg-muted/50 border-border/50 text-sm transition-all",
            isFocused && "ring-2 ring-primary/20 border-primary/30"
          )}
        />
        {searchQuery && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full transition-colors"
          >
            <X size={14} className="text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Dropdown Results */}
      {showDropdown && (
        <div className="absolute top-full left-0 mt-2 bg-popover border border-border rounded-xl shadow-lg z-50 overflow-hidden w-[min(95vw,550px)]">
          <ScrollArea className="h-[min(70vh,450px)]">
            {!showResults ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <Search size={40} className="text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground text-sm">
                  Digite pelo menos 3 caracteres para buscar
                </p>
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-muted-foreground" />
                <span className="ml-3 text-sm text-muted-foreground">Buscando...</span>
              </div>
            ) : !hasResults && isSearching ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <MessageCircle size={40} className="text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground text-sm">
                  Nenhum resultado encontrado para "{searchQuery}"
                </p>
                {filters && (
                  <p className="text-muted-foreground/70 text-xs mt-1">
                    Busca filtrada pelos filtros ativos
                  </p>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {/* Contacts Section */}
                {results.contacts.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30 sticky top-0 z-10">
                      <User size={14} className="text-primary" />
                      <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
                        Contatos
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({results.contacts.length})
                      </span>
                    </div>
                    <div className="py-1">
                      {results.contacts.map((contact) => (
                        <button
                          key={contact.id}
                          onClick={() => handleContactClick(contact)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
                        >
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-sm font-medium flex-shrink-0">
                            {contact.avatar_url ? (
                              <img
                                src={contact.avatar_url}
                                alt={contact.full_name}
                                className="w-9 h-9 rounded-full object-cover"
                              />
                            ) : (
                              contact.full_name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-foreground truncate">
                              {highlightMatch(contact.full_name, searchQuery)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {highlightMatch(contact.phone, searchQuery)}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Messages Section */}
                {results.messages.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30 sticky top-0 z-10">
                      <MessageCircle size={14} className="text-primary" />
                      <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
                        Mensagens
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({results.messages.length}{hasMoreMessages ? '+' : ''})
                      </span>
                    </div>
                    <div className="py-1">
                      {results.messages.map((message) => (
                        <button
                          key={`${message.conversationId}-${message.messageId}`}
                          onClick={() => handleMessageClick(message)}
                          className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
                        >
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-muted-foreground/20 to-muted-foreground/10 flex items-center justify-center text-muted-foreground text-sm font-medium flex-shrink-0 mt-0.5">
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
                            <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {message.isFromMe && <span className="text-primary font-medium">Você: </span>}
                              {highlightMatch(message.matchHighlight || message.content, searchQuery)}
                            </div>
                          </div>
                        </button>
                      ))}
                      
                      {/* Load More Button */}
                      {hasMoreMessages && (
                        <div className="px-4 py-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs"
                            onClick={loadMoreMessages}
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
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
