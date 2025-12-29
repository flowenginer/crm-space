-- Store OAuth state + originating app URL so callback can redirect to a frontend page (Supabase Edge forces HTML to text/plain)
CREATE TABLE IF NOT EXISTS public.meta_oauth_states (
  state UUID PRIMARY KEY,
  user_id UUID NULL,
  tenant_id UUID NULL,
  redirect_origin TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.meta_oauth_states ENABLE ROW LEVEL SECURITY;

-- No client access needed; service-role edge function bypasses RLS.
-- Keep table locked down for safety.
CREATE POLICY "No direct access to meta_oauth_states"
ON public.meta_oauth_states
FOR ALL
USING (false)
WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_meta_oauth_states_created_at ON public.meta_oauth_states (created_at);
CREATE INDEX IF NOT EXISTS idx_meta_oauth_states_user_id ON public.meta_oauth_states (user_id);
CREATE INDEX IF NOT EXISTS idx_meta_oauth_states_tenant_id ON public.meta_oauth_states (tenant_id);