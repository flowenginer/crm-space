UPDATE flow_executions
SET status = 'waiting_delay',
    error_message = NULL,
    waiting_until = NOW() - interval '1 minute'
WHERE flow_id = '381a4177-6a52-4531-9f2c-f09cb5fc586f'
  AND status = 'error'
  AND error_message IN ('Delay node not found', 'Timeout node not found')