/**
 * Hook para sincronizar permissões do config central com o banco de dados
 * 
 * Este hook é executado automaticamente para admins e garante que
 * todas as permissões definidas em SYSTEM_PERMISSIONS existam no banco.
 */

import { useEffect } from 'react';
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
  const { data: dbPermissions = [] } = useQuery({
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

  // Mutation to sync permissions
  const syncMutation = useMutation({
    mutationFn: async () => {
      const configPermissions = getAllPermissions();
      const dbPermissionKeys = new Set(dbPermissions.map(p => p.permission_key));
      
      // Find permissions that need to be added
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

      // Insert new permissions
      if (toInsert.length > 0) {
        const { error } = await supabase
          .from('permission_definitions')
          .insert(toInsert);
        
        if (error) throw error;
        
        console.log(`[PermissionSync] Added ${toInsert.length} new permissions:`, toInsert.map(p => p.permission_key));
      }

      return { added: toInsert.length };
    },
    onSuccess: (result) => {
      if (result.added > 0) {
        // Invalidate related queries
        queryClient.invalidateQueries({ queryKey: ['permission-definitions'] });
        queryClient.invalidateQueries({ queryKey: ['permission-definitions-sync'] });
      }
    },
    onError: (error) => {
      console.error('[PermissionSync] Error syncing permissions:', error);
    },
  });

  // Auto-sync when admin loads the app
  useEffect(() => {
    if (isFullyLoaded && isAdmin && dbPermissions.length > 0) {
      const configPermissions = getAllPermissions();
      const dbPermissionKeys = new Set(dbPermissions.map(p => p.permission_key));
      
      // Check if there are missing permissions
      const hasMissing = configPermissions.some(p => !dbPermissionKeys.has(p.key));
      
      if (hasMissing) {
        syncMutation.mutate();
      }
    }
  }, [isFullyLoaded, isAdmin, dbPermissions]);

  return {
    syncPermissions: syncMutation.mutate,
    isSyncing: syncMutation.isPending,
    syncResult: syncMutation.data,
    syncError: syncMutation.error,
  };
}
