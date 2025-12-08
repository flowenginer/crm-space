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

  // Find missing permissions
  const findMissingPermissions = useCallback(() => {
    if (!dbLoaded || dbPermissions.length === 0) return [];
    
    const dbPermissionKeys = new Set(dbPermissions.map(p => p.permission_key));
    const toInsert: Array<{
      category: string;
      permission_key: string;
      permission_name: string;
      description: string;
    }> = [];

    for (const category of SYSTEM_PERMISSIONS) {
      for (const perm of category.permissions) {
        if (!dbPermissionKeys.has(perm.key)) {
          toInsert.push({
            category: category.key,
            permission_key: perm.key,
            permission_name: perm.name,
            description: perm.description,
          });
        }
      }
    }

    return toInsert;
  }, [dbPermissions, dbLoaded]);

  // Mutation to sync permissions
  const syncMutation = useMutation({
    mutationFn: async () => {
      const toInsert = findMissingPermissions();

      if (toInsert.length === 0) {
        return { added: 0, permissions: [] };
      }

      // Insert new permissions
      const { error } = await supabase
        .from('permission_definitions')
        .insert(toInsert);
      
      if (error) throw error;
      
      console.log(`[PermissionSync] ✅ Added ${toInsert.length} new permissions:`, toInsert.map(p => p.permission_key));
      
      return { added: toInsert.length, permissions: toInsert.map(p => p.permission_key) };
    },
    onSuccess: (result) => {
      if (result.added > 0) {
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
      
      if (missingPermissions.length > 0) {
        console.log(`[PermissionSync] 🔄 Found ${missingPermissions.length} missing permissions, syncing...`);
        syncMutation.mutate();
      } else {
        console.log('[PermissionSync] ✓ All permissions are in sync');
      }
    }
  }, [isFullyLoaded, isAdmin, dbLoaded, dbPermissions.length, findMissingPermissions]);

  return {
    syncPermissions: syncMutation.mutate,
    isSyncing: syncMutation.isPending,
    syncResult: syncMutation.data,
    syncError: syncMutation.error,
    missingCount: findMissingPermissions().length,
  };
}
