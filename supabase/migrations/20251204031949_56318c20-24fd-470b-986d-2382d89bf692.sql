-- Atualizar Ricardo para admin
UPDATE public.profiles 
SET role = 'admin', 
    updated_at = now()
WHERE full_name ILIKE '%ricardo%';