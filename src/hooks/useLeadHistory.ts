import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay } from 'date-fns';

export interface LeadStatusHistoryEntry {
  id: string;
  contact_id: string;
  previous_status: string | null;
  new_status: string;
  changed_by: string | null;
  changed_at: string;
  duration_seconds: number | null;
}

export interface LeadAssignmentHistoryEntry {
  id: string;
  contact_id: string;
  conversation_id: string | null;
  assigned_from: string | null;
  assigned_to: string | null;
  assigned_by: string | null;
  assigned_at: string;
  assignment_type: string;
  time_to_assign_seconds: number | null;
}

export interface StatusDuration {
  status: string;
  avgDurationSeconds: number;
  count: number;
}

export interface ConversionMetrics {
  totalLeads: number;
  convertedLeads: number;
  conversionRate: number;
  avgTimeToConversion: number; // in seconds
}

interface StatusHistoryFilters {
  dateFrom: Date;
  dateTo: Date;
  agentId?: string;
  departmentId?: string;
}

// Hook to get lead status history for a specific contact
export function useContactStatusHistory(contactId: string | undefined) {
  return useQuery({
    queryKey: ['contact_status_history', contactId],
    queryFn: async () => {
      if (!contactId) return [];

      const { data, error } = await supabase
        .from('lead_status_history')
        .select('*')
        .eq('contact_id', contactId)
        .order('changed_at', { ascending: false });

      if (error) throw error;
      return data as LeadStatusHistoryEntry[];
    },
    enabled: !!contactId,
  });
}

