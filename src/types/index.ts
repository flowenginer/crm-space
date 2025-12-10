// User types
export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  signature_name: string | null;
  signature_enabled: boolean | null;
  role: string | null;
  department_id: string | null;
  is_active: boolean | null;
  is_available: boolean | null;
  is_online: boolean | null;
  phone: string | null;
  max_conversations: number | null;
  current_conversations: number | null;
  can_view_all_conversations: boolean | null;
  can_transfer_freely: boolean | null;
  created_at: string;
  updated_at: string;
}

export type AppRole = 'admin' | 'user' | 'manager' | 'supervisor' | 'seller';

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

// Navigation types
export interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}
