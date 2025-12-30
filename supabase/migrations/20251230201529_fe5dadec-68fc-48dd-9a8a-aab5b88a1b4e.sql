-- Add new columns to redirect_ab_tests for advanced A/B testing functionality
ALTER TABLE public.redirect_ab_tests 
ADD COLUMN IF NOT EXISTS goal_type text CHECK (goal_type IN ('visits', 'leads', 'time')),
ADD COLUMN IF NOT EXISTS goal_value integer,
ADD COLUMN IF NOT EXISTS goal_reached boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS end_date timestamptz,
ADD COLUMN IF NOT EXISTS winner_variant_id uuid REFERENCES public.redirect_ab_test_variants(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'running' CHECK (status IN ('running', 'paused', 'completed')),
ADD COLUMN IF NOT EXISTS auto_winner boolean DEFAULT false;

-- Add index for status filtering
CREATE INDEX IF NOT EXISTS idx_redirect_ab_tests_status ON public.redirect_ab_tests(status);

-- Add index for tenant + status queries
CREATE INDEX IF NOT EXISTS idx_redirect_ab_tests_tenant_status ON public.redirect_ab_tests(tenant_id, status);