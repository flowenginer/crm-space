-- Remover categoria 'crm' duplicada (já existe 'deals' com as mesmas permissões)
DELETE FROM permission_definitions WHERE category = 'crm';