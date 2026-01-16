-- Create bucket for chatbot flow audio files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chatbot-audio', 'chatbot-audio', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload audio files
CREATE POLICY "Users can upload chatbot audio" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'chatbot-audio' AND auth.role() = 'authenticated');

-- Allow anyone to view/download audio files (needed for WhatsApp to fetch)
CREATE POLICY "Chatbot audio is publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'chatbot-audio');

-- Allow authenticated users to delete their uploaded audio
CREATE POLICY "Users can delete chatbot audio" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'chatbot-audio' AND auth.role() = 'authenticated');