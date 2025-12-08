-- =====================================================
-- SINCRONIZAÇÃO COMPLETA DE PERMISSÕES
-- Adiciona todas as permissões definidas em permissions.ts
-- =====================================================

-- Limpar e reinserir todas as permissões do sistema
-- Isso garante que o banco esteja 100% sincronizado com o código

-- Dashboard
INSERT INTO permission_definitions (category, permission_key, permission_name, description)
VALUES 
  ('dashboard', 'dashboard.view', 'Ver Dashboard', 'Acessar painel principal com métricas'),
  ('dashboard', 'dashboard.view_all', 'Ver Métricas Globais', 'Ver métricas de todos os atendentes')
ON CONFLICT (permission_key) DO NOTHING;

-- Conversas (incluindo a nova permissão requests)
INSERT INTO permission_definitions (category, permission_key, permission_name, description)
VALUES 
  ('conversations', 'conversations.view', 'Ver Conversas', 'Visualizar suas conversas'),
  ('conversations', 'conversations.view_all', 'Ver Todas as Conversas', 'Ver conversas de todos os atendentes'),
  ('conversations', 'conversations.view_unassigned', 'Ver Não Atribuídas', 'Visualizar conversas não atribuídas'),
  ('conversations', 'conversations.create', 'Iniciar Conversa', 'Iniciar nova conversa com contato'),
  ('conversations', 'conversations.respond', 'Responder Mensagens', 'Enviar mensagens nas conversas'),
  ('conversations', 'conversations.transfer', 'Transferir Conversa', 'Transferir para outro atendente/departamento'),
  ('conversations', 'conversations.close', 'Fechar Conversa', 'Fechar atendimentos'),
  ('conversations', 'conversations.requests', 'Gerenciar Requisições', 'Visualizar e gerenciar requisições de contato')
ON CONFLICT (permission_key) DO NOTHING;

-- Monitor Ao Vivo
INSERT INTO permission_definitions (category, permission_key, permission_name, description)
VALUES 
  ('live', 'live.view', 'Acessar Monitor', 'Visualizar monitor em tempo real'),
  ('live', 'live.intervene', 'Intervir em Conversas', 'Entrar em conversas de outros atendentes')
ON CONFLICT (permission_key) DO NOTHING;

-- Templates / Mensagens Rápidas
INSERT INTO permission_definitions (category, permission_key, permission_name, description)
VALUES 
  ('templates', 'templates.view', 'Ver Templates', 'Visualizar mensagens rápidas'),
  ('templates', 'templates.create', 'Criar Template', 'Adicionar novas mensagens rápidas'),
  ('templates', 'templates.update', 'Editar Template', 'Modificar mensagens existentes'),
  ('templates', 'templates.delete', 'Excluir Template', 'Remover mensagens rápidas')
ON CONFLICT (permission_key) DO NOTHING;

-- Agendamentos
INSERT INTO permission_definitions (category, permission_key, permission_name, description)
VALUES 
  ('schedules', 'schedules.view', 'Ver Agendamentos', 'Visualizar mensagens agendadas'),
  ('schedules', 'schedules.create', 'Criar Agendamento', 'Agendar novas mensagens'),
  ('schedules', 'schedules.update', 'Editar Agendamento', 'Modificar agendamentos'),
  ('schedules', 'schedules.delete', 'Cancelar Agendamento', 'Cancelar mensagens agendadas')
ON CONFLICT (permission_key) DO NOTHING;

-- Automações
INSERT INTO permission_definitions (category, permission_key, permission_name, description)
VALUES 
  ('automations', 'automations.view', 'Ver Automações', 'Visualizar fluxos de automação'),
  ('automations', 'automations.create', 'Criar Automação', 'Criar novos fluxos'),
  ('automations', 'automations.update', 'Editar Automação', 'Modificar fluxos existentes'),
  ('automations', 'automations.delete', 'Excluir Automação', 'Remover fluxos'),
  ('automations', 'automations.publish', 'Publicar/Ativar', 'Ativar ou desativar fluxos')
ON CONFLICT (permission_key) DO NOTHING;

-- CRM / Negócios
INSERT INTO permission_definitions (category, permission_key, permission_name, description)
VALUES 
  ('deals', 'deals.view', 'Ver Negócios', 'Visualizar seus negócios no CRM'),
  ('deals', 'deals.view_all', 'Ver Todos os Negócios', 'Ver negócios de todos os atendentes'),
  ('deals', 'deals.create', 'Criar Negócio', 'Adicionar novos negócios'),
  ('deals', 'deals.update', 'Editar Negócio', 'Modificar negócios existentes'),
  ('deals', 'deals.delete', 'Excluir Negócio', 'Remover negócios')
