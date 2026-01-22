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
import { AvailabilityToggle } from './AvailabilityToggle';
import { useCurrentUserIsSuperAdmin } from '@/hooks/useSuperAdminTenants';
import { LogoutConfirmDialog } from './LogoutConfirmDialog';
import { useTenantEnabledModules } from '@/hooks/useTenantEnabledModules';
import { CompanyLogo } from '@/components/ui/company-logo';
import { useCompanySettings } from '@/hooks/useCompanySettings';
// moduleKeys está deprecated - usar item.module_key diretamente

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
  const { profile } = useAuth();
  const isMobile = useIsMobile();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const { hasPermission, isAdmin, role: userRole, isFullyLoaded, roleDefinition } = usePermissions();
  const { data: pendingRequestsCount = 0 } = usePendingRequestsCount();
  const { data: internalChatUnreadCount = 0 } = useInternalChatUnreadCount();
  const { data: internalEmailUnreadCount = 0 } = useInternalEmailUnreadCount();
  const { data: callbacksCount } = usePendingCallbacksCount();
  const { data: isSuperAdmin = false } = useCurrentUserIsSuperAdmin();
  const { data: tenantEnabledModules, isLoading: modulesLoading } = useTenantEnabledModules();
  const { data: companySettings } = useCompanySettings();
  
  // Carregar menu do banco de dados
  const { data: menuHierarchy = [], isLoading: menuLoading } = useMenuHierarchy();
  
  // Estado para controlar submenus expandidos
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());
  
  // Estado para rastrear menus fechados manualmente pelo usuário
  const [manuallyCollapsed, setManuallyCollapsed] = useState<Set<string>>(new Set());
  
  // Ativar listener de realtime para requisições
  useContactRequestsRealtime();

  // OTIMIZAÇÃO: Verificar se o módulo de agendamentos está habilitado antes de fazer a query
  const hasScheduledMessagesAccess = tenantEnabledModules?.has('scheduled_messages') ?? false;
  
  // Fetch pending scheduled messages count - CONDICIONAL
  const { data: pendingCount } = useQuery({
    queryKey: ['pending-scheduled-count'],
    staleTime: 60000, // OTIMIZAÇÃO: Aumentado de 30s para 60s
    queryFn: async () => {
      const { count, error } = await supabase
        .from('scheduled_messages')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'scheduled');
      if (error) throw error;
      return count || 0;
    },
    enabled: hasScheduledMessagesAccess, // OTIMIZAÇÃO: Só executa se módulo habilitado
    refetchInterval: 60000 // OTIMIZAÇÃO: Aumentado de 30s para 60s
  });

  // Expandir automaticamente menus que contêm a rota atual (respeitar fechamento manual)
  useEffect(() => {
    if (menuHierarchy.length === 0) return;

    for (const item of menuHierarchy) {
      if (!item.children?.length) continue;
      
      // NÃO expandir automaticamente se o usuário fechou manualmente
      if (manuallyCollapsed.has(item.id)) continue;
      
      const hasActiveChild = item.children.some(
        (child) =>
          child.href &&
          (location.pathname === child.href ||
            location.pathname.startsWith(child.href + '/'))
      );
      if (hasActiveChild) {
        setExpandedMenus(prev => {
          if (prev.has(item.id)) return prev;
          const next = new Set(prev);
          next.add(item.id);
          return next;
        });
      }
    }
  }, [menuHierarchy, location.pathname, manuallyCollapsed]);

  // Helper para gerar chave de permissão do menu (igual ao MenuPermissionsTree)
  const getMenuPermissionKey = (item: MenuItem): string => {
    if (item.permission) return item.permission;
    if (item.href) {
      const path = item.href.replace(/^\//, '').replace(/\//g, '_');
      return `menu_${path}`;
    }
    return `menu_${item.id}`;
  };

  // Helper para obter module_key do menu
  // IMPORTANTE: Todos os menus agora têm module_key no banco de dados
  const getModuleKey = (item: MenuItem): string | null => {
    // Usar module_key do banco diretamente - OBRIGATÓRIO
    if ((item as any).module_key) {
      return (item as any).module_key;
    }
    // Não há fallback - menus sem module_key são ignorados no filtro de módulos
    return null;
  };

  // Filtrar itens de menu baseado em permissões E módulos do tenant
  const filteredMenuItems = useMemo(() => {
    // CRITICAL: Aguardar carregamento completo de permissões E módulos
    if (!isFullyLoaded) {
      console.log('[Sidebar] BLOCKED: Permissions not fully loaded yet');
      return [];
    }
    
    // FAIL-CLOSED: Se módulos ainda estão carregando, não mostrar nenhum menu
    if (modulesLoading) {
      console.log('[Sidebar] BLOCKED: Modules still loading');
      return [];
    }
    
    // FAIL-CLOSED: Se tenantEnabledModules é undefined (erro ou não carregou), bloquear menu
    // Exceto para SuperAdmin que pode ver tudo
    if (tenantEnabledModules === undefined && !isSuperAdmin) {
      console.log('[Sidebar] BLOCKED: tenantEnabledModules is undefined (failed to load or no tenant)');
      return [];
    }
    
    // Obter permissões de menu do role_definition (funciona como STRICT ALLOWLIST)
    const menuPermissions = (roleDefinition?.permissions as any)?.menu || {};
    const hasMenuPermissions = Object.keys(menuPermissions).length > 0;
    
    // ALTERADO: Se tenantEnabledModules existe (mesmo vazio), significa que há configuração de módulos
    // Size 0 = todos desabilitados = devemos aplicar o filtro (e ocultar tudo)
    const hasTenantModulesConfig = tenantEnabledModules !== undefined;
    const hasAnyModuleEnabled = tenantEnabledModules && tenantEnabledModules.size > 0;
    
    // Debug: log detalhado para diagnóstico
    console.log('[Sidebar] === Module Filter Debug ===');
    console.log('[Sidebar] Role:', userRole, 'isAdmin:', isAdmin, 'isSuperAdmin:', isSuperAdmin);
    console.log('[Sidebar] tenantEnabledModules status:', {
      isUndefined: tenantEnabledModules === undefined,
      isEmpty: tenantEnabledModules?.size === 0,
      count: tenantEnabledModules?.size || 0,
      modules: tenantEnabledModules ? Array.from(tenantEnabledModules) : 'N/A'
    });
    console.log('[Sidebar] menuPermissions:', menuPermissions);
    
    const filterItem = (item: MenuItem): MenuItem | null => {
      // Verificar se está ativo
      if (!item.is_active) return null;
      
      // Super Admin SEMPRE requer flag isSuperAdmin, independente de qualquer outra permissão
      if (item.href === '/super-admin' || item.title?.toLowerCase().includes('super admin')) {
        console.log('[Sidebar] Super Admin check:', item.title, 'isSuperAdmin:', isSuperAdmin);
        if (!isSuperAdmin) return null;
      }
      
      // FILTRO DE MÓDULOS DO TENANT (aplica para todos, inclusive admins)
      // Se existe configuração de módulos (mesmo que todos desabilitados), aplicar filtro
      if (hasTenantModulesConfig && item.href !== '/super-admin') {
        // Se NENHUM módulo está habilitado e não é Super Admin, bloquear tudo
        if (!hasAnyModuleEnabled && !isSuperAdmin) {
          console.log('[Sidebar] BLOCKED (all modules disabled):', item.title);
          return null;
        }
        
        const moduleKey = getModuleKey(item);
        
        // FAIL-CLOSED: Se tem module_key e está desabilitado, bloquear IMEDIATAMENTE
        // Não verificar filhos - se o módulo do pai está off, o menu inteiro some
        if (moduleKey) {
          const isModuleEnabled = tenantEnabledModules.has(moduleKey);
          console.log('[Sidebar] Module check:', item.title, 'moduleKey:', moduleKey, 'enabled:', isModuleEnabled);
          if (!isModuleEnabled) {
            console.log('[Sidebar] BLOCKED (module disabled, fail-closed):', item.title);
            return null;
          }
        }
        
        // FAIL-CLOSED para menus sem module_key: se não tem module_key, bloquear (exceto Super Admin)
        // Isso evita que menus "órfãos" apareçam
        if (!moduleKey && !isSuperAdmin) {
          // Exceção: menus cascata (sem href) podem passar se tiverem filhos válidos
          if (!item.href && item.children && item.children.length > 0) {
            const filteredChildren = item.children
              .map(filterItem)
              .filter((child): child is MenuItem => child !== null);
            if (filteredChildren.length > 0) {
              return { ...item, children: filteredChildren };
            }
          }
          // Menu sem module_key e sem filhos válidos = bloquear
          if (!item.href || !item.children) {
            console.log('[Sidebar] BLOCKED (no module_key, fail-closed):', item.title);
            return null;
          }
        }
      }
      
      // Admin vê tudo (exceto módulos desabilitados do tenant que já foram verificados)
      if (isAdmin) {
        if (item.children) {
          const filteredChildren = item.children
            .map(filterItem)
            .filter((child): child is MenuItem => child !== null);
          
          // Se é um menu cascata (sem href) e não sobrou nenhum filho, não exibir o pai
          if (!item.href && filteredChildren.length === 0) return null;
          
          return { ...item, children: filteredChildren };
        }
        return item;
      }
      
      // Para não-admins: menuPermissions é STRICT ALLOWLIST
      const permKey = getMenuPermissionKey(item);
      
      // Se tem permissões de menu configuradas, usar STRICT ALLOWLIST
      if (hasMenuPermissions) {
        const hasAccess = menuPermissions[permKey] === true;
        console.log('[Sidebar] Checking:', item.title, 'permKey:', permKey, 'hasAccess:', hasAccess);
        
        // Se o item NÃO está no allowlist, verificar se é um menu cascata com filhos permitidos
        if (!hasAccess) {
          // Se é um menu cascata (sem href, com children), verificar se algum filho tem permissão
          if (!item.href && item.children && item.children.length > 0) {
            const filteredChildren = item.children
              .map(filterItem)
              .filter((child): child is MenuItem => child !== null);
            
            // Se algum filho passou, exibir o pai com os filhos filtrados
            if (filteredChildren.length > 0) {
              return { ...item, children: filteredChildren };
            }
          }
          // Sem filhos permitidos ou não é cascata = ocultar
          return null;
        }
      } else {
        // Fallback apenas se NÃO existem menuPermissions configuradas (migração)
        if (item.permission) {
          const [category, action] = item.permission.split('.');
          if (!hasPermission(category, action)) return null;
        }
        
        if (item.roles && item.roles.length > 0) {
          if (!userRole || !item.roles.includes(userRole)) return null;
        }
      }
      
      // Filtrar children recursivamente (para itens que passaram a verificação)
      if (item.children) {
        const filteredChildren = item.children
          .map(filterItem)
          .filter((child): child is MenuItem => child !== null);
        
        // Se é um menu cascata (sem href) e não sobrou nenhum filho, não exibir o pai
        if (!item.href && filteredChildren.length === 0) return null;
        
        return { ...item, children: filteredChildren };
      }
      
      return item;
    };
    
    const result = menuHierarchy
      .map(filterItem)
      .filter((item): item is MenuItem => item !== null);
    
    console.log('[Sidebar] Filtered items:', result.map(i => i.title));
    return result;
  }, [menuHierarchy, isFullyLoaded, isAdmin, hasPermission, userRole, isSuperAdmin, roleDefinition, tenantEnabledModules, modulesLoading]);

  const toggleExpanded = (id: string) => {
    setExpandedMenus(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Marcar como manualmente fechado
        setManuallyCollapsed(prevCollapsed => new Set(prevCollapsed).add(id));
      } else {
        next.add(id);
        // Remover da lista de manualmente fechados
        setManuallyCollapsed(prevCollapsed => {
          const newSet = new Set(prevCollapsed);
          newSet.delete(id);
          return newSet;
        });
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
    const isActive = item.href ? (() => {
      const fullPath = location.pathname + location.search;
      const hrefHasQuery = item.href.includes('?');
      
      if (hrefHasQuery) {
        return fullPath === item.href;
      } else {
        const isPathMatch = location.pathname === item.href || 
                            location.pathname.startsWith(item.href + '/');
        return isPathMatch && !location.search;
      }
    })() : false;
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedMenus.has(item.id);
    const isCascadeMenu = !item.href && hasChildren;
    const badgeValue = getBadgeValue(item.show_badge);
    const showLive = isLiveBadge(item.show_badge);
    
    // Se é menu cascata (sem href, com children)
    if (isCascadeMenu) {
      const isChildActive = item.children!.some(child => {
        if (!child.href) return false;
        const fullPath = location.pathname + location.search;
        const hrefHasQuery = child.href.includes('?');
        
        if (hrefHasQuery) {
          return fullPath === child.href;
        } else {
          const isPathMatch = location.pathname === child.href || 
                              location.pathname.startsWith(child.href + '/');
          return isPathMatch && !location.search;
        }
      });
      
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
              <span className="ml-2 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white bg-red-500">
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
          <div className="flex h-11 w-11 items-center justify-center shadow-lg overflow-hidden bg-white">
            <CompanyLogo size="md" className="h-11 w-11" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className={cn(
                "font-bold text-lg tracking-tight",
                isDark ? "text-foreground" : "text-white"
              )}>
                CRM SPACE
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
          {(menuLoading || modulesLoading || (!isSuperAdmin && tenantEnabledModules === undefined)) ? (
            // Skeleton loading - FAIL-CLOSED: mostra skeleton se módulos não carregaram
            <>
              {process.env.NODE_ENV === 'development' && (
                <div className="text-xs text-muted-foreground px-2 mb-2">
                  [DEV] Loading: menu={menuLoading ? 'yes' : 'no'}, modules={modulesLoading ? 'yes' : 'no'}, 
                  data={tenantEnabledModules === undefined ? 'undefined' : `${tenantEnabledModules?.size || 0} items`}
                </div>
              )}
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </>
          ) : (
            filteredMenuItems.map((item) => renderMenuItem(item))
          )}

          {/* Platform Admin Link - Only for Super Admins */}
          {isSuperAdmin && !menuLoading && (
            <>
              <div className={cn(
                'my-4 border-t',
                isDark ? 'border-border/50' : 'border-white/20'
              )} />
              <NavLink
                to="/platform"
                className={cn(
                  'group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200',
                  location.pathname.startsWith('/platform')
                    ? isDark
                      ? 'bg-amber-500/20 text-amber-400 border-l-4 border-amber-400'
                      : 'bg-amber-400/20 text-amber-100 shadow-lg border-l-4 border-amber-300'
                    : isDark
                      ? 'text-amber-400/70 hover:bg-amber-500/10 hover:text-amber-400'
                      : 'text-amber-200 hover:bg-amber-400/10 hover:text-amber-100',
                  isCollapsed && 'justify-center px-3'
                )}
              >
                <LucideIcons.Crown className={cn(
                  'h-5 w-5 shrink-0',
                  location.pathname.startsWith('/platform')
                    ? isDark ? 'text-amber-400' : 'text-amber-200'
                    : isDark ? 'text-amber-400/60' : 'text-amber-300'
                )} />
                {!isCollapsed && <span>Painel da Plataforma</span>}
              </NavLink>
            </>
          )}
        </div>
      </nav>

      {/* User Section */}
      <div className="p-4 space-y-3">
        {/* Availability Toggle */}
        <AvailabilityToggle isCollapsed={isCollapsed} />
        
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
                  onClick={() => setLogoutDialogOpen(true)}
                  className={cn(
                    "h-9 w-9 transition-colors",
                    isDark 
                      ? "text-muted-foreground hover:text-destructive hover:bg-destructive/10" 
                      : "text-white hover:bg-red-500/30"
                  )}
                  title="Sair do sistema"
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
                onClick={() => setLogoutDialogOpen(true)}
                className={cn(
                  "h-9 w-9 transition-colors",
                  isDark 
                    ? "text-muted-foreground hover:text-destructive hover:bg-destructive/10" 
                    : "text-white hover:bg-red-500/30"
                )}
                title="Sair do sistema"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Logout Confirmation Dialog */}
      <LogoutConfirmDialog 
        open={logoutDialogOpen} 
        onOpenChange={setLogoutDialogOpen} 
      />
    </aside>
  );
}
