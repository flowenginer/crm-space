-- Fase 1: Atualizar RLS para visibilidade por departamento/usuário

-- Primeiro, dropar a política existente muito permissiva
DROP POLICY IF EXISTS "Authenticated access conversations" ON conversations;

-- Política 1: Admins podem ver todas as conversas
CREATE POLICY "Admins can view all conversations" 
ON conversations FOR SELECT 
USING (is_admin(auth.uid()));

-- Política 2: Admins podem fazer todas as operações
CREATE POLICY "Admins can manage all conversations" 
ON conversations FOR ALL 
USING (is_admin(auth.uid()));

-- Política 3: Usuários podem ver conversas atribuídas a eles
CREATE POLICY "Users can view assigned conversations" 
ON conversations FOR SELECT 
USING (assigned_to = auth.uid());

-- Política 4: Usuários podem ver conversas do seu departamento sem atribuição
CREATE POLICY "Users can view department unassigned conversations" 
ON conversations FOR SELECT 
USING (
  assigned_to IS NULL 
  AND department_id IN (
    SELECT department_id FROM profiles WHERE id = auth.uid()
  )
);

-- Política 5: Usuários podem ver conversas sem departamento e sem atribuição
CREATE POLICY "Users can view unassigned no department conversations" 
ON conversations FOR SELECT 
USING (
  assigned_to IS NULL 
  AND department_id IS NULL
);

-- Política 6: Usuários podem atualizar conversas atribuídas a eles
CREATE POLICY "Users can update assigned conversations" 
ON conversations FOR UPDATE 
USING (assigned_to = auth.uid());

-- Política 7: Usuários podem atualizar conversas do seu departamento sem atribuição
CREATE POLICY "Users can update department unassigned conversations" 
ON conversations FOR UPDATE 
USING (
  assigned_to IS NULL 
  AND department_id IN (
    SELECT department_id FROM profiles WHERE id = auth.uid()
  )
);

-- Política 8: Usuários podem inserir conversas
CREATE POLICY "Users can insert conversations" 
ON conversations FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);