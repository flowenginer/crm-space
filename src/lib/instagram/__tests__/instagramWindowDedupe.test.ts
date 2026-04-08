import { describe, it, expect } from 'vitest';
import {
  isOutside24hWindow,
  META_24H_WINDOW_MS,
  ECHO_MATCH_WINDOW_MS,
  matchesEchoDedupe,
  type EchoCandidate,
} from '../instagramWindowDedupe';

describe('isOutside24hWindow — regra da Meta para IG DMs', () => {
  it('dentro de 24h → false (pode enviar)', () => {
    const lastInbound = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    expect(isOutside24hWindow(lastInbound)).toBe(false);
  });

  it('exatamente no limite (24h menos 1s) → false', () => {
    const lastInbound = new Date(Date.now() - (24 * 60 * 60 * 1000 - 1000)).toISOString();
    expect(isOutside24hWindow(lastInbound)).toBe(false);
  });

  it('24h e 1 segundo → true (janela fechou)', () => {
    const lastInbound = new Date(Date.now() - (24 * 60 * 60 * 1000 + 1000)).toISOString();
    expect(isOutside24hWindow(lastInbound)).toBe(true);
  });

  it('7 dias atrás → true (caso Quelí Silva)', () => {
    const lastInbound = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(isOutside24hWindow(lastInbound)).toBe(true);
  });

  it('sem lastInbound (null/undefined) → false (não bloqueia, deixa Meta decidir)', () => {
    expect(isOutside24hWindow(null)).toBe(false);
    expect(isOutside24hWindow(undefined)).toBe(false);
  });

  it('timestamp inválido → false (não bloqueia, fail-open)', () => {
    expect(isOutside24hWindow('not-a-date')).toBe(false);
  });

  it('constante META_24H_WINDOW_MS == 86_400_000', () => {
    expect(META_24H_WINDOW_MS).toBe(24 * 60 * 60 * 1000);
  });
});

describe('matchesEchoDedupe — L2 match por conversation+content+janela', () => {
  const now = Date.now();
  const candidates: EchoCandidate[] = [
    {
      id: 'm1',
      conversation_id: 'conv-A',
      content: 'Olá tudo bem?',
      created_at: new Date(now - 5_000).toISOString(),
      whatsapp_message_id: null,
      is_from_me: true,
    },
    {
      id: 'm2',
      conversation_id: 'conv-A',
      content: 'Olá tudo bem?',
      created_at: new Date(now - 120_000).toISOString(), // 2min atrás, fora da janela L2
      whatsapp_message_id: null,
      is_from_me: true,
    },
    {
      id: 'm3',
      conversation_id: 'conv-A',
      content: 'Olá tudo bem?',
      created_at: new Date(now - 10_000).toISOString(),
      whatsapp_message_id: 'already_has_mid_xyz',
      is_from_me: true,
    },
    {
      id: 'm4',
      conversation_id: 'conv-B',
      content: 'Olá tudo bem?',
      created_at: new Date(now - 5_000).toISOString(),
      whatsapp_message_id: null,
      is_from_me: true,
    },
  ];

  it('match: mesma conversa, mesmo content, dentro de 60s, sem mid', () => {
    const match = matchesEchoDedupe(candidates, 'conv-A', 'Olá tudo bem?', now);
    expect(match?.id).toBe('m1');
  });

  it('não match: content igual mas fora da janela L2 (>60s)', () => {
    const olderOnly: EchoCandidate[] = [candidates[1]]; // só o m2 (2min atrás)
    const match = matchesEchoDedupe(olderOnly, 'conv-A', 'Olá tudo bem?', now);
    expect(match).toBeNull();
  });

  it('não match: content igual mas já tem whatsapp_message_id (não é row fantasma)', () => {
    const onlyWithMid: EchoCandidate[] = [candidates[2]];
    const match = matchesEchoDedupe(onlyWithMid, 'conv-A', 'Olá tudo bem?', now);
    expect(match).toBeNull();
  });

  it('não match: conversa diferente', () => {
    const match = matchesEchoDedupe(candidates, 'conv-B-different', 'Olá tudo bem?', now);
    expect(match).toBeNull();
  });

  it('não match: content diferente', () => {
    const match = matchesEchoDedupe(candidates, 'conv-A', 'texto diferente', now);
    expect(match).toBeNull();
  });

  it('retorna o mais recente quando há múltiplos candidatos válidos', () => {
    const multi: EchoCandidate[] = [
      {
        id: 'old',
        conversation_id: 'conv-X',
        content: 'hey',
        created_at: new Date(now - 30_000).toISOString(),
        whatsapp_message_id: null,
        is_from_me: true,
      },
      {
        id: 'new',
        conversation_id: 'conv-X',
        content: 'hey',
        created_at: new Date(now - 5_000).toISOString(),
        whatsapp_message_id: null,
        is_from_me: true,
      },
    ];
    const match = matchesEchoDedupe(multi, 'conv-X', 'hey', now);
    expect(match?.id).toBe('new');
  });

  it('constante ECHO_MATCH_WINDOW_MS == 60_000', () => {
    expect(ECHO_MATCH_WINDOW_MS).toBe(60 * 1000);
  });

  it('não match: mensagem inbound (is_from_me=false) com mesmo content na mesma janela', () => {
    // Proteção contra cenário patológico: cliente manda "ok" e o atendente manda "ok"
    // segundos depois. O dedupe L2 só pode casar outbound, nunca deve tocar inbound.
    const inboundOnly: EchoCandidate[] = [
      {
        id: 'inbound-ok',
        conversation_id: 'conv-Z',
        content: 'ok',
        created_at: new Date(now - 3_000).toISOString(),
        whatsapp_message_id: null,
        is_from_me: false,
      },
    ];
    const match = matchesEchoDedupe(inboundOnly, 'conv-Z', 'ok', now);
    expect(match).toBeNull();
  });

  it('clock skew: lastInbound no futuro (ageMs negativo) → não bloqueia envio', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isOutside24hWindow(future)).toBe(false);
  });
});
