-- Create table for user's personal quick templates (max 5 favorites)
CREATE TABLE public.user_quick_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.message_templates(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 1 AND position <= 5),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, position),
  UNIQUE(user_id, template_id)
);

-- Enable RLS
ALTER TABLE public.user_quick_templates ENABLE ROW LEVEL SECURITY;

-- Users can only see their own quick templates
CREATE POLICY "Users can view own quick templates"
ON public.user_quick_templates
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own quick templates
CREATE POLICY "Users can create own quick templates"
ON public.user_quick_templates
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own quick templates
CREATE POLICY "Users can update own quick templates"
ON public.user_quick_templates
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own quick templates
CREATE POLICY "Users can delete own quick templates"
ON public.user_quick_templates
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_user_quick_templates_user_id ON public.user_quick_templates(user_id);
CREATE INDEX idx_user_quick_templates_template_id ON public.user_quick_templates(template_id);