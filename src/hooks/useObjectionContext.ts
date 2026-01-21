import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ObjectionContext {
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

export interface ObjectionContextResponse {
  contexts: ObjectionContext[];
  objectionType: string;
  objectionKey: string;
  keywordsUsed: string[];
  totalMessages: number;
}

export function useObjectionContext(
  conversationId: string | null,
  objectionType: string | null
) {
  return useQuery({
    queryKey: ['objection-context', conversationId, objectionType],
    queryFn: async (): Promise<ObjectionContextResponse> => {
      if (!conversationId || !objectionType) {
        throw new Error('conversationId e objectionType são obrigatórios');
      }

      const { data, error } = await supabase.functions.invoke('find-objection-context', {
        body: { conversationId, objectionType },
      });

      if (error) {
        console.error('Erro ao buscar contexto da objeção:', error);
        throw error;
      }

      return data as ObjectionContextResponse;
    },
    enabled: !!conversationId && !!objectionType,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  });
}
