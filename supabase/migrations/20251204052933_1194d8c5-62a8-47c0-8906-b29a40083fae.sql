-- Fix Scarlet's role in user_roles table
UPDATE public.user_roles 
SET role = 'seller' 
WHERE user_id = '97ad6ef8-24fd-458e-a193-5dac1f5a42c1';

-- Add unique constraint if not exists for upsert to work
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_key'
  ) THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);
  END IF;
END $$;