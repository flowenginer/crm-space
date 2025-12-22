import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useCurrentUserIsSuperAdmin } from '@/hooks/useSuperAdminTenants';
import { Loader2 } from 'lucide-react';

interface SuperAdminGuardProps {
  children: ReactNode;
}

export function SuperAdminGuard({ children }: SuperAdminGuardProps) {
  const { data: isSuperAdmin, isLoading } = useCurrentUserIsSuperAdmin();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
