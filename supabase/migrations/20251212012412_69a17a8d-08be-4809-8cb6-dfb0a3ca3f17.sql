-- Create product_catalogs table
CREATE TABLE public.product_catalogs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  cover_image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_catalogs ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Authenticated access product_catalogs"
ON public.product_catalogs
FOR ALL
USING (auth.uid() IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_product_catalogs_updated_at
BEFORE UPDATE ON public.product_catalogs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index on slug
CREATE INDEX idx_product_catalogs_slug ON public.product_catalogs(slug);
CREATE INDEX idx_product_catalogs_is_active ON public.product_catalogs(is_active);
CREATE INDEX idx_product_catalogs_display_order ON public.product_catalogs(display_order);