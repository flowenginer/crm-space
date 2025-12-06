-- =====================================================
-- TABELA: FLUXOS DE CHATBOT/AUTOMAÇÃO
-- =====================================================
CREATE TABLE IF NOT EXISTS chatbot_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT false,
  is_draft BOOLEAN DEFAULT true,
  channel_ids UUID[] DEFAULT '{}',
  run_once_per_contact BOOLEAN DEFAULT false,
  priority INTEGER DEFAULT 0,
  total_executions INTEGER DEFAULT 0,
  total_completions INTEGER DEFAULT 0,
  total_errors INTEGER DEFAULT 0,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  published_at TIMESTAMPTZ
);

-- =====================================================
-- TABELA: NÓS DO FLUXO (Blocos no canvas)
-- =====================================================
CREATE TABLE IF NOT EXISTS flow_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID REFERENCES chatbot_flows(id) ON DELETE CASCADE,
  name TEXT,
  node_type TEXT NOT NULL,
  node_subtype TEXT NOT NULL,
  position_x FLOAT DEFAULT 0,
  position_y FLOAT DEFAULT 0,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- TABELA: CONEXÕES ENTRE NÓS (Arestas)
-- =====================================================
CREATE TABLE IF NOT EXISTS flow_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID REFERENCES chatbot_flows(id) ON DELETE CASCADE,
  source_node_id UUID REFERENCES flow_nodes(id) ON DELETE CASCADE,
  target_node_id UUID REFERENCES flow_nodes(id) ON DELETE CASCADE,
  source_handle TEXT DEFAULT 'default',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- TABELA: EXECUÇÕES DE FLUXO (Tracking)
