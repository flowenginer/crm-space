import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, Calendar, Menu, X, MessageCircle, Clock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { useIsMobile } from '@/hooks/use-mobile';
import { ThemeToggle } from '@/components/ThemeToggle';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface HeaderProps {
  title: string;
  onMenuClick?: () => void;
}

interface SearchResult {
  id: string;
  type: 'contact' | 'conversation';
  name: string;
  phone?: string;
  conversationId?: string;
  lastMessage?: string;
}

interface Notification {
  id: string;
  conversationId: string;
  contactName: string;
  message: string;
  timestamp: string;
  isRead: boolean;
}

export function Header({ title, onMenuClick }: HeaderProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Fetch unread conversations for notifications
  const { data: notifications = [], refetch: refetchNotifications } = useQuery({
    queryKey: ['header-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          last_message_preview,
          last_message_at,
          is_unread,
          unread_count,
          contact:contacts(full_name, phone)
        `)
        .eq('is_unread', true)
        .order('last_message_at', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      
      return (data || []).map(conv => ({
        id: conv.id,
        conversationId: conv.id,
        contactName: conv.contact?.full_name || 'Contato',
        message: conv.last_message_preview || 'Nova mensagem',
        timestamp: conv.last_message_at,
        isRead: !conv.is_unread,
        unreadCount: conv.unread_count || 0,
      }));
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const unreadCount = notifications.length;

  // Search function
  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        setShowSearchResults(false);
        return;
      }

      setIsSearching(true);
      try {
        // Search contacts
        const { data: contacts, error: contactsError } = await supabase
          .from('contacts')
          .select('id, full_name, phone')
          .or(`full_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
          .limit(5);

        if (contactsError) throw contactsError;

        // Get conversations for found contacts
        const contactIds = contacts?.map(c => c.id) || [];
        let conversationsMap: Record<string, string> = {};
        
        if (contactIds.length > 0) {
          const { data: convs } = await supabase
            .from('conversations')
            .select('id, contact_id')
            .in('contact_id', contactIds);
          
          convs?.forEach(c => {
            conversationsMap[c.contact_id] = c.id;
          });
        }

        const results: SearchResult[] = (contacts || []).map(contact => ({
          id: contact.id,
          type: 'contact',
          name: contact.full_name || 'Sem nome',
          phone: contact.phone,
          conversationId: conversationsMap[contact.id],
        }));

        setSearchResults(results);
        setShowSearchResults(true);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [searchQuery]);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleResultClick = (result: SearchResult) => {
    setShowSearchResults(false);
    setSearchQuery('');
    
    if (result.conversationId) {
      navigate(`/conversations?id=${result.conversationId}`);
    } else {
      // If no conversation exists, go to contacts
      navigate(`/contacts`);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    setShowNotifications(false);
    navigate(`/conversations?id=${notification.conversationId}`);
  };

  const formatTime = (date: string | null) => {
    if (!date) return '';
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: false, locale: ptBR });
    } catch {
      return '';
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-border/50 bg-card px-6 shadow-sm md:px-8">
      <div className="flex items-center gap-4">
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="md:hidden h-10 w-10 hover:bg-muted"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">
            {title}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        {/* Global Search */}
        <div className="relative hidden md:block" ref={searchRef}>
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar leads, conversas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchQuery.length >= 2 && setShowSearchResults(true)}
            className="w-80 h-11 pl-11 bg-muted/50 border-border/50 rounded-xl focus:bg-card focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground"
          />
          
          {/* Search Results Dropdown */}
          {showSearchResults && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-xl shadow-xl z-50 overflow-hidden">
              {isSearching ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  Buscando...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  Nenhum resultado encontrado
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto">
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => handleResultClick(result)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-muted transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                        {result.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {result.name}
                        </p>
                        {result.phone && (
                          <p className="text-xs text-muted-foreground truncate">
                            {result.phone}
                          </p>
                        )}
                      </div>
                      {result.conversationId && (
                        <MessageCircle size={16} className="text-primary flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Date Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              size="icon" 
              className="hidden md:flex h-11 w-11 rounded-xl border-border/50 hover:bg-muted hover:border-primary/50 transition-all"
            >
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <CalendarComponent
              mode="single"
              selected={date}
              onSelect={setDate}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <Popover open={showNotifications} onOpenChange={setShowNotifications}>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              size="icon" 
              className="relative h-11 w-11 rounded-xl border-border/50 hover:bg-muted hover:border-primary/50 transition-all"
            >
              <Bell className="h-5 w-5 text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground border-2 border-card shadow-sm">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="p-3 border-b border-border">
              <h3 className="font-semibold text-foreground">Notificações</h3>
              <p className="text-xs text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} mensagens não lidas` : 'Nenhuma notificação'}
              </p>
            </div>
            
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Tudo em dia!</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      "w-full flex items-start gap-3 p-3 hover:bg-muted transition-colors text-left border-b border-border/50 last:border-0",
                      !notification.isRead && "bg-primary/5"
                    )}
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                      {notification.contactName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {notification.contactName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock size={10} />
                        {formatTime(notification.timestamp)}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
            
            {notifications.length > 0 && (
              <div className="p-2 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-primary hover:text-primary"
                  onClick={() => {
                    setShowNotifications(false);
                    navigate('/conversations');
                  }}
                >
                  Ver todas as conversas
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Mobile Search */}
        <Button 
          variant="outline" 
          size="icon" 
          className="md:hidden h-11 w-11 rounded-xl border-border/50 hover:bg-muted transition-all"
        >
          <Search className="h-5 w-5 text-muted-foreground" />
        </Button>
      </div>
    </header>
  );
}
