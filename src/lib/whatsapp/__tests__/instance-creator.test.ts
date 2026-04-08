import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks do supabase client: capturam o body exato passado a functions.invoke.
const mockFunctionsInvoke = vi.fn();
const mockChannelSelectSingle = vi.fn();
const mockChannelEq = vi.fn(() => ({ single: mockChannelSelectSingle }));
const mockChannelSelect = vi.fn(() => ({ eq: mockChannelEq }));
const mockFrom = vi.fn((_table: string) => ({ select: mockChannelSelect }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
    functions: { invoke: (...args: unknown[]) => mockFunctionsInvoke(...args) },
  },
}));

import { sendWhatsAppMessage } from '../instance-creator';

beforeEach(() => {
  vi.clearAllMocks();
  // Default: canal não encontrado no cache (cache é module-level Map).
  // Cada chamada vai fazer lookup ao DB.
});

describe('sendWhatsAppMessage — roteamento e dedupe IG', () => {
  it('roteia canal instagram para edge function instagram-send-message com skipDbInsert=true quando existingMessageId é passado', async () => {
    mockChannelSelectSingle.mockResolvedValueOnce({
      data: { type: 'instagram' },
      error: null,
    });
    mockFunctionsInvoke.mockResolvedValueOnce({
      data: { success: true, messageId: 'ig_mid_xyz' },
      error: null,
    });

    const result = await sendWhatsAppMessage(
      'channel-ig-unique-001',
      'ig:987654321',
      'Olá tudo bem?',
      'text',
      undefined,
      undefined,
      undefined,
      'conv-1',
      'frontend-msg-id-abc' // ← 9º arg: ID da row já inserida pelo frontend
    );

    expect(result).toEqual({ success: true, messageId: 'ig_mid_xyz' });
    expect(mockFunctionsInvoke).toHaveBeenCalledWith(
      'instagram-send-message',
      expect.objectContaining({
        body: expect.objectContaining({
          channelId: 'channel-ig-unique-001',
          recipientId: 'ig:987654321',
          conversationId: 'conv-1',
          skipDbInsert: true,
          frontendMessageId: 'frontend-msg-id-abc',
        }),
      })
    );
  });

  it('passa skipDbInsert=false quando existingMessageId é undefined (retrocompat)', async () => {
    mockChannelSelectSingle.mockResolvedValueOnce({
      data: { type: 'instagram' },
      error: null,
    });
    mockFunctionsInvoke.mockResolvedValueOnce({
      data: { success: true, messageId: 'ig_mid_yyy' },
      error: null,
    });

    await sendWhatsAppMessage(
      'channel-ig-unique-002',
      'ig:111222333',
      'sem msg id',
      'text'
    );

    expect(mockFunctionsInvoke).toHaveBeenCalledWith(
      'instagram-send-message',
      expect.objectContaining({
        body: expect.objectContaining({
          skipDbInsert: false,
          frontendMessageId: undefined,
        }),
      })
    );
  });

  it('canal cloudapi NÃO recebe skipDbInsert/frontendMessageId no payload (comportamento inalterado)', async () => {
    mockChannelSelectSingle.mockResolvedValueOnce({
      data: { type: 'cloudapi' },
      error: null,
    });
    mockFunctionsInvoke.mockResolvedValueOnce({
      data: { success: true, messageId: 'wa_mid_aaa' },
      error: null,
    });

    await sendWhatsAppMessage(
      'channel-cloudapi-unique-003',
      '5511999999999',
      'msg wa',
      'text',
      undefined,
      undefined,
      undefined,
      'conv-wa',
      'should-be-ignored'
    );

    const [fnName, { body }] = mockFunctionsInvoke.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(fnName).toBe('cloudapi-send-message');
    expect(body).not.toHaveProperty('skipDbInsert');
    expect(body).not.toHaveProperty('frontendMessageId');
  });

  it('canal provider unofficial (zapi/uazapi/evolution) NÃO recebe campos IG', async () => {
    mockChannelSelectSingle.mockResolvedValueOnce({
      data: { type: 'unofficial' },
      error: null,
    });
    mockFunctionsInvoke.mockResolvedValueOnce({
      data: { success: true, messageId: 'uaz_1' },
      error: null,
    });

    await sendWhatsAppMessage(
      'channel-uazapi-unique-004',
      '5511988887777',
      'msg uazapi',
      'text',
      undefined,
      undefined,
      undefined,
      'conv-uaz',
      'ignored-id'
    );

    const [fnName, { body }] = mockFunctionsInvoke.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(fnName).toBe('whatsapp-instance');
    expect(body).not.toHaveProperty('skipDbInsert');
    expect(body).not.toHaveProperty('frontendMessageId');
  });

  it('retorna erro estruturado quando canal não é encontrado', async () => {
    mockChannelSelectSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'not found' },
    });

    const result = await sendWhatsAppMessage(
      'channel-inexistente-unique-005',
      'ig:000',
      'msg',
      'text'
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Canal não encontrado');
    expect(mockFunctionsInvoke).not.toHaveBeenCalled();
  });
});
