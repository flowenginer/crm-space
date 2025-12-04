import { usePermissions } from '@/hooks/usePermissions';
import { ReactNode } from 'react';
import { Lock } from 'lucide-react';

interface PermissionGateProps {
  children: ReactNode;
  permission?: string; // Ex: 'contacts.create'
  roles?: ('admin' | 'supervisor' | 'vendedor' | 'designer')[];
  fallback?: ReactNode;
  showLock?: boolean;
}

export function PermissionGate({ 
  children, 
  permission, 
  roles,
  fallback = null,
  showLock = false
}: PermissionGateProps) {
  const { hasPermission, role, isLoading } = usePermissions();

  // While loading, show nothing or loading state
  if (isLoading) {
    return null;
  }

  // Check by role
  if (roles && roles.length > 0) {
    if (!role || !roles.includes(role)) {
      if (showLock) {
        return (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Lock size={14} />
            <span className="text-sm">Sem permissão</span>
          </div>
        );
      }
      return <>{fallback}</>;
    }
  }

  // Check by specific permission
  if (permission) {
    const [category, action] = permission.split('.');
    if (!hasPermission(category, action)) {
      if (showLock) {
        return (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Lock size={14} />
            <span className="text-sm">Sem permissão</span>
          </div>
        );
      }
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
}

// Access denied page component
export function AccessDenied() {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-destructive/10 flex items-center justify-center">
          <Lock size={40} className="text-destructive" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Acesso Negado
        </h2>
        <p className="text-muted-foreground max-w-md">
          Você não tem permissão para acessar esta página. Entre em contato com o administrador se precisar de acesso.
        </p>
      </div>
    </div>
  );
}

// HOC to protect entire pages
export function withPermission<P extends object>(
  Component: React.ComponentType<P>,
  permission: string
) {
  return function WrappedComponent(props: P) {
    const { hasPermission, isLoading } = usePermissions();
    
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      );
    }

    const [category, action] = permission.split('.');
    if (!hasPermission(category, action)) {
      return <AccessDenied />;
    }

    return <Component {...props} />;
  };
}

// HOC to protect by role
export function withRole<P extends object>(
  Component: React.ComponentType<P>,
  allowedRoles: ('admin' | 'supervisor' | 'vendedor' | 'designer')[]
) {
  return function WrappedComponent(props: P) {
    const { role, isLoading } = usePermissions();
    
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      );
    }

    if (!role || !allowedRoles.includes(role)) {
      return <AccessDenied />;
    }

    return <Component {...props} />;
  };
}
