-- Criar status "Novo" para capturar contatos com lead_status = 'new'
INSERT INTO public.lead_statuses (name, color, order_position, is_active)
VALUES ('new', '#6B7280', 0, true)
ON CONFLICT DO NOTHING;