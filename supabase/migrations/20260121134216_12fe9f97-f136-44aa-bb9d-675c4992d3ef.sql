-- Inserir novo template para o bloco híbrido "Enviar e Aguardar Resposta"
INSERT INTO public.flow_node_templates (
  id,
  tenant_id,
  node_type,
  node_subtype,
  name,
  description,
  icon,
  color,
  category,
  default_config,
  is_system
) VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001',
  'action',
  'send_text_wait_reply',
  'Enviar e Aguardar Resposta',
  'Envia mensagem e aguarda resposta com roteamento inteligente',
  'MessageCircle',
  '#0EA5E9',
  'action',
  '{"message": "", "timeout_minutes": 60, "expected_responses": []}',
  true
);
