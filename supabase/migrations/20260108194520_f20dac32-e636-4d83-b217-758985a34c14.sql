-- Remove the sync-whatsapp-channels cron job that runs every 3 minutes
-- This job was incorrectly marking channels as disconnected

DO $$
DECLARE
  job_record RECORD;
BEGIN
  FOR job_record IN 
    SELECT jobid FROM cron.job WHERE jobname = 'sync-whatsapp-channels'
  LOOP
    PERFORM cron.unschedule(job_record.jobid);
    RAISE NOTICE 'Unscheduled job with id: %', job_record.jobid;
  END LOOP;
END $$;