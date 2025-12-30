-- Alterar o DEFAULT para usar a função get_user_tenant_id()
ALTER TABLE chatbot_flows 
ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();

-- Criar função para setar tenant_id automaticamente
CREATE OR REPLACE FUNCTION set_chatbot_flow_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Se não veio tenant_id ou veio o default da plataforma, usa o do usuário
  IF NEW.tenant_id IS NULL OR NEW.tenant_id = '00000000-0000-0000-0000-000000000001' THEN
    NEW.tenant_id := get_user_tenant_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger para INSERT
CREATE TRIGGER set_chatbot_flow_tenant_id_trigger
BEFORE INSERT ON chatbot_flows
FOR EACH ROW
EXECUTE FUNCTION set_chatbot_flow_tenant_id();