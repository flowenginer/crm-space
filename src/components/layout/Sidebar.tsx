import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  Zap,
  TrendingUp,
  Radio,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Shirt,
  Bell,
  ChevronLeft,
  ChevronDown,
  Menu,
  LucideIcon,
  CalendarClock,
  ClipboardList,
  Sun,
  Moon,
  Megaphone,
  Target,
  Workflow,
  Link2,
  GitPullRequest,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { NavLink } from '@/components/NavLink';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTheme } from '@/contexts/ThemeContext';
import { usePermissions } from '@/hooks/usePermissions';
import { usePendingRequestsCount, useContactRequestsRealtime } from '@/hooks/useContactRequests';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  permission?: string; // format: 'category.action'
  roles?: string[]; // Aceita qualquer role (admin, supervisor, vendedor, designer, sac, etc.)
}

/**
 * NAVEGAÇÃO COM PERMISSÕES CORRETAS
 * Todas as permissões devem corresponder às definidas em src/config/permissions.ts
 */
const navItems: NavItem[] = [
  { title: 'Dashboard', href: '/', icon: LayoutDashboard, permission: 'dashboard.view' },
  // Conversas agora é um submenu, removido daqui
  { title: 'Ao Vivo', href: '/ao-vivo', icon: Radio, permission: 'live.view' },
  { title: 'Mensagens Rápidas', href: '/quick-messages', icon: Zap, permission: 'templates.view' },
  { title: 'Agendamentos', href: '/agendamentos', icon: CalendarClock, permission: 'schedules.view' },
  { title: 'Automações', href: '/automations', icon: Workflow, permission: 'automations.view' },
  { title: 'CRM', href: '/crm', icon: TrendingUp, permission: 'deals.view' },
  { title: 'Canais WhatsApp', href: '/whatsapp-channels', icon: Radio, permission: 'channels.view' },
  { title: 'Contatos', href: '/contacts', icon: Users, permission: 'contacts.view' },
  // Marketing
  { title: 'Meta Ads', href: '/meta-ads', icon: Megaphone, permission: 'marketing.view' },
  { title: 'Relatório Campanhas', href: '/relatorios/campanhas', icon: Target, permission: 'marketing.view_campaigns' },
  // Relatórios
  { title: 'Atendimentos', href: '/relatorios/atendimentos', icon: ClipboardList, permission: 'reports.view' },
  { title: 'Relatórios', href: '/reports', icon: BarChart3, permission: 'reports.view' },
  // Integrações
  { title: 'Webhooks', href: '/webhooks', icon: Link2, permission: 'webhooks.view' },
  { title: 'Configurações', href: '/settings', icon: Settings, permission: 'settings.view' },
];

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const isMobile = useIsMobile();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const { hasPermission, isAdmin, role: userRole, isFullyLoaded } = usePermissions();
  const { data: pendingRequestsCount = 0 } = usePendingRequestsCount();
  
  // Ativar listener de realtime para requisições
  useContactRequestsRealtime();
  // State for collapsible conversations submenu
  const isConversationsActive = location.pathname.startsWith('/conversations');
  const [conversationsOpen, setConversationsOpen] = useState(isConversationsActive);
  
  // Check if user can see requests - now uses proper permission
  const canSeeRequests = isAdmin || hasPermission('conversations', 'requests');
  const canSeeConversations = isAdmin || hasPermission('conversations', 'view');

  // Fetch pending scheduled messages count
  const { data: pendingCount } = useQuery({
    queryKey: ['pending-scheduled-count'],
    staleTime: 30000, // 30 seconds cache
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

  // Filter nav items based on permissions
  const filteredNavItems = navItems.filter((item) => {
    // While NOT fully loaded, hide items that require permission for safety
    if (!isFullyLoaded) {
      return !item.permission && !item.roles;
    }
    
    // Admin sees everything
    if (isAdmin) return true;
    
    // Check specific permission
    if (item.permission) {
      const [category, action] = item.permission.split('.');
      return hasPermission(category, action);
    }
    
    // Check role restriction
    if (item.roles) {
      return userRole ? item.roles.includes(userRole) : false;
    }
    
    return true;
  });

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 flex h-screen flex-col shadow-2xl transition-all duration-300',
        isCollapsed ? 'w-20' : 'w-[280px]',
        isMobile && isCollapsed && '-translate-x-full',
        // Light mode: vibrant purple gradient
        // Dark mode: subtle dark gradient with hint of purple
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
          {/* Theme Toggle - visible when sidebar is expanded */}
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
          {/* Dashboard - primeiro item */}
          {filteredNavItems.filter(item => item.href === '/').map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;
            return (
              <NavLink
                key={item.href}
                to={item.href}
                className={cn(
                  'group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200',
                  isActive
                    ? isDark
                      ? 'bg-primary/15 text-primary border-l-4 border-primary'
                      : 'bg-white/20 text-white shadow-lg border-l-4 border-white'
                    : isDark
                      ? 'text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-[1.02]'
                      : 'text-purple-100 hover:bg-white/10 hover:text-white hover:scale-[1.02]',
                  isCollapsed && 'justify-center px-3'
                )}
              >
                <Icon className={cn(
                  'h-5 w-5 shrink-0 transition-transform',
                  isActive 
                    ? isDark ? 'text-primary' : 'text-white'
                    : isDark 
                      ? 'text-muted-foreground group-hover:text-foreground' 
                      : 'text-purple-200 group-hover:text-white'
                )} />
                {!isCollapsed && <span>{item.title}</span>}
              </NavLink>
            );
          })}

          {/* Conversas - Submenu expansível */}
          {canSeeConversations && (
            <Collapsible open={conversationsOpen} onOpenChange={setConversationsOpen}>
              <CollapsibleTrigger asChild>
                <button
                  className={cn(
                    'group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200',
                    isConversationsActive
                      ? isDark
                        ? 'bg-primary/15 text-primary border-l-4 border-primary'
                        : 'bg-white/20 text-white shadow-lg border-l-4 border-white'
                      : isDark
                        ? 'text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-[1.02]'
                        : 'text-purple-100 hover:bg-white/10 hover:text-white hover:scale-[1.02]',
                    isCollapsed && 'justify-center px-3'
                  )}
                >
                  <MessageSquare className={cn(
                    'h-5 w-5 shrink-0 transition-transform',
                    isConversationsActive 
                      ? isDark ? 'text-primary' : 'text-white'
                      : isDark 
                        ? 'text-muted-foreground group-hover:text-foreground' 
                        : 'text-purple-200 group-hover:text-white'
                  )} />
                  {!isCollapsed && (
                    <>
                      <span className="flex-1 text-left">Conversas</span>
                      {canSeeRequests && pendingRequestsCount > 0 && (
                        <span className="mr-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-white">
                          {pendingRequestsCount > 99 ? '99+' : pendingRequestsCount}
                        </span>
                      )}
                      <ChevronDown className={cn(
                        'h-4 w-4 transition-transform',
                        conversationsOpen && 'rotate-180'
                      )} />
                    </>
                  )}
                </button>
              </CollapsibleTrigger>
              {!isCollapsed && (
                <CollapsibleContent className="mt-1 ml-4 space-y-1">
                  {/* Subitem: Conversas */}
                  <NavLink
                    to="/conversations"
                    end
                    className={cn(
                      'group flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200',
                      location.pathname === '/conversations'
                        ? isDark
                          ? 'bg-primary/10 text-primary'
                          : 'bg-white/15 text-white'
                        : isDark
                          ? 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          : 'text-purple-200 hover:bg-white/10 hover:text-white'
                    )}
                  >
                    <MessageSquare className="h-4 w-4" />
                    <span>Conversas</span>
                  </NavLink>
                  
                  {/* Subitem: Requisições - só admin/supervisor */}
                  {canSeeRequests && (
                    <NavLink
                      to="/conversations/requests"
                      className={cn(
                        'group flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200',
                        location.pathname === '/conversations/requests'
                          ? isDark
                            ? 'bg-primary/10 text-primary'
                            : 'bg-white/15 text-white'
                          : isDark
                            ? 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            : 'text-purple-200 hover:bg-white/10 hover:text-white'
                      )}
                    >
                      <GitPullRequest className="h-4 w-4" />
                      <span className="flex-1">Requisições</span>
                      {pendingRequestsCount > 0 && (
                        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-white">
                          {pendingRequestsCount > 99 ? '99+' : pendingRequestsCount}
                        </span>
                      )}
                    </NavLink>
                  )}
                </CollapsibleContent>
              )}
            </Collapsible>
          )}

          {/* Demais itens de navegação */}
          {filteredNavItems.filter(item => item.href !== '/').map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;

            const showBadge = item.href === '/agendamentos' && pendingCount && pendingCount > 0;
            const showLiveBadge = item.href === '/ao-vivo';

            return (
              <NavLink
                key={item.href}
                to={item.href}
                className={cn(
                  'group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200',
                  isActive
                    ? isDark
                      ? 'bg-primary/15 text-primary border-l-4 border-primary'
                      : 'bg-white/20 text-white shadow-lg border-l-4 border-white'
                    : isDark
                      ? 'text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-[1.02]'
                      : 'text-purple-100 hover:bg-white/10 hover:text-white hover:scale-[1.02]',
                  isCollapsed && 'justify-center px-3'
                )}
              >
                <Icon className={cn(
                  'h-5 w-5 shrink-0 transition-transform',
                  isActive 
                    ? isDark ? 'text-primary' : 'text-white'
                    : isDark 
                      ? 'text-muted-foreground group-hover:text-foreground' 
                      : 'text-purple-200 group-hover:text-white'
                )} />
                {!isCollapsed && (
                  <span className="flex-1 flex items-center justify-between">
                    {item.title}
                    {showBadge && (
                      <span className="ml-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
                        {pendingCount > 99 ? '99+' : pendingCount}
                      </span>
                    )}
                    {showLiveBadge && (
                      <span className="ml-2 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    )}
                  </span>
                )}
              </NavLink>
            );
          })}
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
