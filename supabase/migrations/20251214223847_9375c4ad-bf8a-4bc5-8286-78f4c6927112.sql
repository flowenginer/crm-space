-- Parte 1: Adicionar Rhaniel à caixa de designers
INSERT INTO email_shared_box_members (shared_box_id, user_id, is_active, order_position)
VALUES ('bf29833d-3cd7-42a6-9bde-8cd2a83ec5a3', '761399dc-acd5-4682-82a5-2d50400e9a98', true, 0)
ON CONFLICT (shared_box_id, user_id) DO UPDATE SET is_active = true;

-- Parte 2: Configurar realtime para internal_emails
ALTER TABLE internal_emails REPLICA IDENTITY FULL;
ALTER TABLE internal_email_recipients REPLICA IDENTITY FULL;

-- Adicionar tabelas à publicação de realtime
ALTER PUBLICATION supabase_realtime ADD TABLE internal_emails;
ALTER PUBLICATION supabase_realtime ADD TABLE internal_email_recipients;