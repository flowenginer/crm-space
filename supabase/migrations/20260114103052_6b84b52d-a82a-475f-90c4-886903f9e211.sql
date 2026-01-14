-- Inserir API Key para teste
INSERT INTO public.integration_api_keys (tenant_id, name, api_key, permissions)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'N8N Integration',
  'sk_live_7f3a9b2c4d5e6f8a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a',
  '{"send_message": true, "read_contacts": true}'::jsonb
);