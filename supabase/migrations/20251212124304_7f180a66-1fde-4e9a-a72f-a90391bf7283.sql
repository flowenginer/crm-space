-- Add contact_type field to contacts table
ALTER TABLE public.contacts 
ADD COLUMN contact_type text DEFAULT 'customer' 
CHECK (contact_type IN ('customer', 'supplier', 'both'));