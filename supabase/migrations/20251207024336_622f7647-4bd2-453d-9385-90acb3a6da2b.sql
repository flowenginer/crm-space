-- Atualizar contatos existentes com estado baseado no DDD do telefone
-- Apenas para contatos que não têm estado preenchido

UPDATE contacts SET state = 
  CASE 
    -- São Paulo
    WHEN regexp_replace(phone, '\D', '', 'g') ~ '^55?(11|12|13|14|15|16|17|18|19)' THEN 'SP'
    -- Rio de Janeiro
    WHEN regexp_replace(phone, '\D', '', 'g') ~ '^55?(21|22|24)' THEN 'RJ'
    -- Espírito Santo
    WHEN regexp_replace(phone, '\D', '', 'g') ~ '^55?(27|28)' THEN 'ES'
    -- Minas Gerais
    WHEN regexp_replace(phone, '\D', '', 'g') ~ '^55?(31|32|33|34|35|37|38)' THEN 'MG'
    -- Paraná
    WHEN regexp_replace(phone, '\D', '', 'g') ~ '^55?(41|42|43|44|45|46)' THEN 'PR'
    -- Santa Catarina
    WHEN regexp_replace(phone, '\D', '', 'g') ~ '^55?(47|48|49)' THEN 'SC'
    -- Rio Grande do Sul
    WHEN regexp_replace(phone, '\D', '', 'g') ~ '^55?(51|53|54|55)' THEN 'RS'
    -- Distrito Federal
    WHEN regexp_replace(phone, '\D', '', 'g') ~ '^55?61' THEN 'DF'
    -- Goiás
    WHEN regexp_replace(phone, '\D', '', 'g') ~ '^55?(62|64)' THEN 'GO'
    -- Tocantins
    WHEN regexp_replace(phone, '\D', '', 'g') ~ '^55?63' THEN 'TO'
    -- Mato Grosso
    WHEN regexp_replace(phone, '\D', '', 'g') ~ '^55?(65|66)' THEN 'MT'
    -- Mato Grosso do Sul
    WHEN regexp_replace(phone, '\D', '', 'g') ~ '^55?67' THEN 'MS'
    -- Acre
    WHEN regexp_replace(phone, '\D', '', 'g') ~ '^55?68' THEN 'AC'
    -- Rondônia
    WHEN regexp_replace(phone, '\D', '', 'g') ~ '^55?69' THEN 'RO'
    -- Bahia
    WHEN regexp_replace(phone, '\D', '', 'g') ~ '^55?(71|73|74|75|77)' THEN 'BA'
    -- Sergipe
    WHEN regexp_replace(phone, '\D', '', 'g') ~ '^55?79' THEN 'SE'
    -- Pernambuco
    WHEN regexp_replace(phone, '\D', '', 'g') ~ '^55?(81|87)' THEN 'PE'
    -- Alagoas
    WHEN regexp_replace(phone, '\D', '', 'g') ~ '^55?82' THEN 'AL'
    -- Paraíba
    WHEN regexp_replace(phone, '\D', '', 'g') ~ '^55?83' THEN 'PB'
    -- Rio Grande do Norte
    WHEN regexp_replace(phone, '\D', '', 'g') ~ '^55?84' THEN 'RN'
    -- Ceará
    WHEN regexp_replace(phone, '\D', '', 'g') ~ '^55?(85|88)' THEN 'CE'
    -- Piauí
    WHEN regexp_replace(phone, '\D', '', 'g') ~ '^55?(86|89)' THEN 'PI'
    -- Maranhão
    WHEN regexp_replace(phone, '\D', '', 'g') ~ '^55?(98|99)' THEN 'MA'
    -- Pará
    WHEN regexp_replace(phone, '\D', '', 'g') ~ '^55?(91|93|94)' THEN 'PA'
    -- Amazonas
    WHEN regexp_replace(phone, '\D', '', 'g') ~ '^55?(92|97)' THEN 'AM'
    -- Roraima
    WHEN regexp_replace(phone, '\D', '', 'g') ~ '^55?95' THEN 'RR'
    -- Amapá
    WHEN regexp_replace(phone, '\D', '', 'g') ~ '^55?96' THEN 'AP'
    ELSE state
  END
WHERE state IS NULL AND phone IS NOT NULL;