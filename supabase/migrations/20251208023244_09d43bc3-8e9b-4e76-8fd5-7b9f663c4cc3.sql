-- Sincronizar permissões faltantes do sistema centralizado
-- Adicionar novas permissões que estão no código mas não no banco

-- Dashboard
INSERT INTO permission_definitions (category, permission_key, permission_name, description)
SELECT 'dashboard', 'dashboard.view_all', 'Ver Métricas Globais', 'Ver métricas de todos os atendentes'
WHERE NOT EXISTS (SELECT 1 FROM permission_definitions WHERE permission_key = 'dashboard.view_all');

-- Live Monitor
INSERT INTO permission_definitions (category, permission_key, permission_name, description)
SELECT 'live', 'live.view', 'Acessar Monitor', 'Visualizar monitor em tempo real'
WHERE NOT EXISTS (SELECT 1 FROM permission_definitions WHERE permission_key = 'live.view');

INSERT INTO permission_definitions (category, permission_key, permission_name, description)
SELECT 'live', 'live.intervene', 'Intervir em Conversas', 'Entrar em conversas de outros atendentes'
WHERE NOT EXISTS (SELECT 1 FROM permission_definitions WHERE permission_key = 'live.intervene');

-- Schedules (Agendamentos)
INSERT INTO permission_definitions (category, permission_key, permission_name, description)
SELECT 'schedules', 'schedules.view', 'Ver Agendamentos', 'Visualizar mensagens agendadas'
WHERE NOT EXISTS (SELECT 1 FROM permission_definitions WHERE permission_key = 'schedules.view');

INSERT INTO permission_definitions (category, permission_key, permission_name, description)
SELECT 'schedules', 'schedules.create', 'Criar Agendamento', 'Agendar novas mensagens'
WHERE NOT EXISTS (SELECT 1 FROM permission_definitions WHERE permission_key = 'schedules.create');

INSERT INTO permission_definitions (category, permission_key, permission_name, description)
SELECT 'schedules', 'schedules.update', 'Editar Agendamento', 'Modificar agendamentos'
WHERE NOT EXISTS (SELECT 1 FROM permission_definitions WHERE permission_key = 'schedules.update');

INSERT INTO permission_definitions (category, permission_key, permission_name, description)
SELECT 'schedules', 'schedules.delete', 'Cancelar Agendamento', 'Cancelar mensagens agendadas'
WHERE NOT EXISTS (SELECT 1 FROM permission_definitions WHERE permission_key = 'schedules.delete');

-- Marketing
INSERT INTO permission_definitions (category, permission_key, permission_name, description)
SELECT 'marketing', 'marketing.view', 'Ver Meta Ads', 'Acessar gerenciador de anúncios'
WHERE NOT EXISTS (SELECT 1 FROM permission_definitions WHERE permission_key = 'marketing.view');

INSERT INTO permission_definitions (category, permission_key, permission_name, description)
SELECT 'marketing', 'marketing.view_campaigns', 'Ver Campanhas', 'Visualizar relatórios de campanhas'
WHERE NOT EXISTS (SELECT 1 FROM permission_definitions WHERE permission_key = 'marketing.view_campaigns');

INSERT INTO permission_definitions (category, permission_key, permission_name, description)
SELECT 'marketing', 'marketing.manage', 'Gerenciar Anúncios', 'Criar e editar campanhas'
WHERE NOT EXISTS (SELECT 1 FROM permission_definitions WHERE permission_key = 'marketing.manage');

-- Tags
INSERT INTO permission_definitions (category, permission_key, permission_name, description)
SELECT 'tags', 'tags.view', 'Ver Tags', 'Visualizar tags do sistema'
WHERE NOT EXISTS (SELECT 1 FROM permission_definitions WHERE permission_key = 'tags.view');

INSERT INTO permission_definitions (category, permission_key, permission_name, description)
SELECT 'tags', 'tags.create', 'Criar Tag', 'Adicionar novas tags'
WHERE NOT EXISTS (SELECT 1 FROM permission_definitions WHERE permission_key = 'tags.create');

