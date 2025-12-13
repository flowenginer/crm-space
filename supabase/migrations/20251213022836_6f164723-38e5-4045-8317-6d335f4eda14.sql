-- Adicionar coluna order_date para permitir datas retroativas
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_date DATE DEFAULT CURRENT_DATE;

-- Criar ou substituir função generate_order_number com tratamento de conflitos
CREATE OR REPLACE FUNCTION generate_order_number(p_tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_year TEXT;
  v_max_number INTEGER;
  v_number TEXT;
  v_exists BOOLEAN;
BEGIN
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  -- Buscar o maior número existente para o tenant e ano atual
  SELECT COALESCE(MAX(
    CAST(NULLIF(SPLIT_PART(order_number, '-', 2), '') AS INTEGER)
  ), 0) + 1 INTO v_max_number
  FROM orders
  WHERE tenant_id = p_tenant_id
    AND order_number LIKE v_year || '-%';
  
  v_number := v_year || '-' || LPAD(v_max_number::TEXT, 6, '0');
  
  -- Loop para garantir número único (evitar conflitos de concorrência)
  LOOP
    SELECT EXISTS(
      SELECT 1 FROM orders 
      WHERE tenant_id = p_tenant_id 
      AND order_number = v_number
    ) INTO v_exists;
    
    EXIT WHEN NOT v_exists;
    
    -- Se já existir, incrementar e tentar novamente
    v_max_number := v_max_number + 1;
    v_number := v_year || '-' || LPAD(v_max_number::TEXT, 6, '0');
  END LOOP;
  
  RETURN v_number;
END;
$$;