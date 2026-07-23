/**
 * Decisões puras usadas pela lista de conversas em src/pages/Conversations.tsx.
 *
 * Contexto do bug: usuárias com muitas conversas fixadas (ex.: 799) dominam a
 * página de 50 registros trazida do servidor (ordenada por last_message_at desc).
 * A aba "Todas" esconde fixadas do corpo da lista (elas moram na aba "Fixadas"),
 * então uma página inteira de fixadas resultava em pouquíssimos itens visíveis
 * e, sem conteúdo suficiente para rolar, a próxima página nunca era buscada.
 */

/** Subconjunto de Conversation necessário para decidir visibilidade na aba "Todas". */
export interface PinnedVisibilityConversation {
  id: string;
  is_unread: boolean | null;
  unread_count: number | null;
}

export interface PinnedConversationVisibilityParams {
  conversation: PinnedVisibilityConversation;
  isPinned: boolean;
  isSelected: boolean;
  hasActiveSearch: boolean;
}

/**
 * Decide se uma conversa FIXADA deve aparecer no corpo da aba "Todas"
 * (fora da aba "Fixadas"). Não-fixadas não passam por esta função.
 *
 * Mostra quando: há busca ativa, é a conversa selecionada, ou tem mensagem
 * não lida do cliente. Fixadas já lidas continuam escondidas (design atual).
 */
export function shouldShowPinnedInAllTab(params: PinnedConversationVisibilityParams): boolean {
  const { conversation, isPinned, isSelected, hasActiveSearch } = params;

  if (!isPinned) return true;
  if (hasActiveSearch) return true;
  if (isSelected) return true;

  const hasUnreadFromClient = !!conversation.is_unread || (conversation.unread_count ?? 0) > 0;
  return hasUnreadFromClient;
}

export interface AutoFetchNextPageParams {
  /** Quantidade de itens já renderizados na aba ativa após o filtro de tela. */
  visibleCount: number;
  /** Abaixo deste número a lista é considerada "curta demais para rolar". */
  minVisibleToScroll: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  /** Quantos auto-fetches já ocorreram para a troca de aba/filtro atual. */
  autoFetchCount: number;
  /** Cap de segurança para nunca entrar em loop infinito. */
  maxAutoFetches: number;
}

/**
 * Decide se deve disparar a busca automática da próxima página porque a
 * lista renderizada ficou curta demais para o usuário rolar e revelar mais
 * conteúdo sozinho.
 */
export function shouldAutoFetchNextPage(params: AutoFetchNextPageParams): boolean {
  const { visibleCount, minVisibleToScroll, hasNextPage, isFetchingNextPage, autoFetchCount, maxAutoFetches } = params;

  if (!hasNextPage) return false;
  if (isFetchingNextPage) return false;
  if (autoFetchCount >= maxAutoFetches) return false;
  return visibleCount < minVisibleToScroll;
}
