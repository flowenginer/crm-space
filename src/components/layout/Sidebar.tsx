import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import * as LucideIcons from 'lucide-react';
import {
  Bell,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Menu,
  LogOut,
  Shirt,
  Sun,
  Moon,
  Circle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NavLink } from '@/components/NavLink';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTheme } from '@/contexts/ThemeContext';
import { usePermissions } from '@/hooks/usePermissions';
import { usePendingRequestsCount, useContactRequestsRealtime } from '@/hooks/useContactRequests';
import { useInternalChatUnreadCount } from '@/hooks/useInternalChat';
import { useInternalEmailUnreadCount } from '@/hooks/useInternalEmail';
import { usePendingCallbacksCount } from '@/hooks/useCallbackReminders';
import { useMenuHierarchy, MenuItem } from '@/hooks/useMenuConfig';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

// Componente para renderizar ícone dinamicamente
function DynamicIcon({ name, className }: { name: string; className?: string }) {
  const IconComponent = (LucideIcons as any)[name];
  if (!IconComponent) {
    return <Circle className={className} />;
  }
  return <IconComponent className={className} />;
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const isMobile = useIsMobile();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const { hasPermission, isAdmin, role: userRole, isFullyLoaded } = usePermissions();
  const { data: pendingRequestsCount = 0 } = usePendingRequestsCount();
  const { data: internalChatUnreadCount = 0 } = useInternalChatUnreadCount();
  const { data: internalEmailUnreadCount = 0 } = useInternalEmailUnreadCount();
  const { data: callbacksCount } = usePendingCallbacksCount();
  
  // Carregar menu do banco de dados
  const { data: menuHierarchy = [], isLoading: menuLoading } = useMenuHierarchy();
  
  // Estado para controlar submenus expandidos
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(() => {
    // Inicializar com menus que contêm a rota atual
    const expanded = new Set<string>();
    return expanded;
  });
  
  // Ativar listener de realtime para requisições
  useContactRequestsRealtime();

  // Fetch pending scheduled messages count
  const { data: pendingCount } = useQuery({
    queryKey: ['pending-scheduled-count'],
    staleTime: 30000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('scheduled_messages')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'scheduled');
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000
  });

  // Expandir automaticamente menus que contêm a rota atual
  useEffect(() => {
    if (menuHierarchy.length > 0) {
      menuHierarchy.forEach(item => {
        if (item.children && item.children.some(child => child.href && (location.pathname === child.href || location.pathname.startsWith(child.href + '/')))) {
          setExpandedMenus(prev => new Set([...prev, item.id]));
        }
      });
    }
  }, [menuHierarchy, location.pathname]);

  // Filtrar itens de menu baseado em permissões
  const filteredMenuItems = useMemo(() => {
    if (!isFullyLoaded) return [];
    
    const filterItem = (item: MenuItem): MenuItem | null => {
      // Verificar se está ativo
      if (!item.is_active) return null;
      
      // Admin vê tudo
      if (isAdmin) {
        // Filtrar children também
        if (item.children) {
          const filteredChildren = item.children
            .map(filterItem)
            .filter((child): child is MenuItem => child !== null);
          return { ...item, children: filteredChildren };
        }
        return item;
      }
      
      // Verificar permissão
      if (item.permission) {
        const [category, action] = item.permission.split('.');
        if (!hasPermission(category, action)) return null;
      }
      
      // Verificar roles
      if (item.roles && item.roles.length > 0) {
        if (!userRole || !item.roles.includes(userRole)) return null;
      }
      
      // Filtrar children
      if (item.children) {
        const filteredChildren = item.children
          .map(filterItem)
          .filter((child): child is MenuItem => child !== null);
        return { ...item, children: filteredChildren };
      }
      
      return item;
    };
    
    return menuHierarchy
      .map(filterItem)
      .filter((item): item is MenuItem => item !== null);
  }, [menuHierarchy, isFullyLoaded, isAdmin, hasPermission, userRole]);

  const toggleExpanded = (id: string) => {
    setExpandedMenus(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getBadgeValue = (badgeType: string | null): number | null => {
    if (!badgeType) return null;
    
    switch (badgeType) {
      case 'scheduledCount':
        return ((pendingCount || 0) + (callbacksCount?.total || 0)) || null;
      case 'requestsCount':
        return pendingRequestsCount || null;
      case 'internalChatCount':
        return internalChatUnreadCount || null;
      case 'internalEmailCount':
        return internalEmailUnreadCount || null;
      default:
        return null;
    }
  };

  const isLiveBadge = (badgeType: string | null): boolean => {
    return badgeType === 'liveBadge';
  };

  const hasOverdueCallbacks = callbacksCount && callbacksCount.overdue > 0;

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const renderMenuItem = (item: MenuItem, isSubmenuItem = false) => {
    const isActive = item.href ? 
      (location.pathname === item.href || location.pathname.startsWith(item.href + '/')) : 
      false;
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedMenus.has(item.id);
    const isCascadeMenu = !item.href && hasChildren;
    const badgeValue = getBadgeValue(item.show_badge);
    const showLive = isLiveBadge(item.show_badge);
    
    // Se é menu cascata (sem href, com children)
    if (isCascadeMenu) {
      const isChildActive = item.children!.some(child => 
        child.href && (location.pathname === child.href || location.pathname.startsWith(child.href + '/'))
      );
      
      return (
        <div key={item.id} className="mt-2">
          <button
            onClick={() => toggleExpanded(item.id)}
            className={cn(
              'group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200',
              isChildActive
                ? isDark
                  ? 'bg-primary/15 text-primary'
                  : 'bg-white/20 text-white shadow-lg'
                : isDark
                  ? 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  : 'text-purple-100 hover:bg-white/10 hover:text-white',
              isCollapsed && 'justify-center px-3'
            )}
          >
            <DynamicIcon 
              name={item.icon} 
              className={cn(
                'h-5 w-5 shrink-0',
                isChildActive
                  ? isDark ? 'text-primary' : 'text-white'
                  : isDark ? 'text-muted-foreground' : 'text-purple-200'
              )} 
            />
            {!isCollapsed && (
              <>
                <span className="flex-1 text-left">{item.title}</span>
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </>
            )}
          </button>
          {isExpanded && !isCollapsed && item.children && (
            <div className="ml-4 mt-1 space-y-1 border-l-2 border-primary/20 pl-3">
              {item.children.map((child) => renderMenuItem(child, true))}
            </div>
          )}
        </div>
      );
    }
    
    // Item normal com link
    return (
      <NavLink
        key={item.id}
        to={item.href || '/'}
        className={cn(
          'group flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200',
          isSubmenuItem ? 'rounded-lg px-3 py-2' : 'px-4 py-3',
          isActive
            ? isDark
              ? isSubmenuItem 
                ? 'bg-primary/10 text-primary font-medium'
                : 'bg-primary/15 text-primary border-l-4 border-primary'
              : isSubmenuItem
                ? 'bg-white/15 text-white font-medium'
                : 'bg-white/20 text-white shadow-lg border-l-4 border-white'
            : isDark
              ? isSubmenuItem
                ? 'text-muted-foreground hover:bg-muted hover:text-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-[1.02]'
              : isSubmenuItem
                ? 'text-purple-200 hover:bg-white/10 hover:text-white'
                : 'text-purple-100 hover:bg-white/10 hover:text-white hover:scale-[1.02]',
          isCollapsed && !isSubmenuItem && 'justify-center px-3'
        )}
      >
        <DynamicIcon 
          name={item.icon} 
          className={cn(
            'shrink-0 transition-transform',
            isSubmenuItem ? 'h-4 w-4' : 'h-5 w-5',
            isActive 
              ? isDark ? 'text-primary' : 'text-white'
              : isDark 
                ? 'text-muted-foreground group-hover:text-foreground' 
                : 'text-purple-200 group-hover:text-white'
          )} 
        />
        {(!isCollapsed || isSubmenuItem) && (
          <span className="flex-1 flex items-center justify-between">
            {item.title}
            {badgeValue && badgeValue > 0 && (
              <span className={cn(
                'ml-2 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white',
                item.show_badge === 'scheduledCount' && hasOverdueCallbacks ? 'bg-red-500' : 
                item.show_badge === 'requestsCount' ? 'bg-destructive' :
                item.show_badge === 'internalChatCount' ? 'bg-primary' :
                'bg-amber-500'
              )}>
                {badgeValue > 99 ? '99+' : badgeValue}
              </span>
            )}
            {showLive && (
              <span className="ml-2 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            )}
          </span>
        )}
      </NavLink>
    );
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 flex h-screen flex-col shadow-2xl transition-all duration-300',
        isCollapsed ? 'w-20' : 'w-[280px]',
        isMobile && isCollapsed && '-translate-x-full',
        isDark 
          ? 'bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-r border-border/50' 
          : 'bg-gradient-to-b from-purple-600 via-purple-700 to-pink-600'
      )}
    >
      {/* Logo Section */}
      <div className={cn(
        "flex h-20 items-center justify-between px-5 border-b",
        isDark ? "border-border/50" : "border-white/10"
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl shadow-lg",
            isDark ? "bg-primary" : "bg-white"
          )}>
            <Shirt className={cn(
              "h-6 w-6",
              isDark ? "text-primary-foreground" : "text-purple-600"
            )} />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className={cn(
                "font-bold text-lg tracking-tight",
                isDark ? "text-foreground" : "text-white"
              )}>
                Space Sports
              </span>
              <span className={cn(
                "text-xs",
                isDark ? "text-muted-foreground" : "text-purple-200"
              )}>
                CRM Pro
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!isCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className={cn(
                "h-9 w-9 transition-colors",
                isDark 
                  ? "text-muted-foreground hover:text-foreground hover:bg-muted" 
                  : "text-white hover:bg-white/10"
              )}
              title={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className={cn(
              "h-9 w-9 transition-colors",
              isDark 
                ? "text-muted-foreground hover:text-foreground hover:bg-muted" 
                : "text-white hover:bg-white/10"
            )}
          >
            {isCollapsed ? (
              <Menu className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 px-3">
        <div className="space-y-1.5">
          {menuLoading ? (
            // Skeleton loading
            Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))
          ) : (
            filteredMenuItems.map((item) => renderMenuItem(item))
          )}
        </div>
      </nav>

      {/* User Section */}
      <div className="p-4">
        <div
          className={cn(
            'rounded-xl p-3 transition-all',
            isDark 
              ? 'bg-muted/50 border border-border/50' 
              : 'glass border border-white/20',
            isCollapsed && 'flex flex-col items-center gap-2'
          )}
        >
          <div className={cn(
            'flex items-center',
            isCollapsed ? 'flex-col gap-2' : 'gap-3'
          )}>
            {/* Avatar with notification badge */}
            <div className="relative">
              <div className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full font-semibold text-sm border-2 shadow-lg",
                isDark 
                  ? "bg-primary text-primary-foreground border-primary" 
                  : "bg-white text-purple-600 border-white"
              )}>
              {getInitials(profile?.full_name)}
              </div>
            </div>

            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "truncate text-sm font-semibold",
                  isDark ? "text-foreground" : "text-white"
                )}>
                  {profile?.full_name || 'Usuário'}
                </p>
                <p className={cn(
                  "truncate text-xs flex items-center gap-1",
                  isDark ? "text-muted-foreground" : "text-purple-200"
                )}>
                  <span className="h-2 w-2 rounded-full bg-green-400"></span>
                  Online
                </p>
              </div>
            )}

            {!isCollapsed && (
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-9 w-9 transition-colors",
                    isDark 
                      ? "text-muted-foreground hover:text-foreground hover:bg-muted" 
                      : "text-white hover:bg-white/10"
                  )}
                >
                  <Bell className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => signOut()}
                  className={cn(
                    "h-9 w-9 transition-colors",
                    isDark 
                      ? "text-muted-foreground hover:text-destructive hover:bg-destructive/10" 
                      : "text-white hover:bg-red-500/30"
                  )}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {isCollapsed && (
            <div className="flex flex-col gap-2">
              {/* Theme Toggle when collapsed */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className={cn(
                  "h-9 w-9 transition-colors",
                  isDark 
                    ? "text-muted-foreground hover:text-foreground hover:bg-muted" 
                    : "text-white hover:bg-white/10"
                )}
                title={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => signOut()}
                className={cn(
                  "h-9 w-9 transition-colors",
                  isDark 
                    ? "text-muted-foreground hover:text-destructive hover:bg-destructive/10" 
                    : "text-white hover:bg-red-500/30"
                )}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
