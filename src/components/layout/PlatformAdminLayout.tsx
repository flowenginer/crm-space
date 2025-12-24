import { useState, useEffect } from 'react';
import { Outlet, useLocation, Navigate, NavLink } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { useCurrentUserIsSuperAdmin } from '@/hooks/useSuperAdminTenants';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LogoutConfirmDialog } from './LogoutConfirmDialog';
import { useTheme } from '@/contexts/ThemeContext';
import {
  Loader2,
  LayoutDashboard,
  Building2,
  Shield,
  Boxes,
  ScrollText,
  Settings,
  ChevronLeft,
  Menu,
  LogOut,
  ArrowLeftFromLine,
  Crown,
} from 'lucide-react';

const platformMenuItems = [
  {
    title: 'Dashboard',
    href: '/platform',
    icon: LayoutDashboard,
  },
  {
    title: 'Tenants',
    href: '/platform/tenants',
    icon: Building2,
  },
  {
    title: 'Super Admins',
    href: '/platform/admins',
    icon: Shield,
  },
  {
    title: 'Módulos',
    href: '/platform/modules',
    icon: Boxes,
  },
  {
    title: 'Logs & Auditoria',
    href: '/platform/logs',
    icon: ScrollText,
  },
  {
    title: 'Configurações',
    href: '/platform/settings',
    icon: Settings,
  },
];

export function PlatformAdminLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const location = useLocation();
  const { session, profile, isLoading: authLoading } = useAuth();
  const { data: isSuperAdmin, isLoading: superAdminLoading } = useCurrentUserIsSuperAdmin();
  const isMobile = useIsMobile();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Auto-collapse sidebar on mobile
  useEffect(() => {
    if (isMobile) {
      setSidebarCollapsed(true);
    }
  }, [isMobile]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    if (isMobile) {
      setSidebarCollapsed(true);
    }
  }, [location.pathname, isMobile]);

  const isLoading = authLoading || superAdminLoading;

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 animate-pulse"></div>
            <Loader2 className="absolute inset-0 m-auto h-8 w-8 animate-spin text-white" />
          </div>
          <p className="text-muted-foreground font-medium">Carregando Painel da Plataforma...</p>
        </div>
      </div>
    );
  }

  // Redirect to auth if not logged in
  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  // Redirect to home if not super admin
  if (!isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  const getInitials = (name: string | null) => {
    if (!name) return 'SA';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col transition-all duration-300',
          sidebarCollapsed ? 'w-20' : 'w-[280px]',
          isMobile && sidebarCollapsed && '-translate-x-full',
          // Platform admin sidebar - distinct amber/orange gradient
          isDark
            ? 'bg-gradient-to-b from-amber-950 via-orange-950 to-background border-r border-amber-900/20'
            : 'bg-gradient-to-b from-amber-600 via-orange-500 to-orange-600'
        )}
      >
        {/* Logo */}
        <div className={cn(
          'flex items-center gap-3 px-4 py-6',
          sidebarCollapsed && 'justify-center px-3'
        )}>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm">
            <Crown className="h-7 w-7 text-white" />
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-col">
              <span className="text-lg font-bold text-white">Plataforma</span>
              <span className="text-xs text-white/70">Administração</span>
            </div>
          )}
        </div>

        {/* Menu */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {platformMenuItems.map((item) => {
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
                      ? 'bg-amber-500/20 text-amber-400 border-l-4 border-amber-400'
                      : 'bg-white/20 text-white shadow-lg border-l-4 border-white'
                    : isDark
                      ? 'text-amber-200/70 hover:bg-amber-500/10 hover:text-amber-200'
                      : 'text-orange-100 hover:bg-white/10 hover:text-white',
                  sidebarCollapsed && 'justify-center px-3'
                )}
              >
                <Icon className={cn(
                  'h-5 w-5 shrink-0',
                  isActive
                    ? isDark ? 'text-amber-400' : 'text-white'
                    : isDark ? 'text-amber-300/60' : 'text-orange-200'
                )} />
                {!sidebarCollapsed && <span>{item.title}</span>}
              </NavLink>
            );
          })}

          {/* Separator */}
          <div className="my-4 border-t border-white/10" />

          {/* Back to Tenant */}
          <NavLink
            to="/"
            className={cn(
              'group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200',
              isDark
                ? 'text-amber-200/70 hover:bg-amber-500/10 hover:text-amber-200'
                : 'text-orange-100 hover:bg-white/10 hover:text-white',
              sidebarCollapsed && 'justify-center px-3'
            )}
          >
            <ArrowLeftFromLine className={cn(
              'h-5 w-5 shrink-0',
              isDark ? 'text-amber-300/60' : 'text-orange-200'
            )} />
            {!sidebarCollapsed && <span>Voltar ao Tenant</span>}
          </NavLink>
        </nav>

        {/* User Info */}
        <div className={cn(
          'px-3 py-4 border-t',
          isDark ? 'border-amber-900/20' : 'border-white/10'
        )}>
          <div className={cn(
            'flex items-center gap-3',
            sidebarCollapsed && 'justify-center'
          )}>
            <Avatar className="h-10 w-10 ring-2 ring-white/20">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-white/10 text-white text-sm font-medium">
                {getInitials(profile?.full_name)}
              </AvatarFallback>
            </Avatar>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {profile?.full_name || 'Super Admin'}
                </p>
                <p className={cn(
                  'text-xs truncate',
                  isDark ? 'text-amber-300/60' : 'text-orange-200'
                )}>
                  Super Administrador
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className={cn(
            'flex items-center gap-2 mt-4',
            sidebarCollapsed && 'flex-col'
          )}>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLogoutDialogOpen(true)}
              className={cn(
                'shrink-0',
                isDark 
                  ? 'text-amber-200/70 hover:bg-amber-500/10 hover:text-amber-200'
                  : 'text-orange-200 hover:bg-white/10 hover:text-white'
              )}
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Toggle Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={cn(
            'absolute -right-4 top-20 h-8 w-8 rounded-full border shadow-md',
            isDark 
              ? 'bg-background border-amber-900/30 text-amber-400 hover:bg-muted'
              : 'bg-white border-orange-200 text-orange-600 hover:bg-orange-50'
          )}
        >
          {sidebarCollapsed ? (
            <Menu className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </aside>

      {/* Mobile overlay */}
      {isMobile && !sidebarCollapsed && (
        <div
          className="fixed inset-0 z-30 bg-foreground/50 backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}

      {/* Main content */}
      <div
        className={cn(
          'flex-1 flex flex-col overflow-hidden transition-all duration-300',
          sidebarCollapsed ? 'md:ml-20' : 'md:ml-[280px]',
          isMobile && 'ml-0'
        )}
      >
        {/* Header */}
        <header className={cn(
          'h-16 flex items-center justify-between px-6 border-b',
          isDark ? 'bg-amber-950/30 border-amber-900/20' : 'bg-amber-50 border-amber-200'
        )}>
          <div className="flex items-center gap-3">
            {isMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              >
                <Menu className="h-5 w-5" />
              </Button>
            )}
            <div className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium',
              isDark
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                : 'bg-amber-100 text-amber-700 border border-amber-200'
            )}>
              <Crown className="h-4 w-4" />
              <span>Modo Administração da Plataforma</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto animate-fade-in">
          <Outlet />
        </main>
      </div>

      {/* Logout Dialog */}
      <LogoutConfirmDialog
        open={logoutDialogOpen}
        onOpenChange={setLogoutDialogOpen}
      />
    </div>
  );
}
