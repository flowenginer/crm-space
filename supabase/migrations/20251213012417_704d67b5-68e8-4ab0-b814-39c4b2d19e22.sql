-- Atualizar permissões nos menu_items para sincronizar com o sistema de permissões

-- Chat Interno
UPDATE menu_items SET permission = 'internal_chat.view' WHERE id = 'e0689a60-0ad0-4230-bed8-294e2b3f2f0c';

-- Meu Painel
UPDATE menu_items SET permission = 'seller.view' WHERE id = '48bfb6b0-3ebd-4fef-85ad-069515bebf9a';

-- Orçamentos (corrigir de orders.view para quotes.view)
UPDATE menu_items SET permission = 'quotes.view' WHERE id = '279bc0b5-ffdc-46da-9329-dac085f77a18';

-- Produtos (submenu cascata dentro de ERP)
UPDATE menu_items SET permission = 'products.view' WHERE id = 'fb6eb768-4d1f-44a4-b491-16d0029caad9';

-- Produtos (página direta /products)
UPDATE menu_items SET permission = 'products.view' WHERE id = 'a2460912-3a37-4bfe-99e5-b2aa580c5fdb';

-- Catálogos
UPDATE menu_items SET permission = 'products.manage_catalogs' WHERE id = 'f29e6224-0a3e-4d6f-8bcc-3b32dd19a542';

-- Templates
UPDATE menu_items SET permission = 'products.manage_templates' WHERE id = 'bc74721b-f490-49df-8fad-e33704c865c6';

-- Atributos
UPDATE menu_items SET permission = 'products.manage_attributes' WHERE id = '98fc8d10-f11f-4591-a4c1-d240c614d3dc';

-- Regras de Preço
UPDATE menu_items SET permission = 'products.manage_price_rules' WHERE id = 'cda8fad5-5fa6-4657-aafc-9d58419fd572';

-- Menus cascata pai (remover permissão settings.view incorreta - herdarão dos filhos)
UPDATE menu_items SET permission = NULL WHERE id = 'f49fb05a-f125-4a93-9534-00b3cf305b44'; -- CRM
UPDATE menu_items SET permission = NULL WHERE id = '5cd3c308-97ae-4c07-bce1-1a41c338d03b'; -- ERP
UPDATE menu_items SET permission = NULL WHERE id = '8b34a5fa-b5cd-4b84-a169-b86d710545ee'; -- Integrações