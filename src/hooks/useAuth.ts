import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/store/userStore';
import type { Profile, AppRole } from '@/types';

export function useAuth() {
  const navigate = useNavigate();
  const { 
    user, 
    session, 
    profile, 
    roles, 
    isLoading,
    setUser, 
    setSession, 
    setProfile, 
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
    }
  }, [setProfile]);

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
        setSession(session as any);
        setUser(session?.user as any ?? null);
        setIsLoading(false);

        // Defer Supabase calls with setTimeout to prevent deadlock
        if (session?.user) {
          setTimeout(async () => {
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
            
            fetchProfile(session.user.id);
            fetchRoles(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session as any);
      setUser(session?.user as any ?? null);
      setIsLoading(false);

      if (session?.user) {
        fetchProfile(session.user.id);
        fetchRoles(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [setSession, setUser, setIsLoading, setProfile, setRoles, fetchProfile, fetchRoles]);

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
    roles,
    isLoading,
    signIn,
    signUp,
    signOut,
    hasRole,
  };
}
