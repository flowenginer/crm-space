import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, subMonths, format, parseISO, eachDayOfInterval, eachMonthOfInterval } from 'date-fns';

export interface FinancialReportFilters {
  startDate?: Date;
  endDate?: Date;
  type?: 'income' | 'expense' | 'all';
  categoryId?: string;
}

// Summary with comparison to previous period
export function useFinancialComparison(filters: FinancialReportFilters) {
  return useQuery({
    queryKey: ['financial-comparison', filters],
    queryFn: async () => {
      const startDate = filters.startDate || startOfMonth(new Date());
      const endDate = filters.endDate || new Date();
      
      // Calculate previous period
      const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const prevEnd = new Date(startDate);
      prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - periodDays);

      // Current period
      const { data: currentData } = await supabase
        .from('financial_transactions')
        .select('type, status, amount, paid_amount')
        .gte('due_date', format(startDate, 'yyyy-MM-dd'))
        .lte('due_date', format(endDate, 'yyyy-MM-dd'))
        .neq('status', 'canceled');

      // Previous period
      const { data: prevData } = await supabase
        .from('financial_transactions')
        .select('type, status, amount, paid_amount')
        .gte('due_date', format(prevStart, 'yyyy-MM-dd'))
        .lte('due_date', format(prevEnd, 'yyyy-MM-dd'))
        .neq('status', 'canceled');

      const calculate = (data: any[]) => {
        let income = 0, expense = 0, paidIncome = 0, paidExpense = 0;
        data?.forEach((t) => {
          if (t.type === 'income') {
            income += t.amount || 0;
            if (t.status === 'paid') paidIncome += t.paid_amount || t.amount || 0;
          } else if (t.type === 'expense') {
            expense += t.amount || 0;
            if (t.status === 'paid') paidExpense += t.paid_amount || t.amount || 0;
          }
        });
        return { income, expense, paidIncome, paidExpense, balance: income - expense };
      };

      const current = calculate(currentData || []);
      const previous = calculate(prevData || []);

      const calcChange = (curr: number, prev: number) => 
        prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100;

      return {
        current,
        previous,
        changes: {
          income: calcChange(current.income, previous.income),
          expense: calcChange(current.expense, previous.expense),
          balance: calcChange(current.balance, previous.balance),
        },
      };
    },
  });
}

// Daily/Monthly timeline data
export function useFinancialTimeline(filters: FinancialReportFilters, granularity: 'daily' | 'monthly' = 'daily') {
  return useQuery({
    queryKey: ['financial-timeline', filters, granularity],
    queryFn: async () => {
      const startDate = filters.startDate || startOfMonth(new Date());
      const endDate = filters.endDate || new Date();

      const { data } = await supabase
        .from('financial_transactions')
        .select('type, status, amount, paid_amount, due_date, paid_at')
        .gte('due_date', format(startDate, 'yyyy-MM-dd'))
        .lte('due_date', format(endDate, 'yyyy-MM-dd'))
        .neq('status', 'canceled')
        .order('due_date');

      // Generate all dates in range
      const dates = granularity === 'daily'
        ? eachDayOfInterval({ start: startDate, end: endDate })
        : eachMonthOfInterval({ start: startDate, end: endDate });

      const formatKey = granularity === 'daily' ? 'yyyy-MM-dd' : 'yyyy-MM';
      const formatLabel = granularity === 'daily' ? 'dd/MM' : 'MMM/yy';

      const timeline = dates.map(date => {
        const key = format(date, formatKey);
        const transactions = data?.filter(t => {
          const tDate = granularity === 'daily' 
            ? t.due_date 
            : format(parseISO(t.due_date), 'yyyy-MM');
          return tDate === key || (granularity === 'monthly' && t.due_date.startsWith(key));
        }) || [];

        let income = 0, expense = 0;
        transactions.forEach(t => {
          const amount = t.status === 'paid' ? (t.paid_amount || t.amount) : t.amount;
          if (t.type === 'income') income += amount || 0;
          else if (t.type === 'expense') expense += amount || 0;
        });

        return {
          date: format(date, formatLabel),
          receitas: income,
          despesas: expense,
          saldo: income - expense,
        };
      });

      return timeline;
    },
  });
}

