-- Corrigir contatos que foram criados com o nome da empresa ao invés do cliente
-- Isso acontecia quando mensagens fromMe usavam pushName (nome do perfil WhatsApp Business)

UPDATE contacts
SET 
  full_name = 'WhatsApp ' || phone,
  updated_at = NOW()
WHERE (
  full_name ILIKE '%Space Sports%'
  OR full_name ILIKE '%Space Sport%'
)
AND full_name NOT LIKE 'WhatsApp %';