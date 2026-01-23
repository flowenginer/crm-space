import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';

export interface TemplateStatsFilters {
  startDate: Date;
  endDate: Date;
  departmentId?: string;
  userId?: string;
  onlyOutsideWindow?: boolean; // Novo filtro: apenas fora da janela 24h
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
  outsideWindowCount: number; // Templates fora da janela (cobrados)
  insideWindowCount: number; // Templates dentro da janela (grátis)
  chargedCost: number; // Custo apenas dos que geram cobrança
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
  outsideWindowCount: number;
  insideWindowCount: number;
}

export interface TemplateStatsSummary {
  totalSent: number;
  estimatedCost: number;
  topCategory: string;
  topSender: string;
  marketingCount: number;
  utilityCount: number;
  authenticationCount: number;
  outsideWindowCount: number; // Templates fora da janela (cobrados)
  insideWindowCount: number; // Templates dentro da janela (grátis)
  chargedCost: number; // Custo real (apenas fora da janela)
  outsideWindowPercentage: number; // % fora da janela
}

// Default prices per category (BRL)
const DEFAULT_PRICES: Record<string, number> = {
  MARKETING: 0.60,
  UTILITY: 0.20,
  AUTHENTICATION: 0.18,
};

// Função auxiliar para verificar se template está fora da janela de 24h
function isOutsideWindow(templateSentAt: Date, lastClientMsgAt: Date | null): boolean {
  // Se não há mensagem do cliente antes, está fora da janela (cold outreach)
  if (!lastClientMsgAt) return true;
  
  // Calcular diferença em horas
  const diffMs = templateSentAt.getTime() - lastClientMsgAt.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  
  // Se passou mais de 24h, está fora da janela
  return diffHours > 24;
}

