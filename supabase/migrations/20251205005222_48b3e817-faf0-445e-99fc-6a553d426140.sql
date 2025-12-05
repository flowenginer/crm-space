
-- Atualizar contatos com seus nomes reais extraídos dos webhook_logs
UPDATE contacts SET full_name = 'estrutura metalúrgica wolfart', updated_at = NOW() 
WHERE phone = '554497069749' AND full_name LIKE 'WhatsApp%';

UPDATE contacts SET full_name = 'Deus é Deus.', updated_at = NOW() 
WHERE phone = '559185349948' AND full_name LIKE 'WhatsApp%';

UPDATE contacts SET full_name = 'Jorge', updated_at = NOW() 
WHERE phone = '558791720537' AND full_name LIKE 'WhatsApp%';

UPDATE contacts SET full_name = 'João Paulo', updated_at = NOW() 
WHERE phone = '556993321796' AND full_name LIKE 'WhatsApp%';

-- Criar contato Danilo se não existir (o número pode estar diferente)
UPDATE contacts SET full_name = 'Danilo', updated_at = NOW() 
WHERE phone = '553492289816' AND full_name LIKE 'WhatsApp%';

-- Juliano - Winners Energia Solar
UPDATE contacts SET full_name = 'Juliano - Winners Energia Solar', updated_at = NOW() 
WHERE phone = '555184067720' AND full_name LIKE 'WhatsApp%';

-- Eliel Schemer  
UPDATE contacts SET full_name = 'Eliel Schemer', updated_at = NOW() 
WHERE phone = '5515991794809' AND full_name LIKE 'WhatsApp%';
