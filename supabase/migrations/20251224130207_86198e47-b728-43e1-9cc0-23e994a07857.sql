-- =====================================================
-- FASE 1: CORREÇÃO DO ISOLAMENTO DE TENANTS (COMPLETO)
-- =====================================================

-- 1.1 Criar função trigger para definir tenant_id automaticamente
CREATE OR REPLACE FUNCTION public.set_tenant_id_from_user()
RETURNS TRIGGER AS $$
DECLARE
  user_tenant_id uuid;
BEGIN
  -- Se tenant_id já foi fornecido e é válido (não é o tenant base), manter
  IF NEW.tenant_id IS NOT NULL AND NEW.tenant_id != '00000000-0000-0000-0000-000000000001'::uuid THEN
    RETURN NEW;
  END IF;
  
  -- Buscar tenant_id do usuário autenticado
  user_tenant_id := get_user_tenant_id();
  
  -- Se o usuário tem tenant_id, usar ele
  IF user_tenant_id IS NOT NULL THEN
    NEW.tenant_id := user_tenant_id;
  ELSIF NEW.tenant_id IS NULL THEN
    -- Se não tem usuário autenticado e tenant_id é NULL, erro
    RAISE EXCEPTION 'tenant_id é obrigatório e não foi possível determinar automaticamente';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 1.2 Função para criar triggers em massa (apenas em tabelas base)
CREATE OR REPLACE FUNCTION public.create_tenant_triggers()
RETURNS void AS $$
DECLARE
  tbl_name text;
  trigger_name text;
BEGIN
  -- Lista de todas as TABELAS (não views) com tenant_id
  FOR tbl_name IN 
    SELECT c.table_name 
    FROM information_schema.columns c
    JOIN information_schema.tables t ON c.table_name = t.table_name AND c.table_schema = t.table_schema
    WHERE c.table_schema = 'public' 
    AND c.column_name = 'tenant_id'
    AND t.table_type = 'BASE TABLE'
    AND c.table_name NOT IN ('tenants')
  LOOP
    trigger_name := 'trigger_set_tenant_id_' || tbl_name;
    
    -- Remover trigger existente se houver
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', trigger_name, tbl_name);
    
    -- Criar novo trigger
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user()',
      trigger_name, tbl_name
    );
    
    RAISE NOTICE 'Trigger criado para tabela: %', tbl_name;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Executar criação dos triggers
SELECT create_tenant_triggers();

-- 1.3 Atualizar trigger de novo usuário para definir tenant_id corretamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  invitation_record RECORD;
  user_tenant_id uuid;
BEGIN
  -- Buscar convite pelo email
  SELECT * INTO invitation_record
  FROM invitations
  WHERE email = NEW.email
  AND status = 'pending'
  AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Se encontrou convite, usar tenant_id do convite
  IF invitation_record.id IS NOT NULL THEN
    user_tenant_id := invitation_record.tenant_id;
  ELSE
    -- Se não tem convite, criar novo tenant para o usuário
    INSERT INTO tenants (name, slug, is_active)
    VALUES (
      COALESCE(NEW.raw_user_meta_data->>'company_name', 'Minha Empresa'),
      COALESCE(
        NEW.raw_user_meta_data->>'company_slug',
        'tenant-' || substr(NEW.id::text, 1, 8)
      ),
      true
    )
    RETURNING id INTO user_tenant_id;
    
    -- Criar configurações padrão para o novo tenant
    INSERT INTO company_settings (tenant_id, company_name)
    VALUES (user_tenant_id, COALESCE(NEW.raw_user_meta_data->>'company_name', 'Minha Empresa'));
  END IF;
  
  -- Criar perfil com tenant_id correto
  INSERT INTO public.profiles (
    id,
    tenant_id,
    full_name,
    email,
    role,
    is_active,
    is_available
  )
  VALUES (
    NEW.id,
    user_tenant_id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    CASE WHEN invitation_record.id IS NOT NULL THEN invitation_record.role ELSE 'admin' END,
    true,
    true
  );
  
  -- Atualizar status do convite se existir
  IF invitation_record.id IS NOT NULL THEN
    UPDATE invitations
    SET status = 'accepted', accepted_at = now()
    WHERE id = invitation_record.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 1.4 Criar função de auditoria para verificar integridade
