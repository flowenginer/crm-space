-- Add skipped_count column to track contacts that were skipped during dispatch
ALTER TABLE bulk_dispatches ADD COLUMN skipped_count INTEGER DEFAULT 0;

-- Add comment explaining the column
COMMENT ON COLUMN bulk_dispatches.skipped_count IS 'Number of contacts skipped during dispatch (e.g., due to disconnected channel)';

-- Populate skipped_count for existing dispatches based on bulk_dispatch_contacts status
UPDATE bulk_dispatches bd
SET skipped_count = (
  SELECT COUNT(*) 
  FROM bulk_dispatch_contacts bdc 
  WHERE bdc.dispatch_id = bd.id AND bdc.status = 'skipped'
);