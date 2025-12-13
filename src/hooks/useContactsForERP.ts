import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ERPContact {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  cpf_cnpj: string | null;
  zip_code: string | null;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
}

export function useContactsForERP(searchTerm: string = '') {
  return useQuery({
    queryKey: ['contacts-erp', searchTerm],
    queryFn: async (): Promise<ERPContact[]> => {
      const { data, error } = await supabase.rpc('search_contacts_for_erp', {
        search_term: searchTerm,
        result_limit: 50,
      });

      if (error) {
        console.error('Erro ao buscar contatos para ERP:', error);
        throw error;
      }

      return (data || []) as ERPContact[];
    },
    staleTime: 30000, // 30 segundos
  });
}
