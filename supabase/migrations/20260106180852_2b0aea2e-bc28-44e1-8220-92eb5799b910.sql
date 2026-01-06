-- Add schedule columns to bulk_dispatches table
ALTER TABLE public.bulk_dispatches 
ADD COLUMN IF NOT EXISTS schedule_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS schedule_override jsonb DEFAULT null;

-- Comment explaining the schedule_override format
COMMENT ON COLUMN public.bulk_dispatches.schedule_override IS 'Override schedule config. Format: { "start": "09:00", "end": "18:00", "days": [1,2,3,4,5], "timezone": "America/Sao_Paulo" }. When null, uses company_settings.business_hours.';