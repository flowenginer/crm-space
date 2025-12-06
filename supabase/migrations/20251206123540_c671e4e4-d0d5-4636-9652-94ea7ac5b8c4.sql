-- Create close_reasons table for customizable conversation close reasons
CREATE TABLE public.close_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  value text NOT NULL UNIQUE,
  color text DEFAULT '#8B5CF6',
  is_active boolean DEFAULT true,
  order_position integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.close_reasons ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Authenticated access close_reasons" 
ON public.close_reasons 
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- Insert default close reasons
INSERT INTO public.close_reasons (name, value, color, order_position) VALUES
  ('Venda realizada', 'sold', '#22C55E', 1),
  ('Sem interesse', 'no_interest', '#EF4444', 2),
  ('Contato futuro', 'future_contact', '#F59E0B', 3),
  ('Duplicado', 'duplicate', '#6B7280', 4),
  ('Spam', 'spam', '#1F2937', 5),
  ('Número errado', 'wrong_number', '#8B5CF6', 6),
  ('Outro motivo', 'other', '#3B82F6', 7);