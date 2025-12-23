-- Corrigir o role do Ricardo Oliveira (Top Creative) de 'user' para 'admin'
UPDATE public.user_roles 
SET role = 'admin' 
WHERE user_id = '71b0306e-244a-4ff5-a4a8-161b5c68de3c' 
AND role = 'user';