// User types
export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
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
