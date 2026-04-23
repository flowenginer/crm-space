-- Add Meta template support to scheduled_messages
-- Spec: docs/spec-scheduled-meta-templates.md

ALTER TABLE public.scheduled_messages
  ADD COLUMN IF NOT EXISTS meta_template_id uuid
    REFERENCES public.meta_message_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_name text,
  ADD COLUMN IF NOT EXISTS template_language text,
  ADD COLUMN IF NOT EXISTS template_components jsonb,
  ADD COLUMN IF NOT EXISTS template_header_media_url text;

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_meta_template
  ON public.scheduled_messages(meta_template_id)
  WHERE meta_template_id IS NOT NULL;

COMMENT ON COLUMN public.scheduled_messages.meta_template_id IS
  'FK para meta_message_templates. Usado quando message_type=''template''.';
COMMENT ON COLUMN public.scheduled_messages.template_components IS
  'Snapshot dos components no momento do agendamento, evita divergencia se template for alterado/removido antes do envio.';