CREATE OR REPLACE FUNCTION public.audit_tenant_data_integrity()
RETURNS TABLE(
  table_name text,
  total_records bigint,
  records_in_base_tenant bigint,
  orphan_records bigint
) AS $$
DECLARE
  tbl_name text;
  base_tenant_id uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  FOR tbl_name IN 
    SELECT c.table_name 
    FROM information_schema.columns c
    JOIN information_schema.tables t ON c.table_name = t.table_name AND c.table_schema = t.table_schema
    WHERE c.table_schema = 'public' 
    AND c.column_name = 'tenant_id'
    AND t.table_type = 'BASE TABLE'
    AND c.table_name NOT IN ('tenants')
  LOOP
    RETURN QUERY EXECUTE format(
      'SELECT 
        %L::text as table_name,
        COUNT(*)::bigint as total_records,
        COUNT(*) FILTER (WHERE tenant_id = %L)::bigint as records_in_base_tenant,
        COUNT(*) FILTER (WHERE tenant_id IS NULL)::bigint as orphan_records
       FROM public.%I',
      tbl_name, base_tenant_id, tbl_name
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 1.5 Criar função para migrar dados de um tenant para outro
CREATE OR REPLACE FUNCTION public.migrate_user_data_to_correct_tenant(
  p_user_id uuid,
  p_correct_tenant_id uuid
)
RETURNS TABLE(
  table_name text,
  records_migrated bigint
) AS $$
DECLARE
  tbl_name text;
  migrated_count bigint;
BEGIN
  -- Apenas super_admins podem executar
  IF NOT is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas super admins podem migrar dados entre tenants';
  END IF;

  -- Migrar perfil do usuário primeiro
  UPDATE profiles SET tenant_id = p_correct_tenant_id WHERE id = p_user_id;
  
  -- Migrar registros associados ao usuário em tabelas com assigned_to
  FOR tbl_name IN 
    SELECT c.table_name 
    FROM information_schema.columns c
    JOIN information_schema.tables t ON c.table_name = t.table_name AND c.table_schema = t.table_schema
    WHERE c.table_schema = 'public' 
    AND c.column_name = 'assigned_to'
    AND t.table_type = 'BASE TABLE'
    AND EXISTS (
      SELECT 1 FROM information_schema.columns c2 
      WHERE c2.table_name = c.table_name 
      AND c2.column_name = 'tenant_id'
    )
  LOOP
    EXECUTE format(
      'UPDATE public.%I SET tenant_id = $1 WHERE assigned_to = $2',
      tbl_name
    ) USING p_correct_tenant_id, p_user_id;
    
    GET DIAGNOSTICS migrated_count = ROW_COUNT;
    
    IF migrated_count > 0 THEN
      RETURN QUERY SELECT tbl_name, migrated_count;
    END IF;
  END LOOP;
  
  -- Migrar registros criados pelo usuário em tabelas com created_by
  FOR tbl_name IN 
    SELECT c.table_name 
    FROM information_schema.columns c
    JOIN information_schema.tables t ON c.table_name = t.table_name AND c.table_schema = t.table_schema
    WHERE c.table_schema = 'public' 
    AND c.column_name = 'created_by'
    AND t.table_type = 'BASE TABLE'
    AND EXISTS (
      SELECT 1 FROM information_schema.columns c2 
      WHERE c2.table_name = c.table_name 
      AND c2.column_name = 'tenant_id'
    )
  LOOP
    EXECUTE format(
      'UPDATE public.%I SET tenant_id = $1 WHERE created_by = $2',
      tbl_name
    ) USING p_correct_tenant_id, p_user_id;
    
    GET DIAGNOSTICS migrated_count = ROW_COUNT;
    
    IF migrated_count > 0 THEN
      RETURN QUERY SELECT tbl_name, migrated_count;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;