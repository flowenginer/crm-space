import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type BlingImportEntityType = 'products' | 'contacts' | 'orders' | 'financial';

export interface BlingDependency {
  type: 'account' | 'category' | 'cost_center';
  name: string;
  blingId: string;
  existsLocally: boolean;
}

export interface BlingPreviewItem {
  id: string;
  name: string;
  code?: string;
  isNew: boolean;
  date?: string;
  value?: number;
  dependencies?: BlingDependency[];
}

export interface BlingPreviewResult {
  items: BlingPreviewItem[];
  summary: {
    total: number;
    new: number;
    existing: number;
  };
  dependencies?: BlingDependency[];
}

export interface BlingImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  dependenciesCreated?: number;
}

export interface BlingConfig {
  id: string;
  tenant_id: string;
  client_id: string | null;
  client_secret: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
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
  next_sync_at: string | null;
  webhook_url: string | null;
  webhook_secret: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlingStatusMapping {
  id: string;
  tenant_id: string;
  entity_type: 'order' | 'quote';
  bling_status_id: string;
  bling_status_name: string;
  local_status: string;
  color: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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

// Hook to refresh Bling token manually
export function useRefreshBlingToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('bling-token-refresh');

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bling-config'] });
      toast.success('Token renovado com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Error refreshing token:', error);
      toast.error('Erro ao renovar token: ' + error.message);
    },
  });
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

// Hook to trigger manual sync
export function useTriggerBlingSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entityType?: 'contacts' | 'orders' | 'products' | 'quotes' | 'all') => {
      // Get config to get tenant_id
      const { data: config } = await supabase
        .from('bling_integration_config')
        .select('tenant_id')
        .maybeSingle();

      if (!config?.tenant_id) {
        throw new Error('Bling not configured');
      }

      const { data, error } = await supabase.functions.invoke('bling-sync', {
        body: {
          tenant_id: config.tenant_id,
          entity_type: entityType || 'all',
          direction: 'bidirectional',
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bling-sync-logs'] });
      queryClient.invalidateQueries({ queryKey: ['bling-config'] });
      
      const summary = data?.summary;
      if (summary) {
        toast.success(
          `Sincronização concluída: ${summary.created} criados, ${summary.updated} atualizados${summary.errors > 0 ? `, ${summary.errors} erros` : ''}`
        );
      } else {
        toast.success('Sincronização concluída');
      }
    },
    onError: (error) => {
      console.error('Sync error:', error);
      toast.error('Erro ao sincronizar com Bling');
    },
  });
}

// Hook to fetch status mappings
export function useBlingStatusMappings(entityType?: 'order' | 'quote') {
  return useQuery({
    queryKey: ['bling-status-mappings', entityType],
    queryFn: async () => {
      let query = supabase
        .from('bling_status_mappings')
        .select('*')
        .order('bling_status_id', { ascending: true });

      if (entityType) {
        query = query.eq('entity_type', entityType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as BlingStatusMapping[];
    },
  });
}

// Hook to manage status mappings
export function useBlingStatusMappingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (mappings: Array<{
      entity_type: 'order' | 'quote';
      bling_status_id: string;
      bling_status_name: string;
      local_status: string;
      color?: string | null;
      is_active?: boolean;
    }>) => {
      // Get tenant_id
      const { data: config } = await supabase
        .from('bling_integration_config')
        .select('tenant_id')
        .maybeSingle();

      if (!config?.tenant_id) {
        throw new Error('Bling not configured');
      }

      // Upsert all mappings
      const mappingsWithTenant = mappings.map(m => ({
        ...m,
        tenant_id: config.tenant_id,
      }));

      const { data, error } = await supabase
        .from('bling_status_mappings')
        .upsert(mappingsWithTenant, { 
          onConflict: 'tenant_id,entity_type,bling_status_id',
          ignoreDuplicates: false,
        })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bling-status-mappings'] });
      toast.success('Mapeamentos de status salvos');
    },
    onError: (error) => {
      console.error('Error saving status mappings:', error);
      toast.error('Erro ao salvar mapeamentos');
    },
  });
}

