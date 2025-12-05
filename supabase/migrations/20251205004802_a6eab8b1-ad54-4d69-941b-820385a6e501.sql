
-- Manter o contato mais antigo (1adf4a82) e mesclar os outros nele
-- Primeiro, mesclar os contatos duplicados
SELECT merge_duplicate_contacts(
  '1adf4a82-9bf6-460e-a4db-09c434234d99'::uuid,  -- keep
  '2b2a3605-3b28-4d2e-a0ed-b0a1fe594bd8'::uuid,  -- duplicate
  false  -- não usar nome do duplicado
);

SELECT merge_duplicate_contacts(
  '1adf4a82-9bf6-460e-a4db-09c434234d99'::uuid,
  'a3ee16d6-97c9-49a5-8a4d-33bb55484fcc'::uuid,
  false
);

SELECT merge_duplicate_contacts(
  '1adf4a82-9bf6-460e-a4db-09c434234d99'::uuid,
  '3699f1f4-ec24-4fc8-b0cb-0310506a69ca'::uuid,
  false
);

-- Agora mesclar as conversas duplicadas na mais antiga (1f9b304b)
SELECT merge_duplicate_conversations(
  '1f9b304b-bda9-4a58-892d-e9fdbb19202e'::uuid,  -- keep
  '2f55d7fc-6946-4256-86a1-976831223b5a'::uuid   -- duplicate
);

SELECT merge_duplicate_conversations(
  '1f9b304b-bda9-4a58-892d-e9fdbb19202e'::uuid,
  '6e4f4309-e7ee-4fb8-bbdc-56c66550ec64'::uuid
);

SELECT merge_duplicate_conversations(
  '1f9b304b-bda9-4a58-892d-e9fdbb19202e'::uuid,
  '365483f5-5301-429b-9a9d-a84e2ffa26e3'::uuid
);
