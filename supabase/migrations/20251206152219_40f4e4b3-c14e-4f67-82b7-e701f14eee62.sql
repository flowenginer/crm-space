-- Criar tabela de status de lead configuráveis
CREATE TABLE lead_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  order_position INTEGER NOT NULL,
  color TEXT DEFAULT '#8B5CF6',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE lead_statuses ENABLE ROW LEVEL SECURITY;

-- Policy para usuários autenticados
CREATE POLICY "Authenticated access lead_statuses" ON lead_statuses
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Inserir os 14 status do JetSales
INSERT INTO lead_statuses (name, order_position, color) VALUES
  ('01 - Não respondeu', 1, '#FEF3C7'),
  ('02 - Pré-venda', 2, '#DDD6FE'),
  ('03 - Catálogo', 3, '#DBEAFE'),
  ('04 - Layout', 4, '#D1FAE5'),
  ('05 - Orçamento', 5, '#FED7AA'),
  ('06 - Aguardando pagamento', 6, '#BBF7D0'),
  ('07 - Pedido Fechado', 7, '#86EFAC'),
  ('08 - Em andamento', 8, '#93C5FD'),
  ('09 - Cobrança', 9, '#FECACA'),
  ('10 - Aguardando envio', 10, '#E0E7FF'),
  ('11 - Pedido Enviado', 11, '#CCFBF1'),
  ('12 - Entregue', 12, '#34D399'),
  ('13 - Recompra', 13, '#A78BFA'),
  ('14 - Cancelado/Descarte', 14, '#F87171');