// Hook to initialize default Bling status mappings
export function useInitializeBlingStatusMappings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Get tenant_id
      const { data: config } = await supabase
        .from('bling_integration_config')
        .select('tenant_id')
        .maybeSingle();

      if (!config?.tenant_id) {
        throw new Error('Bling not configured');
      }

      // Default Bling status mappings for orders
      const defaultMappings: Omit<BlingStatusMapping, 'id' | 'created_at' | 'updated_at'>[] = [
        { tenant_id: config.tenant_id, entity_type: 'order', bling_status_id: '0', bling_status_name: 'Em aberto', local_status: 'pending', color: '#f59e0b', is_active: true },
        { tenant_id: config.tenant_id, entity_type: 'order', bling_status_id: '1', bling_status_name: 'Atendido', local_status: 'completed', color: '#22c55e', is_active: true },
        { tenant_id: config.tenant_id, entity_type: 'order', bling_status_id: '2', bling_status_name: 'Cancelado', local_status: 'cancelled', color: '#ef4444', is_active: true },
        { tenant_id: config.tenant_id, entity_type: 'order', bling_status_id: '3', bling_status_name: 'Em andamento', local_status: 'in_production', color: '#3b82f6', is_active: true },
        { tenant_id: config.tenant_id, entity_type: 'order', bling_status_id: '4', bling_status_name: 'Venda Agenciada', local_status: 'approved', color: '#8b5cf6', is_active: true },
        { tenant_id: config.tenant_id, entity_type: 'order', bling_status_id: '5', bling_status_name: 'Pronto para envio', local_status: 'ready_to_ship', color: '#06b6d4', is_active: true },
        { tenant_id: config.tenant_id, entity_type: 'order', bling_status_id: '6', bling_status_name: 'Enviado', local_status: 'shipped', color: '#14b8a6', is_active: true },
        { tenant_id: config.tenant_id, entity_type: 'order', bling_status_id: '7', bling_status_name: 'Entregue', local_status: 'delivered', color: '#22c55e', is_active: true },
        { tenant_id: config.tenant_id, entity_type: 'order', bling_status_id: '8', bling_status_name: 'Devolvido', local_status: 'returned', color: '#f97316', is_active: true },
        { tenant_id: config.tenant_id, entity_type: 'order', bling_status_id: '9', bling_status_name: 'Verificado', local_status: 'verified', color: '#a855f7', is_active: true },
        { tenant_id: config.tenant_id, entity_type: 'quote', bling_status_id: '0', bling_status_name: 'Pendente', local_status: 'pending', color: '#f59e0b', is_active: true },
        { tenant_id: config.tenant_id, entity_type: 'quote', bling_status_id: '1', bling_status_name: 'Aprovado', local_status: 'approved', color: '#22c55e', is_active: true },
        { tenant_id: config.tenant_id, entity_type: 'quote', bling_status_id: '2', bling_status_name: 'Recusado', local_status: 'rejected', color: '#ef4444', is_active: true },
      ];

      const { data, error } = await supabase
        .from('bling_status_mappings')
        .upsert(defaultMappings, { 
          onConflict: 'tenant_id,entity_type,bling_status_id',
          ignoreDuplicates: true,
        })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bling-status-mappings'] });
      toast.success('Mapeamentos padrão criados');
    },
    onError: (error) => {
      console.error('Error initializing status mappings:', error);
      toast.error('Erro ao criar mapeamentos padrão');
    },
  });
}

// Hook to preview data from Bling before importing
export function useBlingPreview(entityType: BlingImportEntityType) {
  return useMutation({
    mutationFn: async (filters?: { 
      startDate?: string; 
      endDate?: string;
      mode?: 'all' | 'new_only' | 'update_existing';
      ignoreIncomplete?: boolean;
    }): Promise<BlingPreviewResult> => {
      const { data: config } = await supabase
        .from('bling_integration_config')
        .select('tenant_id')
        .maybeSingle();

      if (!config?.tenant_id) {
        throw new Error('Bling not configured');
      }

      const { data, error } = await supabase.functions.invoke('bling-sync', {
        body: {
          tenant_id: config.tenant_id,
          entity_type: entityType, // Send the actual entity type (including 'financial')
          direction: 'bling_to_local',
          preview_only: true,
          start_date: filters?.startDate,
          end_date: filters?.endDate,
          import_mode: filters?.mode,
          ignore_incomplete: filters?.ignoreIncomplete,
        },
      });

      if (error) throw error;

      // Transform the response into preview format
      const items: BlingPreviewItem[] = (data?.preview || []).map((item: any) => ({
        id: item.id?.toString() || item.bling_id?.toString() || '',
        name: item.nome || item.name || item.fantasia || item.razaoSocial || item.descricao || 'Sem nome',
        code: item.codigo || item.numero || undefined,
        isNew: !item.exists_locally,
        date: item.data || item.dataEmissao || item.vencimento || undefined,
        value: item.valor || item.total || undefined,
        dependencies: item.dependencies,
      }));

      return {
        items,
        summary: {
          total: data?.summary?.total || items.length,
          new: data?.summary?.new || items.filter((i: BlingPreviewItem) => i.isNew).length,
          existing: data?.summary?.existing || items.filter((i: BlingPreviewItem) => !i.isNew).length,
        },
        dependencies: data?.dependencies,
      };
    },
    onError: (error) => {
      console.error('Error fetching preview:', error);
      toast.error('Erro ao carregar preview do Bling');
    },
  });
}

