import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { useUserStore } from '@/store/userStore';
import { AccessDenied } from '@/components/PermissionGate';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  permission?: string; // format: 'category.action'
  roles?: string[]; // Aceita qualquer role
  requireTenant?: boolean; // Default true - requires user to have a tenant
}

export function ProtectedRoute({ 
  children, 
  permission, 
  roles,
  requireTenant = true 
}: ProtectedRouteProps) {
  const { hasPermission, role, isLoading, isAdmin, isFullyLoaded } = usePermissions();
  const { profile, tenantId } = useUserStore();
  const location = useLocation();

  // Show loading while checking permissions (wait for full load including roleDefinition)
  if (isLoading || !isFullyLoaded) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Check if user needs to complete tenant onboarding
  if (requireTenant && profile && !tenantId) {
    // Don't redirect if already on onboarding
    if (location.pathname !== '/onboarding') {
      return <Navigate to="/onboarding" replace />;
    }
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