// Category breakdown
export function useCategoryBreakdown(filters: FinancialReportFilters) {
  return useQuery({
    queryKey: ['category-breakdown', filters],
    queryFn: async () => {
      const startDate = filters.startDate || startOfMonth(new Date());
      const endDate = filters.endDate || new Date();

      const { data } = await supabase
        .from('financial_transactions')
        .select(`
          type, amount, paid_amount, status,
          category:financial_categories(id, name, color, icon)
        `)
        .gte('due_date', format(startDate, 'yyyy-MM-dd'))
        .lte('due_date', format(endDate, 'yyyy-MM-dd'))
        .neq('status', 'canceled');

      const categoryMap = new Map<string, { name: string; color: string; income: number; expense: number }>();

      data?.forEach((t: any) => {
        const categoryName = t.category?.name || 'Sem categoria';
        const categoryColor = t.category?.color || '#6B7280';
        const key = t.category?.id || 'uncategorized';
        
        if (!categoryMap.has(key)) {
          categoryMap.set(key, { name: categoryName, color: categoryColor, income: 0, expense: 0 });
        }
        
        const cat = categoryMap.get(key)!;
        const amount = t.status === 'paid' ? (t.paid_amount || t.amount) : t.amount;
        if (t.type === 'income') cat.income += amount || 0;
        else if (t.type === 'expense') cat.expense += amount || 0;
      });

      return {
        income: Array.from(categoryMap.entries())
          .filter(([_, v]) => v.income > 0)
          .map(([id, v]) => ({ id, name: v.name, value: v.income, color: v.color }))
          .sort((a, b) => b.value - a.value),
        expense: Array.from(categoryMap.entries())
          .filter(([_, v]) => v.expense > 0)
          .map(([id, v]) => ({ id, name: v.name, value: v.expense, color: v.color }))
          .sort((a, b) => b.value - a.value),
      };
    },
  });
}

// Cash flow projection
export function useCashFlowProjection() {
  return useQuery({
    queryKey: ['cashflow-projection'],
    queryFn: async () => {
      const today = new Date();
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 3);

      // Get current balance from accounts
      const { data: accounts } = await supabase
        .from('financial_accounts')
        .select('current_balance')
        .eq('is_active', true);

      const currentBalance = accounts?.reduce((sum, a) => sum + (a.current_balance || 0), 0) || 0;

      // Get pending transactions
      const { data: transactions } = await supabase
        .from('financial_transactions')
        .select('type, amount, due_date')
        .gte('due_date', format(today, 'yyyy-MM-dd'))
        .lte('due_date', format(futureDate, 'yyyy-MM-dd'))
        .eq('status', 'pending')
        .order('due_date');

      // Build monthly projection
      const months = eachMonthOfInterval({ start: today, end: futureDate });
      let runningBalance = currentBalance;

      const projection = months.map(month => {
        const monthKey = format(month, 'yyyy-MM');
        const monthTransactions = transactions?.filter(t => t.due_date.startsWith(monthKey)) || [];
        
        let income = 0, expense = 0;
        monthTransactions.forEach(t => {
          if (t.type === 'income') income += t.amount || 0;
          else if (t.type === 'expense') expense += t.amount || 0;
        });

        runningBalance = runningBalance + income - expense;

        return {
          month: format(month, 'MMM/yy'),
          receitas: income,
          despesas: expense,
          saldoProjetado: runningBalance,
        };
      });

      return {
        currentBalance,
        projection,
      };
    },
  });
}

