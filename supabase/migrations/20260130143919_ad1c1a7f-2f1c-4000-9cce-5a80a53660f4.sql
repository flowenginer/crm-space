-- Habilitar chamadas na configuração Cloud API ativa
UPDATE public.cloudapi_configs
SET calling_enabled = true,
    updated_at = now()
WHERE id = '88f42b33-ac4a-488c-98a8-5cc6f6341b24';