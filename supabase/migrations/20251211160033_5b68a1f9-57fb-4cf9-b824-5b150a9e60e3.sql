-- Inserir novas permissões granulares para relatórios
INSERT INTO permission_definitions (category, permission_key, permission_name, description)
VALUES 
  ('reports', 'reports.view_sla', 'Ver SLA', 'Acessar relatório de SLA e tempo de resposta'),
  ('reports', 'reports.view_attendance', 'Ver Atendimentos', 'Acessar relatório de atendimentos'),
  ('reports', 'reports.view_sales', 'Ver Vendas', 'Acessar relatório de vendas e faturamento'),
  ('reports', 'reports.view_satisfaction', 'Ver Satisfação', 'Acessar relatório de satisfação e NPS'),
  ('reports', 'reports.view_performance', 'Ver Performance', 'Acessar relatório de performance individual'),
  ('reports', 'reports.view_transfers', 'Ver Transferências', 'Acessar histórico de transferências'),
  ('reports', 'reports.view_calls', 'Ver Ligações', 'Acessar histórico de ligações')
ON CONFLICT (permission_key) DO UPDATE SET
  permission_name = EXCLUDED.permission_name,
  description = EXCLUDED.description;