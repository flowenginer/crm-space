-- Corrigir contato com LID para número real
UPDATE contacts 
SET 
  phone = '558387634965',
  full_name = 'ALITEC Soluções em lavadoras',
  updated_at = NOW()
WHERE id = '1adf4a82-9bf6-460e-a4db-09c434234d99';

-- Buscar e corrigir outros contatos que podem ter LID como telefone
-- (LIDs geralmente começam com números altos como 9184, 1584, etc e têm mais de 13 dígitos)