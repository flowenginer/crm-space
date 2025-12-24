import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TenantSyncStatus {
  tenant_id: string;
  tenant_name: string;
  is_active: boolean;
  total_menus: number;
  base_menus: number;
  missing_menus: number;
  sync_percentage: number;
  is_base: boolean;
}

export interface SyncResult {
  tenant_id: string;
  tenant_name: string;
  items_copied: number;
  items_skipped: number;
  total_in_target: number;
}

export interface PlatformSyncConfig {
  base_tenant_id: string;
  base_tenant_name: string;
  auto_sync_enabled: boolean;
  total_tenants: number;
}

// Hook para obter a configuração de sincronização da plataforma
export function usePlatformSyncConfig() {
  return useQuery({
    queryKey: ['platform-sync-config'],
    queryFn: async (): Promise<PlatformSyncConfig | null> => {
      const { data, error } = await supabase.rpc('get_platform_sync_config');
      
      if (error) {
        console.error('[usePlatformSyncConfig] Error:', error);
        throw error;
      }
      
      return (data as PlatformSyncConfig[])?.[0] || null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Hook para obter status de sincronização de todos os tenants
export function useTenantsSyncStatus(baseTenantId: string | undefined) {
  return useQuery({
    queryKey: ['tenants-sync-status', baseTenantId],
    queryFn: async (): Promise<TenantSyncStatus[]> => {
      if (!baseTenantId) return [];
      
      const { data, error } = await supabase.rpc('get_tenants_sync_status', {
        p_base_tenant_id: baseTenantId
      });
      
      if (error) {
        console.error('[useTenantsSyncStatus] Error:', error);
        throw error;
      }
      
      return (data || []) as TenantSyncStatus[];
    },
    enabled: !!baseTenantId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Hook para sincronizar todos os tenants
export function useSyncAllTenants() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (sourceTenantId: string): Promise<SyncResult[]> => {
      const { data, error } = await supabase.rpc('sync_menu_to_all_tenants', {
        p_source_tenant_id: sourceTenantId
      });
      
      if (error) throw error;
      return (data || []) as SyncResult[];
    },
    onSuccess: (results) => {
      const totalCopied = results.reduce((acc, r) => acc + r.items_copied, 0);
      const tenantsUpdated = results.filter(r => r.items_copied > 0).length;
      
      toast.success(
        `Sincronização concluída: ${totalCopied} itens copiados para ${tenantsUpdated} tenants`
      );
      
      queryClient.invalidateQueries({ queryKey: ['tenants-sync-status'] });
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
    },
    onError: (error: any) => {
      toast.error('Erro ao sincronizar tenants: ' + error.message);
    },
  });
}

// Hook para sincronizar tenants selecionados
export function useSyncSelectedTenants() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      sourceTenantId,
      targetTenantIds
    }: {
      sourceTenantId: string;
      targetTenantIds: string[];
    }): Promise<SyncResult[]> => {
      const { data, error } = await supabase.rpc('sync_menu_to_selected_tenants', {
        p_source_tenant_id: sourceTenantId,
        p_target_tenant_ids: targetTenantIds
      });
      
      if (error) throw error;
      return (data || []) as SyncResult[];
    },
    onSuccess: (results) => {
      const totalCopied = results.reduce((acc, r) => acc + r.items_copied, 0);
      const tenantsUpdated = results.filter(r => r.items_copied > 0).length;
      
      toast.success(
        `Sincronização concluída: ${totalCopied} itens copiados para ${tenantsUpdated} tenant(s)`
      );
      
      queryClient.invalidateQueries({ queryKey: ['tenants-sync-status'] });
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
    },
    onError: (error: any) => {
      toast.error('Erro ao sincronizar tenants selecionados: ' + error.message);
    },
  });
}

// Hook para obter diferenças de menu entre tenants
export function useMenuDiff(sourceTenantId: string | undefined, targetTenantId: string | undefined) {
  return useQuery({
    queryKey: ['menu-diff', sourceTenantId, targetTenantId],
    queryFn: async () => {
      if (!sourceTenantId || !targetTenantId) return [];
      
      const { data, error } = await supabase.rpc('get_menu_diff', {
        p_source_tenant_id: sourceTenantId,
        p_target_tenant_id: targetTenantId
      });
      
      if (error) {
        console.error('[useMenuDiff] Error:', error);
        throw error;
      }
      
      return data || [];
    },
    enabled: !!sourceTenantId && !!targetTenantId,
  });
}
