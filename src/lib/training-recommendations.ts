import { EvaluationDetail } from '@/hooks/useSalesEvaluations';

export interface TrainingRecommendation {
  area: string;
  score: number;
  priority: 'high' | 'medium' | 'low';
  tips: string[];
}

const OBJECTION_TIPS: Record<string, string[]> = {
  preco: [
    "Apresente os benefícios e diferenciais ANTES de falar o preço",
    "Use ancoragem: compare com produtos similares mais caros",
    "Destaque o custo-benefício por unidade",
    "Ofereça opções de parcelamento",
    "Mostre cases de sucesso de clientes satisfeitos"
  ],
  quantidade_minima: [
    "Explique a lógica do pedido mínimo (personalização, setup)",
    "Sugira que o cliente junte mais pessoas (equipe, amigos)",
    "Ofereça opção de preço varejo para quantidades menores",
    "Mostre o benefício de ter peças sobressalentes"
  ],
  prazo: [
    "Seja transparente sobre os prazos desde o início",
    "Explique cada etapa do processo de produção",
    "Ofereça alternativas para entregas urgentes",
    "Negocie datas comemorativas com antecedência"
  ],
  qualidade: [
    "Mostre certificações e garantias do produto",
    "Envie fotos e vídeos de trabalhos anteriores",
    "Ofereça amostras quando possível",
    "Compartilhe depoimentos de clientes"
  ],
  concorrencia: [
    "Destaque seus diferenciais únicos",
    "Não fale mal da concorrência",
    "Mostre o valor agregado do seu serviço",
    "Enfatize a experiência e histórico da empresa"
  ],
  indecisao: [
    "Faça perguntas para entender a real objeção",
    "Crie senso de urgência genuíno",
    "Ofereça garantias e políticas de devolução",
    "Sugira começar com um pedido menor"
  ],
  so_pesquisando: [
    "Qualifique o lead antes de investir muito tempo",
    "Ofereça material educativo para nutrir o interesse",
    "Agende um follow-up específico",
    "Mantenha-se disponível sem ser invasivo"
  ],
};

const COMMUNICATION_TIPS: Record<string, string[]> = {
  clareza: [
    "Use linguagem simples e direta",
    "Evite jargões técnicos desnecessários",
    "Estruture suas mensagens em tópicos",
    "Confirme que o cliente entendeu antes de prosseguir"
  ],
  cordialidade: [
    "Sempre cumprimente de forma personalizada",
    "Use o nome do cliente nas mensagens",
    "Mantenha tom amigável mesmo sob pressão",
    "Agradeça genuinamente pela preferência"
  ],
  proatividade: [
    "Antecipe dúvidas comuns e responda antes de perguntarem",
    "Sugira opções antes que o cliente peça",
    "Ofereça informações complementares úteis",
    "Faça follow-up sem esperar o cliente cobrar"
  ],
  conhecimento_produto: [
    "Estude o catálogo completo de produtos",
    "Conheça os processos de produção",
    "Saiba responder sobre materiais e técnicas",
    "Mantenha-se atualizado sobre novidades"
  ],
};

const CRITERIA_TIPS: Record<string, string[]> = {
  tempo_resposta: [
    "Responda em até 5 minutos durante horário comercial",
    "Configure notificações para não perder mensagens",
    "Use respostas rápidas para agilizar",
    "Avise quando precisar de mais tempo para responder"
  ],
  personalizacao: [
    "Pesquise sobre o cliente antes de atender",
    "Adapte a comunicação ao perfil do cliente",
    "Lembre-se de conversas e preferências anteriores",
    "Trate cada cliente como único"
  ],
  senso_urgencia: [
    "Destaque prazos e disponibilidade limitada quando real",
    "Mostre consequências de adiar a decisão",
    "Crie marcos de ação claros",
    "Use gatilhos de escassez com ética"
  ],
  recuperacao_final: [
    "Nunca termine uma conversa sem próximo passo definido",
    "Faça uma última tentativa antes de encerrar",
    "Ofereça alternativas quando o cliente hesitar",
    "Deixe a porta aberta para retorno"
  ],
  qualificacao_lead: [
    "Faça perguntas para entender necessidade real",
    "Identifique quem é o decisor da compra",
    "Avalie potencial e urgência do cliente",
    "Priorize leads mais qualificados"
  ],
  followup_estruturado: [
    "Crie uma cadência de follow-up definida",
    "Varie os canais de contato",
    "Agregue valor em cada follow-up",
    "Saiba quando parar de insistir"
  ],
};

