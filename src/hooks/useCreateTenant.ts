import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CreateTenantParams {
  tenantName: string;
  slug: string;
  planType: 'free' | 'pro' | 'enterprise';
  maxUsers: number;
  maxContacts: number;
  trialDays?: number;
  adminEmail: string;
  adminName: string;
  adminPassword: string;
  enabledModules: string[];
}

interface CreateTenantResponse {
  success: boolean;
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  admin: {
    id: string;
    email: string;
    name: string;
  };
}

export function useCreateTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateTenantParams): Promise<CreateTenantResponse> => {
      const { data, error } = await supabase.functions.invoke('create-tenant-admin', {
        body: params
      });

      if (error) {
        throw new Error(error.message || 'Erro ao criar tenant');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      return data as CreateTenantResponse;
    },
    onSuccess: (data) => {
      toast.success(`Tenant "${data.tenant.name}" criado com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['super_admin_tenants'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao criar tenant');
    }
  });
}
