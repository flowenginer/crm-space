-- Fix stuck call permission status for Michel Santos (phone 5521992731918)
-- The customer already accepted the call permission in WhatsApp, but the webhook fix was deployed after the reply events.
UPDATE public.contacts
SET call_permission_status = 'granted',
    call_permission_requested_at = COALESCE(call_permission_requested_at, now()),
    updated_at = now()
WHERE id = '29ade8db-c839-4b5f-bbcf-5148663a52bf';