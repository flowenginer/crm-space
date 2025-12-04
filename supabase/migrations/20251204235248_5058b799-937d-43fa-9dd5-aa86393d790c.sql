-- =====================================================
-- MIGRAÇÃO: Mesclar contatos LID com seus números reais
-- =====================================================

-- 1. Eliel Schemer (LID: 210397663633537) → 5515991794809
-- O contato com número real é: ca4518a2-f6b5-4cf5-b1cc-e3b8ee4580ae (WhatsApp 5515991794809)
-- O contato LID é: 056bef18-6a6c-4fed-943b-c9e70de25bb6 (Eliel Schemer)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM contacts WHERE id = 'ca4518a2-f6b5-4cf5-b1cc-e3b8ee4580ae')
     AND EXISTS (SELECT 1 FROM contacts WHERE id = '056bef18-6a6c-4fed-943b-c9e70de25bb6') THEN
    PERFORM merge_duplicate_contacts(
      'ca4518a2-f6b5-4cf5-b1cc-e3b8ee4580ae'::UUID,
      '056bef18-6a6c-4fed-943b-c9e70de25bb6'::UUID,
      true
    );
    RAISE NOTICE 'Merged Eliel Schemer';
  END IF;
END $$;

-- 2. Lego (LID: 254498320724051) → 553899223548
-- O contato com número real é: 00dca3d1-d9d3-47c5-9583-7d381073d7c2 (WhatsApp 553899223548)
-- O contato LID é: 71929d97-0fa6-45e2-9177-b9f4f32e948f (Lego)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM contacts WHERE id = '00dca3d1-d9d3-47c5-9583-7d381073d7c2')
     AND EXISTS (SELECT 1 FROM contacts WHERE id = '71929d97-0fa6-45e2-9177-b9f4f32e948f') THEN
    PERFORM merge_duplicate_contacts(
      '00dca3d1-d9d3-47c5-9583-7d381073d7c2'::UUID,
      '71929d97-0fa6-45e2-9177-b9f4f32e948f'::UUID,
      true
    );
    RAISE NOTICE 'Merged Lego';
  END IF;
END $$;

-- 3. desafioqueroalmas03 (LID: 269844373102838) → 5519971688099
-- O contato com número real é: cfd6d88c-9f83-4343-b388-5ce319a3cc19 (WhatsApp 5519971688099)
-- O contato LID é: 01db6f7b-2b33-4944-8d42-7589c659901c (desafioqueroalmas03)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM contacts WHERE id = 'cfd6d88c-9f83-4343-b388-5ce319a3cc19')
     AND EXISTS (SELECT 1 FROM contacts WHERE id = '01db6f7b-2b33-4944-8d42-7589c659901c') THEN
    PERFORM merge_duplicate_contacts(
      'cfd6d88c-9f83-4343-b388-5ce319a3cc19'::UUID,
      '01db6f7b-2b33-4944-8d42-7589c659901c'::UUID,
      true
    );
    RAISE NOTICE 'Merged desafioqueroalmas03';
  END IF;
END $$;