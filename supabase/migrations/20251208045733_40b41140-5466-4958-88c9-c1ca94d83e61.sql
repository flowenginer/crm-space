-- =====================================================
-- 1. REMOVER POLÍTICAS RLS QUE PERMITEM VENDEDORES VEREM LEADS NÃO ATRIBUÍDOS
-- =====================================================

-- Remover política que permite ver conversas não atribuídas do departamento
DROP POLICY IF EXISTS "Users can view department unassigned conversations" ON conversations;

-- Remover política que permite ver conversas órfãs (sem assigned_to e sem department_id)
DROP POLICY IF EXISTS "Users can view unassigned conversations" ON conversations;

-- =====================================================
-- 2. MIGRAR CONVERSAS ÓRFÃS PARA DEPARTAMENTO DE VENDAS
-- =====================================================

-- Atribuir as 729 conversas órfãs ao departamento de Vendas
UPDATE conversations 
SET department_id = '440b4be6-5833-44ae-a1a9-c61162fc0afa'
WHERE department_id IS NULL 
  AND status = 'open';