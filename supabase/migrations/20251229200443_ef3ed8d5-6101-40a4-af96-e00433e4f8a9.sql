-- Inserir template de gatilho para leads vindos do redirect
INSERT INTO flow_node_templates (
  name,
  node_type,
  node_subtype,
  description,
  icon,
  color,
  default_config,
  category
) VALUES (
  'Lead via Redirect',
  'trigger',
  'redirect_lead',
  'Dispara quando um lead chega via página de captura/redirect',
  'Link2',
  '#10B981',
  '{"campaign_id": null}',
  'trigger'
);