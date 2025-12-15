-- Enable full row data for UPDATE/DELETE events (helps realtime + cache invalidation correctness)
ALTER TABLE public.departments REPLICA IDENTITY FULL;
ALTER TABLE public.user_departments REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.user_roles REPLICA IDENTITY FULL;

-- Ensure tables are included in Supabase Realtime publication
DO $$
BEGIN
  -- Add tables one by one to avoid failure if some are already present
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.departments;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_departments;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;