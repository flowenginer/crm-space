import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WhatsAppProvider {
  id: string;
  name: string;
  code: 'zapi' | 'uazapi' | 'evolution';
  base_url: string;
  api_key: string | null;
  api_secret: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useProviders() {
  return useQuery({
    queryKey: ['whatsapp-providers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_providers')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as WhatsAppProvider[];
    },
  });
}
