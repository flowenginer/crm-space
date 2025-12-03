import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Profile, AppRole } from '@/types';

interface UserState {
  user: { id: string; email?: string } | null;
  session: { access_token: string; user: { id: string } } | null;
  profile: Profile | null;
  roles: AppRole[];
  isLoading: boolean;
  setUser: (user: { id: string; email?: string } | null) => void;
  setSession: (session: { access_token: string; user: { id: string } } | null) => void;
  setProfile: (profile: Profile | null) => void;
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
      roles: [],
      isLoading: true,
      setUser: (user) => set({ user }),
      setSession: (session) => set({ session }),
      setProfile: (profile) => set({ profile }),
      setRoles: (roles) => set({ roles }),
      setIsLoading: (isLoading) => set({ isLoading }),
      reset: () => set({ user: null, session: null, profile: null, roles: [], isLoading: false }),
    }),
    {
      name: 'user-storage',
      partialize: (state) => ({
        profile: state.profile,
        roles: state.roles,
      }),
    }
  )
);
