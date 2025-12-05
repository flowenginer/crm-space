
-- Adicionar índice único no telefone para evitar duplicatas por race condition
-- Primeiro, verificar se não há duplicatas restantes
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) - COUNT(DISTINCT phone) INTO duplicate_count FROM contacts;
  IF duplicate_count > 0 THEN
    RAISE NOTICE 'Existem % telefones duplicados. Mescle manualmente antes de criar o índice.', duplicate_count;
  END IF;
END $$;

-- Criar índice único no telefone (se não houver duplicatas)
CREATE UNIQUE INDEX IF NOT EXISTS contacts_phone_unique ON contacts(phone);
