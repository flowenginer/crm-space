import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from './useTenant';
import { toast } from 'sonner';

export interface FinancialCategory {
  id: string;
  tenant_id: string | null;
  name: string;
  type: 'income' | 'expense';
  color: string | null;
  icon: string | null;
  parent_id: string | null;
  is_active: boolean | null;
  created_at: string | null;
}

export interface FinancialAccount {
  id: string;
  tenant_id: string | null;
  name: string;
  type: string;
  bank_name: string | null;
  agency: string | null;
  account_number: string | null;
  initial_balance: number | null;
  current_balance: number | null;
  color: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface FinancialTransaction {
  id: string;
  tenant_id: string | null;
  type: 'income' | 'expense' | 'transfer';
  status: 'pending' | 'paid' | 'overdue' | 'canceled';
  amount: number;
  paid_amount: number | null;
  due_date: string;
  paid_at: string | null;
  competence_date: string | null;
  description: string;
  notes: string | null;
  category_id: string | null;
  account_id: string | null;
  contact_id: string | null;
  order_id: string | null;
  is_recurring: boolean | null;
  recurrence_type: string | null;
  recurrence_interval: number | null;
  parent_transaction_id: string | null;
  installment_number: number | null;
  total_installments: number | null;
  attachment_url: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  category?: FinancialCategory;
  account?: FinancialAccount;
  contact?: { id: string; full_name: string };
}

// Categories
export function useFinancialCategories(type?: 'income' | 'expense') {
  return useQuery({
    queryKey: ['financial-categories', type],
    queryFn: async () => {
      let query = supabase
        .from('financial_categories')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (type) {
        query = query.eq('type', type);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as FinancialCategory[];
    },
  });
}

// Accounts
export function useFinancialAccounts() {
  return useQuery({
    queryKey: ['financial-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_accounts')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as FinancialAccount[];
    },
  });
}

export function useCreateFinancialAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      type: string;
      bank_name?: string;
      initial_balance?: number;
      color?: string;
    }) => {
      const { error } = await supabase
        .from('financial_accounts')
        .insert({
          name: data.name,
          type: data.type,
          bank_name: data.bank_name,
          initial_balance: data.initial_balance || 0,
          current_balance: data.initial_balance || 0,
          color: data.color,
        } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-accounts'] });
      toast.success('Conta criada com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao criar conta: ' + error.message);
    },
  });
}

// Transactions
export function useFinancialTransactions(filters?: {
  type?: 'income' | 'expense';
  status?: string;
  startDate?: string;
  endDate?: string;
}) {
  const { data: tenantId } = useCurrentTenantId();

  return useQuery({
    queryKey: ['financial-transactions', tenantId, filters],
    queryFn: async () => {
      let query = supabase
        .from('financial_transactions')
        .select(`
          *,
          category:financial_categories(id, name, color, icon, type),
          account:financial_accounts(id, name, color),
          contact:contacts(id, full_name)
        `)
        .order('due_date', { ascending: true });

      if (filters?.type) {
        query = query.eq('type', filters.type);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.startDate) {
        query = query.gte('due_date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('due_date', filters.endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as FinancialTransaction[];
    },
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      type: 'income' | 'expense';
      amount: number;
      due_date: string;
      description: string;
      category_id?: string;
      contact_id?: string;
      order_id?: string;
      notes?: string;
      competence_date?: string;
      installments?: number;
    }) => {
      // Se tem parcelamento, criar múltiplas transações
      if (data.installments && data.installments > 1) {
        const transactions = [];
        const installmentAmount = data.amount / data.installments;
        const baseDate = new Date(data.due_date);

        for (let i = 0; i < data.installments; i++) {
          const dueDate = new Date(baseDate);
          dueDate.setMonth(dueDate.getMonth() + i);

          transactions.push({
            type: data.type,
            amount: installmentAmount,
            due_date: dueDate.toISOString().split('T')[0],
            description: `${data.description} (${i + 1}/${data.installments})`,
            category_id: data.category_id,
            contact_id: data.contact_id,
            order_id: data.order_id,
            notes: data.notes,
            competence_date: data.competence_date,
            installment_number: i + 1,
            total_installments: data.installments,
            status: 'pending',
          });
        }

        const { error } = await supabase
          .from('financial_transactions')
          .insert(transactions as any);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('financial_transactions')
          .insert({
            type: data.type,
            amount: data.amount,
            due_date: data.due_date,
            description: data.description,
            category_id: data.category_id,
            contact_id: data.contact_id,
            order_id: data.order_id,
            notes: data.notes,
            competence_date: data.competence_date,
            status: 'pending',
          } as any);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      toast.success('Transação criada com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao criar transação: ' + error.message);
    },
  });
}

export function useRegisterPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      transactionId,
      accountId,
      amount,
    }: {
      transactionId: string;
      accountId: string;
      amount: number;
    }) => {
      const { error } = await supabase.rpc('register_payment', {
        p_transaction_id: transactionId,
        p_account_id: accountId,
        p_amount: amount,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['financial-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      toast.success('Pagamento registrado');
    },
    onError: (error) => {
      toast.error('Erro ao registrar pagamento: ' + error.message);
    },
  });
}

export function useCancelTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transactionId: string) => {
      const { error } = await supabase
        .from('financial_transactions')
        .update({ status: 'canceled' })
        .eq('id', transactionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      toast.success('Transação cancelada');
    },
  });
}

// Summary
export function useFinancialSummary(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['financial-summary', startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from('financial_transactions')
        .select('type, status, amount, paid_amount');

      if (startDate) {
        query = query.gte('due_date', startDate);
      }
      if (endDate) {
        query = query.lte('due_date', endDate);
      }

      const { data, error } = await query;
      if (error) throw error;

      const summary = {
        totalIncome: 0,
        totalExpense: 0,
        pendingIncome: 0,
        pendingExpense: 0,
        paidIncome: 0,
        paidExpense: 0,
        overdueIncome: 0,
        overdueExpense: 0,
      };

      data?.forEach((t) => {
        const amount = t.amount || 0;
        const paidAmount = t.paid_amount || 0;

        if (t.type === 'income') {
          summary.totalIncome += amount;
          if (t.status === 'paid') summary.paidIncome += paidAmount;
          if (t.status === 'pending') summary.pendingIncome += amount;
          if (t.status === 'overdue') summary.overdueIncome += amount;
        } else if (t.type === 'expense') {
          summary.totalExpense += amount;
          if (t.status === 'paid') summary.paidExpense += paidAmount;
          if (t.status === 'pending') summary.pendingExpense += amount;
          if (t.status === 'overdue') summary.overdueExpense += amount;
        }
      });

      return summary;
    },
  });
}
