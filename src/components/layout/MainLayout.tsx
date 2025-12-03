import { useState, useEffect } from 'react';
import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

// Map routes to page titles
const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/conversations': 'Conversas',
  '/quick-messages': 'Mensagens Rápidas',
  '/crm': 'CRM',
  '/whatsapp-channels': 'Canais WhatsApp',
  '/contacts': 'Contatos',
  '/reports': 'Relatórios',
  '/settings': 'Configurações',
};

export function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();
  const { session, isLoading } = useAuth();
  const isMobile = useIsMobile();

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

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center gradient-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Redirect to auth if not logged in
  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  const pageTitle = pageTitles[location.pathname] || 'Space Sports CRM';

  return (
    <div className="min-h-screen gradient-background">
      {/* Sidebar */}
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Mobile overlay */}
      {isMobile && !sidebarCollapsed && (
        <div
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}

      {/* Main content */}
      <div
        className={cn(
          'min-h-screen transition-all duration-300',
          sidebarCollapsed ? 'md:pl-16' : 'md:pl-64',
          isMobile && 'pl-0'
        )}
      >
        <Header
          title={pageTitle}
          onMenuClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
