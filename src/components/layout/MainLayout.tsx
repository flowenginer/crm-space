import { useState, useEffect } from 'react';
import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { useIncomingCalls } from '@/hooks/useIncomingCalls';
import { IncomingCallNotification } from '@/components/calls/IncomingCallNotification';

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
  const { incomingCall, dismissCall } = useIncomingCalls();

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
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-16 w-16 rounded-2xl icon-gradient animate-pulse"></div>
            <Loader2 className="absolute inset-0 m-auto h-8 w-8 animate-spin text-white" />
          </div>
          <p className="text-muted-foreground font-medium">Carregando...</p>
        </div>
      </div>
    );
  }

  // Redirect to auth if not logged in
  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  const pageTitle = pageTitles[location.pathname] || 'Space Sports CRM';

  // Check if current route is conversations (hide header for more space)
  const isConversationsPage = location.pathname === '/conversations';

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

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
        {!isConversationsPage && (
          <Header
            title={pageTitle}
            onMenuClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        )}
        <main className={cn(
          "flex-1 animate-fade-in",
          isConversationsPage ? "p-0 overflow-hidden" : "p-6 md:p-8 overflow-y-auto"
        )}>
          <Outlet />
        </main>
      </div>

      {/* Incoming call notification */}
      {incomingCall && (
        <IncomingCallNotification 
          call={incomingCall} 
          onDismiss={dismissCall} 
        />
      )}
    </div>
  );
}