const CONDUCTION_TIPS = [
  "Faça perguntas abertas para manter controle da conversa",
  "Defina próximos passos claros ao final de cada interação",
  "Não espere o cliente perguntar, antecipe informações",
  "Guie o cliente pelo processo de compra",
  "Retome o foco quando a conversa dispersar"
];

export function generateTrainingRecommendations(evaluation: EvaluationDetail): TrainingRecommendation[] {
  const recommendations: TrainingRecommendation[] = [];
  const THRESHOLD = 5;

  // Analyze objections
  if (evaluation.objecoes) {
    Object.entries(evaluation.objecoes).forEach(([objectionKey, objection]) => {
      if (objection.apareceu === 1 && objection.nota < THRESHOLD) {
        const normalizedKey = objectionKey.toLowerCase().replace(/\s+/g, '_');
        const tips = OBJECTION_TIPS[normalizedKey] || [
          `Estude técnicas específicas para lidar com a objeção "${objectionKey}"`,
          "Pratique respostas para esta objeção com colegas",
          "Documente casos de sucesso para usar como referência"
        ];
        
        recommendations.push({
          area: `Objeção: ${objectionKey}`,
          score: objection.nota,
          priority: objection.nota < 3 ? 'high' : 'medium',
          tips,
        });
      }
    });
  }

  // Analyze communication
  if (evaluation.comunicacaoClareza < THRESHOLD) {
    recommendations.push({
      area: 'Comunicação: Clareza',
      score: evaluation.comunicacaoClareza,
      priority: evaluation.comunicacaoClareza < 3 ? 'high' : 'medium',
      tips: COMMUNICATION_TIPS.clareza,
    });
  }

  if (evaluation.comunicacaoCordialidade < THRESHOLD) {
    recommendations.push({
      area: 'Comunicação: Cordialidade',
      score: evaluation.comunicacaoCordialidade,
      priority: evaluation.comunicacaoCordialidade < 3 ? 'high' : 'medium',
      tips: COMMUNICATION_TIPS.cordialidade,
    });
  }

  if (evaluation.comunicacaoProatividade < THRESHOLD) {
    recommendations.push({
      area: 'Comunicação: Proatividade',
      score: evaluation.comunicacaoProatividade,
      priority: evaluation.comunicacaoProatividade < 3 ? 'high' : 'medium',
      tips: COMMUNICATION_TIPS.proatividade,
    });
  }

  if (evaluation.comunicacaoConhecimentoProduto < THRESHOLD) {
    recommendations.push({
      area: 'Comunicação: Conhecimento do Produto',
      score: evaluation.comunicacaoConhecimentoProduto,
      priority: evaluation.comunicacaoConhecimentoProduto < 3 ? 'high' : 'medium',
      tips: COMMUNICATION_TIPS.conhecimento_produto,
    });
  }

  // Analyze criteria
  if (evaluation.criterioTempoResposta < THRESHOLD) {
    recommendations.push({
      area: 'Critério: Tempo de Resposta',
      score: evaluation.criterioTempoResposta,
      priority: evaluation.criterioTempoResposta < 3 ? 'high' : 'medium',
      tips: CRITERIA_TIPS.tempo_resposta,
    });
  }

  if (evaluation.criterioPersonalizacao < THRESHOLD) {
    recommendations.push({
      area: 'Critério: Personalização',
      score: evaluation.criterioPersonalizacao,
      priority: evaluation.criterioPersonalizacao < 3 ? 'high' : 'medium',
      tips: CRITERIA_TIPS.personalizacao,
    });
  }

  if (evaluation.criterioSensoUrgencia < THRESHOLD) {
    recommendations.push({
      area: 'Critério: Senso de Urgência',
      score: evaluation.criterioSensoUrgencia,
      priority: evaluation.criterioSensoUrgencia < 3 ? 'high' : 'medium',
      tips: CRITERIA_TIPS.senso_urgencia,
    });
  }

  if (evaluation.criterioRecuperacaoFinal < THRESHOLD) {
    recommendations.push({
      area: 'Critério: Recuperação Final',
      score: evaluation.criterioRecuperacaoFinal,
      priority: evaluation.criterioRecuperacaoFinal < 3 ? 'high' : 'medium',
      tips: CRITERIA_TIPS.recuperacao_final,
    });
  }

  if (evaluation.criterioQualificacaoLead < THRESHOLD) {
    recommendations.push({
      area: 'Critério: Qualificação do Lead',
      score: evaluation.criterioQualificacaoLead,
      priority: evaluation.criterioQualificacaoLead < 3 ? 'high' : 'medium',
      tips: CRITERIA_TIPS.qualificacao_lead,
    });
  }

  if (evaluation.criterioFollowupEstruturado < THRESHOLD) {
    recommendations.push({
      area: 'Critério: Follow-up Estruturado',
      score: evaluation.criterioFollowupEstruturado,
      priority: evaluation.criterioFollowupEstruturado < 3 ? 'high' : 'medium',
      tips: CRITERIA_TIPS.followup_estruturado,
    });
  }

  // Analyze conduction
  if (evaluation.conducao < THRESHOLD) {
    recommendations.push({
      area: 'Condução da Conversa',
      score: evaluation.conducao,
      priority: evaluation.conducao < 3 ? 'high' : 'medium',
      tips: CONDUCTION_TIPS,
    });
  }

  // Sort by priority and score
  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return a.score - b.score;
  });
}

