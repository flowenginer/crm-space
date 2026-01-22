import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface PublicCompanySettings {
  logo_url: string | null;
  company_name: string | null;
}

/**
 * Hook para buscar configurações públicas da empresa (logo e nome)
 * Pode ser usado em páginas públicas como login e registro
 */
export function usePublicCompanySettings() {
  return useQuery({
    queryKey: ['public_company_settings'],
    queryFn: async (): Promise<PublicCompanySettings> => {
      const { data, error } = await supabase
        .from('company_settings')
        .select('logo_url, company_name')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching public company settings:', error);
        return { logo_url: null, company_name: null };
      }

      return {
        logo_url: data?.logo_url || null,
        company_name: data?.company_name || null,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  });
}
