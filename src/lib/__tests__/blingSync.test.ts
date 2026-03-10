import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFunctionsInvoke = vi.fn();
const mockSupabaseFrom = vi.fn();

// Mock supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: any[]) => mockSupabaseFrom(...args),
    functions: {
      invoke: (...args: any[]) => mockFunctionsInvoke(...args),
    },
  },
}));

// Mock global fetch for fallback (GET requests)
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { blingApi, createPreOrderInBling } from '../blingSync';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('blingApi', () => {
  it('should use Edge Function proxy for POST /contatos', async () => {
    // Mock getBlingConfig (called inside blingApi for proxy)
    mockSupabaseFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { tenant_id: 'tenant-1', access_token: 'token' },
          error: null,
        }),
      }),
    });

    mockFunctionsInvoke.mockResolvedValueOnce({
      data: { data: { id: 123 } },
      error: null,
    });

    const body = { nome: 'Test', tipo: 'F' };
    const result = await blingApi('/contatos', 'token', 'POST', body);

    expect(mockFunctionsInvoke).toHaveBeenCalledWith('bling-proxy', {
      body: {
        action: 'create_contact',
        tenant_id: 'tenant-1',
        contact_data: body,
      },
    });
    expect(result).toEqual({ data: { id: 123 } });
  });

  it('should use Edge Function proxy for POST /pedidos/vendas', async () => {
    mockSupabaseFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { tenant_id: 'tenant-1', access_token: 'token' },
          error: null,
        }),
      }),
    });

    mockFunctionsInvoke.mockResolvedValueOnce({
      data: { data: { id: 999, numero: '1001' } },
      error: null,
    });

    const body = { contato: { id: 123 }, itens: [] };
    const result = await blingApi('/pedidos/vendas', 'token', 'POST', body);

    expect(mockFunctionsInvoke).toHaveBeenCalledWith('bling-proxy', {
      body: {
        action: 'create_pre_order',
        tenant_id: 'tenant-1',
        order_data: body,
      },
    });
    expect(result).toEqual({ data: { id: 999, numero: '1001' } });
  });

  it('should throw when proxy returns error', async () => {
    mockSupabaseFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { tenant_id: 'tenant-1', access_token: 'token' },
          error: null,
        }),
      }),
    });

    mockFunctionsInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'Function invocation failed' },
    });

    await expect(blingApi('/contatos', 'token', 'POST', {}))
      .rejects.toThrow('Bling API proxy error: Function invocation failed');
  });

  it('should fallback to direct fetch for GET requests', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: {} }),
    });

    await blingApi('/contatos/1', 'my-token');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.bling.com.br/Api/v3/contatos/1',
      expect.objectContaining({
        method: 'GET',
        body: undefined,
      }),
    );
    expect(mockFunctionsInvoke).not.toHaveBeenCalled();
  });

  it('should throw on direct fetch error', async () => {
    const errorBody = '{"error":"not found"}';
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => errorBody,
    });

    await expect(blingApi('/contatos/999', 'token'))
      .rejects.toThrow('Bling API error: 404 - ' + errorBody);
  });
});

describe('createPreOrderInBling', () => {
  it('should send order with address via proxy', async () => {
    // getBlingConfig
    mockSupabaseFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { access_token: 'test-token', tenant_id: 'tenant-1' },
          error: null,
        }),
      }),
    });

    // blingApi internal getBlingConfig (proxy path)
    mockSupabaseFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { access_token: 'test-token', tenant_id: 'tenant-1' },
          error: null,
        }),
      }),
    });

    mockFunctionsInvoke.mockResolvedValueOnce({
      data: { data: { id: 999, numero: '1001' } },
      error: null,
    });

    const result = await createPreOrderInBling({
      contactBlingId: 123,
      endereco: {
        nome: 'João',
        endereco: 'Rua A',
        numero: '10',
        municipio: 'São Paulo',
        uf: 'SP',
        cep: '01001-000',
        bairro: 'Centro',
      },
      observacoes: 'Teste',
    });

    expect(result).toEqual({ blingId: '999', blingNumero: '1001' });

    const invokeCall = mockFunctionsInvoke.mock.calls[0];
    const orderData = invokeCall[1].body.order_data;
    expect(orderData.itens).toEqual([]);
    expect(orderData.contato).toEqual({ id: 123 });
    expect(orderData.transporte.etiqueta.cep).toBe('01001000');
  });

  it('should send order without address (optional)', async () => {
    mockSupabaseFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { access_token: 'test-token', tenant_id: 'tenant-1' },
          error: null,
        }),
      }),
    });

    mockSupabaseFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { access_token: 'test-token', tenant_id: 'tenant-1' },
          error: null,
        }),
      }),
    });

    mockFunctionsInvoke.mockResolvedValueOnce({
      data: { data: { id: 888, numero: '2002' } },
      error: null,
    });

    const result = await createPreOrderInBling({
      contactBlingId: 456,
      observacoes: 'Sem endereço',
    });

    expect(result).toEqual({ blingId: '888', blingNumero: '2002' });

    const invokeCall = mockFunctionsInvoke.mock.calls[0];
    const orderData = invokeCall[1].body.order_data;
    expect(orderData.transporte).toBeUndefined();
    expect(orderData.contato).toEqual({ id: 456 });
  });

  it('should throw when Bling returns no ID', async () => {
    mockSupabaseFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { access_token: 'test-token', tenant_id: 'tenant-1' },
          error: null,
        }),
      }),
    });

    mockSupabaseFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { access_token: 'test-token', tenant_id: 'tenant-1' },
          error: null,
        }),
      }),
    });

    mockFunctionsInvoke.mockResolvedValueOnce({
      data: { data: { id: null } },
      error: null,
    });

    await expect(
      createPreOrderInBling({
        contactBlingId: 123,
        observacoes: 'Teste',
      }),
    ).rejects.toThrow('Bling não retornou ID do pedido');
  });
});