INSERT INTO permission_definitions (category, permission_key, permission_name, description)
SELECT 'tags', 'tags.update', 'Editar Tag', 'Modificar tags existentes'
WHERE NOT EXISTS (SELECT 1 FROM permission_definitions WHERE permission_key = 'tags.update');

INSERT INTO permission_definitions (category, permission_key, permission_name, description)
SELECT 'tags', 'tags.delete', 'Excluir Tag', 'Remover tags'
WHERE NOT EXISTS (SELECT 1 FROM permission_definitions WHERE permission_key = 'tags.delete');

-- Webhooks
INSERT INTO permission_definitions (category, permission_key, permission_name, description)
SELECT 'webhooks', 'webhooks.view', 'Ver Webhooks', 'Visualizar webhooks configurados'
WHERE NOT EXISTS (SELECT 1 FROM permission_definitions WHERE permission_key = 'webhooks.view');

INSERT INTO permission_definitions (category, permission_key, permission_name, description)
SELECT 'webhooks', 'webhooks.create', 'Criar Webhook', 'Adicionar novos webhooks'
WHERE NOT EXISTS (SELECT 1 FROM permission_definitions WHERE permission_key = 'webhooks.create');

INSERT INTO permission_definitions (category, permission_key, permission_name, description)
SELECT 'webhooks', 'webhooks.update', 'Editar Webhook', 'Modificar webhooks'
WHERE NOT EXISTS (SELECT 1 FROM permission_definitions WHERE permission_key = 'webhooks.update');

INSERT INTO permission_definitions (category, permission_key, permission_name, description)
SELECT 'webhooks', 'webhooks.delete', 'Excluir Webhook', 'Remover webhooks'
WHERE NOT EXISTS (SELECT 1 FROM permission_definitions WHERE permission_key = 'webhooks.delete');

-- Users (Gestão de usuários)
INSERT INTO permission_definitions (category, permission_key, permission_name, description)
SELECT 'users', 'users.view', 'Ver Usuários', 'Visualizar lista de usuários'
WHERE NOT EXISTS (SELECT 1 FROM permission_definitions WHERE permission_key = 'users.view');

INSERT INTO permission_definitions (category, permission_key, permission_name, description)
SELECT 'users', 'users.create', 'Criar Usuário', 'Convidar novos usuários'
WHERE NOT EXISTS (SELECT 1 FROM permission_definitions WHERE permission_key = 'users.create');

INSERT INTO permission_definitions (category, permission_key, permission_name, description)
SELECT 'users', 'users.update', 'Editar Usuário', 'Modificar dados de usuários'
WHERE NOT EXISTS (SELECT 1 FROM permission_definitions WHERE permission_key = 'users.update');

INSERT INTO permission_definitions (category, permission_key, permission_name, description)
SELECT 'users', 'users.delete', 'Desativar Usuário', 'Desativar ou remover usuários'
WHERE NOT EXISTS (SELECT 1 FROM permission_definitions WHERE permission_key = 'users.delete');

INSERT INTO permission_definitions (category, permission_key, permission_name, description)
SELECT 'users', 'users.manage_roles', 'Gerenciar Perfis', 'Criar e editar perfis de acesso'
WHERE NOT EXISTS (SELECT 1 FROM permission_definitions WHERE permission_key = 'users.manage_roles');

-- Queues (Filas)
INSERT INTO permission_definitions (category, permission_key, permission_name, description)
SELECT 'queues', 'queues.view', 'Ver Filas', 'Visualizar filas de atendimento'
WHERE NOT EXISTS (SELECT 1 FROM permission_definitions WHERE permission_key = 'queues.view');

INSERT INTO permission_definitions (category, permission_key, permission_name, description)
SELECT 'queues', 'queues.manage', 'Gerenciar Filas', 'Criar e configurar filas'
WHERE NOT EXISTS (SELECT 1 FROM permission_definitions WHERE permission_key = 'queues.manage');

INSERT INTO permission_definitions (category, permission_key, permission_name, description)
SELECT 'queues', 'queues.manage_agents', 'Gerenciar Agentes', 'Adicionar/remover agentes das filas'
WHERE NOT EXISTS (SELECT 1 FROM permission_definitions WHERE permission_key = 'queues.manage_agents');

