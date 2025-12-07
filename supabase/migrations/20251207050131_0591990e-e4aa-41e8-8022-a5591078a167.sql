-- Add negotiated_value column to contacts table
ALTER TABLE contacts ADD COLUMN negotiated_value NUMERIC DEFAULT 0;