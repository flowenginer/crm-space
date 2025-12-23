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
      // Also set tenantId from profile
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
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const currentUserId = session?.user?.id ?? null;
        
        // Only log and process if there's an actual change
        console.log('[useAuth] onAuthStateChange:', event, 'userId:', currentUserId);
        
        // CRITICAL: Clear React Query cache on SIGNED_OUT
        if (event === 'SIGNED_OUT') {
          console.log('[useAuth] SIGNED_OUT - Clearing all query cache');
          resetQueryCache();
          previousUserId = null;
        }
        
        // Only reset cache on SIGNED_IN if user actually changed (not TOKEN_REFRESHED with same user)
        if (event === 'SIGNED_IN') {
          // Only reset if this is a different user than before
          if (previousUserId !== null && previousUserId !== currentUserId) {
            console.log('[useAuth] User changed - Resetting query cache and state');
            resetQueryCache();
            setProfile(null);
            setTenant(null);
            setTenantId(null);
            setRoles([]);
          }
        }
        
        // TOKEN_REFRESHED should NOT reset cache - it's the same session
        // This was causing constant refreshes when the token auto-renewed
        
        previousUserId = currentUserId;
        
        setSession(session as any);
        setUser(session?.user as any ?? null);
        setIsLoading(false);

        // Defer Supabase calls with setTimeout to prevent deadlock
        if (session?.user) {
          setTimeout(async () => {
            try {
              // Auto-activate on login: set available, online, and clear locks
              await supabase
                .from('profiles')
                .update({
                  is_available: true,
                  is_online: true,
                  availability_locked_by: null,
                  unavailable_until: null,
                  unavailability_reason: null,
                })
                .eq('id', session.user.id);
              
              // Fetch profile first, then tenant and roles
              const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();
              
              if (profileError) {
                console.error('[useAuth] Error fetching profile:', profileError);
                return;
              }
              
              if (profileData) {
                console.log('[useAuth] Profile loaded:', profileData.id, 'tenant:', profileData.tenant_id);
                setProfile(profileData as Profile);
                
                // FASE 2: Verificar se está no tenant default sem ser super admin
                const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
                if (profileData.tenant_id === DEFAULT_TENANT_ID) {
                  // Verificar se é super admin
                  const { data: isSuperAdmin } = await supabase.rpc('current_user_is_super_admin');
                  if (!isSuperAdmin) {
                    console.log('[useAuth] User in default tenant without super admin role, logging out');
                    reset();
                    await supabase.auth.signOut();
                    window.location.href = '/auth?error=invalid_tenant';
                    return;
                  }
                }
                
                if (profileData.tenant_id) {
                  setTenantId(profileData.tenant_id);
                  const tenantData = await fetchTenant(profileData.tenant_id);
                  
                  // FASE 2: Validar se o tenant está ativo
                  if (tenantData && tenantData.is_active === false) {
                    console.log('[useAuth] Tenant is deactivated, logging out');
                    reset();
                    await supabase.auth.signOut();
                    window.location.href = '/auth?error=tenant_inactive';
                    return;
                  }
                }
              }
              
              fetchRoles(session.user.id);
            } catch (err) {
              console.error('[useAuth] Error in auth state handler:', err);
            }
          }, 0);
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

      if (session?.user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (profileData) {
          setProfile(profileData as Profile);
          
          // FASE 2: Verificar se está no tenant default sem ser super admin
          const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
          if (profileData.tenant_id === DEFAULT_TENANT_ID) {
            const { data: isSuperAdmin } = await supabase.rpc('current_user_is_super_admin');
            if (!isSuperAdmin) {
              console.log('[useAuth] User in default tenant without super admin role on initial load, logging out');
              reset();
              await supabase.auth.signOut();
              window.location.href = '/auth?error=invalid_tenant';
              return;
            }
          }
          
          if (profileData.tenant_id) {
            setTenantId(profileData.tenant_id);
            const tenantData = await fetchTenant(profileData.tenant_id);
            
            // FASE 2: Validar se o tenant está ativo (check inicial)
            if (tenantData && tenantData.is_active === false) {
              console.log('[useAuth] Tenant is deactivated on initial load, logging out');
              reset();
              await supabase.auth.signOut();
              window.location.href = '/auth?error=tenant_inactive';
              return;
            }
          }
        }
        
        fetchRoles(session.user.id);
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
    // Clear query cache BEFORE signing out to prevent any stale data
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
