import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/store/userStore';
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

  const fetchTenant = useCallback(async (tenantId: string) => {
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (!error && data) {
      setTenant(data as Tenant);
    }
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
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[useAuth] onAuthStateChange:', event, session?.user?.id);
        
        // CRITICAL: Clear old state BEFORE setting new session to prevent ghost data
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // Reset state immediately to prevent stale data from previous session
          setProfile(null);
          setTenant(null);
          setTenantId(null);
          setRoles([]);
        }
        
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
                if (profileData.tenant_id) {
                  setTenantId(profileData.tenant_id);
                  fetchTenant(profileData.tenant_id);
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
          if (profileData.tenant_id) {
            setTenantId(profileData.tenant_id);
            fetchTenant(profileData.tenant_id);
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
