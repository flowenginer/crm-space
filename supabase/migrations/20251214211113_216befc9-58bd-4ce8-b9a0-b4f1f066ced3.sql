-- Drop problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Recipients can view emails" ON internal_emails;
DROP POLICY IF EXISTS "Sender can view recipients of own emails" ON internal_email_recipients;
DROP POLICY IF EXISTS "Recipients can view attachments" ON internal_email_attachments;

-- Create SECURITY DEFINER helper functions to avoid RLS recursion
CREATE OR REPLACE FUNCTION is_email_recipient(p_email_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM internal_email_recipients 
    WHERE email_id = p_email_id 
    AND user_id = p_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION is_email_sender(p_email_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM internal_emails 
    WHERE id = p_email_id 
    AND sender_id = p_user_id
  );
END;
$$;

-- Recreate policies using helper functions (no recursion)
CREATE POLICY "Recipients can view emails"
ON internal_emails
FOR SELECT
USING (is_email_recipient(id, auth.uid()));

CREATE POLICY "Sender can view recipients of own emails"
ON internal_email_recipients
FOR SELECT
USING (is_email_sender(email_id, auth.uid()));

CREATE POLICY "Recipients can view attachments"
ON internal_email_attachments
FOR SELECT
USING (is_email_recipient(email_id, auth.uid()));