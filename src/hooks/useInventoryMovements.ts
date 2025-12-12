import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from './useTenant';

export interface InventoryMovement {
  id: string;
  tenant_id: string | null;
  variation_id: string;
  movement_type: string;
  quantity: number;
  stock_before: number;
  stock_after: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  cost_per_unit: number | null;
  created_at: string;
  created_by: string | null;
}

export interface InventoryMovementWithDetails extends InventoryMovement {
  variation: {
    id: string;
    sku: string;
    variation_name: string | null;
    product: {
      id: string;
      name: string;
    };
  };
  created_by_profile: {
    id: string;
    full_name: string;
  } | null;
}

// Hook para buscar movimentações de uma variação
export function useVariationMovements(variationId: string | undefined) {
  return useQuery({
    queryKey: ['inventory-movements', 'variation', variationId],
    queryFn: async () => {
      if (!variationId) return [];

      const { data, error } = await supabase
        .from('inventory_movements')
        .select(`
          *,
          variation:product_variations(
            id, 
            sku, 
            variation_name,
            product:products(id, name)
          )
        `)
        .eq('variation_id', variationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as InventoryMovementWithDetails[];
    },
    enabled: !!variationId,
  });
}

// Hook para buscar todas as movimentações recentes
export function useRecentMovements(limit = 50) {
  const { data: tenantId } = useCurrentTenantId();

  return useQuery({
    queryKey: ['inventory-movements', 'recent', tenantId, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_movements')
        .select(`
          *,
          variation:product_variations(
            id, 
            sku, 
            variation_name,
            product:products(id, name)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as InventoryMovementWithDetails[];
    },
  });
}

// Hook para buscar movimentações por período
export function useMovementsByPeriod(startDate: string, endDate: string) {
  const { data: tenantId } = useCurrentTenantId();

  return useQuery({
    queryKey: ['inventory-movements', 'period', tenantId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_movements')
        .select(`
          *,
          variation:product_variations(
            id, 
            sku, 
            variation_name,
            product:products(id, name)
          )
        `)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as InventoryMovementWithDetails[];
    },
    enabled: !!startDate && !!endDate,
  });
}

// Tipos de movimentação disponíveis
export const MOVEMENT_TYPES = {
  entrada_manual: { label: 'Entrada Manual', color: 'green' },
  saida_manual: { label: 'Saída Manual', color: 'red' },
  venda: { label: 'Venda', color: 'blue' },
  devolucao: { label: 'Devolução', color: 'orange' },
  ajuste: { label: 'Ajuste de Inventário', color: 'gray' },
  transferencia: { label: 'Transferência', color: 'purple' },
} as const;

export type MovementType = keyof typeof MOVEMENT_TYPES;
