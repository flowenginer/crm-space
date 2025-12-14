-- Fix incorrect test data: cancel the followup that was incorrectly marked as sent
UPDATE quote_expiration_notifications
SET 
  status = 'cancelled', 
  cancelled_at = NOW(), 
  cancel_reason = 'manual_override'
WHERE id = '734d2468-3e53-419a-8363-09e05cbcfc32';