-- Deals (CRM)
INSERT INTO permission_definitions (category, permission_key, permission_name, description)
SELECT 'deals', 'deals.view', 'Ver Negócios', 'Visualizar seus negócios no CRM'
WHERE NOT EXISTS (SELECT 1 FROM permission_definitions WHERE permission_key = 'deals.view');

INSERT INTO permission_definitions (category, permission_key, permission_name, description)
SELECT 'deals', 'deals.view_all', 'Ver Todos os Negócios', 'Ver negócios de todos os atendentes'
WHERE NOT EXISTS (SELECT 1 FROM permission_definitions WHERE permission_key = 'deals.view_all');

INSERT INTO permission_definitions (category, permission_key, permission_name, description)
SELECT 'deals', 'deals.create', 'Criar Negócio', 'Adicionar novos negócios'
WHERE NOT EXISTS (SELECT 1 FROM permission_definitions WHERE permission_key = 'deals.create');

INSERT INTO permission_definitions (category, permission_key, permission_name, description)
SELECT 'deals', 'deals.update', 'Editar Negócio', 'Modificar negócios existentes'
WHERE NOT EXISTS (SELECT 1 FROM permission_definitions WHERE permission_key = 'deals.update');

INSERT INTO permission_definitions (category, permission_key, permission_name, description)
SELECT 'deals', 'deals.delete', 'Excluir Negócio', 'Remover negócios'
WHERE NOT EXISTS (SELECT 1 FROM permission_definitions WHERE permission_key = 'deals.delete');

-- Templates
INSERT INTO permission_definitions (category, permission_key, permission_name, description)
SELECT 'templates', 'templates.view', 'Ver Templates', 'Visualizar mensagens rápidas'
WHERE NOT EXISTS (SELECT 1 FROM permission_definitions WHERE permission_key = 'templates.view');

INSERT INTO permission_definitions (category, permission_key, permission_name, description)
SELECT 'templates', 'templates.create', 'Criar Template', 'Adicionar novas mensagens rápidas'
WHERE NOT EXISTS (SELECT 1 FROM permission_definitions WHERE permission_key = 'templates.create');

INSERT INTO permission_definitions (category, permission_key, permission_name, description)
SELECT 'templates', 'templates.update', 'Editar Template', 'Modificar mensagens existentes'
WHERE NOT EXISTS (SELECT 1 FROM permission_definitions WHERE permission_key = 'templates.update');

INSERT INTO permission_definitions (category, permission_key, permission_name, description)
SELECT 'templates', 'templates.delete', 'Excluir Template', 'Remover mensagens rápidas'
WHERE NOT EXISTS (SELECT 1 FROM permission_definitions WHERE permission_key = 'templates.delete');

-- Settings
INSERT INTO permission_definitions (category, permission_key, permission_name, description)
SELECT 'settings', 'settings.update', 'Editar Configurações', 'Modificar configurações gerais'
WHERE NOT EXISTS (SELECT 1 FROM permission_definitions WHERE permission_key = 'settings.update');

-- Reports
INSERT INTO permission_definitions (category, permission_key, permission_name, description)
SELECT 'reports', 'reports.view_all', 'Ver Relatórios Globais', 'Ver relatórios de toda a equipe'
WHERE NOT EXISTS (SELECT 1 FROM permission_definitions WHERE permission_key = 'reports.view_all');

-- Corrigir permissão view_unassigned que estava com category errado
UPDATE permission_definitions 
SET permission_key = 'conversations.view_unassigned', category = 'conversations'
WHERE permission_key = 'view_unassigned';

-- Atualizar permissões dos roles para usar as novas chaves corretas
-- Admin e Supervisor ganham live.view automaticamente
UPDATE role_definitions
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),
  '{live}',
  '{"view": true, "intervene": true}'::jsonb
)
WHERE role_key IN ('admin', 'supervisor');

-- Dar permissões de schedules para todos os roles que tinham templates
UPDATE role_definitions
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),
  '{schedules}',
  '{"view": true, "create": true, "update": true, "delete": true}'::jsonb
)
WHERE permissions->'templates'->>'view' = 'true' OR permissions->'templates'->>'read' = 'true';