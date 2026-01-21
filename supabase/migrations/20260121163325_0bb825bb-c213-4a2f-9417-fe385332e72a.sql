-- Criar VIEW que junta sales_evaluations com conversations
-- para permitir filtro por data da conversa

CREATE OR REPLACE VIEW sales_evaluations_with_conversation AS
SELECT 
  se.id,
  se.conversation_id,
  se.assigned_to,
  se.analyzed_at,
  se.overall_score,
  se.feedback,
  se.etapa_catalogo_referencia,
  se.etapa_mockup,
  se.etapa_aprovacao_mockup,
  se.etapa_orcamento_final,
  se.etapa_fechamento,
  se.etapas_score,
  se.objecoes,
  se.objecoes_apareceram,
  se.objecoes_tratadas,
  se.objecoes_nota_media,
  se.comunicacao_clareza,
  se.comunicacao_cordialidade,
  se.comunicacao_proatividade,
  se.comunicacao_conhecimento_produto,
  se.criterio_tempo_resposta,
  se.criterio_personalizacao,
  se.criterio_senso_urgencia,
  se.criterio_recuperacao_final,
  se.criterio_qualificacao_lead,
  se.criterio_followup_estruturado,
  se.conducao,
  se.tenant_id,
  c.created_at as conversation_created_at,
  c.last_message_at as conversation_last_message_at
FROM sales_evaluations se
LEFT JOIN conversations c ON c.id = se.conversation_id;

-- Comentário para documentação
COMMENT ON VIEW sales_evaluations_with_conversation IS 'View que combina avaliações de vendas com datas da conversa para permitir filtros por data real da negociação';