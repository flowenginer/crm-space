import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCurrentTenantId } from "@/hooks/useTenant";

export interface IntegrationAPIKey {
  id: string;
  tenant_id: string;
  name: string;
  api_key: string;
  is_active: boolean | null;
  permissions: {
    send_message?: boolean;
    read_contacts?: boolean;
  } | null;
  created_at: string | null;
  created_by: string | null;
  last_used_at: string | null;
}

// Generate a secure API key
export const generateAPIKey = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let key = 'sk_live_';
  for (let i = 0; i < 48; i++) {
    key += chars[Math.floor(Math.random() * chars.length)];
  }
  return key;
};

// Mask API key for display
export const maskAPIKey = (key: string): string => {
  if (key.length <= 16) return key;
  return key.substring(0, 12) + '...' + key.substring(key.length - 6);
};

export function useIntegrationAPIKeys() {
  const { data: tenantId } = useCurrentTenantId();

  return useQuery({
    queryKey: ["integration-api-keys", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from("integration_api_keys")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      return (data || []) as IntegrationAPIKey[];
    },
    enabled: !!tenantId,
  });
}

export function useCreateIntegrationAPIKey() {
  const queryClient = useQueryClient();
  const { data: tenantId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async (params: {
      name: string;
      permissions: { send_message?: boolean; read_contacts?: boolean };
    }) => {
      if (!tenantId) throw new Error("Tenant não encontrado");

      const apiKey = generateAPIKey();

      const { data, error } = await supabase
        .from("integration_api_keys")
        .insert({
          tenant_id: tenantId,
          name: params.name,
          api_key: apiKey,
          permissions: params.permissions,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return { ...data, api_key: apiKey } as IntegrationAPIKey;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integration-api-keys"] });
      toast.success("API Key criada com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao criar API Key:", error);
      toast.error("Erro ao criar API Key");
    },
  });
}

export function useUpdateIntegrationAPIKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; is_active?: boolean; name?: string }) => {
      const { data, error } = await supabase
        .from("integration_api_keys")
        .update({
          ...(params.is_active !== undefined && { is_active: params.is_active }),
          ...(params.name && { name: params.name }),
        })
        .eq("id", params.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integration-api-keys"] });
      toast.success("API Key atualizada!");
    },
    onError: (error) => {
      console.error("Erro ao atualizar API Key:", error);
      toast.error("Erro ao atualizar API Key");
    },
  });
}

export function useDeleteIntegrationAPIKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("integration_api_keys")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integration-api-keys"] });
      toast.success("API Key excluída!");
    },
    onError: (error) => {
      console.error("Erro ao excluir API Key:", error);
      toast.error("Erro ao excluir API Key");
    },
  });
}
