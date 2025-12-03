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
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NavLink } from '@/components/NavLink';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';

const navItems = [
  { title: 'Dashboard', href: '/', icon: LayoutDashboard },
  { title: 'Conversas', href: '/conversations', icon: MessageSquare },
  { title: 'Mensagens Rápidas', href: '/quick-messages', icon: Zap },
  { title: 'CRM', href: '/crm', icon: TrendingUp },
  { title: 'Canais WhatsApp', href: '/whatsapp-channels', icon: Radio },
  { title: 'Contatos', href: '/contacts', icon: Users },
  { title: 'Relatórios', href: '/reports', icon: BarChart3 },
  { title: 'Configurações', href: '/settings', icon: Settings },
];

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const isMobile = useIsMobile();

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
        'fixed left-0 top-0 z-40 flex h-screen flex-col border-r bg-sidebar transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-64',
        isMobile && isCollapsed && '-translate-x-full'
      )}
    >
      {/* Logo Section */}
      <div className="flex h-16 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary shadow-md">
            <Shirt className="h-5 w-5 text-primary-foreground" />
          </div>
          {!isCollapsed && (
            <span className="font-bold text-lg text-sidebar-foreground">
              Space Sports
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {isCollapsed ? (
            <Menu className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;

          return (
            <NavLink
              key={item.href}
              to={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-primary'
              )}
            >
              <Icon className={cn('h-5 w-5 shrink-0', isActive && 'text-sidebar-primary')} />
              {!isCollapsed && <span>{item.title}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="border-t p-3">
        <div
          className={cn(
            'flex items-center gap-3 rounded-lg p-2',
            isCollapsed && 'justify-center'
          )}
        >
          <div className="relative">
            <Avatar className="h-10 w-10 border-2 border-primary/20">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {getInitials(profile?.full_name)}
              </AvatarFallback>
            </Avatar>
            {/* Notification badge */}
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              3
            </span>
          </div>

          {!isCollapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {profile?.full_name || 'Usuário'}
              </p>
              <p className="truncate text-xs text-muted-foreground">Online</p>
            </div>
          )}

          {!isCollapsed && (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
              >
                <Bell className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => signOut()}
                className="h-8 w-8 text-sidebar-foreground hover:bg-destructive hover:text-destructive-foreground"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {isCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => signOut()}
            className="mt-2 h-8 w-8 w-full text-sidebar-foreground hover:bg-destructive hover:text-destructive-foreground"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </div>
    </aside>
  );
}
