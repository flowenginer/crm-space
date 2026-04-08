// ============================================================================
// Lógica pura compartilhada para Instagram Direct:
//   - Verificação da janela 24h da Meta
//   - Dedupe de echo webhook (match por conversation+content+janela)
//
// Essas funções são usadas em testes unitários (vitest) e a MESMA lógica é
// espelhada nas Edge Functions `instagram-send-message` e `instagram-webhook`.
// Não dá pra importar daqui direto nas edge functions porque elas rodam em
// Deno com imports de URL. Se mudar algo aqui, refletir lá.
// ============================================================================

/** Janela da Meta para responder DMs sem message tag: 24 horas. */
export const META_24H_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Janela de dedupe L2 do webhook echo — casa outbound otimista sem mid. */
export const ECHO_MATCH_WINDOW_MS = 60 * 1000;

/**
 * Retorna true se a última mensagem inbound foi há mais de 24h.
 * Fail-open: se não houver timestamp válido, retorna false (não bloqueia).
 * A Meta cuida de rejeitar se for o caso — o check aqui é só para evitar
 * chamadas desnecessárias e dar feedback rápido ao atendente.
 */
export function isOutside24hWindow(lastInboundAt: string | null | undefined, nowMs: number = Date.now()): boolean {
  if (!lastInboundAt) return false;
  const t = Date.parse(lastInboundAt);
  if (Number.isNaN(t)) return false;
  return nowMs - t > META_24H_WINDOW_MS;
}

export interface EchoCandidate {
  id: string;
  conversation_id: string;
  content: string | null;
  created_at: string;
  whatsapp_message_id: string | null;
  is_from_me: boolean;
}

/**
 * Dedupe L2: procura uma mensagem outbound otimista sem mid, na mesma conversation,
 * com o mesmo content, criada dentro da ECHO_MATCH_WINDOW_MS. Retorna o match mais
 * recente ou null. Usada pelo webhook ao receber um echo da Meta: se achar, atualiza
 * a row existente com o mid ao invés de inserir duplicata.
 */
export function matchesEchoDedupe(
  candidates: EchoCandidate[],
  conversationId: string,
  content: string,
  nowMs: number = Date.now()
): EchoCandidate | null {
  const windowStartMs = nowMs - ECHO_MATCH_WINDOW_MS;
  let best: EchoCandidate | null = null;
  let bestTs = -Infinity;
  for (const c of candidates) {
    if (c.conversation_id !== conversationId) continue;
    if (c.content !== content) continue;
    if (c.whatsapp_message_id !== null) continue;
    if (!c.is_from_me) continue;
    const ts = Date.parse(c.created_at);
    if (Number.isNaN(ts)) continue;
    if (ts < windowStartMs) continue;
    if (ts > bestTs) {
      best = c;
      bestTs = ts;
    }
  }
  return best;
}
