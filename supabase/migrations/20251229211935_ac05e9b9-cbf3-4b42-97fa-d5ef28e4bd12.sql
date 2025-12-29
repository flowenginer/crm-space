-- Add transaction fields to payment_links table
ALTER TABLE public.payment_links 
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS transaction_id TEXT,
ADD COLUMN IF NOT EXISTS authorization_code TEXT,
ADD COLUMN IF NOT EXISTS nsu TEXT,
ADD COLUMN IF NOT EXISTS card_brand TEXT,
ADD COLUMN IF NOT EXISTS card_last_digits TEXT,
ADD COLUMN IF NOT EXISTS installments_used INTEGER;

-- Create a view for public access to payment links (non-sensitive data only)
CREATE OR REPLACE VIEW public.payment_links_public AS
SELECT 
  id,
  amount,
  description,
  customer_name,
  expires_at,
  status,
  payment_methods,
  max_installments,
  tenant_id,
  created_at
FROM public.payment_links;

-- Enable RLS on the view is not needed, but we need a function for public access
CREATE OR REPLACE FUNCTION public.get_public_payment_link(link_id UUID)
RETURNS TABLE (
  id UUID,
  amount NUMERIC,
  description TEXT,
  customer_name TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  status TEXT,
  payment_methods TEXT[],
  max_installments INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  company_name TEXT,
  logo_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pl.id,
    pl.amount,
    pl.description,
    pl.customer_name,
    pl.expires_at,
    pl.status,
    pl.payment_methods,
    pl.max_installments,
    pl.created_at,
    cs.company_name,
    cs.logo_url
  FROM public.payment_links pl
  LEFT JOIN public.company_settings cs ON cs.tenant_id = pl.tenant_id
  WHERE pl.id = link_id;
END;
$$;

-- Grant execute permission to anon role for public access
GRANT EXECUTE ON FUNCTION public.get_public_payment_link(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_payment_link(UUID) TO authenticated;