import { describe, it, expect, vi, beforeEach } from 'vitest';

interface QueryResult {
  data: unknown;
  error: unknown;
}

interface QueryCall {
  table: string;
  select?: string;
  in?: [string, string[]];
  order?: [string, unknown];
  limit?: number;
}

const calls: QueryCall[] = [];
const results: Record<string, QueryResult> = {};

// Builder encadeável mínimo: registra a chamada e resolve com o resultado da tabela.
function makeBuilder(table: string) {
  const call: QueryCall = { table };
  calls.push(call);
  const builder = {
    select: (cols: string) => { call.select = cols; return builder; },
    in: (col: string, values: string[]) => { call.in = [col, values]; return builder; },
    order: (col: string, opts: unknown) => { call.order = [col, opts]; return builder; },
    limit: (n: number) => { call.limit = n; return builder; },
    then: (resolve: (r: QueryResult) => unknown) =>
      resolve(results[table] ?? { data: [], error: null }),
  };
  return builder;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (table: string) => makeBuilder(table) },
}));

const { fetchRecentContactMessages } = await import('../useGlobalSearch');

const CONVERSATION = {
  id: 'conv-1',
  contact_id: 'contact-1',
  channel_id: 'ch-1',
  contacts: { full_name: 'MARCOS BRASIL SOLAR', phone: '5569999912903', avatar_url: null },
  whatsapp_channels: { id: 'ch-1', name: 'Vendas 06' },
};

const MESSAGE = {
  id: 'msg-1',
  content: 'Ok',
  created_at: '2026-09-24T18:08:21Z',
  is_from_me: true,
  conversation_id: 'conv-1',
};

describe('fetchRecentContactMessages', () => {
  beforeEach(() => {
    calls.length = 0;
    for (const key of Object.keys(results)) delete results[key];
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('busca mensagens por conversation_id, nunca filtrando pelo embed de conversations', async () => {
    results.conversations = { data: [CONVERSATION], error: null };
    results.messages = { data: [MESSAGE], error: null };

    await fetchRecentContactMessages(['contact-1']);

    const msgCall = calls.find((c) => c.table === 'messages');
    expect(msgCall?.in).toEqual(['conversation_id', ['conv-1']]);
    expect(msgCall?.select).not.toContain('conversations');
    expect(msgCall?.limit).toBe(200);
  });

  it('monta o resultado com os dados do contato e do canal', async () => {
    results.conversations = { data: [CONVERSATION], error: null };
    results.messages = { data: [MESSAGE], error: null };

    const [msg] = await fetchRecentContactMessages(['contact-1']);

    expect(msg).toMatchObject({
      message_id: 'msg-1',
      conversation_id: 'conv-1',
      contact_id: 'contact-1',
      contact_name: 'MARCOS BRASIL SOLAR',
      contact_phone: '5569999912903',
      channel_name: 'Vendas 06',
      _matchType: 'contact',
    });
  });

  it('lista vazia de contatos não consulta o banco', async () => {
    expect(await fetchRecentContactMessages([])).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('contato sem conversa não consulta messages', async () => {
    results.conversations = { data: [], error: null };

    expect(await fetchRecentContactMessages(['contact-1'])).toEqual([]);
    expect(calls.map((c) => c.table)).toEqual(['conversations']);
  });

  it('erro nas mensagens é logado e devolve vazio sem lançar', async () => {
    results.conversations = { data: [CONVERSATION], error: null };
    results.messages = { data: null, error: { code: '57014', message: 'statement timeout' } };

    expect(await fetchRecentContactMessages(['contact-1'])).toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });

  it('erro nas conversas é logado e devolve vazio sem lançar', async () => {
    results.conversations = { data: null, error: { message: 'boom' } };

    expect(await fetchRecentContactMessages(['contact-1'])).toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });
});
