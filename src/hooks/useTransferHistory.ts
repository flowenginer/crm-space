import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TransferRecord {
  id: string;
  conversation_id: string;
  contact_id: string;
  contact_name: string;
  contact_phone: string;
  transferred_at: string;
  from_user_id: string | null;
  from_user_name: string | null;
  to_user_id: string | null;
  to_user_name: string | null;
  from_department_id: string | null;
  from_department_name: string | null;
  to_department_id: string | null;
  to_department_name: string | null;
  transfer_note: string | null;
  is_return: boolean;
  actor_id: string | null;
  actor_name: string | null;
  total_count: number;
}

interface UseTransferHistoryParams {
  dateFrom: Date;
  dateTo: Date;
  fromUserId?: string | null;
  toUserId?: string | null;
  fromDepartmentId?: string | null;
  toDepartmentId?: string | null;
  transferType?: 'all' | 'transfer' | 'return';
  page?: number;
  pageSize?: number;
}

export function useTransferHistory({
  dateFrom,
  dateTo,
  fromUserId,
  toUserId,
  fromDepartmentId,
  toDepartmentId,
  transferType = 'all',
  page = 1,
  pageSize = 50,
}: UseTransferHistoryParams) {
  const offset = (page - 1) * pageSize;

  return useQuery({
    queryKey: [
      'transfer-history',
      dateFrom.toISOString(),
      dateTo.toISOString(),
      fromUserId,
      toUserId,
      fromDepartmentId,
      toDepartmentId,
      transferType,
      page,
      pageSize,
    ],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_transfer_history', {
        p_date_from: dateFrom.toISOString(),
        p_date_to: dateTo.toISOString(),
        p_from_user_id: fromUserId || null,
        p_to_user_id: toUserId || null,
        p_from_department_id: fromDepartmentId || null,
        p_to_department_id: toDepartmentId || null,
        p_transfer_type: transferType,
        p_limit: pageSize,
        p_offset: offset,
      });

      if (error) throw error;

      const records = (data as TransferRecord[]) || [];
      const totalCount = records.length > 0 ? records[0].total_count : 0;

      return {
        records,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        currentPage: page,
      };
    },
    staleTime: 30000,
  });
}

export function useTransferHistoryKPIs({
  dateFrom,
  dateTo,
}: {
  dateFrom: Date;
  dateTo: Date;
}) {
  return useQuery({
    queryKey: ['transfer-history-kpis', dateFrom.toISOString(), dateTo.toISOString()],
    queryFn: async () => {
      // Buscar todos os registros para calcular KPIs
      const { data, error } = await supabase.rpc('get_transfer_history', {
        p_date_from: dateFrom.toISOString(),
        p_date_to: dateTo.toISOString(),
        p_from_user_id: null,
        p_to_user_id: null,
        p_from_department_id: null,
        p_to_department_id: null,
        p_transfer_type: 'all',
        p_limit: 10000,
        p_offset: 0,
      });

      if (error) throw error;

      const records = (data as TransferRecord[]) || [];
      const totalTransfers = records.length;
      const totalReturns = records.filter((r) => r.is_return).length;

      // Calcular dias no período
      const diffTime = Math.abs(dateTo.getTime() - dateFrom.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
      const avgPerDay = totalTransfers / diffDays;

      // Departamento que mais transfere
      const fromDeptCounts: Record<string, { name: string; count: number }> = {};
      const toDeptCounts: Record<string, { name: string; count: number }> = {};

      records.forEach((r) => {
        if (r.from_department_id && r.from_department_name) {
          if (!fromDeptCounts[r.from_department_id]) {
            fromDeptCounts[r.from_department_id] = { name: r.from_department_name, count: 0 };
          }
          fromDeptCounts[r.from_department_id].count++;
        }
        if (r.to_department_id && r.to_department_name) {
          if (!toDeptCounts[r.to_department_id]) {
            toDeptCounts[r.to_department_id] = { name: r.to_department_name, count: 0 };
          }
          toDeptCounts[r.to_department_id].count++;
        }
      });

      const topFromDept = Object.values(fromDeptCounts).sort((a, b) => b.count - a.count)[0];
      const topToDept = Object.values(toDeptCounts).sort((a, b) => b.count - a.count)[0];

      return {
        totalTransfers,
        totalReturns,
        avgPerDay: Math.round(avgPerDay * 10) / 10,
        topFromDepartment: topFromDept || null,
        topToDepartment: topToDept || null,
      };
    },
    staleTime: 30000,
  });
}
