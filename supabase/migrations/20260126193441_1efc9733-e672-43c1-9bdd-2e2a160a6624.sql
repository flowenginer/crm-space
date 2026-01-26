-- Fix RLS policies for products to ensure authenticated users can read tenant products

-- Ensure RLS is enabled (idempotent)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Drop the existing policy (it appears to be blocking reads)
DROP POLICY IF EXISTS "Tenant isolation for products" ON public.products;

-- Read access: users can read products in their tenant
CREATE POLICY "Products are readable within tenant"
ON public.products
FOR SELECT
TO authenticated
USING (
  tenant_id = (
    SELECT p.tenant_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

-- Insert access: users can insert products only into their tenant
CREATE POLICY "Products are insertable within tenant"
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (
  tenant_id = (
    SELECT p.tenant_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

-- Update access: users can update products only within their tenant
CREATE POLICY "Products are updatable within tenant"
ON public.products
FOR UPDATE
TO authenticated
USING (
  tenant_id = (
    SELECT p.tenant_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
)
WITH CHECK (
  tenant_id = (
    SELECT p.tenant_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);

-- Delete access: users can delete products only within their tenant
CREATE POLICY "Products are deletable within tenant"
ON public.products
FOR DELETE
TO authenticated
USING (
  tenant_id = (
    SELECT p.tenant_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
  )
);
