import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock modules before importing the hook
const mockSupabaseFrom = vi.fn();
const mockSyncContactToBling = vi.fn();
const mockCreatePreOrderInBling = vi.fn();
const mockGetBlingConfig = vi.fn();
const mockBlingApi = vi.fn();
const mockMutateAsync = vi.fn();
const mockInvalidateQueries = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: any[]) => mockSupabaseFrom(...args),
  },
}));

vi.mock('@/lib/blingSync', () => ({
  syncContactToBling: (...args: any[]) => mockSyncContactToBling(...args),
  createPreOrderInBling: (...args: any[]) => mockCreatePreOrderInBling(...args),
  getBlingConfig: () => mockGetBlingConfig(),
  blingApi: (...args: any[]) => mockBlingApi(...args),
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: (opts: any) => {
    mockMutateAsync.mockImplementation((data: any) => opts.mutationFn(data));
    return {
      mutateAsync: mockMutateAsync,
      isPending: false,
    };
  },
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { useCreatePreOrderBling } from '../usePreOrderBling';

const basePreOrderData = {
  contactId: 'contact-1',
  contactData: {
    full_name: 'João Silva',
    phone: '11999999999',
    email: 'joao@test.com',
    cpf_cnpj: '12345678900',
    person_type: 'individual' as const,
  },
  endereco: {
    nome: 'João Silva',
    endereco: 'Rua A',
    numero: '10',
    municipio: 'São Paulo',
    uf: 'SP',
    cep: '01001000',
    bairro: 'Centro',
  },
  observacoes: 'Teste',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useCreatePreOrderBling - mutationFn', () => {
  it('should use bling_id from syncContactToBling when available', async () => {
    mockSyncContactToBling.mockResolvedValue({ success: true, bling_id: '456' });
    mockCreatePreOrderInBling.mockResolvedValue({ blingId: '999', blingNumero: '1001' });

    // Mock the update call
    mockSupabaseFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { custom_fields: {} }, error: null }),
        }),
      }),
    });

    const hook = useCreatePreOrderBling();
    const result = await hook.mutateAsync(basePreOrderData);

    expect(mockCreatePreOrderInBling).toHaveBeenCalledWith(
      expect.objectContaining({ contactBlingId: 456 }),
    );
    expect(result).toEqual({ blingId: '999', blingNumero: '1001' });
  });

  it('should force-create contact in Bling when sync returns no bling_id and no mapping exists', async () => {
    // syncContactToBling returns success but no bling_id (sync_contacts disabled)
    mockSyncContactToBling.mockResolvedValue({ success: true });

    // getBlingConfig returns valid config
    mockGetBlingConfig.mockResolvedValue({
      access_token: 'token-123',
      tenant_id: 'tenant-1',
      is_active: true,
      is_configured: true,
    });

    // No existing mapping found
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    const mockSelectCustom = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { custom_fields: {} }, error: null }),
      }),
    });

    let callCount = 0;
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'contacts') {
        callCount++;
        if (callCount === 1) {
          // First call: update contact
          return { update: mockUpdate };
        }
        // Later calls: select custom_fields, update custom_fields
        return {
          select: mockSelectCustom,
          update: mockUpdate,
        };
      }
      if (table === 'bling_id_mappings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: mockMaybeSingle,
                }),
              }),
            }),
          }),
          insert: mockInsert,
        };
      }
      return {};
    });

    // blingApi creates contact and returns id
    mockBlingApi.mockResolvedValue({ data: { id: 789 } });

    // createPreOrderInBling succeeds
    mockCreatePreOrderInBling.mockResolvedValue({ blingId: '999', blingNumero: '1001' });

    const hook = useCreatePreOrderBling();
    await hook.mutateAsync(basePreOrderData);

    // Should have called blingApi to create contact
    expect(mockBlingApi).toHaveBeenCalledWith(
      '/contatos',
      'token-123',
      'POST',
      expect.objectContaining({
        nome: 'João Silva',
        celular: '11999999999',
      }),
    );

    // Should have saved mapping
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-1',
        entity_type: 'contact',
        local_id: 'contact-1',
        bling_id: '789',
      }),
    );

    // Should have called createPreOrderInBling with the new bling id
    expect(mockCreatePreOrderInBling).toHaveBeenCalledWith(
      expect.objectContaining({ contactBlingId: 789 }),
    );
  });

  it('should throw when Bling is not configured', async () => {
    mockSyncContactToBling.mockResolvedValue({ success: true });
    mockGetBlingConfig.mockResolvedValue(null);

    mockSupabaseFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });

    const hook = useCreatePreOrderBling();
    await expect(hook.mutateAsync(basePreOrderData)).rejects.toThrow('Bling não configurado');
  });

  it('should throw when blingApi fails to create contact', async () => {
    mockSyncContactToBling.mockResolvedValue({ success: true });
    mockGetBlingConfig.mockResolvedValue({
      access_token: 'token',
      tenant_id: 'tenant-1',
    });

    let callCount = 0;
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'contacts') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      }
      if (table === 'bling_id_mappings') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    // blingApi returns no id
    mockBlingApi.mockResolvedValue({ data: { id: null } });

    const hook = useCreatePreOrderBling();
    await expect(hook.mutateAsync(basePreOrderData)).rejects.toThrow(
      'Não foi possível criar contato no Bling',
    );
  });
});
