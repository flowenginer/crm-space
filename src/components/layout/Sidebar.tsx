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
        'fixed left-0 top-0 z-40 flex h-screen flex-col sidebar-gradient shadow-2xl transition-all duration-300',
        isCollapsed ? 'w-20' : 'w-[280px]',
        isMobile && isCollapsed && '-translate-x-full'
      )}
    >
      {/* Logo Section */}
      <div className="flex h-20 items-center justify-between px-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-lg">
            <Shirt className="h-6 w-6 text-purple-600" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-lg text-white tracking-tight">
                Space Sports
              </span>
              <span className="text-xs text-purple-200">
                CRM Pro
              </span>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-9 w-9 text-white hover:bg-white/10 transition-colors"
        >
          {isCollapsed ? (
            <Menu className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 px-3">
        <div className="space-y-1.5">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;

            return (
              <NavLink
                key={item.href}
                to={item.href}
                className={cn(
                  'group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-white/20 text-white shadow-lg border-l-4 border-white'
                    : 'text-purple-100 hover:bg-white/10 hover:text-white hover:scale-[1.02]',
                  isCollapsed && 'justify-center px-3'
                )}
              >
                <Icon className={cn(
                  'h-5 w-5 shrink-0 transition-transform',
                  isActive ? 'text-white' : 'text-purple-200 group-hover:text-white'
                )} />
                {!isCollapsed && <span>{item.title}</span>}
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* User Section */}
      <div className="p-4">
        <div
          className={cn(
            'rounded-xl glass border border-white/20 p-3 transition-all',
            isCollapsed && 'flex flex-col items-center gap-2'
          )}
        >
          <div className={cn(
            'flex items-center',
            isCollapsed ? 'flex-col gap-2' : 'gap-3'
          )}>
            {/* Avatar with notification badge */}
            <div className="relative">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-purple-600 font-semibold text-sm border-2 border-white shadow-lg">
                {getInitials(profile?.full_name)}
              </div>
              {/* Notification badge */}
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-purple-600 shadow-md">
                3
              </span>
            </div>

            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {profile?.full_name || 'Usuário'}
                </p>
                <p className="truncate text-xs text-purple-200 flex items-center gap-1">
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
                  className="h-9 w-9 text-white hover:bg-white/10 transition-colors"
                >
                  <Bell className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => signOut()}
                  className="h-9 w-9 text-white hover:bg-red-500/30 transition-colors"
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
              className="h-9 w-9 text-white hover:bg-red-500/30 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