ON CONFLICT (permission_key) DO NOTHING;

-- Canais WhatsApp
INSERT INTO permission_definitions (category, permission_key, permission_name, description)
VALUES 
  ('channels', 'channels.view', 'Ver Canais', 'Visualizar canais WhatsApp conectados'),
  ('channels', 'channels.create', 'Criar Canal', 'Adicionar novos canais'),
  ('channels', 'channels.update', 'Configurar Canal', 'Editar configurações de canais'),
  ('channels', 'channels.delete', 'Excluir Canal', 'Remover canais'),
  ('channels', 'channels.connect', 'Conectar QR Code', 'Conectar instâncias via QR Code')
ON CONFLICT (permission_key) DO NOTHING;

-- Contatos
INSERT INTO permission_definitions (category, permission_key, permission_name, description)
VALUES 
  ('contacts', 'contacts.view', 'Ver Contatos', 'Visualizar lista de contatos'),
  ('contacts', 'contacts.create', 'Criar Contato', 'Adicionar novos contatos'),
  ('contacts', 'contacts.update', 'Editar Contato', 'Modificar dados de contatos'),
  ('contacts', 'contacts.delete', 'Excluir Contato', 'Remover contatos'),
  ('contacts', 'contacts.import', 'Importar Contatos', 'Importar via planilha'),
  ('contacts', 'contacts.export', 'Exportar Contatos', 'Exportar para planilha')
ON CONFLICT (permission_key) DO NOTHING;

-- Marketing
INSERT INTO permission_definitions (category, permission_key, permission_name, description)
VALUES 
  ('marketing', 'marketing.view', 'Ver Meta Ads', 'Acessar gerenciador de anúncios'),
  ('marketing', 'marketing.view_campaigns', 'Ver Campanhas', 'Visualizar relatórios de campanhas'),
  ('marketing', 'marketing.manage', 'Gerenciar Anúncios', 'Criar e editar campanhas')
ON CONFLICT (permission_key) DO NOTHING;

-- Relatórios
INSERT INTO permission_definitions (category, permission_key, permission_name, description)
VALUES 
  ('reports', 'reports.view', 'Ver Relatórios', 'Acessar relatórios e métricas'),
  ('reports', 'reports.view_all', 'Ver Relatórios Globais', 'Ver relatórios de toda a equipe'),
  ('reports', 'reports.export', 'Exportar Relatórios', 'Exportar dados para planilha')
ON CONFLICT (permission_key) DO NOTHING;

-- Tags
INSERT INTO permission_definitions (category, permission_key, permission_name, description)
VALUES 
  ('tags', 'tags.view', 'Ver Tags', 'Visualizar tags do sistema'),
  ('tags', 'tags.create', 'Criar Tag', 'Adicionar novas tags'),
  ('tags', 'tags.update', 'Editar Tag', 'Modificar tags existentes'),
  ('tags', 'tags.delete', 'Excluir Tag', 'Remover tags')
ON CONFLICT (permission_key) DO NOTHING;

-- Webhooks
INSERT INTO permission_definitions (category, permission_key, permission_name, description)
VALUES 
  ('webhooks', 'webhooks.view', 'Ver Webhooks', 'Visualizar webhooks configurados'),
  ('webhooks', 'webhooks.create', 'Criar Webhook', 'Adicionar novos webhooks'),
  ('webhooks', 'webhooks.update', 'Editar Webhook', 'Modificar webhooks'),
  ('webhooks', 'webhooks.delete', 'Excluir Webhook', 'Remover webhooks')
ON CONFLICT (permission_key) DO NOTHING;

-- Settings (com todas as sub-permissões)
INSERT INTO permission_definitions (category, permission_key, permission_name, description)
VALUES 
  ('settings', 'settings.view', 'Ver Configurações', 'Acessar configurações do sistema'),
  ('settings', 'settings.update', 'Editar Configurações Gerais', 'Modificar configurações gerais da empresa'),
  ('settings', 'settings.users', 'Gerenciar Equipe', 'Visualizar e gerenciar membros da equipe'),
  ('settings', 'settings.departments', 'Gerenciar Departamentos', 'Criar e editar departamentos'),
  ('settings', 'settings.channels', 'Gerenciar Canais', 'Configurar canais de atendimento'),
  ('settings', 'settings.fields', 'Gerenciar Campos', 'Criar campos personalizados'),
  ('settings', 'settings.tags', 'Gerenciar Etiquetas', 'Criar e editar tags do sistema'),
  ('settings', 'settings.close_reasons', 'Motivos de Fechamento', 'Configurar motivos de encerramento'),
  ('settings', 'settings.integrations', 'Integrações', 'Configurar integrações externas')
