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
  'Transferir p/ Usuário',
  'Transfere a conversa para um atendente específico',
  'action',
  'action',
  'transfer_user',
  '{"user_id": "", "department_id": "", "note": ""}',
  'UserPlus',
  '#8B5CF6',
  true
);