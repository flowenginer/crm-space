-- Reset scheduled message for testing
UPDATE scheduled_messages 
SET status = 'scheduled', error_message = NULL, attempts = 0, scheduled_for = NOW() + interval '1 minute'
WHERE id = '545ec359-efd5-460f-b5ab-abedae5cfaa4';