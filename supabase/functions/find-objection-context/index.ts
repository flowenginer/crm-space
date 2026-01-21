import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapa de palavras-chave por tipo de objeção
const OBJECTION_KEYWORDS: Record<string, string[]> = {
  preco: ['preço', 'valor', 'caro', 'barato', 'custo', 'quanto custa', 'orçamento', 'muito caro', 'tá caro', 'ta caro', 'custa quanto', 'quanto fica', 'qual o valor', 'qual o preço', 'preço alto'],
  quantidade_minima: ['mínimo', 'mínima', 'quantidade mínima', 'quantas unidades', 'partir de quantas', 'só preciso de', 'pouca quantidade', 'poucas peças', 'mínimo de peças', 'pedido mínimo'],
  prazo_entrega: ['prazo', 'entrega', 'quanto tempo', 'dias para entregar', 'demora', 'quando chega', 'tempo de entrega', 'previsão de entrega', 'data de entrega', 'urgente', 'preciso urgente', 'entregar rápido'],
  frete_entrega: ['frete', 'envio', 'correio', 'transportadora', 'taxa de entrega', 'custo do frete', 'valor do frete', 'entrega grátis', 'frete grátis', 'sedex', 'pac'],
  pedido_desconto: ['desconto', 'abater', 'promocional', 'condição especial', 'preço melhor', 'consegue baixar', 'fazer um preço', 'melhor preço', 'negociar', 'promocao', 'promoção'],
  desconfianca: ['confiável', 'golpe', 'garantia', 'cnpj', 'empresa séria', 'seguro', 'confiança', 'referência', 'conhecer a empresa', 'quem são vocês', 'site seguro', 'medo', 'receio'],
  forma_pagamento: ['pix', 'cartão', 'parcelamento', 'boleto', 'pagamento', 'parcelar', 'parcela', 'à vista', 'forma de pagar', 'como pago', 'condição de pagamento', 'entrada'],
  qualidade_tecido: ['tecido', 'qualidade', 'durável', 'desbota', 'material', 'algodão', 'poliéster', 'gramatura', 'encolhe', 'qualidade da malha', 'boa qualidade'],
  so_pesquisando: ['só pesquisando', 'ainda vou ver', 'comparar', 'depois', 'só olhando', 'pensando ainda', 'vou pensar', 'ainda não decidi', 'estou cotando', 'fazer orçamento', 'pesquisando preço'],
  concorrencia: ['concorrente', 'outra empresa', 'outro fornecedor', 'mais barato em outro', 'achei mais barato', 'vi em outro lugar', 'outro orçamento'],
  personalizacao: ['personalização', 'personalizar', 'cor específica', 'modelo específico', 'do meu jeito', 'customizado', 'customização', 'arte própria'],
  tamanhos: ['tamanho', 'numeração', 'grade', 'p m g', 'plus size', 'tamanho especial', 'sob medida'],
};

// Função para normalizar texto (remover acentos e lowercase)
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Função para converter nome de objeção para chave do mapa
function getObjectionKey(objectionName: string): string {
  const normalized = normalizeText(objectionName.replace(/\s+/g, '_'));
  
  // Mapeamento de nomes para chaves
  const nameToKey: Record<string, string> = {
    'preco': 'preco',
    'quantidade_minima': 'quantidade_minima',
    'prazo_entrega': 'prazo_entrega',
    'prazo_de_entrega': 'prazo_entrega',
    'frete_entrega': 'frete_entrega',
    'frete_e_entrega': 'frete_entrega',
    'frete': 'frete_entrega',
    'pedido_desconto': 'pedido_desconto',
    'pedido_de_desconto': 'pedido_desconto',
    'desconto': 'pedido_desconto',
    'desconfianca': 'desconfianca',
    'forma_pagamento': 'forma_pagamento',
    'forma_de_pagamento': 'forma_pagamento',
    'formas_de_pagamento': 'forma_pagamento',
    'qualidade_tecido': 'qualidade_tecido',
    'qualidade_do_tecido': 'qualidade_tecido',
    'so_pesquisando': 'so_pesquisando',
    'concorrencia': 'concorrencia',
    'personalizacao': 'personalizacao',
    'tamanhos': 'tamanhos',
  };

  return nameToKey[normalized] || normalized;
}

