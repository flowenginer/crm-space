-- Script para sincronizar conversas órfãs
-- Problema: 948 contatos têm atendente responsável (contacts.assigned_to) 
-- mas suas conversas não têm atendente atual (conversations.assigned_to = NULL)

-- Primeiro, verificar quantas conversas serão afetadas
SELECT 
  COUNT(*) as total_orphan_conversations,
  COUNT(DISTINCT cv.contact_id) as total_contacts_affected
FROM conversations cv
JOIN contacts con ON cv.contact_id = con.id
WHERE cv.status IN ('open', 'pending')
  AND cv.assigned_to IS NULL
  AND con.assigned_to IS NOT NULL;

-- Atualizar conversas órfãs: atribuir o mesmo atendente do contato
UPDATE conversations cv
SET 
  assigned_to = con.assigned_to,
  updated_at = now()
FROM contacts con
WHERE cv.contact_id = con.id
  AND cv.status IN ('open', 'pending')
  AND cv.assigned_to IS NULL
  AND con.assigned_to IS NOT NULL;

-- Verificar resultado após a execução
SELECT 
  'Conversas sincronizadas' as status,
  COUNT(*) as remaining_orphans
FROM conversations cv
JOIN contacts con ON cv.contact_id = con.id
WHERE cv.status IN ('open', 'pending')
  AND cv.assigned_to IS NULL
  AND con.assigned_to IS NOT NULL;
