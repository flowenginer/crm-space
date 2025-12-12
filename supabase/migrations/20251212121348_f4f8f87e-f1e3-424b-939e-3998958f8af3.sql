-- =====================================================
-- ADICIONAR CAMPOS FISCAIS À TABELA PRODUCTS (NF-e)
-- =====================================================

-- Identificação e Classificação Fiscal
ALTER TABLE products ADD COLUMN IF NOT EXISTS ncm VARCHAR(10);
ALTER TABLE products ADD COLUMN IF NOT EXISTS cest VARCHAR(7);
ALTER TABLE products ADD COLUMN IF NOT EXISTS cfop_venda VARCHAR(4);
ALTER TABLE products ADD COLUMN IF NOT EXISTS cfop_devolucao VARCHAR(4);
ALTER TABLE products ADD COLUMN IF NOT EXISTS origem INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS tipo_produto VARCHAR(2) DEFAULT '00';

-- Códigos de Identificação
ALTER TABLE products ADD COLUMN IF NOT EXISTS sku VARCHAR(60);
ALTER TABLE products ADD COLUMN IF NOT EXISTS gtin VARCHAR(14);
ALTER TABLE products ADD COLUMN IF NOT EXISTS gtin_tributavel VARCHAR(14);
ALTER TABLE products ADD COLUMN IF NOT EXISTS codigo_beneficio_fiscal VARCHAR(10);

-- Unidades de Medida
ALTER TABLE products ADD COLUMN IF NOT EXISTS unidade_comercial VARCHAR(6) DEFAULT 'UN';
ALTER TABLE products ADD COLUMN IF NOT EXISTS unidade_tributavel VARCHAR(6) DEFAULT 'UN';
ALTER TABLE products ADD COLUMN IF NOT EXISTS fator_conversao_tributavel NUMERIC(15,4) DEFAULT 1;

-- Peso
ALTER TABLE products ADD COLUMN IF NOT EXISTS peso_bruto NUMERIC(15,4);
ALTER TABLE products ADD COLUMN IF NOT EXISTS peso_liquido NUMERIC(15,4);

-- ICMS
ALTER TABLE products ADD COLUMN IF NOT EXISTS cst_icms VARCHAR(3);
ALTER TABLE products ADD COLUMN IF NOT EXISTS csosn VARCHAR(3);
ALTER TABLE products ADD COLUMN IF NOT EXISTS aliquota_icms NUMERIC(5,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS reducao_base_icms NUMERIC(5,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS icms_st_modalidade VARCHAR(2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS icms_st_aliquota NUMERIC(5,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS icms_st_mva NUMERIC(5,2);

-- IPI
ALTER TABLE products ADD COLUMN IF NOT EXISTS cst_ipi VARCHAR(2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS aliquota_ipi NUMERIC(5,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS codigo_enquadramento_ipi VARCHAR(3);
ALTER TABLE products ADD COLUMN IF NOT EXISTS ex_tipi VARCHAR(3);

-- PIS/COFINS
ALTER TABLE products ADD COLUMN IF NOT EXISTS cst_pis VARCHAR(2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS aliquota_pis NUMERIC(5,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS cst_cofins VARCHAR(2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS aliquota_cofins NUMERIC(5,2);

-- Informações Adicionais
ALTER TABLE products ADD COLUMN IF NOT EXISTS informacoes_adicionais TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS regime_tributario VARCHAR(20);

-- Comentários para documentação
COMMENT ON COLUMN products.ncm IS 'Nomenclatura Comum do Mercosul (8 dígitos)';
COMMENT ON COLUMN products.cest IS 'Código Especificador da Substituição Tributária';
COMMENT ON COLUMN products.cfop_venda IS 'CFOP padrão para venda';
COMMENT ON COLUMN products.origem IS 'Origem da mercadoria (0-8): 0=Nacional, 1=Estrangeira importação direta, etc';
COMMENT ON COLUMN products.gtin IS 'GTIN/EAN do produto (código de barras)';
COMMENT ON COLUMN products.cst_icms IS 'CST do ICMS para regime normal';
COMMENT ON COLUMN products.csosn IS 'CSOSN para Simples Nacional';
COMMENT ON COLUMN products.cst_pis IS 'CST do PIS';
COMMENT ON COLUMN products.cst_cofins IS 'CST do COFINS';