// Helper to check if error is a timeout/network error
function isTimeoutOrNetworkError(error: unknown): boolean {
  if (!error) return false;
  const errorMessage = error instanceof Error ? error.message : String(error);
  return (
    errorMessage.includes('network') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('aborted') ||
    errorMessage.includes('Failed to fetch') ||
    errorMessage.includes('NetworkError') ||
    errorMessage.includes('connection')
  );
}

// Hook to import data from Bling
export function useBlingImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      entityType, 
      mode,
      selectedIds,
      createDependencies,
      ignoreIncomplete,
      dateRange,
    }: { 
      entityType: BlingImportEntityType; 
      mode: 'all' | 'new_only' | 'update_existing';
      selectedIds?: string[];
      createDependencies?: boolean;
      ignoreIncomplete?: boolean;
      dateRange?: { startDate: string; endDate: string };
    }): Promise<BlingImportResult & { wasTimeoutRecovery?: boolean }> => {
      const { data: config } = await supabase
        .from('bling_integration_config')
        .select('tenant_id')
        .maybeSingle();

      if (!config?.tenant_id) {
        throw new Error('Bling not configured');
      }

      try {
        const { data, error } = await supabase.functions.invoke('bling-sync', {
          body: {
            tenant_id: config.tenant_id,
            entity_type: entityType,
            direction: 'bling_to_local',
            import_mode: mode,
            selected_ids: selectedIds,
            create_dependencies: createDependencies,
            ignore_incomplete: ignoreIncomplete,
            start_date: dateRange?.startDate,
            end_date: dateRange?.endDate,
          },
        });

        if (error) throw error;

        return {
          created: data?.summary?.created || 0,
          updated: data?.summary?.updated || 0,
          skipped: data?.summary?.skipped || 0,
          errors: data?.summary?.errors || 0,
          dependenciesCreated: data?.summary?.dependencies_created || 0,
        };
      } catch (error) {
        // Check if it's a timeout/network error - might have succeeded on backend
        if (isTimeoutOrNetworkError(error)) {
          console.log('[useBlingImport] Timeout detected, checking sync log...');
          
          // Wait a moment for the backend to finish
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Check the latest sync log to see if it actually completed
          const { data: lastLog } = await supabase
            .from('bling_sync_logs')
            .select('*')
            .eq('entity_type', entityType)
            .order('started_at', { ascending: false })
            .limit(1)
            .single();
          
          if (lastLog && lastLog.status === 'completed') {
            console.log('[useBlingImport] Timeout recovery: import actually completed!', lastLog);
            return {
              created: lastLog.created_count || 0,
              updated: lastLog.updated_count || 0,
              skipped: lastLog.skipped_count || 0,
              errors: lastLog.error_count || 0,
              wasTimeoutRecovery: true,
            };
          }
          
          // Check if it's still running (started recently)
          if (lastLog && lastLog.status === 'running') {
            const startedAt = new Date(lastLog.started_at);
            const now = new Date();
            const minutesAgo = (now.getTime() - startedAt.getTime()) / 60000;
            
            if (minutesAgo < 5) {
              // Still running, throw a specific error
              throw new Error('IMPORT_STILL_RUNNING');
            }
          }
        }
        
        throw error;
      }
    },
    onSuccess: (data) => {
      // Invalidate relevant queries based on what was imported
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['financial-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['financial-categories'] });
      queryClient.invalidateQueries({ queryKey: ['bling-sync-logs'] });
      queryClient.invalidateQueries({ queryKey: ['bling-config'] });

      const parts = [];
      if (data.created > 0) parts.push(`${data.created} criados`);
      if (data.updated > 0) parts.push(`${data.updated} atualizados`);
      if (data.skipped && data.skipped > 0) parts.push(`${data.skipped} pulados`);
      if (data.dependenciesCreated && data.dependenciesCreated > 0) {
        parts.push(`${data.dependenciesCreated} dependências`);
      }
      if (data.errors > 0) {
        parts.push(`${data.errors} erros`);
      }

      const message = data.wasTimeoutRecovery 
        ? `Importação concluída (conexão recuperada): ${parts.length > 0 ? parts.join(', ') : 'Nenhuma alteração'}`
        : `Importação concluída: ${parts.length > 0 ? parts.join(', ') : 'Nenhuma alteração'}`;
      
      toast.success(message);
    },
    onError: (error) => {
      console.error('Import error:', error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage === 'IMPORT_STILL_RUNNING') {
        toast.info('A importação ainda está em andamento no servidor. Aguarde alguns minutos e verifique os dados.');
      } else {
        toast.error('Erro ao importar dados do Bling');
      }
    },
  });
}

// Hook to check if entity has Bling mapping
export function useBlingMapping(entityType: 'contact' | 'product' | 'order' | 'quote', localId: string) {
  return useQuery({
    queryKey: ['bling-mapping', entityType, localId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bling_id_mappings')
        .select('bling_id, bling_numero, last_synced_at, sync_status')
        .eq('entity_type', entityType)
        .eq('local_id', localId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!localId,
  });
}
