-- Inserir template para o novo node de condição de horário
INSERT INTO flow_node_templates (
  name,
  node_type,
  node_subtype,
  category,
  description,
  icon,
  color,
  default_config,
  is_system,
  tenant_id
) VALUES (
  'Condição de Horário',
  'condition',
  'time_condition',
  'condition',
  'Direciona baseado no horário atual',
  'Clock',
  '#F59E0B',
  '{"time_ranges": []}',
  true,
  '00000000-0000-0000-0000-000000000001'
);