
-- Corrigir utm_content copiando o valor de utm_medium para registros com content encoded/grande
-- Tabela redirect_campaign_views
UPDATE redirect_campaign_views
SET utm_content = utm_medium
WHERE utm_content LIKE '%+%7C+%'
   OR utm_content LIKE '%SEGMENTADO%'
   OR utm_content LIKE '%REFRIGERA%'
   OR utm_content LIKE '%ENERGIA%'
   OR utm_content LIKE '%CONSTRU%'
   OR utm_content LIKE '%AGRO+%7C%';

-- Tabela redirect_logs
UPDATE redirect_logs
SET utm_content = utm_medium
WHERE utm_content LIKE '%+%7C+%'
   OR utm_content LIKE '%SEGMENTADO%'
   OR utm_content LIKE '%REFRIGERA%'
   OR utm_content LIKE '%ENERGIA%'
   OR utm_content LIKE '%CONSTRU%'
   OR utm_content LIKE '%AGRO+%7C%';