export function useTemplateStats(filters: TemplateStatsFilters) {
  const { startDate, endDate, departmentId, userId, onlyOutsideWindow } = filters;

  // Fetch stats by user with window calculation
  const userStatsQuery = useQuery({
    queryKey: ['template-stats-by-user', startDate.toISOString(), endDate.toISOString(), departmentId, userId, onlyOutsideWindow],
    queryFn: async () => {
      // Get template messages with conversation info
      const { data: templateMessages, error } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          created_at,
          conversation_id,
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

      // Get conversation IDs to find last client messages before each template
      const conversationIds = [...new Set(templateMessages?.map(m => m.conversation_id).filter(Boolean))];
      
      // For each conversation, get all client messages to determine window status
      const { data: clientMessages } = conversationIds.length > 0 
        ? await supabase
            .from('messages')
            .select('conversation_id, created_at')
            .in('conversation_id', conversationIds)
            .eq('is_from_me', false)
            .eq('is_deleted', false)
            .order('created_at', { ascending: false })
        : { data: [] };

      // Create a map of conversation_id -> array of client message timestamps
      const clientMsgMap = new Map<string, Date[]>();
      clientMessages?.forEach(msg => {
        if (!clientMsgMap.has(msg.conversation_id)) {
          clientMsgMap.set(msg.conversation_id, []);
        }
        clientMsgMap.get(msg.conversation_id)!.push(new Date(msg.created_at));
      });

      // Function to find last client message before template sent time
      const findLastClientMsgBefore = (conversationId: string, templateSentAt: Date): Date | null => {
        const clientMsgs = clientMsgMap.get(conversationId) || [];
        for (const msgDate of clientMsgs) {
          if (msgDate < templateSentAt) {
            return msgDate;
          }
        }
        return null;
      };

      // Get profiles for assigned users
      const userIds = [...new Set(templateMessages?.map(m => (m.conversation as any)?.assigned_to).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, role, department_id')
        .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

      // Get departments
      const deptIds = [...new Set([
        ...templateMessages?.map(m => (m.conversation as any)?.department_id).filter(Boolean) || [],
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
        if (!priceMap[p.category] || true) {
          priceMap[p.category] = Number(p.price_per_message);
        }
      });

      // Aggregate by user
      const userMap = new Map<string, UserTemplateStat>();

      templateMessages?.forEach(msg => {
        const conv = msg.conversation as any;
        const assignedTo = conv?.assigned_to || 'unassigned';
        const convDeptId = conv?.department_id;
        const templateSentAt = new Date(msg.created_at);

        // Calculate window status
        const lastClientMsg = findLastClientMsgBefore(msg.conversation_id, templateSentAt);
        const isOutside = isOutsideWindow(templateSentAt, lastClientMsg);

        // Apply filters
        if (departmentId && convDeptId !== departmentId) return;
        if (userId && assignedTo !== userId) return;
        if (onlyOutsideWindow && !isOutside) return;

        const profile = profiles?.find(p => p.id === assignedTo);
        const dept = departments?.find(d => d.id === (profile?.department_id || convDeptId));

        // Detect category from content
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
            outsideWindowCount: 0,
            insideWindowCount: 0,
            chargedCost: 0,
          });
        }

        const stat = userMap.get(assignedTo)!;
        stat.totalCount++;
        
        const price = category === 'MARKETING' ? priceMap.MARKETING 
          : category === 'UTILITY' ? priceMap.UTILITY 
          : priceMap.AUTHENTICATION;
        
        stat.estimatedCost += price;

        if (isOutside) {
          stat.outsideWindowCount++;
          stat.chargedCost += price;
        } else {
          stat.insideWindowCount++;
        }
        
        if (category === 'MARKETING') {
          stat.marketingCount++;
        } else if (category === 'UTILITY') {
          stat.utilityCount++;
        } else if (category === 'AUTHENTICATION') {
          stat.authenticationCount++;
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

      const deptIds = [...new Set(messages?.map(m => (m.conversation as any)?.department_id).filter(Boolean))];
      const { data: departments } = await supabase
        .from('departments')
        .select('id, name')
        .in('id', deptIds.length > 0 ? deptIds : ['00000000-0000-0000-0000-000000000000']);

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

  // Fetch daily timeline with window info
  const timelineQuery = useQuery({
    queryKey: ['template-stats-timeline', startDate.toISOString(), endDate.toISOString(), onlyOutsideWindow],
    queryFn: async () => {
      const { data: templateMessages, error } = await supabase
        .from('messages')
        .select('id, created_at, conversation_id')
        .eq('message_type', 'template')
        .eq('is_deleted', false)
        .gte('created_at', startOfDay(startDate).toISOString())
        .lte('created_at', endOfDay(endDate).toISOString());

      if (error) throw error;

      // Get client messages for window calculation
      const conversationIds = [...new Set(templateMessages?.map(m => m.conversation_id).filter(Boolean))];
      
      const { data: clientMessages } = conversationIds.length > 0 
        ? await supabase
            .from('messages')
            .select('conversation_id, created_at')
            .in('conversation_id', conversationIds)
            .eq('is_from_me', false)
            .eq('is_deleted', false)
            .order('created_at', { ascending: false })
        : { data: [] };

      const clientMsgMap = new Map<string, Date[]>();
      clientMessages?.forEach(msg => {
        if (!clientMsgMap.has(msg.conversation_id)) {
          clientMsgMap.set(msg.conversation_id, []);
        }
        clientMsgMap.get(msg.conversation_id)!.push(new Date(msg.created_at));
      });

      const findLastClientMsgBefore = (conversationId: string, templateSentAt: Date): Date | null => {
        const clientMsgs = clientMsgMap.get(conversationId) || [];
        for (const msgDate of clientMsgs) {
          if (msgDate < templateSentAt) {
            return msgDate;
          }
        }
        return null;
      };

      // Aggregate by day with window info
      const dayMap = new Map<string, { total: number; outside: number; inside: number }>();

      templateMessages?.forEach(msg => {
        const templateSentAt = new Date(msg.created_at);
        const lastClientMsg = findLastClientMsgBefore(msg.conversation_id, templateSentAt);
        const isOutside = isOutsideWindow(templateSentAt, lastClientMsg);

        // Apply filter
        if (onlyOutsideWindow && !isOutside) return;

        const day = format(templateSentAt, 'yyyy-MM-dd');
        if (!dayMap.has(day)) {
          dayMap.set(day, { total: 0, outside: 0, inside: 0 });
        }
        const stats = dayMap.get(day)!;
        stats.total++;
        if (isOutside) {
          stats.outside++;
        } else {
          stats.inside++;
        }
      });

      const result: DailyTemplateStat[] = [];
      dayMap.forEach((stats, date) => {
        result.push({ 
          date, 
          count: stats.total,
          outsideWindowCount: stats.outside,
          insideWindowCount: stats.inside,
        });
      });

      return result.sort((a, b) => a.date.localeCompare(b.date));
    },
  });

  // Summary stats
  const summaryQuery = useQuery({
    queryKey: ['template-stats-summary', startDate.toISOString(), endDate.toISOString(), onlyOutsideWindow],
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
        outsideWindowCount: 0,
        insideWindowCount: 0,
        chargedCost: 0,
        outsideWindowPercentage: 0,
      };

      userStats.forEach(stat => {
        summary.totalSent += stat.totalCount;
        summary.estimatedCost += stat.estimatedCost;
        summary.marketingCount += stat.marketingCount;
        summary.utilityCount += stat.utilityCount;
        summary.authenticationCount += stat.authenticationCount;
        summary.outsideWindowCount += stat.outsideWindowCount;
        summary.insideWindowCount += stat.insideWindowCount;
        summary.chargedCost += stat.chargedCost;
      });

      // Calculate percentage
      if (summary.totalSent > 0) {
        summary.outsideWindowPercentage = (summary.outsideWindowCount / summary.totalSent) * 100;
      }

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
      outsideWindowCount: 0,
      insideWindowCount: 0,
      chargedCost: 0,
      outsideWindowPercentage: 0,
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
