import { useState, useRef, useEffect } from 'react';
import { Search, User, MessageCircle, Loader2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useGlobalSearch, type ContactSearchResult, type MessageSearchResult } from '@/hooks/useGlobalSearch';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface GlobalSearchPopoverProps {
  onSelectContact: (contactId: string, conversationId?: string) => void;
  onSelectMessage: (conversationId: string, messageId: string) => void;
  onSearchChange?: (query: string) => void;
  className?: string;
}

export function GlobalSearchPopover({
  onSelectContact,
  onSelectMessage,
  onSearchChange,
  className,
}: GlobalSearchPopoverProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { results, isLoading, hasResults, isSearching } = useGlobalSearch(searchQuery, isOpen);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Notify parent of search changes for fallback filtering
  useEffect(() => {
    onSearchChange?.(searchQuery);
  }, [searchQuery, onSearchChange]);

  const handleFocus = () => {
    setIsOpen(true);
  };

  const handleClear = () => {
    setSearchQuery('');
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleContactClick = (contact: ContactSearchResult) => {
    onSelectContact(contact.id, contact.conversationId);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleMessageClick = (message: MessageSearchResult) => {
    onSelectMessage(message.conversationId, message.messageId);
    setIsOpen(false);
    setSearchQuery('');
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

  const showDropdown = isOpen && searchQuery.length >= 3;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Search Input */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Buscar contatos e mensagens..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={handleFocus}
          className="pl-9 pr-8 h-9 rounded-xl bg-muted/50 border-border/50 text-sm"
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
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          <ScrollArea className="max-h-[400px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Buscando...</span>
              </div>
            ) : !hasResults && isSearching ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Nenhum resultado encontrado para "{searchQuery}"
              </div>
            ) : (
              <>
                {/* Contacts Section */}
                {results.contacts.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border sticky top-0">
                      <User size={14} className="text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Contatos ({results.contacts.length})
                      </span>
                    </div>
                    {results.contacts.map((contact) => (
                      <button
                        key={contact.id}
                        onClick={() => handleContactClick(contact)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
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
                          <div className="text-sm font-medium truncate">
                            {highlightMatch(contact.full_name, searchQuery)}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {highlightMatch(contact.phone, searchQuery)}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Messages Section */}
                {results.messages.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b border-border sticky top-0">
                      <MessageCircle size={14} className="text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Mensagens ({results.messages.length})
                      </span>
                    </div>
                    {results.messages.map((message) => (
                      <button
                        key={`${message.conversationId}-${message.messageId}`}
                        onClick={() => handleMessageClick(message)}
                        className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                      >
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-muted-foreground/20 to-muted-foreground/10 flex items-center justify-center text-muted-foreground text-sm font-medium flex-shrink-0">
                          {message.contactName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium truncate">
                              {message.contactName}
                            </span>
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              {formatDistanceToNow(new Date(message.createdAt), {
                                addSuffix: false,
                                locale: ptBR,
                              })}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            {message.isFromMe && <span className="text-primary">Você: </span>}
                            {highlightMatch(message.matchHighlight || message.content, searchQuery)}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
