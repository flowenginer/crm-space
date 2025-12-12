-- =============================================
-- FASE C: MÓDULO FINANCEIRO
-- =============================================

-- Categorias financeiras
CREATE TABLE public.financial_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  color TEXT DEFAULT '#8B5CF6',
  icon TEXT DEFAULT 'Wallet',
  parent_id UUID REFERENCES public.financial_categories(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Contas bancárias/caixas
CREATE TABLE public.financial_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'checking',
  bank_name TEXT,
  agency TEXT,
  account_number TEXT,
  initial_balance NUMERIC(12,2) DEFAULT 0,
  current_balance NUMERIC(12,2) DEFAULT 0,
  color TEXT DEFAULT '#3B82F6',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Transações financeiras (contas a pagar e receber)
CREATE TABLE public.financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Tipo e status
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'canceled')),
  
  -- Valores
  amount NUMERIC(12,2) NOT NULL,
  paid_amount NUMERIC(12,2) DEFAULT 0,
  
  -- Datas
  due_date DATE NOT NULL,
  paid_at TIMESTAMP WITH TIME ZONE,
  competence_date DATE,
  
  -- Descrição
  description TEXT NOT NULL,
  notes TEXT,
  
  -- Relacionamentos
  category_id UUID REFERENCES public.financial_categories(id),
  account_id UUID REFERENCES public.financial_accounts(id),
  contact_id UUID REFERENCES public.contacts(id),
  order_id UUID REFERENCES public.orders(id),
  
  -- Recorrência
  is_recurring BOOLEAN DEFAULT false,
  recurrence_type TEXT,
  recurrence_interval INTEGER,
  parent_transaction_id UUID REFERENCES public.financial_transactions(id),
  
  -- Parcelamento
  installment_number INTEGER,
  total_installments INTEGER,
  
  -- Anexos
  attachment_url TEXT,
  
  -- Metadata
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Movimentações de conta (histórico)
CREATE TABLE public.account_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.financial_accounts(id) ON DELETE CASCADE NOT NULL,
  transaction_id UUID REFERENCES public.financial_transactions(id),
  
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  amount NUMERIC(12,2) NOT NULL,
  balance_before NUMERIC(12,2) NOT NULL,
  balance_after NUMERIC(12,2) NOT NULL,
  
  description TEXT,
  reference_type TEXT,
  reference_id UUID,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices
CREATE INDEX idx_financial_categories_tenant ON public.financial_categories(tenant_id);
CREATE INDEX idx_financial_accounts_tenant ON public.financial_accounts(tenant_id);
CREATE INDEX idx_financial_transactions_tenant ON public.financial_transactions(tenant_id);
CREATE INDEX idx_financial_transactions_due_date ON public.financial_transactions(due_date);
CREATE INDEX idx_financial_transactions_status ON public.financial_transactions(status);
CREATE INDEX idx_financial_transactions_type ON public.financial_transactions(type);
CREATE INDEX idx_account_movements_account ON public.account_movements(account_id);

-- RLS
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_movements ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Tenant isolation for financial_categories"
  ON public.financial_categories FOR ALL
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Tenant isolation for financial_accounts"
  ON public.financial_accounts FOR ALL
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Tenant isolation for financial_transactions"
  ON public.financial_transactions FOR ALL
  USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Tenant isolation for account_movements"
  ON public.account_movements FOR ALL
  USING (tenant_id = get_user_tenant_id());

-- Função para atualizar saldo da conta
CREATE OR REPLACE FUNCTION update_account_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atualizar saldo da conta
  UPDATE financial_accounts
  SET 
    current_balance = balance_after,
    updated_at = now()
  WHERE id = NEW.account_id;
  
  RETURN NEW;
END;
$$;

-- Trigger para atualizar saldo
CREATE TRIGGER trigger_update_account_balance
  AFTER INSERT ON public.account_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_account_balance();

-- Função para registrar pagamento
CREATE OR REPLACE FUNCTION register_payment(
  p_transaction_id UUID,
  p_account_id UUID,
  p_amount NUMERIC,
  p_paid_at TIMESTAMP WITH TIME ZONE DEFAULT now()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction RECORD;
  v_account RECORD;
  v_movement_type TEXT;
  v_movement_id UUID;
BEGIN
  -- Buscar transação
  SELECT * INTO v_transaction FROM financial_transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transação não encontrada';
  END IF;
  
  -- Buscar conta
  SELECT * INTO v_account FROM financial_accounts WHERE id = p_account_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta não encontrada';
  END IF;
  
  -- Definir tipo de movimento
  v_movement_type := CASE WHEN v_transaction.type = 'income' THEN 'credit' ELSE 'debit' END;
  
  -- Criar movimento na conta
  INSERT INTO account_movements (
    tenant_id, account_id, transaction_id, type, amount,
    balance_before, balance_after, description
  ) VALUES (
    v_transaction.tenant_id,
    p_account_id,
    p_transaction_id,
    v_movement_type,
    p_amount,
    v_account.current_balance,
    CASE 
      WHEN v_movement_type = 'credit' THEN v_account.current_balance + p_amount
      ELSE v_account.current_balance - p_amount
    END,
    v_transaction.description
  ) RETURNING id INTO v_movement_id;
  
  -- Atualizar transação
  UPDATE financial_transactions
  SET 
    paid_amount = paid_amount + p_amount,
    paid_at = p_paid_at,
    account_id = p_account_id,
    status = CASE 
      WHEN paid_amount + p_amount >= amount THEN 'paid'
      ELSE 'pending'
    END,
    updated_at = now()
  WHERE id = p_transaction_id;
  
  RETURN v_movement_id;
END;
$$;

-- Função para verificar vencimentos
CREATE OR REPLACE FUNCTION check_overdue_transactions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE financial_transactions
  SET status = 'overdue'
  WHERE status = 'pending'
    AND due_date < CURRENT_DATE;
END;
$$;

-- Inserir categorias padrão
INSERT INTO public.financial_categories (tenant_id, name, type, color, icon) VALUES
  (NULL, 'Vendas', 'income', '#22C55E', 'TrendingUp'),
  (NULL, 'Serviços', 'income', '#3B82F6', 'Briefcase'),
  (NULL, 'Outros Recebimentos', 'income', '#8B5CF6', 'Plus'),
  (NULL, 'Fornecedores', 'expense', '#EF4444', 'Package'),
  (NULL, 'Funcionários', 'expense', '#F59E0B', 'Users'),
  (NULL, 'Aluguel', 'expense', '#6366F1', 'Home'),
  (NULL, 'Marketing', 'expense', '#EC4899', 'Megaphone'),
  (NULL, 'Impostos', 'expense', '#64748B', 'Receipt'),
  (NULL, 'Outros Pagamentos', 'expense', '#94A3B8', 'Minus');