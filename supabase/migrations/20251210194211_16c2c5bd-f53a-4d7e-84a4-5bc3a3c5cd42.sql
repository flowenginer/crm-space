
-- Atualizar padrão do Linktree para usar 'contains' com padrão simplificado
UPDATE ad_message_patterns 
SET pattern = 'vim pelo Linktree', match_type = 'contains', updated_at = now()
WHERE id = '660d64f5-d6e0-4814-b946-1f17f073e498';

-- Atualizar padrão do Site para usar 'contains' com padrão simplificado
UPDATE ad_message_patterns 
SET pattern = 'vim pelo Site', match_type = 'contains', updated_at = now()
WHERE id = '6708c535-9f26-44ad-8e9a-1ba0346ec1d1';
