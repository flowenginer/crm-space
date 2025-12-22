import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Profile, AppRole, Tenant } from '@/types';

interface UserState {
  user: { id: string; email?: string } | null;
  session: { access_token: string; user: { id: string } } | null;
  profile: Profile | null;
  tenant: Tenant | null;
  tenantId: string | null;
  roles: AppRole[];
  isLoading: boolean;
  setUser: (user: { id: string; email?: string } | null) => void;
  setSession: (session: { access_token: string; user: { id: string } } | null) => void;
  setProfile: (profile: Profile | null) => void;
  setTenant: (tenant: Tenant | null) => void;
  setTenantId: (tenantId: string | null) => void;
  setRoles: (roles: AppRole[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  reset: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      session: null,
      profile: null,
      tenant: null,
      tenantId: null,
      roles: [],
      isLoading: true,
      setUser: (user) => set({ user }),
      setSession: (session) => set({ session }),
      setProfile: (profile) => set({ profile, tenantId: profile?.tenant_id || null }),
      setTenant: (tenant) => set({ tenant }),
      setTenantId: (tenantId) => set({ tenantId }),
      setRoles: (roles) => set({ roles }),
      setIsLoading: (isLoading) => set({ isLoading }),
      reset: () => set({ 
        user: null, 
        session: null, 
        profile: null, 
        tenant: null,
        tenantId: null,
        roles: [], 
        isLoading: false 
      }),
    }),
    {
      name: 'user-storage',
      partialize: (state) => ({
        profile: state.profile,
        tenant: state.tenant,
        tenantId: state.tenantId,
        roles: state.roles,
      }),
    }
  )
);
