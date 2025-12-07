import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface RoleDefinition {
  id: string;
  role_key: string;
  role_name: string;
  description: string;
  color: string;
  icon: string;
  permissions: Record<string, Record<string, boolean>>;
  order_position: number;
  is_system: boolean;
}

type UserRole = 'admin' | 'supervisor' | 'vendedor' | 'designer';

interface UserProfile {
  id: string;
  role: UserRole | null;
  permissions: Record<string, Record<string, boolean>> | null;
  department_id: string | null;
  is_active: boolean | null;
}

export function usePermissions() {
  const { user } = useAuth();

  // Fetch user profile with role
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile-permissions', user?.id],
    staleTime: 30000, // 30 seconds cache for faster permission updates
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, role, permissions, department_id, is_active')
        .eq('id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as UserProfile | null;
    },
    enabled: !!user?.id,
  });

  // Fetch role definition
  const { data: roleDefinition, isLoading: roleLoading } = useQuery({
    queryKey: ['roleDefinition', profile?.role],
    staleTime: 30000, // 30 seconds cache for faster permission updates
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!profile?.role) return null;
      
      const { data, error } = await supabase
        .from('role_definitions')
        .select('*')
        .eq('role_key', profile.role)
        .maybeSingle();
      
      if (error) throw error;
      return data as RoleDefinition | null;
    },
    enabled: !!profile?.role,
  });

  // Determine if fully loaded (profile + roleDefinition for non-admins)
  const isFullyLoaded = !profileLoading && !!profile && (profile.role === 'admin' || (!roleLoading && !!roleDefinition));

  // Check permission function - returns false while loading for safety
  const hasPermission = (category: string, action: string): boolean => {
    // If not fully loaded yet, deny access for safety
    if (!profile) return false;
    
    // Admin always has all permissions
    if (profile.role === 'admin') return true;
    
    // For non-admins, require roleDefinition to be loaded
    if (!roleDefinition) return false;
    
    // Check user's custom permissions first (overrides)
    if (profile.permissions?.[category]?.[action] !== undefined) {
      return profile.permissions[category][action];
    }
    
    // Fallback to role permissions
    return roleDefinition.permissions?.[category]?.[action] ?? false;
  };

  // Convenience permission checkers
  const can = {
    // Users
    createUsers: () => hasPermission('users', 'create'),
    viewUsers: () => hasPermission('users', 'read'),
    editUsers: () => hasPermission('users', 'update'),
    deleteUsers: () => hasPermission('users', 'delete'),
    
    // Contacts
    createContacts: () => hasPermission('contacts', 'create'),
    viewContacts: () => hasPermission('contacts', 'read'),
    editContacts: () => hasPermission('contacts', 'update'),
    deleteContacts: () => hasPermission('contacts', 'delete'),
    importContacts: () => hasPermission('contacts', 'import'),
    exportContacts: () => hasPermission('contacts', 'export'),
    
    // Conversations
    createConversations: () => hasPermission('conversations', 'create'),
    viewConversations: () => hasPermission('conversations', 'read'),
    transferConversations: () => hasPermission('conversations', 'transfer'),
    closeConversations: () => hasPermission('conversations', 'close'),
    viewAllConversations: () => hasPermission('conversations', 'view_all'),
    
    // Deals
    createDeals: () => hasPermission('deals', 'create'),
    viewDeals: () => hasPermission('deals', 'read'),
    editDeals: () => hasPermission('deals', 'update'),
    deleteDeals: () => hasPermission('deals', 'delete'),
    viewAllDeals: () => hasPermission('deals', 'view_all'),
    
    // Templates
    createTemplates: () => hasPermission('templates', 'create'),
    viewTemplates: () => hasPermission('templates', 'read'),
    editTemplates: () => hasPermission('templates', 'update'),
    deleteTemplates: () => hasPermission('templates', 'delete'),
    
    // Channels
    viewChannels: () => hasPermission('channels', 'read'),
    connectChannels: () => hasPermission('channels', 'connect'),
    
    // Reports
    viewReports: () => hasPermission('reports', 'view'),
    exportReports: () => hasPermission('reports', 'export'),
    viewAllReports: () => hasPermission('reports', 'view_all'),
    
    // Settings
    viewSettings: () => hasPermission('settings', 'view'),
    editSettings: () => hasPermission('settings', 'update'),
    
    // Tags
    createTags: () => hasPermission('tags', 'create'),
    deleteTags: () => hasPermission('tags', 'delete'),
    
    // Queues
    manageQueues: () => hasPermission('queues', 'manage_agents'),
  };

  return {
    profile,
    roleDefinition,
    hasPermission,
    can,
    isAdmin: profile?.role === 'admin',
    isSupervisor: profile?.role === 'supervisor',
    isVendedor: profile?.role === 'vendedor',
    isDesigner: profile?.role === 'designer',
    role: profile?.role,
    isLoading: profileLoading || roleLoading,
    isFullyLoaded, // NEW: indicates when it's safe to check permissions
  };
}

// Hook to fetch all available roles (otimizado)
export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_definitions')
        .select('id, role_key, role_name, description, color, icon, permissions, order_position, is_system')
        .order('order_position');
      
      if (error) throw error;
      return data as RoleDefinition[];
    },
    staleTime: 300000, // 5 minutes cache - roles rarely change
  });
}

// Hook to fetch all users (for admin/supervisor) - otimizado
const USER_FIELDS = `
  id,
  full_name,
  phone,
  role,
  department_id,
  avatar_url,
  is_online,
  is_active,
  is_available,
  current_conversations,
  max_conversations,
  last_seen_at,
  created_at
`;

export function useUsers(search?: string, filterRole?: string) {
  return useQuery({
    queryKey: ['users', search, filterRole],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select(`
          ${USER_FIELDS},
          department:departments(id, name)
        `)
        .order('full_name');
      
      if (search) {
        query = query.or(`full_name.ilike.%${search}%`);
      }
      
      if (filterRole) {
        query = query.eq('role', filterRole);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    staleTime: 30000, // 30 seconds cache
  });
}

// Hook to fetch pending invites
export function usePendingInvites() {
  return useQuery({
    queryKey: ['pendingInvites'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_invites')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
}