-- =====================================================
CREATE TABLE IF NOT EXISTS flow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID REFERENCES chatbot_flows(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  channel_id UUID REFERENCES whatsapp_channels(id) ON DELETE SET NULL,
  current_node_id UUID REFERENCES flow_nodes(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'running',
  variables JSONB DEFAULT '{}',
  waiting_until TIMESTAMPTZ,
  waiting_for TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- TABELA: LOGS DE EXECUÇÃO
-- =====================================================
CREATE TABLE IF NOT EXISTS flow_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID REFERENCES flow_executions(id) ON DELETE CASCADE,
  node_id UUID,
  log_type TEXT NOT NULL,
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- TABELA: TEMPLATES DE NÓS
-- =====================================================
CREATE TABLE IF NOT EXISTS flow_node_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  node_type TEXT NOT NULL,
  node_subtype TEXT NOT NULL,
  default_config JSONB DEFAULT '{}',
  icon TEXT,
  color TEXT,
  is_system BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- ÍNDICES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_flow_nodes_flow ON flow_nodes(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_connections_flow ON flow_connections(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_executions_status ON flow_executions(status);
CREATE INDEX IF NOT EXISTS idx_flow_executions_conversation ON flow_executions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_flows_active ON chatbot_flows(is_active) WHERE is_active = true;

-- =====================================================
-- RLS POLICIES
-- =====================================================
ALTER TABLE chatbot_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_node_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access chatbot_flows" ON chatbot_flows FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated access flow_nodes" ON flow_nodes FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated access flow_connections" ON flow_connections FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated access flow_executions" ON flow_executions FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated access flow_execution_logs" ON flow_execution_logs FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated access flow_node_templates" ON flow_node_templates FOR ALL USING (auth.uid() IS NOT NULL);

-- =====================================================
-- SEED: TEMPLATES DE NÓS
-- =====================================================
INSERT INTO flow_node_templates (name, description, category, node_type, node_subtype, icon, color, is_system, default_config) VALUES
-- TRIGGERS
('Palavra-chave', 'Inicia quando mensagem contém palavras específicas', 'trigger', 'trigger', 'keyword', 'MessageSquare', '#22C55E', true, '{"keywords": [], "match_type": "contains"}'),
('Novo Contato', 'Inicia quando um novo contato envia mensagem', 'trigger', 'trigger', 'new_contact', 'UserPlus', '#22C55E', true, '{}'),
('Primeira Mensagem', 'Inicia na primeira mensagem de uma conversa', 'trigger', 'trigger', 'first_message', 'MessageCircle', '#22C55E', true, '{}'),
('Tag Adicionada', 'Inicia quando tag é adicionada ao contato', 'trigger', 'trigger', 'tag_added', 'Tag', '#22C55E', true, '{"tag_id": ""}'),
('Inatividade', 'Inicia após X minutos sem resposta', 'trigger', 'trigger', 'inactivity', 'Clock', '#22C55E', true, '{"minutes": 30}'),

-- AÇÕES
('Enviar Texto', 'Envia mensagem de texto', 'action', 'action', 'send_text', 'Send', '#8B5CF6', true, '{"message": "", "typing_delay": 1000}'),
('Enviar Imagem', 'Envia imagem com legenda', 'action', 'action', 'send_image', 'Image', '#8B5CF6', true, '{"image_url": "", "caption": ""}'),
('Enviar Áudio', 'Envia mensagem de áudio', 'action', 'action', 'send_audio', 'Mic', '#8B5CF6', true, '{"audio_url": ""}'),
('Enviar Vídeo', 'Envia vídeo', 'action', 'action', 'send_video', 'Video', '#8B5CF6', true, '{"video_url": "", "caption": ""}'),
('Enviar Documento', 'Envia arquivo', 'action', 'action', 'send_document', 'File', '#8B5CF6', true, '{"document_url": "", "filename": ""}'),
('Enviar Botões', 'Envia mensagem com botões', 'action', 'action', 'send_buttons', 'LayoutGrid', '#8B5CF6', true, '{"message": "", "buttons": []}'),
('Enviar Lista', 'Envia lista de opções', 'action', 'action', 'send_list', 'List', '#8B5CF6', true, '{"message": "", "sections": []}'),
('Adicionar Tag', 'Adiciona tag ao contato', 'action', 'action', 'add_tag', 'Tag', '#8B5CF6', true, '{"tag_id": ""}'),
('Remover Tag', 'Remove tag do contato', 'action', 'action', 'remove_tag', 'X', '#8B5CF6', true, '{"tag_id": ""}'),
('Atribuir Atendente', 'Atribui conversa a atendente', 'action', 'action', 'assign_agent', 'UserCheck', '#8B5CF6', true, '{"user_id": ""}'),
('Transferir Departamento', 'Transfere para departamento', 'action', 'action', 'transfer_department', 'Building', '#8B5CF6', true, '{"department_id": ""}'),
('Alterar Status Lead', 'Muda status do lead', 'action', 'action', 'set_lead_status', 'TrendingUp', '#8B5CF6', true, '{"status": ""}'),
('Criar Negócio', 'Cria deal no CRM', 'action', 'action', 'create_deal', 'DollarSign', '#8B5CF6', true, '{"pipeline_id": "", "stage_id": "", "value": 0}'),
('Definir Variável', 'Define variável no fluxo', 'action', 'action', 'set_variable', 'Variable', '#8B5CF6', true, '{"name": "", "value": ""}'),
('Chamar Webhook', 'Faz requisição HTTP', 'action', 'action', 'http_request', 'Globe', '#8B5CF6', true, '{"url": "", "method": "POST", "body": {}}'),
('Adicionar Nota', 'Adiciona nota interna', 'action', 'action', 'add_note', 'StickyNote', '#8B5CF6', true, '{"note": ""}'),
('Fechar Conversa', 'Fecha a conversa', 'action', 'action', 'close_conversation', 'XCircle', '#8B5CF6', true, '{}'),

-- CONDIÇÕES
('Se/Então', 'Condição if/else', 'condition', 'condition', 'if_else', 'GitBranch', '#F59E0B', true, '{"variable": "", "operator": "equals", "value": ""}'),
('Contém Texto', 'Verifica se contém texto', 'condition', 'condition', 'contains', 'Search', '#F59E0B', true, '{"text": ""}'),
('Tem Tag', 'Verifica se tem tag', 'condition', 'condition', 'has_tag', 'Tag', '#F59E0B', true, '{"tag_id": ""}'),
('Status do Lead', 'Verifica status', 'condition', 'condition', 'lead_status', 'TrendingUp', '#F59E0B', true, '{"status": ""}'),
('Horário Comercial', 'Verifica horário', 'condition', 'condition', 'business_hours', 'Clock', '#F59E0B', true, '{"start": "09:00", "end": "18:00", "days": [1,2,3,4,5]}'),

-- DELAYS
('Aguardar Tempo', 'Espera X tempo', 'delay', 'delay', 'wait_time', 'Timer', '#EC4899', true, '{"amount": 5, "unit": "seconds"}'),
('Aguardar Resposta', 'Espera cliente responder', 'delay', 'delay', 'wait_reply', 'MessageSquare', '#EC4899', true, '{"timeout_minutes": 60}'),
('Aguardar Horário', 'Espera horário específico', 'delay', 'delay', 'wait_until', 'Calendar', '#EC4899', true, '{"time": "09:00"}'),

-- FINS
('Finalizar', 'Encerra o fluxo', 'end', 'end', 'end', 'CircleStop', '#EF4444', true, '{}'),
('Ir para Fluxo', 'Redireciona para outro fluxo', 'end', 'end', 'go_to_flow', 'ExternalLink', '#EF4444', true, '{"flow_id": ""}')
ON CONFLICT DO NOTHING;