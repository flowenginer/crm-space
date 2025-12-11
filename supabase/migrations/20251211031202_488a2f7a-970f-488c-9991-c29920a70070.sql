-- Create table for call result types
CREATE TABLE public.call_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6b7280',
  icon TEXT DEFAULT 'Phone',
  order_position INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for call logs
CREATE TABLE public.call_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  call_date DATE NOT NULL DEFAULT CURRENT_DATE,
  call_time TIME NOT NULL DEFAULT CURRENT_TIME,
  result_id UUID REFERENCES public.call_results(id) ON DELETE SET NULL,
  notes TEXT,
  schedule_followup BOOLEAN DEFAULT false,
  followup_date TIMESTAMP WITH TIME ZONE,
  followup_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.call_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for call_results (read-only for authenticated users)
CREATE POLICY "Authenticated users can view call results"
  ON public.call_results FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage call results"
  ON public.call_results FOR ALL
  USING (is_admin_or_supervisor(auth.uid()));

-- RLS Policies for call_logs
CREATE POLICY "Users can view all call logs"
  ON public.call_logs FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can create call logs"
  ON public.call_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own call logs"
  ON public.call_logs FOR UPDATE
  USING (auth.uid() = user_id OR is_admin_or_supervisor(auth.uid()));

CREATE POLICY "Admins can delete call logs"
  ON public.call_logs FOR DELETE
  USING (is_admin_or_supervisor(auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_call_logs_contact_id ON public.call_logs(contact_id);
CREATE INDEX idx_call_logs_user_id ON public.call_logs(user_id);
CREATE INDEX idx_call_logs_call_date ON public.call_logs(call_date);
CREATE INDEX idx_call_logs_result_id ON public.call_logs(result_id);

-- Insert default call result types
INSERT INTO public.call_results (name, color, icon, order_position) VALUES
  ('Não atendeu', '#ef4444', 'PhoneMissed', 1),
  ('Ocupado', '#f97316', 'PhoneOff', 2),
  ('Pediu pra retornar depois', '#eab308', 'PhoneForwarded', 3),
  ('Atendeu - Interessado', '#22c55e', 'PhoneCall', 4),
  ('Atendeu - Sem interesse', '#6b7280', 'PhoneOff', 5),
  ('Atendeu - Fechou negócio', '#10b981', 'Check', 6),
  ('Caixa postal', '#8b5cf6', 'Voicemail', 7),
  ('Número inválido', '#dc2626', 'PhoneOff', 8);