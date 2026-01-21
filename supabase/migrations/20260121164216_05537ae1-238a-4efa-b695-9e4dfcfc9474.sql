-- Create sales_evaluation_targets table for configurable goals
CREATE TABLE public.sales_evaluation_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Main KPI targets
  target_overall_score DECIMAL(3,1) DEFAULT 7.0,
  target_taxa_fechamento DECIMAL(5,2) DEFAULT 20.0,
  target_eficiencia_objecoes DECIMAL(5,2) DEFAULT 80.0,
  target_nota_objecoes DECIMAL(3,1) DEFAULT 6.5,
  target_conducao DECIMAL(3,1) DEFAULT 7.0,
  
  -- Communication targets
  target_comunicacao_clareza DECIMAL(3,1) DEFAULT 7.0,
  target_comunicacao_cordialidade DECIMAL(3,1) DEFAULT 7.0,
  target_comunicacao_proatividade DECIMAL(3,1) DEFAULT 7.0,
  target_comunicacao_conhecimento DECIMAL(3,1) DEFAULT 7.0,
  
  -- Additional criteria targets
  target_tempo_resposta DECIMAL(3,1) DEFAULT 7.0,
  target_personalizacao DECIMAL(3,1) DEFAULT 7.0,
  target_senso_urgencia DECIMAL(3,1) DEFAULT 7.0,
  target_recuperacao_final DECIMAL(3,1) DEFAULT 7.0,
  target_qualificacao_lead DECIMAL(3,1) DEFAULT 7.0,
  target_followup_estruturado DECIMAL(3,1) DEFAULT 7.0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id),
  
  CONSTRAINT sales_evaluation_targets_tenant_unique UNIQUE (tenant_id)
);

-- Enable RLS
ALTER TABLE public.sales_evaluation_targets ENABLE ROW LEVEL SECURITY;

-- RLS policy for tenant isolation
CREATE POLICY "Tenant isolation for sales_evaluation_targets" 
  ON public.sales_evaluation_targets 
  FOR ALL 
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_sales_evaluation_targets_updated_at
  BEFORE UPDATE ON public.sales_evaluation_targets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();