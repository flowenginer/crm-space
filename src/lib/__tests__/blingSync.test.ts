import { describe, it, expect, vi, beforeEach } from 'vitest';
import { blingApi, createPreOrderInBling, getBlingConfig } from '../blingSync';

// Mock supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        maybeSingle: vi.fn(() => ({ data: null, error: null })),
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => ({ data: null, error: null })),
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() => ({ data: null, error: null })),
            })),
          })),
        })),
      })),
    })),
  },
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('blingApi', () => {
  it('should include error details in thrown error message', async () => {
    const errorBody = '{"error":{"type":"VALIDATION_ERROR","message":"Campo obrigatório: itens"}}';
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => errorBody,
    });

    await expect(blingApi('/pedidos/vendas', 'fake-token', 'POST', {}))
      .rejects.toThrow('Bling API error: 400 - ' + errorBody);
  });

  it('should return parsed JSON on success', async () => {
    const responseData = { data: { id: 123, numero: '456' } };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => responseData,
    });

    const result = await blingApi('/contatos', 'fake-token');
    expect(result).toEqual(responseData);
  });

  it('should send correct headers and body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: {} }),
    });

    const body = { nome: 'Test', tipo: 'F' };
    await blingApi('/contatos', 'my-token', 'POST', body);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.bling.com.br/Api/v3/contatos',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer my-token',
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      }),
    );
  });

  it('should not send body for GET requests', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: {} }),
    });

    await blingApi('/contatos/1', 'token');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'GET',
        body: undefined,
      }),
    );
  });
});

describe('createPreOrderInBling', () => {
  it('should include itens:[] in the payload', async () => {
    // Mock getBlingConfig via supabase
    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            access_token: 'test-token',
            tenant_id: 'tenant-1',
            is_active: true,
            is_configured: true,
            sync_contacts: true,
            sync_orders: true,
            sync_products: true,
            sync_quotes: true,
          },
          error: null,
        }),
      }),
    } as any);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: 999, numero: '1001' } }),
    });

    await createPreOrderInBling({
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

    // Verify the fetch was called with itens: []
    const fetchCall = mockFetch.mock.calls[0];
    const sentBody = JSON.parse(fetchCall[1].body);
    expect(sentBody.itens).toEqual([]);
    expect(sentBody.contato).toEqual({ id: 123 });
    expect(sentBody.observacoes).toBe('Teste');
    expect(sentBody.transporte.etiqueta.cep).toBe('01001000');
  });

  it('should throw when Bling returns no ID', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.from).mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            access_token: 'test-token',
            tenant_id: 'tenant-1',
            is_active: true,
            is_configured: true,
          },
          error: null,
        }),
      }),
    } as any);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: null } }),
    });

    await expect(
      createPreOrderInBling({
        contactBlingId: 123,
        endereco: {
          nome: 'João',
          endereco: 'Rua A',
          numero: '10',
          municipio: 'São Paulo',
          uf: 'SP',
          cep: '01001000',
          bairro: 'Centro',
        },
        observacoes: 'Teste',
      }),
    ).rejects.toThrow('Bling não retornou ID do pedido');
  });
});
