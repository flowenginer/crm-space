/**
 * Hook para sincronizar permissões do config central com o banco de dados
 * 
 * Este hook é executado automaticamente para admins e garante que
 * todas as permissões definidas em SYSTEM_PERMISSIONS existam no banco.
 * 
 * IMPORTANTE: Toda vez que uma nova permissão for adicionada em permissions.ts,
 * ela será automaticamente inserida no banco de dados na próxima vez que
 * um admin acessar o sistema.
 */

import { useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SYSTEM_PERMISSIONS, getAllPermissions } from '@/config/permissions';
import { usePermissions } from '@/hooks/usePermissions';

interface DBPermission {
  id: string;
  category: string;
  permission_key: string;
  permission_name: string;
  description: string;
}

export function usePermissionSync() {
  const { isAdmin, isFullyLoaded } = usePermissions();
  const queryClient = useQueryClient();

  // Fetch existing permissions from DB
  const { data: dbPermissions = [], isSuccess: dbLoaded } = useQuery({
    queryKey: ['permission-definitions-sync'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('permission_definitions')
        .select('id, category, permission_key, permission_name, description');
      
      if (error) throw error;
      return data as DBPermission[];
    },
    enabled: isFullyLoaded && isAdmin,
    staleTime: 60000, // 1 minute
  });

  // Get all permissions from config
  const getAllConfigPermissions = useCallback(() => {
    const configPermissions: Array<{
      category: string;
      permission_key: string;
      permission_name: string;
      description: string;
    }> = [];

    for (const category of SYSTEM_PERMISSIONS) {
      for (const perm of category.permissions) {
        configPermissions.push({
          category: category.key,
          permission_key: perm.key,
          permission_name: perm.name,
          description: perm.description,
        });
      }
    }

    return configPermissions;
  }, []);

  // Find missing permissions (exist in config but not in DB)
  const findMissingPermissions = useCallback(() => {
    if (!dbLoaded || dbPermissions.length === 0) return [];
    
    const dbPermissionKeys = new Set(dbPermissions.map(p => p.permission_key));
    return getAllConfigPermissions().filter(p => !dbPermissionKeys.has(p.permission_key));
  }, [dbPermissions, dbLoaded, getAllConfigPermissions]);

  // Find permissions to update (exist in both but with different name/description)
  const findPermissionsToUpdate = useCallback(() => {
    if (!dbLoaded || dbPermissions.length === 0) return [];
    
    const configPermissions = getAllConfigPermissions();
    const toUpdate: Array<{
      id: string;
      permission_name: string;
      description: string;
    }> = [];

    for (const dbPerm of dbPermissions) {
      const configPerm = configPermissions.find(p => p.permission_key === dbPerm.permission_key);
      if (configPerm && (
        configPerm.permission_name !== dbPerm.permission_name ||
        configPerm.description !== dbPerm.description
      )) {
        toUpdate.push({
          id: dbPerm.id,
          permission_name: configPerm.permission_name,
          description: configPerm.description,
        });
      }
    }

    return toUpdate;
  }, [dbPermissions, dbLoaded, getAllConfigPermissions]);

  // Find obsolete permissions (exist in DB but not in config)
  const findObsoletePermissions = useCallback(() => {
    if (!dbLoaded || dbPermissions.length === 0) return [];
    
    const configKeys = new Set(getAllConfigPermissions().map(p => p.permission_key));
    return dbPermissions.filter(p => !configKeys.has(p.permission_key));
  }, [dbPermissions, dbLoaded, getAllConfigPermissions]);

  // Mutation to sync permissions
  const syncMutation = useMutation({
    mutationFn: async () => {
      const toInsert = findMissingPermissions();
      const toUpdate = findPermissionsToUpdate();
      const toDelete = findObsoletePermissions();

      const results = { added: 0, updated: 0, deleted: 0 };

      // Insert new permissions
      if (toInsert.length > 0) {
        const { error } = await supabase
          .from('permission_definitions')
          .insert(toInsert);
        
        if (error) throw error;
        results.added = toInsert.length;
        console.log(`[PermissionSync] ✅ Added ${toInsert.length} new permissions:`, toInsert.map(p => p.permission_key));
      }

      // Update existing permissions
      for (const perm of toUpdate) {
        const { error } = await supabase
          .from('permission_definitions')
          .update({
            permission_name: perm.permission_name,
            description: perm.description,
          })
          .eq('id', perm.id);
        
        if (error) throw error;
      }
      if (toUpdate.length > 0) {
        results.updated = toUpdate.length;
        console.log(`[PermissionSync] ✅ Updated ${toUpdate.length} permissions`);
      }

      // Delete obsolete permissions
      if (toDelete.length > 0) {
        const { error } = await supabase
          .from('permission_definitions')
          .delete()
          .in('id', toDelete.map(p => p.id));
        
        if (error) throw error;
        results.deleted = toDelete.length;
        console.log(`[PermissionSync] ✅ Deleted ${toDelete.length} obsolete permissions:`, toDelete.map(p => p.permission_key));
      }

      return results;
    },
    onSuccess: (result) => {
      if (result.added > 0 || result.updated > 0 || result.deleted > 0) {
        // Invalidate related queries
        queryClient.invalidateQueries({ queryKey: ['permission-definitions'] });
        queryClient.invalidateQueries({ queryKey: ['permission-definitions-sync'] });
      }
    },
    onError: (error) => {
      console.error('[PermissionSync] ❌ Error syncing permissions:', error);
    },
  });

  // Auto-sync when admin loads the app
  useEffect(() => {
    if (isFullyLoaded && isAdmin && dbLoaded && dbPermissions.length > 0) {
      const missingPermissions = findMissingPermissions();
      const permissionsToUpdate = findPermissionsToUpdate();
      const obsoletePermissions = findObsoletePermissions();
      
      const needsSync = missingPermissions.length > 0 || permissionsToUpdate.length > 0 || obsoletePermissions.length > 0;
      
      if (needsSync) {
        console.log(`[PermissionSync] 🔄 Syncing... Add: ${missingPermissions.length}, Update: ${permissionsToUpdate.length}, Delete: ${obsoletePermissions.length}`);
        syncMutation.mutate();
      } else {
        console.log('[PermissionSync] ✓ All permissions are in sync');
      }
    }
  }, [isFullyLoaded, isAdmin, dbLoaded, dbPermissions.length, findMissingPermissions, findPermissionsToUpdate, findObsoletePermissions]);

  return {
    syncPermissions: syncMutation.mutate,
    isSyncing: syncMutation.isPending,
    syncResult: syncMutation.data,
    syncError: syncMutation.error,
    missingCount: findMissingPermissions().length,
    updateCount: findPermissionsToUpdate().length,
    deleteCount: findObsoletePermissions().length,
  };
}
