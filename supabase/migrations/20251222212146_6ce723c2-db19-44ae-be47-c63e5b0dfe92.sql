-- Create tenant_invitations table
CREATE TABLE public.tenant_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent',
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  CONSTRAINT valid_role CHECK (role IN ('admin', 'supervisor', 'agent'))
);

-- Create index for faster lookups
CREATE INDEX idx_tenant_invitations_tenant ON public.tenant_invitations(tenant_id);
CREATE INDEX idx_tenant_invitations_email ON public.tenant_invitations(email);
CREATE INDEX idx_tenant_invitations_token ON public.tenant_invitations(token);
CREATE INDEX idx_tenant_invitations_status ON public.tenant_invitations(status);

-- Enable RLS
ALTER TABLE public.tenant_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage invitations for their tenant"
ON public.tenant_invitations
FOR ALL
USING (
  tenant_id = get_user_tenant_id() AND 
  is_admin_or_supervisor(auth.uid())
);

CREATE POLICY "Users can view invitations by token"
ON public.tenant_invitations
FOR SELECT
USING (true);

-- Function to check and expire old invitations
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.tenant_invitations
  SET status = 'expired', updated_at = now()
  WHERE status = 'pending' AND expires_at < now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to accept invitation
CREATE OR REPLACE FUNCTION accept_invitation(invitation_token TEXT, user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
  result JSONB;
BEGIN
  -- Get invitation
  SELECT * INTO inv FROM tenant_invitations 
  WHERE token = invitation_token AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Convite não encontrado ou já utilizado');
  END IF;
  
  IF inv.expires_at < now() THEN
    UPDATE tenant_invitations SET status = 'expired', updated_at = now() WHERE id = inv.id;
    RETURN jsonb_build_object('success', false, 'error', 'Convite expirado');
  END IF;
  
  -- Update user's tenant_id in profiles
  UPDATE profiles SET tenant_id = inv.tenant_id WHERE id = user_id;
  
  -- Add user role
  INSERT INTO user_roles (user_id, role)
  VALUES (user_id, inv.role::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- If department specified, add to user_departments
  IF inv.department_id IS NOT NULL THEN
    INSERT INTO user_departments (user_id, department_id, tenant_id)
    VALUES (user_id, inv.department_id, inv.tenant_id)
    ON CONFLICT DO NOTHING;
  END IF;
  
  -- Mark invitation as accepted
  UPDATE tenant_invitations 
  SET status = 'accepted', accepted_at = now(), accepted_by = user_id, updated_at = now()
  WHERE id = inv.id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'tenant_id', inv.tenant_id,
    'role', inv.role
  );
END;
$$;