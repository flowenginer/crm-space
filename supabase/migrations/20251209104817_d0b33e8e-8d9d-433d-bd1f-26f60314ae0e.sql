-- Dropar versões antigas das funções com p_channel_id uuid que estão causando conflito PGRST203

-- Dropar get_all_conversation_counts com p_channel_id uuid
DROP FUNCTION IF EXISTS public.get_all_conversation_counts(
  p_user_id uuid,
  p_timezone text,
  p_department_id uuid,
  p_agent_id uuid,
  p_channel_id uuid,
  p_origin text,
  p_date_filter text,
  p_status_filter text
);

-- Dropar get_date_filter_counts com p_channel_id uuid
DROP FUNCTION IF EXISTS public.get_date_filter_counts(
  p_timezone text,
  p_department_id uuid,
  p_agent_id uuid,
  p_channel_id uuid,
  p_origin text,
  p_status_filter text
);