export function getOverallStrengths(evaluation: EvaluationDetail): string[] {
  const strengths: string[] = [];
  const GOOD_THRESHOLD = 7;

  if (evaluation.comunicacaoClareza >= GOOD_THRESHOLD) strengths.push('Clareza na comunicação');
  if (evaluation.comunicacaoCordialidade >= GOOD_THRESHOLD) strengths.push('Cordialidade');
  if (evaluation.comunicacaoProatividade >= GOOD_THRESHOLD) strengths.push('Proatividade');
  if (evaluation.comunicacaoConhecimentoProduto >= GOOD_THRESHOLD) strengths.push('Conhecimento do produto');
  if (evaluation.criterioTempoResposta >= GOOD_THRESHOLD) strengths.push('Tempo de resposta rápido');
  if (evaluation.criterioPersonalizacao >= GOOD_THRESHOLD) strengths.push('Atendimento personalizado');
  if (evaluation.criterioSensoUrgencia >= GOOD_THRESHOLD) strengths.push('Criação de urgência');
  if (evaluation.criterioRecuperacaoFinal >= GOOD_THRESHOLD) strengths.push('Recuperação final');
  if (evaluation.criterioQualificacaoLead >= GOOD_THRESHOLD) strengths.push('Qualificação de leads');
  if (evaluation.criterioFollowupEstruturado >= GOOD_THRESHOLD) strengths.push('Follow-up estruturado');
  if (evaluation.conducao >= GOOD_THRESHOLD) strengths.push('Condução da conversa');

  // Check objections
  if (evaluation.objecoes) {
    Object.entries(evaluation.objecoes).forEach(([name, obj]) => {
      if (obj.apareceu === 1 && obj.nota >= GOOD_THRESHOLD) {
        strengths.push(`Boa abordagem em "${name}"`);
      }
    });
  }

  return strengths.slice(0, 5); // Return top 5
}