interface Message {
  id: string;
  content: string;
  is_from_me: boolean;
  created_at: string;
  message_type: string;
}

interface ObjectionContext {
  customerMessage: {
    content: string;
    timestamp: string;
  };
  vendorResponses: {
    content: string;
    timestamp: string;
  }[];
  matchedKeywords: string[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversationId, objectionType } = await req.json();

    if (!conversationId || !objectionType) {
      return new Response(
        JSON.stringify({ error: 'conversationId e objectionType são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Buscando contexto para objeção "${objectionType}" na conversa ${conversationId}`);

    // Validar autorização
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verificar token
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar mensagens da conversa
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('id, content, is_from_me, created_at, message_type')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Erro ao buscar mensagens:', messagesError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar mensagens' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ contexts: [], message: 'Nenhuma mensagem encontrada' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obter palavras-chave para este tipo de objeção
    const objectionKey = getObjectionKey(objectionType);
    const keywords = OBJECTION_KEYWORDS[objectionKey] || [];

    console.log(`Chave de objeção: ${objectionKey}, Keywords: ${keywords.join(', ')}`);

    if (keywords.length === 0) {
      // Tentar busca genérica com o nome da objeção
      const fallbackKeywords = objectionType
        .toLowerCase()
        .replace(/_/g, ' ')
        .split(' ')
        .filter((w: string) => w.length > 3);
      
      if (fallbackKeywords.length > 0) {
        keywords.push(...fallbackKeywords);
      }
    }

    const contexts: ObjectionContext[] = [];
    const textMessages = messages.filter((m: Message) => 
      m.message_type === 'text' || m.message_type === 'chat' || !m.message_type
    );

    // Percorrer mensagens do cliente buscando palavras-chave
    for (let i = 0; i < textMessages.length; i++) {
      const msg = textMessages[i] as Message;
      
      // Pular mensagens da empresa
      if (msg.is_from_me) continue;
      
      // Pular mensagens sem conteúdo
      if (!msg.content) continue;

      const normalizedContent = normalizeText(msg.content);
      const matchedKeywords: string[] = [];

      // Verificar se a mensagem contém palavras-chave
      for (const keyword of keywords) {
        const normalizedKeyword = normalizeText(keyword);
        if (normalizedContent.includes(normalizedKeyword)) {
          matchedKeywords.push(keyword);
        }
      }

      // Se encontrou palavras-chave, capturar contexto
      if (matchedKeywords.length > 0) {
        // Pegar as próximas mensagens da vendedora (até 3)
        const vendorResponses: { content: string; timestamp: string }[] = [];
        
        for (let j = i + 1; j < textMessages.length && vendorResponses.length < 3; j++) {
          const nextMsg = textMessages[j] as Message;
          
          // Se é outra mensagem do cliente, parar
          if (!nextMsg.is_from_me) break;
          
          // Se tem conteúdo, adicionar
          if (nextMsg.content) {
            vendorResponses.push({
              content: nextMsg.content,
              timestamp: nextMsg.created_at,
            });
          }
        }

        contexts.push({
          customerMessage: {
            content: msg.content,
            timestamp: msg.created_at,
          },
          vendorResponses,
          matchedKeywords,
        });

        // Limitar a 5 contextos para não sobrecarregar
        if (contexts.length >= 5) break;
      }
    }

    console.log(`Encontrados ${contexts.length} contextos para a objeção "${objectionType}"`);

    return new Response(
      JSON.stringify({ 
        contexts,
        objectionType,
        objectionKey,
        keywordsUsed: keywords,
        totalMessages: messages.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função find-objection-context:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