ON CONFLICT (permission_key) DO NOTHING;

-- Users (gestão de usuários)
INSERT INTO permission_definitions (category, permission_key, permission_name, description)
VALUES 
  ('users', 'users.view', 'Ver Usuários', 'Visualizar lista de usuários'),
  ('users', 'users.create', 'Criar Usuário', 'Convidar novos usuários'),
  ('users', 'users.update', 'Editar Usuário', 'Modificar dados de usuários'),
  ('users', 'users.delete', 'Desativar Usuário', 'Desativar ou remover usuários'),
  ('users', 'users.manage_roles', 'Gerenciar Perfis', 'Criar e editar perfis de acesso')
ON CONFLICT (permission_key) DO NOTHING;

-- Filas de Atendimento
INSERT INTO permission_definitions (category, permission_key, permission_name, description)
VALUES 
  ('queues', 'queues.view', 'Ver Filas', 'Visualizar filas de atendimento'),
  ('queues', 'queues.manage', 'Gerenciar Filas', 'Criar e configurar filas'),
  ('queues', 'queues.manage_agents', 'Gerenciar Agentes', 'Adicionar/remover agentes das filas')
ON CONFLICT (permission_key) DO NOTHING;

-- =====================================================
-- ATUALIZAR ROLE_DEFINITIONS COM TODAS AS PERMISSÕES
-- =====================================================

-- Admin - acesso total
UPDATE role_definitions 
SET permissions = '{
  "dashboard": {"view": true, "view_all": true},
  "conversations": {"view": true, "view_all": true, "view_unassigned": true, "create": true, "respond": true, "transfer": true, "close": true, "requests": true},
  "live": {"view": true, "intervene": true},
  "templates": {"view": true, "create": true, "update": true, "delete": true},
  "schedules": {"view": true, "create": true, "update": true, "delete": true},
  "automations": {"view": true, "create": true, "update": true, "delete": true, "publish": true},
  "deals": {"view": true, "view_all": true, "create": true, "update": true, "delete": true},
  "channels": {"view": true, "create": true, "update": true, "delete": true, "connect": true},
  "contacts": {"view": true, "create": true, "update": true, "delete": true, "import": true, "export": true},
  "marketing": {"view": true, "view_campaigns": true, "manage": true},
  "reports": {"view": true, "view_all": true, "export": true},
  "tags": {"view": true, "create": true, "update": true, "delete": true},
  "webhooks": {"view": true, "create": true, "update": true, "delete": true},
  "settings": {"view": true, "update": true, "users": true, "departments": true, "channels": true, "fields": true, "tags": true, "close_reasons": true, "integrations": true},
  "users": {"view": true, "create": true, "update": true, "delete": true, "manage_roles": true},
  "queues": {"view": true, "manage": true, "manage_agents": true}
}'::jsonb
WHERE role_key = 'admin';

-- Supervisor - acesso intermediário
UPDATE role_definitions 
SET permissions = '{
  "dashboard": {"view": true, "view_all": true},
  "conversations": {"view": true, "view_all": true, "view_unassigned": true, "create": true, "respond": true, "transfer": true, "close": true, "requests": true},
  "live": {"view": true, "intervene": true},
  "templates": {"view": true, "create": true, "update": true, "delete": false},
  "schedules": {"view": true, "create": true, "update": true, "delete": true},
  "automations": {"view": true, "create": false, "update": false, "delete": false, "publish": false},
  "deals": {"view": true, "view_all": true, "create": true, "update": true, "delete": false},
  "channels": {"view": true, "create": false, "update": false, "delete": false, "connect": false},
  "contacts": {"view": true, "create": true, "update": true, "delete": false, "import": false, "export": true},
  "marketing": {"view": true, "view_campaigns": true, "manage": false},
  "reports": {"view": true, "view_all": true, "export": true},
  "tags": {"view": true, "create": true, "update": true, "delete": false},
  "webhooks": {"view": false, "create": false, "update": false, "delete": false},
  "settings": {"view": true, "update": false, "users": true, "departments": false, "channels": false, "fields": false, "tags": true, "close_reasons": false, "integrations": false},
  "users": {"view": true, "create": false, "update": false, "delete": false, "manage_roles": false},
  "queues": {"view": true, "manage": false, "manage_agents": true}
}'::jsonb
WHERE role_key = 'supervisor';

