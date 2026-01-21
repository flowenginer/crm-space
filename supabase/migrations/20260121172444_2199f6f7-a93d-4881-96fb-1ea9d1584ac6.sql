-- Drop and recreate VIEW to include real_conversion based on lead status
DROP VIEW IF EXISTS sales_evaluations_with_conversation;

CREATE VIEW sales_evaluations_with_conversation AS
SELECT 
  se.*,
  c.created_at as conversation_created_at,
  c.last_message_at as conversation_last_message_at,
  c.contact_id,
  ct.lead_status,
  -- Flag de conversão real baseada no status "07 - Pedido Fechado"
  CASE WHEN ct.lead_status = '07 - Pedido Fechado' THEN true ELSE false END as real_conversion
FROM sales_evaluations se
LEFT JOIN conversations c ON c.id = se.conversation_id
LEFT JOIN contacts ct ON ct.id = c.contact_id;