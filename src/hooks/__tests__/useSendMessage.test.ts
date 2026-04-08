import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Captura o payload exato passado para messages.insert pra validar que sender_id
// é populado. Antes do fix, o insert ia sem sender_id → 100% NULL em outbound IG.
const insertCalls: Array<Record<string, unknown>> = [];
const mockInsertSelectSingle = vi.fn().mockResolvedValue({ data: { id: 'msg-1' }, error: null });
const mockInsertSelect = vi.fn(() => ({ single: mockInsertSelectSingle }));
const mockInsert = vi.fn((payload: Record<string, unknown>) => {
  insertCalls.push(payload);
  return { select: mockInsertSelect };
});

const mockGetUser = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (_table: string) => ({ insert: mockInsert }),
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
  },
}));

// Mock do zustand store usado por outros hooks no arquivo (evita erro de import)
vi.mock('@/store/userStore', () => ({
  useUserStore: (selector: (state: { tenantId: string }) => unknown) =>
    selector({ tenantId: 'tenant-test' }),
}));

import { useSendMessage } from '../useConversations';

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return React.createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  insertCalls.length = 0;
  mockInsert.mockClear();
  mockInsertSelect.mockClear();
  mockInsertSelectSingle.mockClear();
  mockGetUser.mockReset();
});

describe('useSendMessage — sender_id backfill (IG fix)', () => {
  it('popula sender_id com o id do usuário autenticado', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-diego-123' } },
      error: null,
    });

    const { result } = renderHook(() => useSendMessage(), { wrapper });

    await result.current.mutateAsync({
      conversation_id: 'conv-1',
      content: 'Olá, tudo bem?',
      message_type: 'text',
    });

    await waitFor(() => expect(insertCalls.length).toBe(1));

    const payload = insertCalls[0];
    expect(payload.sender_id).toBe('user-diego-123');
    expect(payload.conversation_id).toBe('conv-1');
    expect(payload.content).toBe('Olá, tudo bem?');
    expect(payload.is_from_me).toBe(true);
    expect(payload.status).toBe('sent');
  });

  it('usa sender_id null quando não há usuário autenticado', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const { result } = renderHook(() => useSendMessage(), { wrapper });

    await result.current.mutateAsync({
      conversation_id: 'conv-2',
      content: 'msg de automação',
      message_type: 'text',
    });

    await waitFor(() => expect(insertCalls.length).toBe(1));
    expect(insertCalls[0].sender_id).toBeNull();
  });

  it('mantém tenant_id=null (trigger preenche) e passa media_url quando presente', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-42' } },
      error: null,
    });

    const { result } = renderHook(() => useSendMessage(), { wrapper });

    await result.current.mutateAsync({
      conversation_id: 'conv-3',
      content: '[Imagem]',
      message_type: 'image',
      media_url: 'https://example.com/foo.jpg',
      media_mime_type: 'image/jpeg',
    });

    await waitFor(() => expect(insertCalls.length).toBe(1));
    const payload = insertCalls[0];
    expect(payload.tenant_id).toBeNull();
    expect(payload.media_url).toBe('https://example.com/foo.jpg');
    expect(payload.media_mime_type).toBe('image/jpeg');
    expect(payload.sender_id).toBe('user-42');
  });
});
