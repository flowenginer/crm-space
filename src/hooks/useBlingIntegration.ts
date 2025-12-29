import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BlingConfig {
  id: string;
  tenant_id: string;
  client_id: string | null;
  client_secret: string | null;
  is_active: boolean;
  is_configured: boolean;
  sync_contacts: boolean;
  sync_orders: boolean;
  sync_products: boolean;
  sync_quotes: boolean;
  sync_statuses: boolean;
  auto_sync_enabled: boolean;
  sync_interval_hours: number;
  last_sync_at: string | null;
  token_expires_at: string | null;
}

export interface BlingSyncLog {
  id: string;
  sync_type: string;
  entity_type: string | null;
  direction: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  total_records: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  error_count: number;
}

// Hook to fetch Bling configuration
export function useBlingConfig() {
  return useQuery({
    queryKey: ['bling-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bling_integration_config')
        .select('*')
        .maybeSingle();

      if (error) throw error;
      return data as BlingConfig | null;
    },
  });
}

// Hook to check if Bling is active
export function useBlingStatus() {
  const { data: config, isLoading } = useBlingConfig();

  const isConnected = config?.is_active && config?.is_configured && 
    (config.token_expires_at ? new Date(config.token_expires_at) > new Date() : false);

  return {
    isLoading,
    isConnected,
    isConfigured: config?.is_configured || false,
    needsRefresh: config?.is_configured && config.token_expires_at && 
      new Date(config.token_expires_at) < new Date(),
  };
}

// Hook to create/update Bling configuration
export function useBlingConfigMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (configData: Partial<BlingConfig>) => {
      // Check if config exists
      const { data: existing } = await supabase
        .from('bling_integration_config')
        .select('id')
        .maybeSingle();

      if (existing) {
        // Update existing
        const { data, error } = await supabase
          .from('bling_integration_config')
          .update(configData)
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new
        const { data, error } = await supabase
          .from('bling_integration_config')
          .insert(configData)
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bling-config'] });
    },
    onError: (error) => {
      console.error('Error saving Bling config:', error);
      toast.error('Erro ao salvar configuração do Bling');
    },
  });
}

// Hook to start OAuth flow
export function useStartBlingOAuth() {
  return useMutation({
    mutationFn: async ({ clientId, clientSecret }: { clientId: string; clientSecret: string }) => {
      // First, save the credentials
      const { data: existing } = await supabase
        .from('bling_integration_config')
        .select('id, tenant_id')
        .maybeSingle();

      const tenantId = existing?.tenant_id || '00000000-0000-0000-0000-000000000001';

      if (existing) {
        await supabase
          .from('bling_integration_config')
          .update({ client_id: clientId, client_secret: clientSecret })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('bling_integration_config')
          .insert({ client_id: clientId, client_secret: clientSecret });
      }

      // Get the OAuth URL from edge function
      const redirectUri = `${window.location.origin}/settings?tab=integrations&bling=callback`;
      
      const response = await supabase.functions.invoke('bling-oauth', {
        body: null,
        headers: {},
      });

      // Build the request URL manually since we need query params for GET
      const { data, error } = await supabase.functions.invoke('bling-oauth?action=authorize&tenant_id=' + tenantId + '&redirect_uri=' + encodeURIComponent(redirectUri) + '&client_id=' + encodeURIComponent(clientId));

      if (error) throw error;
      return data;
    },
    onError: (error) => {
      console.error('Error starting OAuth:', error);
      toast.error('Erro ao iniciar autenticação com Bling');
    },
  });
}

// Hook to disconnect Bling
export function useDisconnectBling() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data: config } = await supabase
        .from('bling_integration_config')
        .select('tenant_id')
        .maybeSingle();

      if (!config) throw new Error('Config not found');

      const { error } = await supabase.functions.invoke('bling-oauth', {
        body: { tenant_id: config.tenant_id },
        headers: {},
      });

      // Since we can't easily pass action in body, update directly
      const { error: updateError } = await supabase
        .from('bling_integration_config')
        .update({
          access_token: null,
          refresh_token: null,
          token_expires_at: null,
          is_active: false,
          is_configured: false,
        })
        .eq('tenant_id', config.tenant_id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bling-config'] });
      toast.success('Bling desconectado com sucesso');
    },
    onError: (error) => {
      console.error('Error disconnecting:', error);
      toast.error('Erro ao desconectar Bling');
    },
  });
}

// Hook to fetch sync logs
export function useBlingLogs(limit = 10) {
  return useQuery({
    queryKey: ['bling-sync-logs', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bling_sync_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as BlingSyncLog[];
    },
  });
}

// Hook to trigger manual sync (placeholder for Phase 2)
export function useTriggerBlingSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entityType?: string) => {
      // This will be implemented in Phase 2
      toast.info('Sincronização será implementada na Fase 2');
      return { message: 'Sync not yet implemented' };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bling-sync-logs'] });
    },
  });
}
