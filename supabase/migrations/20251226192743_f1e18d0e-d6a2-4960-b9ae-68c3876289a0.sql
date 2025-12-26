-- =====================================================
-- CORREÇÃO MULTI-TENANT: Adicionar tenant_id na função get_channel_by_instance
-- Precisa dropar e recriar porque estamos alterando o RETURNS TABLE
-- =====================================================

-- Primeiro dropar a função existente
DROP FUNCTION IF EXISTS public.get_channel_by_instance(text);

-- Recriar com tenant_id incluído
CREATE OR REPLACE FUNCTION public.get_channel_by_instance(
  p_instance_id TEXT
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  instance_id TEXT,
  department_id UUID,
  tenant_id UUID,
  provider_code TEXT,
  provider_base_url TEXT,
  provider_admin_token TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.id,
    c.name,
    c.instance_id,
    c.department_id,
    c.tenant_id,
    p.code as provider_code,
    p.base_url as provider_base_url,
    p.admin_token as provider_admin_token
  FROM whatsapp_channels c
  INNER JOIN whatsapp_providers p ON p.id = c.provider_id
  WHERE c.instance_id = p_instance_id
    AND c.is_deleted = FALSE
  LIMIT 1;
$$;

-- Garantir grant correto
GRANT EXECUTE ON FUNCTION public.get_channel_by_instance TO service_role;