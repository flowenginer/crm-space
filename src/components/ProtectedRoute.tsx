import { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { AccessDenied } from '@/components/PermissionGate';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  permission?: string; // format: 'category.action'
  roles?: string[]; // Aceita qualquer role
}

export function ProtectedRoute({ children, permission, roles }: ProtectedRouteProps) {
  const { hasPermission, role, isLoading, isAdmin, isFullyLoaded } = usePermissions();

  // Show loading while checking permissions (wait for full load including roleDefinition)
  if (isLoading || !isFullyLoaded) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Admin always has access
  if (isAdmin) {
    return <>{children}</>;
  }

  // Check by role
  if (roles && roles.length > 0) {
    if (!role || !roles.includes(role)) {
      return <AccessDenied />;
    }
  }

  // Check by specific permission
  if (permission) {
    const [category, action] = permission.split('.');
    if (!hasPermission(category, action)) {
      return <AccessDenied />;
    }
  }

  return <>{children}</>;
}

export default ProtectedRoute;
