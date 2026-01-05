-- 1. Inserir novo template de trigger "Mensagem-Chave"
INSERT INTO flow_node_templates (
  name, 
  description, 
  category, 
  node_type, 
  node_subtype, 
  default_config, 
  icon, 
  color, 
  is_system
) VALUES (
  'Mensagem-Chave',
  'Dispara quando uma mensagem específica é ENVIADA pelo sistema/atendente',
  'trigger',
  'trigger',
  'message_key',
  '{"keywords": [], "match_type": "contains"}',
  'Send',
  '#8B5CF6',
  true
);

-- 2. Ativar a automação "Status Pedido Fechado"
UPDATE chatbot_flows 
SET is_active = true 
WHERE name ILIKE '%pedido fechado%';

-- 3. Atualizar o trigger da automação de keyword para message_key
UPDATE flow_nodes fn
SET node_subtype = 'message_key',
    config = jsonb_set(
      COALESCE(config, '{}')::jsonb,
      '{keywords}',
      '["acaba de ser enviado para produção"]'::jsonb
    )
FROM chatbot_flows cf
WHERE fn.flow_id = cf.id 
  AND cf.name ILIKE '%pedido fechado%'
  AND fn.node_type = 'trigger'
  AND fn.node_subtype = 'keyword';