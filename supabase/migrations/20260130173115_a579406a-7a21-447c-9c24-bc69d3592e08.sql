-- Add call permission fields to contacts table
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS call_permission_status TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS call_permission_requested_at TIMESTAMPTZ DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.contacts.call_permission_status IS 'Status da permissão de chamada: null (nunca solicitado), pending, granted, denied';
COMMENT ON COLUMN public.contacts.call_permission_requested_at IS 'Data/hora da última solicitação de permissão de chamada';