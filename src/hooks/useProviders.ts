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
  // Novos campos para criação automática de instâncias
  admin_token?: string | null;
  client_token?: string | null;
  is_configured?: boolean;
  is_shared?: boolean;
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

// Hook para buscar apenas provedores configurados
export function useConfiguredProviders() {
  return useQuery({
    queryKey: ['whatsapp-providers-configured'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_providers')
        .select('*')
        .eq('is_active', true)
        .eq('is_configured', true)
        .order('name');

      if (error) throw error;
      return data as WhatsAppProvider[];
    },
  });
}

// Hook para buscar o provedor compartilhado padrão (UAZAPI global)
export function useDefaultSharedProvider() {
  return useQuery({
    queryKey: ['whatsapp-default-shared-provider'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_providers')
        .select('*')
        .eq('is_active', true)
        .eq('is_configured', true)
        .eq('is_shared', true)
        .maybeSingle();

      if (error) throw error;
      return data as WhatsAppProvider | null;
    },
  });
}
