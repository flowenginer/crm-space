-- Tabela para configuração dinâmica do menu
CREATE TABLE public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  href TEXT,                    -- NULL para menus que só abrem submenus (cascata)
  icon TEXT NOT NULL DEFAULT 'Circle',
  parent_id UUID REFERENCES public.menu_items(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  permission TEXT,              -- Ex: 'dashboard.view'
  roles TEXT[],                 -- Ex: ['admin', 'vendedor']
  is_active BOOLEAN DEFAULT true,
  show_badge TEXT,              -- Qual badge mostrar (pendingCount, scheduledCount, etc.)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index para ordenação e hierarquia
CREATE INDEX idx_menu_items_parent ON public.menu_items(parent_id);
CREATE INDEX idx_menu_items_position ON public.menu_items(position);

-- Enable RLS
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- Política: todos usuários autenticados podem visualizar
CREATE POLICY "Authenticated users can view menu items"
ON public.menu_items
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Política: apenas admins podem gerenciar
CREATE POLICY "Admins can manage menu items"
ON public.menu_items
FOR ALL
USING (is_admin_or_supervisor(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_menu_items_updated_at
BEFORE UPDATE ON public.menu_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir menu padrão baseado no menu atual
INSERT INTO public.menu_items (title, href, icon, position, permission, roles, is_active, show_badge) VALUES
('Dashboard', '/', 'LayoutDashboard', 1, 'dashboard.view', NULL, true, NULL),
('Produtos', NULL, 'Package', 2, 'settings.view', NULL, true, NULL),
('Agendamentos', '/agendamentos', 'CalendarClock', 3, 'schedules.view', NULL, true, 'scheduledCount'),
('Ao Vivo', '/ao-vivo', 'Radio', 4, 'live.view', NULL, true, 'liveBadge'),
('Atendimentos', '/relatorios/atendimentos', 'ClipboardList', 5, 'reports.view', NULL, true, NULL),
('Automações', '/automations', 'Workflow', 6, 'automations.view', NULL, true, NULL),
('Canais WhatsApp', '/whatsapp-channels', 'Radio', 7, 'channels.view', NULL, true, NULL),
('Chat Interno', '/internal-chat', 'MessagesSquare', 8, NULL, NULL, true, 'internalChatCount'),
('Contatos', '/contacts', 'Users', 9, 'contacts.view', NULL, true, NULL),
('Conversas', '/conversations', 'MessageSquare', 10, 'conversations.view', NULL, true, NULL),
('CRM', '/crm', 'TrendingUp', 11, 'deals.view', NULL, true, NULL),
('Financeiro', '/financial', 'Wallet', 12, 'financial.view', NULL, true, NULL),
('Mensagens Rápidas', '/quick-messages', 'Zap', 13, 'templates.view', NULL, true, NULL),
('Meta Ads', '/meta-ads', 'Megaphone', 14, 'marketing.view', NULL, true, NULL),
('Meu Painel', '/seller-dashboard', 'UserCircle', 15, NULL, ARRAY['vendedor', 'admin', 'supervisor'], true, NULL),
('Pedidos', '/orders', 'ShoppingCart', 16, 'orders.view', NULL, true, NULL),
('Relatório Campanhas', '/relatorios/campanhas', 'Target', 17, 'marketing.view_campaigns', NULL, true, NULL),
('Relatórios', '/reports', 'BarChart3', 18, 'reports.view', NULL, true, NULL),
('Requisições', '/conversations/requests', 'GitPullRequest', 19, 'conversations.requests', NULL, true, 'requestsCount'),
('Webhooks', '/webhooks', 'Link2', 20, 'webhooks.view', NULL, true, NULL),
('Configurações', '/settings', 'Settings', 100, 'settings.view', NULL, true, NULL);

-- Inserir submenus de Produtos
INSERT INTO public.menu_items (title, href, icon, parent_id, position, permission, is_active)
SELECT 
  sub.title,
  sub.href,
  sub.icon,
  (SELECT id FROM public.menu_items WHERE title = 'Produtos' AND parent_id IS NULL),
  sub.position,
  NULL,
  true
FROM (VALUES
  ('Catálogos', '/products/catalogs', 'Layers', 1),
  ('Produtos', '/products', 'Tags', 2),
  ('Templates', '/products/templates', 'LayoutTemplate', 3),
  ('Atributos', '/products/attributes', 'Settings2', 4),
  ('Regras de Preço', '/products/price-rules', 'DollarSign', 5)
) AS sub(title, href, icon, position);