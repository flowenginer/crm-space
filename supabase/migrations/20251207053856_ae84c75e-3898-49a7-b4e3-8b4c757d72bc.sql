-- Limpar permissões existentes e inserir novas
TRUNCATE permission_definitions;

-- Dashboard
INSERT INTO permission_definitions (category, permission_key, permission_name, description) VALUES
('dashboard', 'dashboard.view', 'Visualizar Dashboard', 'Permite acessar o painel de métricas e KPIs');

-- Conversas
INSERT INTO permission_definitions (category, permission_key, permission_name, description) VALUES
('conversations', 'conversations.view', 'Ver Conversas', 'Visualizar suas conversas'),
('conversations', 'conversations.view_all', 'Ver Todas as Conversas', 'Ver conversas de todos os atendentes'),
('conversations', 'conversations.create', 'Iniciar Conversa', 'Iniciar nova conversa com contato'),
('conversations', 'conversations.respond', 'Responder Mensagens', 'Enviar mensagens nas conversas'),
('conversations', 'conversations.close', 'Fechar Conversa', 'Fechar atendimentos'),
('conversations', 'conversations.transfer', 'Transferir Conversa', 'Transferir para outro atendente/departamento');

-- Monitor Ao Vivo
INSERT INTO permission_definitions (category, permission_key, permission_name, description) VALUES
('live', 'live.view', 'Monitor Ao Vivo', 'Acessar o monitor de conversas em tempo real');

-- Mensagens Rápidas / Templates
INSERT INTO permission_definitions (category, permission_key, permission_name, description) VALUES
('templates', 'templates.view', 'Ver Templates', 'Visualizar mensagens rápidas'),
('templates', 'templates.create', 'Criar Template', 'Criar novas mensagens rápidas'),
('templates', 'templates.update', 'Editar Template', 'Editar mensagens existentes'),
('templates', 'templates.delete', 'Excluir Template', 'Remover mensagens rápidas');

-- Agendamentos
INSERT INTO permission_definitions (category, permission_key, permission_name, description) VALUES
('schedules', 'schedules.view', 'Ver Agendamentos', 'Visualizar mensagens agendadas'),
('schedules', 'schedules.create', 'Criar Agendamento', 'Agendar novas mensagens'),
('schedules', 'schedules.update', 'Editar Agendamento', 'Modificar agendamentos existentes'),
('schedules', 'schedules.delete', 'Excluir Agendamento', 'Remover agendamentos');

-- Automações / Fluxos
INSERT INTO permission_definitions (category, permission_key, permission_name, description) VALUES
('automations', 'automations.view', 'Ver Automações', 'Visualizar fluxos de automação'),
('automations', 'automations.create', 'Criar Automação', 'Criar novos fluxos'),
('automations', 'automations.update', 'Editar Automação', 'Modificar fluxos existentes'),
('automations', 'automations.publish', 'Publicar/Ativar', 'Ativar ou desativar fluxos'),
('automations', 'automations.delete', 'Excluir Automação', 'Remover fluxos');

-- CRM
INSERT INTO permission_definitions (category, permission_key, permission_name, description) VALUES
('crm', 'crm.view', 'Acessar CRM', 'Visualizar o módulo CRM'),
('crm', 'crm.deals', 'Gerenciar Negócios', 'Gerenciar oportunidades no pipeline/kanban'),
('crm', 'crm.media', 'Gestão de Mídia', 'Gerenciar criativas e mídias');

-- Canais WhatsApp
INSERT INTO permission_definitions (category, permission_key, permission_name, description) VALUES
('channels', 'channels.view', 'Ver Canais', 'Visualizar canais WhatsApp conectados'),
('channels', 'channels.create', 'Criar Canal', 'Adicionar novos canais'),
('channels', 'channels.update', 'Configurar Canal', 'Editar configurações de canais'),
('channels', 'channels.connect', 'Conectar QR Code', 'Conectar instâncias via QR Code'),
('channels', 'channels.delete', 'Excluir Canal', 'Remover canais');

-- Contatos
INSERT INTO permission_definitions (category, permission_key, permission_name, description) VALUES
('contacts', 'contacts.view', 'Ver Contatos', 'Visualizar lista de contatos'),
('contacts', 'contacts.create', 'Criar Contato', 'Adicionar novos contatos'),
('contacts', 'contacts.update', 'Editar Contato', 'Modificar dados de contatos'),
('contacts', 'contacts.delete', 'Excluir Contato', 'Remover contatos'),
('contacts', 'contacts.import', 'Importar Contatos', 'Importar via planilha'),
('contacts', 'contacts.export', 'Exportar Contatos', 'Exportar para planilha');

-- Marketing (Meta Ads)
INSERT INTO permission_definitions (category, permission_key, permission_name, description) VALUES
('marketing', 'marketing.view', 'Acessar Marketing', 'Visualizar módulo de marketing'),
('marketing', 'marketing.meta_ads', 'Meta Ads', 'Gerenciar campanhas do Meta/Facebook'),
('marketing', 'marketing.campaigns', 'Relatório Campanhas', 'Ver relatórios de campanhas');

-- Relatórios
INSERT INTO permission_definitions (category, permission_key, permission_name, description) VALUES
('reports', 'reports.view', 'Ver Relatórios', 'Acessar módulo de relatórios'),
('reports', 'reports.conversations', 'Relatório Atendimentos', 'Ver relatório de conversas'),
('reports', 'reports.campaigns', 'Relatório Campanhas', 'Ver relatório de campanhas de marketing'),
('reports', 'reports.export', 'Exportar Relatórios', 'Baixar relatórios em Excel/PDF');

-- Configurações - Sub-menus
INSERT INTO permission_definitions (category, permission_key, permission_name, description) VALUES
('settings', 'settings.view', 'Acessar Configurações', 'Visualizar menu de configurações'),
('settings', 'settings.users', 'Gerenciar Equipe', 'Adicionar, editar e remover membros'),
('settings', 'settings.roles', 'Perfis de Acesso', 'Gerenciar perfis e permissões'),
('settings', 'settings.departments', 'Departamentos', 'Gerenciar departamentos'),
('settings', 'settings.channels', 'Configurar Canais', 'Configurações avançadas de canais'),
('settings', 'settings.fields', 'Campos Personalizados', 'Gerenciar campos customizados'),
('settings', 'settings.tags', 'Etiquetas', 'Gerenciar tags e etiquetas'),
('settings', 'settings.close_reasons', 'Motivos de Fechamento', 'Gerenciar motivos de encerramento'),
('settings', 'settings.integrations', 'Integrações', 'Configurar integrações externas'),
('settings', 'settings.general', 'Configurações Gerais', 'Nome da empresa, horários, etc');