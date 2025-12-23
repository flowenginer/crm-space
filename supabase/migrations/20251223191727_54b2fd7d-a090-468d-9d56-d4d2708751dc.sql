-- Passo 1: Reatribuir conversa órfã (deixar sem atribuição)
UPDATE conversations 
SET assigned_to = NULL, updated_at = now()
WHERE assigned_to = '516f4c24-70f3-4a51-a9bb-1e5f54c89d72';

-- Passo 2: Deletar registros dependentes

-- Deletar roles do usuário
DELETE FROM user_roles 
WHERE user_id = '516f4c24-70f3-4a51-a9bb-1e5f54c89d72';

-- Deletar sessions
DELETE FROM user_sessions 
WHERE user_id = '516f4c24-70f3-4a51-a9bb-1e5f54c89d72';

-- Deletar departamentos do usuário
DELETE FROM user_departments 
WHERE user_id = '516f4c24-70f3-4a51-a9bb-1e5f54c89d72';

-- Deletar notification settings
DELETE FROM notification_settings 
WHERE user_id = '516f4c24-70f3-4a51-a9bb-1e5f54c89d72';

-- Deletar gamification points
DELETE FROM gamification_points 
WHERE user_id = '516f4c24-70f3-4a51-a9bb-1e5f54c89d72';

-- Passo 3: Deletar o profile
DELETE FROM profiles 
WHERE id = '516f4c24-70f3-4a51-a9bb-1e5f54c89d72';