
-- ==========================================================
-- MIGRATION: Adicionar module_key granular à tabela menu_items
-- Objetivo: Eliminar colisões de module_key derivadas dinamicamente
-- ==========================================================

-- 1. Adicionar coluna module_key à tabela menu_items
ALTER TABLE public.menu_items 
ADD COLUMN IF NOT EXISTS module_key TEXT;

-- 2. Popular module_key com valores únicos baseados no path completo
-- Lógica:
--   /settings?tab=company  -> settings_company
--   /products/catalogs     -> products_catalogs
--   /reports?tab=sales     -> reports_sales
--   /gamification/rankings -> gamification_rankings
--   /                      -> dashboard
--   items sem href         -> NULL (menus cascata)

UPDATE public.menu_items
SET module_key = 
  CASE 
    -- Caso especial: dashboard (rota raiz)
    WHEN href = '/' THEN 'dashboard'
    -- Sem href = menu cascata, não tem module_key própria
    WHEN href IS NULL THEN NULL
    -- Normalizar: remover / inicial, converter / e - para _, converter ?tab= para _
    ELSE 
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(
              SUBSTRING(href FROM 2),  -- Remove o / inicial
              '/', '_'                  -- / -> _
            ),
            '-', '_'                    -- - -> _
          ),
          '?tab=', '_'                  -- ?tab= -> _
        ),
        '?', '_'                        -- ? genérico -> _
      )
  END
WHERE module_key IS NULL;

-- 3. Criar índice para performance de lookups
CREATE INDEX IF NOT EXISTS idx_menu_items_module_key 
ON public.menu_items(module_key) 
WHERE module_key IS NOT NULL;

-- 4. Criar índice composto para tenant + module_key
CREATE INDEX IF NOT EXISTS idx_menu_items_tenant_module_key 
ON public.menu_items(tenant_id, module_key) 
WHERE module_key IS NOT NULL;

-- ==========================================================
-- MIGRAR tenant_modules PARA KEYS GRANULARES
-- Objetivo: Converter keys genéricas (ex: "settings") para 
-- keys específicas (ex: "settings_company", "settings_team")
-- ==========================================================

-- 5. Criar função para expandir uma module_key genérica em keys granulares
CREATE OR REPLACE FUNCTION expand_legacy_module_key(
  p_tenant_id UUID,
  p_old_key TEXT
)
RETURNS TABLE(new_key TEXT) AS $$
BEGIN
  -- Buscar todas as module_keys que começam com a key antiga + underscore
  -- OU que são exatamente a key antiga
  RETURN QUERY
  SELECT DISTINCT m.module_key
  FROM menu_items m
  WHERE m.tenant_id = '00000000-0000-0000-0000-000000000001'  -- Base como referência
    AND m.module_key IS NOT NULL
    AND (
      m.module_key = p_old_key  -- Exata
      OR m.module_key LIKE p_old_key || '_%'  -- Começa com key_
    );
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

-- 6. Migrar tenant_modules existentes
DO $$
DECLARE
  v_tenant RECORD;
  v_module RECORD;
  v_expanded_key TEXT;
  v_keys_to_add TEXT[];
  v_existing_keys TEXT[];
BEGIN
  -- Para cada tenant
  FOR v_tenant IN 
    SELECT DISTINCT t.id 
    FROM tenants t 
    WHERE t.is_active = true
  LOOP
    -- Obter keys atuais deste tenant
    SELECT ARRAY_AGG(tm.module_key)
    INTO v_existing_keys
    FROM tenant_modules tm
    WHERE tm.tenant_id = v_tenant.id AND tm.is_enabled = true;
    
    v_existing_keys := COALESCE(v_existing_keys, ARRAY[]::TEXT[]);
    v_keys_to_add := ARRAY[]::TEXT[];
    
    -- Para cada módulo habilitado
    FOR v_module IN 
      SELECT tm.module_key 
      FROM tenant_modules tm 
      WHERE tm.tenant_id = v_tenant.id AND tm.is_enabled = true
    LOOP
      -- Verificar se é uma key "legacy" que precisa expansão
      -- (ex: "settings" sem sufixo, "products" sem sufixo, etc.)
      
      -- Buscar todas as keys granulares que expandem desta
      FOR v_expanded_key IN 
        SELECT new_key FROM expand_legacy_module_key(v_tenant.id, v_module.module_key)
      LOOP
        -- Se a key expandida não existe ainda, adicionar
        IF NOT v_expanded_key = ANY(v_existing_keys) AND NOT v_expanded_key = ANY(v_keys_to_add) THEN
          v_keys_to_add := v_keys_to_add || v_expanded_key;
        END IF;
      END LOOP;
    END LOOP;
    
    -- Inserir as novas keys granulares
    IF array_length(v_keys_to_add, 1) > 0 THEN
      INSERT INTO tenant_modules (tenant_id, module_key, is_enabled)
      SELECT v_tenant.id, unnest(v_keys_to_add), true
      ON CONFLICT (tenant_id, module_key) DO UPDATE SET is_enabled = true;
      
      RAISE NOTICE 'Tenant %: expanded % keys to granular', v_tenant.id, array_length(v_keys_to_add, 1);
    END IF;
  END LOOP;
END $$;

-- 7. Atualizar a função get_current_tenant_modules para usar module_key da tabela
CREATE OR REPLACE FUNCTION get_current_tenant_modules()
RETURNS TABLE(module_key TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT tm.module_key
  FROM tenant_modules tm
  WHERE tm.tenant_id = get_user_tenant_id()
    AND tm.is_enabled = true;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- 8. Criar função helper para obter todas as module_keys válidas (catálogo)
CREATE OR REPLACE FUNCTION get_all_module_keys()
RETURNS TABLE(module_key TEXT, title TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT m.module_key, m.title
  FROM menu_items m
  WHERE m.tenant_id = '00000000-0000-0000-0000-000000000001'  -- Base tenant
    AND m.module_key IS NOT NULL
    AND m.is_active = true
  ORDER BY m.module_key;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;
