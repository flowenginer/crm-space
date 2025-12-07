import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface UserSession {
  id: string;
  user_id: string;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  ip_address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  session_token: string;
  is_current: boolean | null;
  created_at: string | null;
  last_activity_at: string | null;
  expires_at: string | null;
  ended_at: string | null;
  user_agent: string | null;
}

export function useUserSessions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-sessions', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', user.id)
        .is('ended_at', null)
        .order('is_current', { ascending: false })
        .order('last_activity_at', { ascending: false });

      if (error) {
        console.error('Error fetching sessions:', error);
        throw error;
      }
      
      return data as UserSession[];
    },
    enabled: !!user?.id,
    staleTime: 30000, // 30 seconds
  });
}

export function useEndSession() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from('user_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', sessionId)
        .eq('user_id', user?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-sessions'] });
    },
  });
}

export function useEndOtherSessions() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      // End all sessions except the current one
      const { error } = await supabase
        .from('user_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('user_id', user?.id)
        .eq('is_current', false)
        .is('ended_at', null);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-sessions'] });
    },
  });
}

// Function to register session after login
export async function registerSession(): Promise<{ success: boolean; sessionToken?: string; error?: string } | null> {
  try {
    console.log('Calling register-session edge function...');
    
    const { data, error } = await supabase.functions.invoke('register-session', {
      body: { userAgent: navigator.userAgent }
    });

    console.log('Register session response:', { data, error });

    if (error) {
      console.error('Failed to register session:', error);
      return { success: false, error: error.message };
    }

    // Store session token in localStorage for later reference
    if (data?.sessionToken) {
      localStorage.setItem('session_token', data.sessionToken);
    }

    return { success: true, sessionToken: data?.sessionToken };
  } catch (err) {
    console.error('Error registering session:', err);
    return { success: false, error: String(err) };
  }
}
