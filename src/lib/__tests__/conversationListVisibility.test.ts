import { describe, it, expect } from 'vitest';
import {
  shouldShowPinnedInAllTab,
  shouldAutoFetchNextPage,
  type PinnedVisibilityConversation,
} from '../conversationListVisibility';

function makeConversation(overrides: Partial<PinnedVisibilityConversation> = {}): PinnedVisibilityConversation {
  return {
    id: 'conv-1',
    is_unread: false,
    unread_count: 0,
    ...overrides,
  };
}

describe('shouldShowPinnedInAllTab', () => {
  it('esconde conversa fixada e lida (comportamento atual mantido)', () => {
    const result = shouldShowPinnedInAllTab({
      conversation: makeConversation({ is_unread: false, unread_count: 0 }),
      isPinned: true,
      isSelected: false,
      hasActiveSearch: false,
    });
    expect(result).toBe(false);
  });

  it('mostra conversa fixada com is_unread true', () => {
    const result = shouldShowPinnedInAllTab({
      conversation: makeConversation({ is_unread: true, unread_count: 0 }),
      isPinned: true,
      isSelected: false,
      hasActiveSearch: false,
    });
    expect(result).toBe(true);
  });

  it('mostra conversa fixada com unread_count > 0', () => {
    const result = shouldShowPinnedInAllTab({
      conversation: makeConversation({ is_unread: false, unread_count: 3 }),
      isPinned: true,
      isSelected: false,
      hasActiveSearch: false,
    });
    expect(result).toBe(true);
  });

  it('mostra conversa fixada e lida quando é a conversa selecionada', () => {
    const result = shouldShowPinnedInAllTab({
      conversation: makeConversation({ is_unread: false, unread_count: 0 }),
      isPinned: true,
      isSelected: true,
      hasActiveSearch: false,
    });
    expect(result).toBe(true);
  });

  it('mostra conversa não-fixada independente de leitura', () => {
    const result = shouldShowPinnedInAllTab({
      conversation: makeConversation({ is_unread: false, unread_count: 0 }),
      isPinned: false,
      isSelected: false,
      hasActiveSearch: false,
    });
    expect(result).toBe(true);
  });

  it('mostra tudo quando há busca ativa, mesmo fixada e lida', () => {
    const result = shouldShowPinnedInAllTab({
      conversation: makeConversation({ is_unread: false, unread_count: 0 }),
      isPinned: true,
      isSelected: false,
      hasActiveSearch: true,
    });
    expect(result).toBe(true);
  });

  it('trata unread_count null como zero (não lida por unread_count)', () => {
    const result = shouldShowPinnedInAllTab({
      conversation: makeConversation({ is_unread: false, unread_count: null }),
      isPinned: true,
      isSelected: false,
      hasActiveSearch: false,
    });
    expect(result).toBe(false);
  });

  it('trata is_unread null como falso', () => {
    const result = shouldShowPinnedInAllTab({
      conversation: makeConversation({ is_unread: null, unread_count: 0 }),
      isPinned: true,
      isSelected: false,
      hasActiveSearch: false,
    });
    expect(result).toBe(false);
  });

  it('trata unread_count undefined como zero (não lida por unread_count)', () => {
    const result = shouldShowPinnedInAllTab({
      conversation: makeConversation({ is_unread: false, unread_count: undefined as unknown as number | null }),
      isPinned: true,
      isSelected: false,
      hasActiveSearch: false,
    });
    expect(result).toBe(false);
  });

  it('marcação manual de não lida (is_unread=true sem unread_count) também conta — não é exclusivo de mensagem do cliente', () => {
    const result = shouldShowPinnedInAllTab({
      conversation: makeConversation({ is_unread: true, unread_count: 0 }),
      isPinned: true,
      isSelected: false,
      hasActiveSearch: false,
    });
    expect(result).toBe(true);
  });

  it('a exceção de não-lida é intencional em qualquer aba que use esta função (Minhas/Pendentes/Não atribuídas, não só Todas) — a decisão não depende da aba', () => {
    // A função não recebe a aba como parâmetro: quem decide "esta aba esconde
    // fixadas lidas" é o chamador. O mesmo resultado vale para Todas, Minhas,
    // Pendentes e Não atribuídas — comportamento pretendido, não um bug.
    const result = shouldShowPinnedInAllTab({
      conversation: makeConversation({ is_unread: true, unread_count: 0 }),
      isPinned: true,
      isSelected: false,
      hasActiveSearch: false,
    });
    expect(result).toBe(true);
  });
});

describe('shouldAutoFetchNextPage', () => {
  const baseParams = {
    visibleCount: 1,
    minVisibleToScroll: 20,
    hasNextPage: true,
    isFetchingNextPage: false,
    autoFetchCount: 0,
    maxAutoFetches: 10,
    tabUsesAutoFetch: true,
  };

  it('busca a próxima página quando a lista está curta e há mais páginas', () => {
    expect(shouldAutoFetchNextPage(baseParams)).toBe(true);
  });

  it('não busca quando um fetch já está em andamento', () => {
    expect(shouldAutoFetchNextPage({ ...baseParams, isFetchingNextPage: true })).toBe(false);
  });

  it('não busca quando não há próxima página', () => {
    expect(shouldAutoFetchNextPage({ ...baseParams, hasNextPage: false })).toBe(false);
  });

  it('não busca quando o cap de auto-fetches foi atingido', () => {
    expect(shouldAutoFetchNextPage({ ...baseParams, autoFetchCount: 10, maxAutoFetches: 10 })).toBe(false);
  });

  it('não busca quando a lista já tem itens suficientes para rolar', () => {
    expect(shouldAutoFetchNextPage({ ...baseParams, visibleCount: 25 })).toBe(false);
  });

  it('busca quando visibleCount está exatamente no limite não é atingido (limite exclusivo)', () => {
    expect(shouldAutoFetchNextPage({ ...baseParams, visibleCount: 20 })).toBe(false);
  });

  it('não busca em aba inelegível (Fixadas/Compartilhadas), mesmo com lista curta e páginas disponíveis', () => {
    expect(shouldAutoFetchNextPage({ ...baseParams, tabUsesAutoFetch: false })).toBe(false);
  });
});