// Orders revenue analysis
export function useOrdersRevenue(filters: FinancialReportFilters) {
  return useQuery({
    queryKey: ['orders-revenue', filters],
    queryFn: async () => {
      const startDate = filters.startDate || startOfMonth(new Date());
      const endDate = filters.endDate || new Date();

      const { data: orders } = await supabase
        .from('orders')
        .select('id, total, status, created_at, contact:contacts(full_name)')
        .gte('created_at', format(startDate, 'yyyy-MM-dd'))
        .lte('created_at', format(endDate, 'yyyy-MM-dd') + 'T23:59:59')
        .order('created_at', { ascending: false });

      const totalRevenue = orders?.reduce((sum, o) => {
        if (o.status !== 'canceled') return sum + (o.total || 0);
        return sum;
      }, 0) || 0;

      const completedOrders = orders?.filter(o => o.status === 'completed').length || 0;
      const pendingOrders = orders?.filter(o => o.status === 'pending').length || 0;
      const canceledOrders = orders?.filter(o => o.status === 'canceled').length || 0;

      const avgTicket = completedOrders > 0 
        ? (orders?.filter(o => o.status === 'completed').reduce((s, o) => s + (o.total || 0), 0) || 0) / completedOrders 
        : 0;

      return {
        totalRevenue,
        totalOrders: orders?.length || 0,
        completedOrders,
        pendingOrders,
        canceledOrders,
        avgTicket,
        recentOrders: orders?.slice(0, 10) || [],
      };
    },
  });
}

// Accounts receivable aging
export function useReceivablesAging() {
  return useQuery({
    queryKey: ['receivables-aging'],
    queryFn: async () => {
      const today = new Date();
      
      const { data } = await supabase
        .from('financial_transactions')
        .select('id, amount, due_date, description, contact:contacts(full_name)')
        .eq('type', 'income')
        .in('status', ['pending', 'overdue'])
        .order('due_date');

      const aging = {
        current: 0,     // Due in future
        overdue1to30: 0, // 1-30 days overdue
        overdue31to60: 0, // 31-60 days
        overdue61to90: 0, // 61-90 days
        overdue90plus: 0, // 90+ days
      };

      const overdueTransactions: any[] = [];

      data?.forEach((t: any) => {
        const dueDate = parseISO(t.due_date);
        const daysDiff = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= 0) aging.current += t.amount;
        else if (daysDiff <= 30) {
          aging.overdue1to30 += t.amount;
          overdueTransactions.push({ ...t, daysOverdue: daysDiff });
        }
        else if (daysDiff <= 60) {
          aging.overdue31to60 += t.amount;
          overdueTransactions.push({ ...t, daysOverdue: daysDiff });
        }
        else if (daysDiff <= 90) {
          aging.overdue61to90 += t.amount;
          overdueTransactions.push({ ...t, daysOverdue: daysDiff });
        }
        else {
          aging.overdue90plus += t.amount;
          overdueTransactions.push({ ...t, daysOverdue: daysDiff });
        }
      });

      return {
        aging,
        totalOverdue: aging.overdue1to30 + aging.overdue31to60 + aging.overdue61to90 + aging.overdue90plus,
        overdueTransactions: overdueTransactions.slice(0, 20),
      };
    },
  });
}

// Agent sales performance
export function useAgentSalesPerformance(filters: FinancialReportFilters) {
  return useQuery({
    queryKey: ['agent-sales-performance', filters],
    queryFn: async () => {
      const startDate = filters.startDate || startOfMonth(new Date());
      const endDate = filters.endDate || new Date();

      const { data: orders } = await supabase
        .from('orders')
        .select(`
          id, total, status, assigned_to,
          agent:profiles!orders_assigned_to_fkey(id, full_name)
        `)
        .gte('created_at', format(startDate, 'yyyy-MM-dd'))
        .lte('created_at', format(endDate, 'yyyy-MM-dd') + 'T23:59:59')
        .neq('status', 'canceled');

      const agentMap = new Map<string, { name: string; orders: number; revenue: number }>();

      orders?.forEach((o: any) => {
        const agentId = o.assigned_to || 'unknown';
        const agentName = o.agent?.full_name || 'Não atribuído';
        
        if (!agentMap.has(agentId)) {
          agentMap.set(agentId, { name: agentName, orders: 0, revenue: 0 });
        }
        
        const agent = agentMap.get(agentId)!;
        agent.orders += 1;
        agent.revenue += o.total || 0;
      });

      return Array.from(agentMap.entries())
        .map(([id, data]) => ({
          id,
          name: data.name,
          orders: data.orders,
          revenue: data.revenue,
          avgTicket: data.orders > 0 ? data.revenue / data.orders : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue);
    },
  });
}
