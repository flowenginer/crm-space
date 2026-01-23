import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';

export interface TemplateStatsFilters {
  startDate: Date;
  endDate: Date;
  departmentId?: string;
  userId?: string;
}

export interface UserTemplateStat {
  userId: string | null;
  userName: string;
  departmentId: string | null;
  departmentName: string | null;
  role: string | null;
  marketingCount: number;
  utilityCount: number;
  authenticationCount: number;
  totalCount: number;
  estimatedCost: number;
}

export interface DepartmentTemplateStat {
  departmentId: string | null;
  departmentName: string;
  totalCount: number;
  percentage: number;
}

export interface DailyTemplateStat {
  date: string;
  count: number;
}

export interface TemplateStatsSummary {
  totalSent: number;
  estimatedCost: number;
  topCategory: string;
  topSender: string;
  marketingCount: number;
  utilityCount: number;
  authenticationCount: number;
}

// Default prices per category (BRL)
const DEFAULT_PRICES: Record<string, number> = {
  MARKETING: 0.60,
  UTILITY: 0.20,
  AUTHENTICATION: 0.18,
};

export function useTemplateStats(filters: TemplateStatsFilters) {
  const { startDate, endDate, departmentId, userId } = filters;

  // Fetch stats by user
  const userStatsQuery = useQuery({
    queryKey: ['template-stats-by-user', startDate.toISOString(), endDate.toISOString(), departmentId, userId],
    queryFn: async () => {
      // Get template messages with conversation and profile info
      const { data: messages, error } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          created_at,
          conversation:conversations!inner(
            id,
            assigned_to,
            department_id
          )
        `)
        .eq('message_type', 'template')
        .eq('is_deleted', false)
        .gte('created_at', startOfDay(startDate).toISOString())
        .lte('created_at', endOfDay(endDate).toISOString());

      if (error) throw error;

      // Get profiles for assigned users
      const userIds = [...new Set(messages?.map(m => (m.conversation as any)?.assigned_to).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, role, department_id')
        .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

      // Get departments
      const deptIds = [...new Set([
        ...messages?.map(m => (m.conversation as any)?.department_id).filter(Boolean) || [],
        ...profiles?.map(p => p.department_id).filter(Boolean) || []
      ])];
      const { data: departments } = await supabase
        .from('departments')
        .select('id, name')
        .in('id', deptIds.length > 0 ? deptIds : ['00000000-0000-0000-0000-000000000000']);

      // Get pricing
      const { data: pricing } = await supabase
        .from('template_pricing')
        .select('category, price_per_message')
        .order('effective_from', { ascending: false });

      const priceMap: Record<string, number> = { ...DEFAULT_PRICES };
      pricing?.forEach(p => {
        if (!priceMap[p.category] || true) { // Use latest price
          priceMap[p.category] = Number(p.price_per_message);
        }
      });

      // Aggregate by user
      const userMap = new Map<string, UserTemplateStat>();

      messages?.forEach(msg => {
        const conv = msg.conversation as any;
        const assignedTo = conv?.assigned_to || 'unassigned';
        const convDeptId = conv?.department_id;

        // Apply filters
        if (departmentId && convDeptId !== departmentId) return;
        if (userId && assignedTo !== userId) return;

        const profile = profiles?.find(p => p.id === assignedTo);
        const dept = departments?.find(d => d.id === (profile?.department_id || convDeptId));

        // Detect category from content (heuristic - templates usually have category info)
        // For now, we'll assume MARKETING unless we can determine otherwise
        let category = 'MARKETING';
        const content = msg.content?.toLowerCase() || '';
        if (content.includes('verificação') || content.includes('código') || content.includes('otp')) {
          category = 'AUTHENTICATION';
        } else if (content.includes('atualização') || content.includes('status') || content.includes('pedido')) {
          category = 'UTILITY';
        }

        if (!userMap.has(assignedTo)) {
          userMap.set(assignedTo, {
            userId: assignedTo === 'unassigned' ? null : assignedTo,
            userName: profile?.full_name || 'Não atribuído',
            departmentId: profile?.department_id || convDeptId || null,
            departmentName: dept?.name || 'Sem departamento',
            role: profile?.role || null,
            marketingCount: 0,
            utilityCount: 0,
            authenticationCount: 0,
            totalCount: 0,
            estimatedCost: 0,
          });
        }

        const stat = userMap.get(assignedTo)!;
        stat.totalCount++;
        
        if (category === 'MARKETING') {
          stat.marketingCount++;
          stat.estimatedCost += priceMap.MARKETING;
        } else if (category === 'UTILITY') {
          stat.utilityCount++;
          stat.estimatedCost += priceMap.UTILITY;
        } else if (category === 'AUTHENTICATION') {
          stat.authenticationCount++;
          stat.estimatedCost += priceMap.AUTHENTICATION;
        }
      });

      return Array.from(userMap.values()).sort((a, b) => b.totalCount - a.totalCount);
    },
  });

  // Fetch stats by department
  const departmentStatsQuery = useQuery({
    queryKey: ['template-stats-by-department', startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data: messages, error } = await supabase
        .from('messages')
        .select(`
          id,
          conversation:conversations!inner(
            department_id
          )
        `)
        .eq('message_type', 'template')
        .eq('is_deleted', false)
        .gte('created_at', startOfDay(startDate).toISOString())
        .lte('created_at', endOfDay(endDate).toISOString());

      if (error) throw error;

      // Get departments
      const deptIds = [...new Set(messages?.map(m => (m.conversation as any)?.department_id).filter(Boolean))];
      const { data: departments } = await supabase
        .from('departments')
        .select('id, name')
        .in('id', deptIds.length > 0 ? deptIds : ['00000000-0000-0000-0000-000000000000']);

      // Aggregate by department
      const deptMap = new Map<string, number>();
      let total = 0;

      messages?.forEach(msg => {
        const deptId = (msg.conversation as any)?.department_id || 'none';
        deptMap.set(deptId, (deptMap.get(deptId) || 0) + 1);
        total++;
      });

      const result: DepartmentTemplateStat[] = [];
      deptMap.forEach((count, deptId) => {
        const dept = departments?.find(d => d.id === deptId);
        result.push({
          departmentId: deptId === 'none' ? null : deptId,
          departmentName: dept?.name || 'Sem departamento',
          totalCount: count,
          percentage: total > 0 ? (count / total) * 100 : 0,
        });
      });

      return result.sort((a, b) => b.totalCount - a.totalCount);
    },
  });

  // Fetch daily timeline
  const timelineQuery = useQuery({
    queryKey: ['template-stats-timeline', startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data: messages, error } = await supabase
        .from('messages')
        .select('created_at')
        .eq('message_type', 'template')
        .eq('is_deleted', false)
        .gte('created_at', startOfDay(startDate).toISOString())
        .lte('created_at', endOfDay(endDate).toISOString());

      if (error) throw error;

      // Aggregate by day
      const dayMap = new Map<string, number>();

      messages?.forEach(msg => {
        const day = format(new Date(msg.created_at), 'yyyy-MM-dd');
        dayMap.set(day, (dayMap.get(day) || 0) + 1);
      });

      const result: DailyTemplateStat[] = [];
      dayMap.forEach((count, date) => {
        result.push({ date, count });
      });

      return result.sort((a, b) => a.date.localeCompare(b.date));
    },
  });

  // Summary stats
  const summaryQuery = useQuery({
    queryKey: ['template-stats-summary', startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const userStats = userStatsQuery.data || [];
      
      const summary: TemplateStatsSummary = {
        totalSent: 0,
        estimatedCost: 0,
        topCategory: 'MARKETING',
        topSender: '-',
        marketingCount: 0,
        utilityCount: 0,
        authenticationCount: 0,
      };

      userStats.forEach(stat => {
        summary.totalSent += stat.totalCount;
        summary.estimatedCost += stat.estimatedCost;
        summary.marketingCount += stat.marketingCount;
        summary.utilityCount += stat.utilityCount;
        summary.authenticationCount += stat.authenticationCount;
      });

      // Determine top category
      const categories = [
        { name: 'MARKETING', count: summary.marketingCount },
        { name: 'UTILITY', count: summary.utilityCount },
        { name: 'AUTHENTICATION', count: summary.authenticationCount },
      ];
      const topCat = categories.sort((a, b) => b.count - a.count)[0];
      summary.topCategory = topCat?.name || 'MARKETING';

      // Top sender
      if (userStats.length > 0) {
        summary.topSender = userStats[0].userName;
      }

      return summary;
    },
    enabled: !!userStatsQuery.data,
  });

  return {
    userStats: userStatsQuery.data || [],
    departmentStats: departmentStatsQuery.data || [],
    timeline: timelineQuery.data || [],
    summary: summaryQuery.data || {
      totalSent: 0,
      estimatedCost: 0,
      topCategory: 'MARKETING',
      topSender: '-',
      marketingCount: 0,
      utilityCount: 0,
      authenticationCount: 0,
    },
    isLoading: userStatsQuery.isLoading || departmentStatsQuery.isLoading || timelineQuery.isLoading,
    refetch: () => {
      userStatsQuery.refetch();
      departmentStatsQuery.refetch();
      timelineQuery.refetch();
    },
  };
}

export function useTemplatePricing() {
  return useQuery({
    queryKey: ['template-pricing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('template_pricing')
        .select('*')
        .order('effective_from', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: ['departments-for-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name')
        .order('name');

      if (error) throw error;
      return data || [];
    },
  });
}

export function useAgents() {
  return useQuery({
    queryKey: ['agents-for-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, department_id')
        .order('full_name');

      if (error) throw error;
      return data || [];
    },
  });
}
