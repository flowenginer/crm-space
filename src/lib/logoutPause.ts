import type { supabase } from '@/integrations/supabase/client';

type Client = typeof supabase;

// Marca a pausa feita pelo logout, para o próximo login saber que pode desfazê-la.
export const LOGOUT_PAUSE_REASON = 'Saiu do sistema';

// Só pausa quem estava recebendo: pausa manual ou de admin fica intacta.
export async function pauseOnLogout(client: Client, userId: string): Promise<void> {
  const { error } = await client
    .from('profiles')
    .update({ is_available: false, unavailability_reason: LOGOUT_PAUSE_REASON })
    .eq('id', userId)
    .eq('is_available', true);
  if (error) throw error;
}

// Desfaz apenas a pausa do logout; trava de admin e pausa manual continuam valendo.
export async function resumeAfterLogoutPause(client: Client, userId: string): Promise<void> {
  const { error } = await client
    .from('profiles')
    .update({ is_available: true, unavailability_reason: null, unavailable_until: null })
    .eq('id', userId)
    .eq('is_available', false)
    .eq('unavailability_reason', LOGOUT_PAUSE_REASON)
    .is('availability_locked_by', null);
  if (error) throw error;
}
