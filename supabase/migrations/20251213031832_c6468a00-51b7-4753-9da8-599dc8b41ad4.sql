-- Criar tabela order_statuses para status dinâmicos de pedidos
CREATE TABLE public.order_statuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  value TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#6b7280',
  icon TEXT DEFAULT 'Package',
  order_position INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_final BOOLEAN DEFAULT false,
  can_edit_order BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.order_statuses ENABLE ROW LEVEL SECURITY;

-- Policy para acesso autenticado
CREATE POLICY "Authenticated users can view order_statuses"
ON public.order_statuses
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Policy para admins/supervisors gerenciarem
CREATE POLICY "Admins can manage order_statuses"
ON public.order_statuses
FOR ALL
USING (is_admin_or_supervisor(auth.uid()));

-- Inserir status padrão
INSERT INTO public.order_statuses (name, value, color, icon, order_position, is_final, can_edit_order) VALUES
  ('Rascunho', 'draft', '#6b7280', 'FileEdit', 1, false, true),
  ('Pendente', 'pending', '#f59e0b', 'Clock', 2, false, true),
  ('Confirmado', 'confirmed', '#3b82f6', 'CheckCircle', 3, false, true),
  ('Processando', 'processing', '#8b5cf6', 'Loader', 4, false, false),
  ('Enviado', 'shipped', '#06b6d4', 'Truck', 5, false, false),
  ('Entregue', 'delivered', '#22c55e', 'PackageCheck', 6, true, false),
  ('Cancelado', 'canceled', '#ef4444', 'XCircle', 7, true, false);