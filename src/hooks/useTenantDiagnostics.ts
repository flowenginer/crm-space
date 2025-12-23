import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UserDiagnostic {
  user_id: string;
  email: string;
  full_name: string;
  tenant_id: string;
  tenant_name: string | null;
  tenant_is_active: boolean | null;
  is_default_tenant: boolean;
  user_role: string;
  is_super_admin: boolean;
  conversation_count: number;
  contact_count: number;
  has_issues: boolean;
  issues: string[];
}

export interface UserWithTenantIssue {
  user_id: string;
  email: string;
  full_name: string;
  tenant_id: string;
  tenant_name: string | null;
  issue_type: string;
  issue_description: string;
}

export function useUsersWithTenantIssues() {
  return useQuery({
    queryKey: ['users_with_tenant_issues'],
    queryFn: async (): Promise<UserWithTenantIssue[]> => {
      const { data, error } = await supabase.rpc('get_users_with_tenant_issues');
      
      if (error) {
        console.error('Error fetching users with issues:', error);
        throw error;
      }
      
      return (data || []) as UserWithTenantIssue[];
    },
  });
}

export function useUserDiagnostics(userId?: string) {
  return useQuery({
    queryKey: ['user_diagnostics', userId],
    queryFn: async (): Promise<UserDiagnostic[]> => {
      const { data, error } = await supabase.rpc('diagnose_user_tenant', {
        p_user_id: userId || null
      });
      
      if (error) {
        console.error('Error fetching user diagnostics:', error);
        throw error;
      }
      
      return (data || []) as UserDiagnostic[];
    },
  });
}

export function useCheckUserTenantStatus(userId: string | undefined) {
  return useQuery({
    queryKey: ['check_user_tenant_status', userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data, error } = await supabase.rpc('check_user_tenant_status', {
        p_user_id: userId
      });
      
      if (error) {
        console.error('Error checking user tenant status:', error);
        throw error;
      }
      
      return data?.[0] || null;
    },
    enabled: !!userId,
  });
}
