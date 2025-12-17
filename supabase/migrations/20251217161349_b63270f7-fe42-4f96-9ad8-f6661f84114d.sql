-- ==========================================
-- ETAPA 1: Atualização em massa de 38 contatos
-- 28 contatos mudando status para "07 - Pedido Fechado" + valor
-- 10 contatos apenas atualizando valor
-- ==========================================

-- PARTE 1: Mudar STATUS + VALOR (28 contatos)

UPDATE contacts SET lead_status = '07 - Pedido Fechado', updated_at = now() WHERE phone = '5518997222277';
UPDATE contacts SET lead_status = '07 - Pedido Fechado', negotiated_value = 799, updated_at = now() WHERE phone = '5519989917103';
UPDATE contacts SET lead_status = '07 - Pedido Fechado', updated_at = now() WHERE phone = '5521969432473';
UPDATE contacts SET lead_status = '07 - Pedido Fechado', updated_at = now() WHERE phone = '5521972940857';
UPDATE contacts SET lead_status = '07 - Pedido Fechado', negotiated_value = 1528.30, updated_at = now() WHERE phone = '5521979095038';
UPDATE contacts SET lead_status = '07 - Pedido Fechado', negotiated_value = 599, updated_at = now() WHERE phone = '5521991157339';
UPDATE contacts SET lead_status = '07 - Pedido Fechado', negotiated_value = 2097, updated_at = now() WHERE phone = '5521996656341';
UPDATE contacts SET lead_status = '07 - Pedido Fechado', negotiated_value = 599, updated_at = now() WHERE phone = '5521999258005';
UPDATE contacts SET lead_status = '07 - Pedido Fechado', updated_at = now() WHERE phone = '5522981491070';
UPDATE contacts SET lead_status = '07 - Pedido Fechado', updated_at = now() WHERE phone = '553199873826';
UPDATE contacts SET lead_status = '07 - Pedido Fechado', negotiated_value = 1078.80, updated_at = now() WHERE phone = '553388486464';
UPDATE contacts SET lead_status = '07 - Pedido Fechado', negotiated_value = 597.5, updated_at = now() WHERE phone = '553499117936';
UPDATE contacts SET lead_status = '07 - Pedido Fechado', negotiated_value = 799, updated_at = now() WHERE phone = '556196375927';
UPDATE contacts SET lead_status = '07 - Pedido Fechado', negotiated_value = 2142.80, updated_at = now() WHERE phone = '556681430900';
UPDATE contacts SET lead_status = '07 - Pedido Fechado', negotiated_value = 179.8, updated_at = now() WHERE phone = '557382113729';
UPDATE contacts SET lead_status = '07 - Pedido Fechado', negotiated_value = 758.8, updated_at = now() WHERE phone = '558191858636';
UPDATE contacts SET lead_status = '07 - Pedido Fechado', updated_at = now() WHERE phone = '559884648051';
UPDATE contacts SET lead_status = '07 - Pedido Fechado', negotiated_value = 899, updated_at = now() WHERE phone = '5598970169816';
UPDATE contacts SET lead_status = '07 - Pedido Fechado', updated_at = now() WHERE phone = '559991328585';
UPDATE contacts SET lead_status = '07 - Pedido Fechado', updated_at = now() WHERE phone = '559991756882';
UPDATE contacts SET lead_status = '07 - Pedido Fechado', negotiated_value = 1358.30, updated_at = now() WHERE phone = '554788085818';
UPDATE contacts SET lead_status = '07 - Pedido Fechado', negotiated_value = 8990, updated_at = now() WHERE phone = '556630162626';
UPDATE contacts SET lead_status = '07 - Pedido Fechado', negotiated_value = 1298.20, updated_at = now() WHERE phone = '557193190363';
UPDATE contacts SET lead_status = '07 - Pedido Fechado', updated_at = now() WHERE phone = '557798014908';
UPDATE contacts SET lead_status = '07 - Pedido Fechado', updated_at = now() WHERE phone = '558291424171';
UPDATE contacts SET lead_status = '07 - Pedido Fechado', negotiated_value = 849, updated_at = now() WHERE phone = '559481510955';
UPDATE contacts SET lead_status = '07 - Pedido Fechado', negotiated_value = 779, updated_at = now() WHERE phone = '559684226372';
UPDATE contacts SET lead_status = '07 - Pedido Fechado', negotiated_value = 1599.60, updated_at = now() WHERE phone = '557191868954';

-- PARTE 2: Apenas ATUALIZAR VALOR (10 contatos já em 07)

UPDATE contacts SET negotiated_value = 299.5, updated_at = now() WHERE phone = '5512992305217';
UPDATE contacts SET negotiated_value = 839, updated_at = now() WHERE phone = '5515996902394';
UPDATE contacts SET negotiated_value = 778.7, updated_at = now() WHERE phone = '5521976381650';
UPDATE contacts SET negotiated_value = 3445.50, updated_at = now() WHERE phone = '558186442200';
UPDATE contacts SET negotiated_value = 599, updated_at = now() WHERE phone = '558288110929';
UPDATE contacts SET negotiated_value = 1228, updated_at = now() WHERE phone = '558881772949';
UPDATE contacts SET negotiated_value = 929, updated_at = now() WHERE phone = '559193859754';
UPDATE contacts SET negotiated_value = 799, updated_at = now() WHERE phone = '556193820836';
UPDATE contacts SET negotiated_value = 899, updated_at = now() WHERE phone = '556784570939';
UPDATE contacts SET negotiated_value = 899, updated_at = now() WHERE phone = '559981069622';