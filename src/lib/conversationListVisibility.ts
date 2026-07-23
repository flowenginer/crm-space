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
 * Decide se uma conversa FIXADA deve aparecer no corpo de uma aba que
 * normalmente esconde fixadas (Todas, Minhas, Pendentes, Não atribuídas —
 * elas moram por padrão na aba "Fixadas"). Não-fixadas não passam por esta
 * função.
 *
 * Mostra quando: há busca ativa, é a conversa selecionada, ou está não lida
 * — seja por mensagem nova do cliente (is_unread/unread_count) ou por
 * marcação manual do atendente; ambas contam igualmente aqui, de propósito.
 * Fixadas já lidas continuam escondidas (design atual).
 */
export function shouldShowPinnedInAllTab(params: PinnedConversationVisibilityParams): boolean {
  const { conversation, isPinned, isSelected, hasActiveSearch } = params;

  if (!isPinned) return true;
  if (hasActiveSearch) return true;
  if (isSelected) return true;

  const hasUnread = !!conversation.is_unread || (conversation.unread_count ?? 0) > 0;
  return hasUnread;
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
  /**
   * Só faz sentido auto-buscar em abas onde o filtro de tela esconde
   * fixadas/compartilhadas e pode "esvaziar" a página trazida do servidor
   * (Todas, Minhas, Pendentes, Não atribuídas). Nas abas "Fixadas" e
   * "Compartilhadas" o filtro de tela descarta a maioria das linhas por
   * design — auto-fetch ali só gastaria requisições à toa, sem corrigir
   * nenhuma lista "vazia por engano". O chamador decide isso a partir do
   * quickFilter ativo.
   */
  tabUsesAutoFetch: boolean;
}

/**
 * Decide se deve disparar a busca automática da próxima página porque a
 * lista renderizada ficou curta demais para o usuário rolar e revelar mais
 * conteúdo sozinho.
 */
export function shouldAutoFetchNextPage(params: AutoFetchNextPageParams): boolean {
  const { visibleCount, minVisibleToScroll, hasNextPage, isFetchingNextPage, autoFetchCount, maxAutoFetches, tabUsesAutoFetch } = params;

  if (!tabUsesAutoFetch) return false;
  if (!hasNextPage) return false;
  if (isFetchingNextPage) return false;
  if (autoFetchCount >= maxAutoFetches) return false;
  return visibleCount < minVisibleToScroll;
}
