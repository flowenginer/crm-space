import { useEffect, useCallback } from 'react';
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
        }
        
        if (event === 'SIGNED_IN') {
          if (previousUserId !== null && previousUserId !== currentUserId) {
            console.log('[useAuth] User changed - Resetting query cache and state');
            reset();
            resetQueryCache();
          } else if (previousUserId === null) {
            console.log('[useAuth] Fresh login - Clearing query cache only');
            resetQueryCache();
          }
        }
        
        previousUserId = currentUserId;
        
        setSession(session as any);
        setUser(session?.user as any ?? null);
        setIsLoading(false);

        // Sincronizar token com Realtime para RLS funcionar corretamente
        if (session?.access_token) {
          console.log('[useAuth] Syncing Realtime with access token');
          supabase.realtime.setAuth(session.access_token);
        }

        // Garantir sincronização em TOKEN_REFRESHED
        if (event === 'TOKEN_REFRESHED' && session?.access_token) {
          console.log('[useAuth] TOKEN_REFRESHED - Re-syncing Realtime');
          supabase.realtime.setAuth(session.access_token);
        }

        // Execute auth setup without setTimeout for faster loading
        if (session?.user) {
          (async () => {
            try {
              const userId = session.user.id;
              
              // Parallel fetch: profile, roles, and update availability simultaneously
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
                // Fire-and-forget: update availability status
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
              
              // Process roles
              if (!rolesResult.error && rolesResult.data) {
                setRoles(rolesResult.data.map((r) => r.role as AppRole));
              }
              
              // Process profile
              if (profileResult.error) {
                console.error('[useAuth] Error fetching profile:', profileResult.error);
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
                    reset();
                    await supabase.auth.signOut();
                    window.location.href = '/auth?error=tenant_inactive';
                    return;
                  }
                }
              }
            } catch (err) {
              console.error('[useAuth] Error in auth state handler:', err);
            }
          })();
        } else {
          setProfile(null);
          setTenant(null);
          setTenantId(null);
          setRoles([]);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session as any);
      setUser(session?.user as any ?? null);
      setIsLoading(false);

      // Sincronizar token com Realtime para RLS funcionar
      if (session?.access_token) {
        console.log('[useAuth] Initial session - Syncing Realtime with access token');
        supabase.realtime.setAuth(session.access_token);
      }

      if (session?.user) {
        const userId = session.user.id;
        
        // Parallel fetch: profile and roles
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
        ]);
        
        // Process roles
        if (!rolesResult.error && rolesResult.data) {
          setRoles(rolesResult.data.map((r) => r.role as AppRole));
        }
        
        // Process profile
        const profileData = profileResult.data;
        if (profileData) {
          setProfile(profileData as Profile);
          
          if (profileData.tenant_id) {
            setTenantId(profileData.tenant_id);
            const tenantData = await fetchTenant(profileData.tenant_id);
            
            if (tenantData && tenantData.is_active === false) {
              console.log('[useAuth] Tenant is deactivated on initial load, logging out');
              reset();
              await supabase.auth.signOut();
              window.location.href = '/auth?error=tenant_inactive';
              return;
            }
          }
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [setSession, setUser, setIsLoading, setProfile, setTenant, setTenantId, setRoles, fetchProfile, fetchTenant, fetchRoles]);

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