// Hook to get assignment history for a contact
export function useContactAssignmentHistory(contactId: string | undefined) {
  return useQuery({
    queryKey: ['contact_assignment_history', contactId],
    queryFn: async () => {
      if (!contactId) return [];

      const { data, error } = await supabase
        .from('lead_assignment_history')
        .select(`
          *,
          assigned_from_profile:profiles!lead_assignment_history_assigned_from_fkey(id, full_name),
          assigned_to_profile:profiles!lead_assignment_history_assigned_to_fkey(id, full_name),
          assigned_by_profile:profiles!lead_assignment_history_assigned_by_fkey(id, full_name)
        `)
        .eq('contact_id', contactId)
        .order('assigned_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!contactId,
  });
}

// Hook to get average duration per status for dashboard
export function useStatusDurations(filters: StatusHistoryFilters) {
  return useQuery({
    queryKey: ['status_durations', filters.dateFrom, filters.dateTo, filters.agentId, filters.departmentId],
    queryFn: async () => {
      const dateFrom = startOfDay(filters.dateFrom).toISOString();
      const dateTo = endOfDay(filters.dateTo).toISOString();

      // Get all status history entries within the date range
      const { data: historyData, error } = await supabase
        .from('lead_status_history')
        .select('previous_status, duration_seconds')
        .gte('changed_at', dateFrom)
        .lte('changed_at', dateTo)
        .not('duration_seconds', 'is', null);

      if (error) throw error;

      // Aggregate by status
      const statusMap = new Map<string, { total: number; count: number }>();

      historyData?.forEach(entry => {
        if (entry.previous_status && entry.duration_seconds) {
          const existing = statusMap.get(entry.previous_status) || { total: 0, count: 0 };
          existing.total += entry.duration_seconds;
          existing.count += 1;
          statusMap.set(entry.previous_status, existing);
        }
      });

      // Convert to array with averages
      const result: StatusDuration[] = [];
      statusMap.forEach((value, status) => {
        result.push({
          status,
          avgDurationSeconds: Math.round(value.total / value.count),
          count: value.count,
        });
      });

      return result;
    },
    staleTime: 60000, // 1 minute
  });
}

// Hook to get conversion metrics using lead_status_history
export function useConversionMetrics(
  filters: StatusHistoryFilters,
  conversionStatusIds: string[]
) {
  return useQuery({
    queryKey: ['conversion_metrics', filters.dateFrom, filters.dateTo, filters.agentId, filters.departmentId, conversionStatusIds],
    queryFn: async (): Promise<ConversionMetrics> => {
      const dateFrom = startOfDay(filters.dateFrom).toISOString();
      const dateTo = endOfDay(filters.dateTo).toISOString();

      // Get total leads in period
      let leadsQuery = supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo);

      if (filters.agentId) {
        leadsQuery = leadsQuery.eq('assigned_to', filters.agentId);
      }
      if (filters.departmentId) {
        leadsQuery = leadsQuery.eq('department_id', filters.departmentId);
      }

      const { count: totalLeads } = await leadsQuery;

      // Get leads that have reached a conversion status
      // First, get contacts with conversion status in history
      const { data: convertedData } = await supabase
        .from('lead_status_history')
        .select('contact_id, changed_at')
        .gte('changed_at', dateFrom)
        .lte('changed_at', dateTo);

      // Filter by conversion status names (we need to match by status name since history stores name)
      const { data: conversionStatuses } = await supabase
        .from('lead_statuses')
        .select('name')
        .in('id', conversionStatusIds);

      const conversionStatusNames = conversionStatuses?.map(s => s.name) || [];

      // Get contacts that reached conversion status
      const { data: convertedContacts } = await supabase
        .from('lead_status_history')
        .select('contact_id')
        .gte('changed_at', dateFrom)
        .lte('changed_at', dateTo)
        .in('new_status', conversionStatusNames);

      // Get unique converted contact IDs
      const uniqueConvertedIds = new Set(convertedContacts?.map(c => c.contact_id) || []);
      const convertedLeads = uniqueConvertedIds.size;

      return {
        totalLeads: totalLeads || 0,
        convertedLeads,
        conversionRate: totalLeads ? (convertedLeads / totalLeads) * 100 : 0,
        avgTimeToConversion: 0, // Would need more complex calculation
      };
    },
    staleTime: 60000,
  });
}

// Hook to get assignment metrics
export function useAssignmentMetrics(filters: StatusHistoryFilters) {
  return useQuery({
    queryKey: ['assignment_metrics', filters.dateFrom, filters.dateTo, filters.agentId, filters.departmentId],
    queryFn: async () => {
      const dateFrom = startOfDay(filters.dateFrom).toISOString();
      const dateTo = endOfDay(filters.dateTo).toISOString();

      // Get all assignments in period
      const { data: assignments, error } = await supabase
        .from('lead_assignment_history')
        .select('*')
        .gte('assigned_at', dateFrom)
        .lte('assigned_at', dateTo);

      if (error) throw error;

      // Filter by agent if specified
      let filtered = assignments || [];
      if (filters.agentId) {
        filtered = filtered.filter(a => a.assigned_to === filters.agentId);
      }

      // Calculate metrics
      const totalAssignments = filtered.length;
      const firstAssignments = filtered.filter(a => a.assignment_type === 'first_assignment').length;
      const transfers = filtered.filter(a => a.assignment_type === 'transfer').length;
      const reopens = filtered.filter(a => a.assignment_type === 'reopen').length;

      // Average time to assign (only first assignments)
      const firstAssignmentsWithTime = filtered.filter(
        a => a.assignment_type === 'first_assignment' && a.time_to_assign_seconds
      );
      const avgTimeToAssign = firstAssignmentsWithTime.length
        ? firstAssignmentsWithTime.reduce((sum, a) => sum + (a.time_to_assign_seconds || 0), 0) / firstAssignmentsWithTime.length
        : 0;

      // Group by agent
      const byAgent = new Map<string, number>();
      filtered.forEach(a => {
        if (a.assigned_to) {
          byAgent.set(a.assigned_to, (byAgent.get(a.assigned_to) || 0) + 1);
        }
      });

      return {
        totalAssignments,
        firstAssignments,
        transfers,
        reopens,
        avgTimeToAssign: Math.round(avgTimeToAssign),
        byAgent: Object.fromEntries(byAgent),
      };
    },
    staleTime: 60000,
  });
}
