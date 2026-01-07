import { useState, useRef, useEffect } from 'react';
import { Search, User, MessageCircle, Loader2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useGlobalSearch, type ContactSearchResult, type MessageSearchResult } from '@/hooks/useGlobalSearch';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';

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
  const modalInputRef = useRef<HTMLInputElement>(null);

  const { results, isLoading, hasResults, isSearching } = useGlobalSearch(searchQuery, isOpen);

  // Notify parent of search changes for fallback filtering
  useEffect(() => {
    onSearchChange?.(searchQuery);
  }, [searchQuery, onSearchChange]);

  // Focus modal input when dialog opens
  useEffect(() => {
    if (isOpen && modalInputRef.current) {
      setTimeout(() => modalInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleTriggerFocus = () => {
    setIsOpen(true);
  };

  const handleClear = () => {
    setSearchQuery('');
  };

  const handleClose = () => {
    setIsOpen(false);
    setSearchQuery('');
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

  return (
    <>
      {/* Trigger Input */}
      <div className={cn('relative', className)}>
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Buscar contatos e mensagens..."
          value=""
          onFocus={handleTriggerFocus}
          readOnly
          className="pl-9 pr-8 h-9 rounded-xl bg-muted/50 border-border/50 text-sm cursor-pointer"
        />
      </div>

      {/* Search Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl w-[90vw] h-[70vh] max-h-[600px] p-0 gap-0 flex flex-col">
          <DialogTitle className="sr-only">Busca Global</DialogTitle>
          
          {/* Search Header */}
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <Search size={20} className="text-muted-foreground flex-shrink-0" />
            <Input
              ref={modalInputRef}
              type="text"
              placeholder="Buscar contatos e mensagens..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 border-0 bg-transparent p-0 h-auto text-base focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            {searchQuery && (
              <button
                onClick={handleClear}
                className="p-1.5 hover:bg-muted rounded-full transition-colors"
              >
                <X size={16} className="text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Results Area */}
          <ScrollArea className="flex-1">
            {!showResults ? (
              <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                <Search size={48} className="text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground text-sm">
                  Digite pelo menos 3 caracteres para buscar
                </p>
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={24} className="animate-spin text-muted-foreground" />
                <span className="ml-3 text-sm text-muted-foreground">Buscando...</span>
              </div>
            ) : !hasResults && isSearching ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <MessageCircle size={48} className="text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground text-sm">
                  Nenhum resultado encontrado para "{searchQuery}"
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {/* Contacts Section */}
                {results.contacts.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 sticky top-0 z-10">
                      <User size={16} className="text-primary" />
                      <span className="text-sm font-semibold text-foreground">
                        Contatos
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">
                        ({results.contacts.length})
                      </span>
                    </div>
                    <div className="py-1">
                      {results.contacts.map((contact) => (
                        <button
                          key={contact.id}
                          onClick={() => handleContactClick(contact)}
                          className="w-full flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
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
                            <div className="text-sm font-medium text-foreground">
                              {highlightMatch(contact.full_name, searchQuery)}
                            </div>
                            <div className="text-sm text-muted-foreground mt-0.5">
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
                    <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 sticky top-0 z-10">
                      <MessageCircle size={16} className="text-primary" />
                      <span className="text-sm font-semibold text-foreground">
                        Mensagens
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">
                        ({results.messages.length})
                      </span>
                    </div>
                    <div className="py-1">
                      {results.messages.map((message) => (
                        <button
                          key={`${message.conversationId}-${message.messageId}`}
                          onClick={() => handleMessageClick(message)}
                          className="w-full flex items-start gap-4 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                        >
                          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-muted-foreground/20 to-muted-foreground/10 flex items-center justify-center text-muted-foreground text-sm font-medium flex-shrink-0">
                            {message.contactName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-medium text-foreground">
                                {message.contactName}
                              </span>
                              <span className="text-xs text-muted-foreground flex-shrink-0">
                                {formatDistanceToNow(new Date(message.createdAt), {
                                  addSuffix: true,
                                  locale: ptBR,
                                })}
                              </span>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {message.isFromMe && <span className="text-primary font-medium">Você: </span>}
                              {highlightMatch(message.matchHighlight || message.content, searchQuery)}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
