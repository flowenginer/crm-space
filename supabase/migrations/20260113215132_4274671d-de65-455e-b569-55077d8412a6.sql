-- Adicionar template "Enviar Template Meta" na tabela flow_node_templates
INSERT INTO flow_node_templates (
  tenant_id,
  name,
  description,
  node_type,
  node_subtype,
  category,
  icon,
  color,
  default_config,
  is_system
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Enviar Template Meta',
  'Envia template aprovado da API Oficial do WhatsApp',
  'action',
  'send_meta_template',
  'action',
  'Shield',
  '#0EA5E9',
  '{"template_id": null, "variables": {}}',
  true
);