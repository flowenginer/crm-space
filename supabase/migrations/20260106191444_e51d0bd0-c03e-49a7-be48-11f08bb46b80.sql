-- Adicionar coluna initial_department_id para transferência automática antes de iniciar campanha
ALTER TABLE marketing_campaigns 
ADD COLUMN initial_department_id UUID REFERENCES departments(id) ON DELETE SET NULL;

-- Comentário explicativo
COMMENT ON COLUMN marketing_campaigns.initial_department_id IS 'Departamento para onde o lead será transferido automaticamente antes de iniciar a campanha';