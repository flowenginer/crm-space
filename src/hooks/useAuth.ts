import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/store/userStore';
import { resetQueryCache } from '@/lib/queryClient';
import type { Profile, AppRole, Tenant } from '@/types';

export function useAuth() {
  const navigate = useNavigate();
  const { 
    user, 
    session, 
    profile, 
    tenant,
    tenantId,
    roles, 
    isLoading,
    setUser, 
    setSession, 
    setProfile, 
    setTenant,
    setTenantId,
    setRoles,
    setIsLoading,
    reset 
  } = useUserStore();

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) {
      setProfile(data as Profile);
      if (data.tenant_id) {
        setTenantId(data.tenant_id);
      }
    }
  }, [setProfile, setTenantId]);

  const fetchTenant = useCallback(async (tenantId: string): Promise<Tenant | null> => {
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (!error && data) {
      setTenant(data as Tenant);
      return data as Tenant;
    }
    return null;
  }, [setTenant]);

  const fetchRoles = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (!error && data) {
      setRoles(data.map((r) => r.role as AppRole));
    }
  }, [setRoles]);

  // Refs para deduplicação de fetches
  const fetchingRef = useRef<string | null>(null);
  const loadedRef = useRef<string | null>(null);

  const loadUserData = useCallback(async (userId: string) => {
    if (fetchingRef.current === userId || loadedRef.current === userId) {
      console.log('[useAuth] Skipping duplicate fetch for userId:', userId);
      return;
    }

    fetchingRef.current = userId;
    console.log('[useAuth] Fetching profile+roles for userId:', userId);

    try {
      const [profileResult, rolesResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single(),
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId),
        supabase
          .from('profiles')
          .update({
            is_available: true,
            is_online: true,
            availability_locked_by: null,
            unavailable_until: null,
            unavailability_reason: null,
          })
          .eq('id', userId),
      ]);

      if (fetchingRef.current !== userId) {
        console.log('[useAuth] Fetch superseded, discarding results for:', userId);
        return;
      }

      if (!rolesResult.error && rolesResult.data) {
        setRoles(rolesResult.data.map((r) => r.role as AppRole));
      }

      if (profileResult.error) {
        console.error('[useAuth] Error fetching profile:', profileResult.error);
        fetchingRef.current = null;
        return;
      }

      const profileData = profileResult.data;
      if (profileData) {
        console.log('[useAuth] Profile loaded:', profileData.id, 'tenant:', profileData.tenant_id);
        setProfile(profileData as Profile);

        if (profileData.tenant_id) {
          setTenantId(profileData.tenant_id);
          const tenantData = await fetchTenant(profileData.tenant_id);

          if (tenantData && tenantData.is_active === false) {
            console.log('[useAuth] Tenant is deactivated, logging out');
            fetchingRef.current = null;
            loadedRef.current = null;
            reset();
            await supabase.auth.signOut();
            window.location.href = '/auth?error=tenant_inactive';
            return;
          }
        }
      }

      loadedRef.current = userId;
      fetchingRef.current = null;
    } catch (err) {
      console.error('[useAuth] Error in loadUserData:', err);
      fetchingRef.current = null;
    }
  }, [setProfile, setTenantId, setRoles, fetchTenant, reset]);

  useEffect(() => {
    let previousUserId: string | null = null;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const currentUserId = session?.user?.id ?? null;

        console.log('[useAuth] onAuthStateChange:', event, 'userId:', currentUserId);

        if (event === 'SIGNED_OUT') {
          console.log('[useAuth] SIGNED_OUT - Clearing all query cache');
          resetQueryCache();
          previousUserId = null;
          fetchingRef.current = null;
          loadedRef.current = null;
        }

        if (event === 'SIGNED_IN') {
          if (previousUserId !== null && previousUserId !== currentUserId) {
            console.log('[useAuth] User changed - Resetting query cache and state');
            reset();
            resetQueryCache();
            loadedRef.current = null;
          } else if (previousUserId === null) {
            console.log('[useAuth] Fresh login - Clearing query cache only');
            resetQueryCache();
          }
        }

        previousUserId = currentUserId;

        setSession(session as any);
        setUser(session?.user as any ?? null);
        setIsLoading(false);

        if (session?.access_token) {
          supabase.realtime.setAuth(session.access_token);
        }

        if (session?.user) {
          loadUserData(session.user.id);
        } else {
          setProfile(null);
          setTenant(null);
          setTenantId(null);
          setRoles([]);
        }
      }
    );

    // getSession: apenas define sessão/usuário, sem fetch duplicado
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session as any);
      setUser(session?.user as any ?? null);

      if (session?.access_token) {
        console.log('[useAuth] Initial session - Syncing Realtime with access token');
        supabase.realtime.setAuth(session.access_token);
      }

      if (!session?.user) {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [setSession, setUser, setIsLoading, setProfile, setTenant, setTenantId, setRoles, loadUserData, reset]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    resetQueryCache();
    const { error } = await supabase.auth.signOut();
    if (!error) {
      reset();
      navigate('/auth');
    }
    return { error };
  };

  const hasRole = (role: AppRole) => roles.includes(role);

  return {
    user,
    session,
    profile,
    tenant,
    tenantId,
    roles,
    isLoading,
    signIn,
    signUp,
    signOut,
    hasRole,
  };
}
