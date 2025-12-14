
-- Cancel all pending notifications for quotes that are already auto-paused
UPDATE quote_expiration_notifications
SET 
  status = 'cancelled',
  cancelled_at = NOW(),
  cancel_reason = 'client_responded'
WHERE quote_id IN (
  SELECT id FROM quotes WHERE notifications_auto_paused = true
)
AND status = 'pending';