-- Vendedor - acesso básico
UPDATE role_definitions 
SET permissions = '{
  "dashboard": {"view": true, "view_all": false},
  "conversations": {"view": true, "view_all": false, "view_unassigned": true, "create": true, "respond": true, "transfer": true, "close": true, "requests": false},
  "live": {"view": false, "intervene": false},
  "templates": {"view": true, "create": false, "update": false, "delete": false},
  "schedules": {"view": true, "create": true, "update": true, "delete": true},
  "automations": {"view": false, "create": false, "update": false, "delete": false, "publish": false},
  "deals": {"view": true, "view_all": false, "create": true, "update": true, "delete": false},
  "channels": {"view": false, "create": false, "update": false, "delete": false, "connect": false},
  "contacts": {"view": true, "create": true, "update": true, "delete": false, "import": false, "export": false},
  "marketing": {"view": false, "view_campaigns": false, "manage": false},
  "reports": {"view": false, "view_all": false, "export": false},
  "tags": {"view": true, "create": false, "update": false, "delete": false},
  "webhooks": {"view": false, "create": false, "update": false, "delete": false},
  "settings": {"view": true, "update": false, "users": false, "departments": false, "channels": false, "fields": false, "tags": false, "close_reasons": false, "integrations": false},
  "users": {"view": false, "create": false, "update": false, "delete": false, "manage_roles": false},
  "queues": {"view": true, "manage": false, "manage_agents": false}
}'::jsonb
WHERE role_key = 'vendedor';

-- SAC - acesso de atendimento
UPDATE role_definitions 
SET permissions = '{
  "dashboard": {"view": true, "view_all": false},
  "conversations": {"view": true, "view_all": false, "view_unassigned": true, "create": true, "respond": true, "transfer": true, "close": true, "requests": false},
  "live": {"view": false, "intervene": false},
  "templates": {"view": true, "create": false, "update": false, "delete": false},
  "schedules": {"view": true, "create": true, "update": true, "delete": true},
  "automations": {"view": false, "create": false, "update": false, "delete": false, "publish": false},
  "deals": {"view": false, "view_all": false, "create": false, "update": false, "delete": false},
  "channels": {"view": false, "create": false, "update": false, "delete": false, "connect": false},
  "contacts": {"view": true, "create": true, "update": true, "delete": false, "import": false, "export": false},
  "marketing": {"view": false, "view_campaigns": false, "manage": false},
  "reports": {"view": false, "view_all": false, "export": false},
  "tags": {"view": true, "create": false, "update": false, "delete": false},
  "webhooks": {"view": false, "create": false, "update": false, "delete": false},
  "settings": {"view": true, "update": false, "users": false, "departments": false, "channels": false, "fields": false, "tags": false, "close_reasons": false, "integrations": false},
  "users": {"view": false, "create": false, "update": false, "delete": false, "manage_roles": false},
  "queues": {"view": true, "manage": false, "manage_agents": false}
}'::jsonb
WHERE role_key = 'sac';

-- Designer - acesso mínimo
UPDATE role_definitions 
SET permissions = '{
  "dashboard": {"view": false, "view_all": false},
  "conversations": {"view": false, "view_all": false, "view_unassigned": false, "create": false, "respond": false, "transfer": false, "close": false, "requests": false},
  "live": {"view": false, "intervene": false},
  "templates": {"view": true, "create": true, "update": true, "delete": false},
  "schedules": {"view": false, "create": false, "update": false, "delete": false},
  "automations": {"view": false, "create": false, "update": false, "delete": false, "publish": false},
  "deals": {"view": false, "view_all": false, "create": false, "update": false, "delete": false},
  "channels": {"view": false, "create": false, "update": false, "delete": false, "connect": false},
  "contacts": {"view": false, "create": false, "update": false, "delete": false, "import": false, "export": false},
  "marketing": {"view": false, "view_campaigns": false, "manage": false},
  "reports": {"view": false, "view_all": false, "export": false},
  "tags": {"view": true, "create": false, "update": false, "delete": false},
  "webhooks": {"view": false, "create": false, "update": false, "delete": false},
  "settings": {"view": true, "update": false, "users": false, "departments": false, "channels": false, "fields": false, "tags": false, "close_reasons": false, "integrations": false},
  "users": {"view": false, "create": false, "update": false, "delete": false, "manage_roles": false},
  "queues": {"view": false, "manage": false, "manage_agents": false}
}'::jsonb
WHERE role_key = 'designer';