import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import { Search, Bell, Calendar, Menu, MessageCircle, Clock, UserPlus, AlertTriangle, ArrowRightLeft, CheckCheck, X, Crown, Building2, WifiOff } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useCurrentUser, useCurrentUserProfile } from '@/hooks/useCurrentUser';
import { useCurrentUserIsSuperAdmin } from '@/hooks/useSuperAdminTenants';
import { useUserStore } from '@/store/userStore';
import { useInAppNotifications, useMarkNotificationRead, useMarkAllNotificationsRead, useDeleteNotification, type InAppNotification } from '@/hooks/useInAppNotifications';

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
  type: 'assignment' | 'transfer' | 'sla' | 'channel_disconnect';
  conversationId: string;
  contactName: string;
  message: string;
  timestamp: string;
  channelEventId?: string; // Para notificações de canal
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
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  // CRM-specific state
  const isCRMPage = location.pathname === '/crm';
  const crmTab = searchParams.get('tab') || 'leads';
  const crmSearch = searchParams.get('search') || '';
  const [localCrmSearch, setLocalCrmSearch] = useState(crmSearch);

  // Sync local search with URL params for CRM
  useEffect(() => {
    if (isCRMPage) {
      const timeout = setTimeout(() => {
        const newParams = new URLSearchParams(searchParams);
        if (localCrmSearch) {
          newParams.set('search', localCrmSearch);
        } else {
          newParams.delete('search');
        }
        setSearchParams(newParams, { replace: true });
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [localCrmSearch, isCRMPage]);

  // Reset local search when leaving CRM or when URL changes
  useEffect(() => {
    if (isCRMPage) {
      setLocalCrmSearch(crmSearch);
    }
  }, [crmSearch, isCRMPage]);

  const handleCrmTabChange = (tab: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', tab);
    setSearchParams(newParams, { replace: true });
  };

  // OTIMIZAÇÃO: Usa hook centralizado
  const { data: currentUser } = useCurrentUser();
  const { data: currentUserProfile } = useCurrentUserProfile();
  const { data: isSuperAdmin } = useCurrentUserIsSuperAdmin();
  const tenant = useUserStore((state) => state.tenant);

  // In-app notifications with Realtime + Browser Push
  const { unreadNotifications, unreadCount } = useInAppNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  // Map in-app notifications to legacy format for rendering
  const visibleNotifications: Notification[] = unreadNotifications.map(n => ({
    id: n.id,
    type: n.type as Notification['type'],
    conversationId: n.conversation_id || '',
    contactName: n.contact_name || 'Contato',
    message: n.message,
    timestamp: n.created_at,
    channelEventId: (n.metadata as Record<string, string>)?.channelEventId,
  }));
  const notificationCount = unreadCount;

  // Dismiss single notification (mark as read)
  const dismissNotification = (notificationId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    markRead.mutate(notificationId);
  };

  // Dismiss all notifications
  const dismissAllNotifications = () => {
    markAllRead.mutate(undefined, {
      onSuccess: () => toast.success('Todas as notificações foram marcadas como lidas'),
    });
  };

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
        // Search contacts using unaccent function for accent-insensitive search
        const { data: contacts, error: contactsError } = await supabase
          .rpc('search_contacts_unaccent', {
            p_search_query: searchQuery,
            p_limit: 5
          });

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
      navigate(`/contacts`);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    setShowNotifications(false);
    
    // Se for notificação de canal desconectado, marcar como reconhecida e ir para configurações
    if (notification.type === 'channel_disconnect' && notification.channelEventId) {
      try {
        await supabase
          .from('whatsapp_channel_events')
          .update({ 
            acknowledged_at: new Date().toISOString(),
            acknowledged_by: currentUser?.id 
          })
          .eq('id', notification.channelEventId);
        
        queryClient.invalidateQueries({ queryKey: ['in-app-notifications'] });
      } catch (error) {
        console.error('Error acknowledging channel event:', error);
      }
      navigate('/settings/channels');
      return;
    }
    
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

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'assignment':
        return <UserPlus size={14} className="text-primary" />;
      case 'transfer':
        return <ArrowRightLeft size={14} className="text-blue-500" />;
      case 'sla':
        return <AlertTriangle size={14} className="text-amber-500" />;
      case 'channel_disconnect':
        return <WifiOff size={14} className="text-destructive" />;
      default:
        return <Bell size={14} className="text-muted-foreground" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'assignment':
        return 'from-primary to-purple-600';
      case 'transfer':
        return 'from-blue-500 to-cyan-500';
      case 'sla':
        return 'from-amber-500 to-orange-500';
      case 'channel_disconnect':
        return 'from-destructive to-red-600';
      default:
        return 'from-purple-500 to-pink-500';
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
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">
            {title}
          </h1>
          {/* Tenant Badge - Always visible to prevent cross-tenant confusion */}
          {tenant?.name && (
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1 bg-primary/10 text-primary rounded-lg text-xs font-medium border border-primary/20">
              <Building2 className="h-3.5 w-3.5" />
              <span className="max-w-[140px] truncate">{tenant.name}</span>
              {currentUser?.email && (
                <span className="max-w-[180px] truncate text-muted-foreground">({currentUser.email})</span>
              )}
            </div>
          )}
        </div>

        {/* CRM Search - Next to title */}
        {isCRMPage && !isMobile && (
          <div className="relative" ref={searchRef}>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar contatos..."
              value={localCrmSearch}
              onChange={(e) => setLocalCrmSearch(e.target.value)}
              className="w-64 h-10 pl-10 bg-muted/50 border-border/50 rounded-xl focus:bg-card focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground"
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        {/* CRM Tabs - Desktop and Mobile */}
        {isCRMPage && (
          <Tabs value={crmTab} onValueChange={handleCrmTabChange} className="w-auto">
            <TabsList className={isMobile ? "h-9" : ""}>
              <TabsTrigger value="leads" className={isMobile ? "text-xs px-2 py-1" : ""}>
                {isMobile ? "Leads" : "Gestão de Leads"}
              </TabsTrigger>
              <TabsTrigger value="deals" className={isMobile ? "text-xs px-2 py-1" : ""}>
                {isMobile ? "Negócios" : "Negócios"}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {/* Global Search - Hidden on CRM page */}
        {!isCRMPage && (
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
        )}

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

        {/* Super Admin Link */}
        {isSuperAdmin && (
          <Link to="/super-admin">
            <Button 
              variant="outline" 
              size="icon" 
              className="hidden md:flex h-11 w-11 rounded-xl border-yellow-500/50 bg-yellow-500/10 hover:bg-yellow-500/20 hover:border-yellow-500 transition-all"
              title="Super Admin Panel"
            >
              <Crown className="h-5 w-5 text-yellow-500" />
            </Button>
          </Link>
        )}

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
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground border-2 border-card shadow-sm">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-foreground">Notificações</h3>
                <p className="text-xs text-muted-foreground">
                  Atribuições, transferências e alertas
                </p>
              </div>
              {visibleNotifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={dismissAllNotifications}
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                  title="Marcar todas como lidas"
                >
                  <CheckCheck size={14} className="mr-1" />
                  Limpar
                </Button>
              )}
            </div>
            
            <div className="max-h-80 overflow-y-auto">
              {visibleNotifications.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma notificação</p>
                </div>
              ) : (
                visibleNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="relative group flex items-start gap-3 p-3 hover:bg-muted transition-colors text-left border-b border-border/50 last:border-0"
                  >
                    <button
                      onClick={() => handleNotificationClick(notification)}
                      className="flex items-start gap-3 flex-1 min-w-0"
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-semibold flex-shrink-0",
                        getNotificationColor(notification.type)
                      )}>
                        {notification.contactName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {getNotificationIcon(notification.type)}
                          <p className="text-sm font-medium text-foreground truncate">
                            {notification.contactName}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock size={10} />
                          {formatTime(notification.timestamp)}
                        </p>
                      </div>
                    </button>
                    <button
                      onClick={(e) => dismissNotification(notification.id, e)}
                      className="p-1 rounded hover:bg-muted-foreground/20 transition-colors opacity-0 group-hover:opacity-100 absolute top-2 right-2"
                      title="Marcar como lida"
                    >
                      <X size={14} className="text-muted-foreground" />
                    </button>
                  </div>
                ))
              )}
            </div>
            
            {visibleNotifications.length > 0 && (
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
