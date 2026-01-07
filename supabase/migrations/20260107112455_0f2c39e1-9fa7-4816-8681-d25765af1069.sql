-- Function to safely increment responded_count in bulk_dispatches
CREATE OR REPLACE FUNCTION increment_dispatch_responded(p_dispatch_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE bulk_dispatches 
  SET responded_count = responded_count + 1,
      updated_at = NOW()
  WHERE id = p_dispatch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;