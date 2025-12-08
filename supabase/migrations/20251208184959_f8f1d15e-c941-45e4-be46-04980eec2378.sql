-- Adicionar campos para controle de tempo e reabertura
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS total_active_time_seconds integer DEFAULT 0;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS reopened_at timestamp with time zone;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS reopen_count integer DEFAULT 0;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS previous_close_reason text;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS previous_closed_at timestamp with time zone;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS previous_closed_by uuid REFERENCES profiles(id);

-- Habilitar realtime para os novos campos
ALTER TABLE conversations REPLICA IDENTITY FULL;