import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapeamento de nomes de vendedores para IDs
const VENDEDOR_MAP: Record<string, { userId: string; departmentId: string | null }> = {
  'Diego': { userId: '290087bf-fb0c-49d4-aa19-6c36a6bc4fef', departmentId: 'a8c7e9e4-3b1d-4f5a-9c2e-8d7f6b5a4c3d' },
  'Raul': { userId: '8e01fe21-aa6f-4a93-8db4-53a7d87370bb', departmentId: 'a8c7e9e4-3b1d-4f5a-9c2e-8d7f6b5a4c3d' },
  'Scarlet Costa': { userId: '97ad6ef8-24fd-458e-a193-5dac1f5a42c1', departmentId: 'a8c7e9e4-3b1d-4f5a-9c2e-8d7f6b5a4c3d' },
  'Waleska Brum': { userId: '367c7f21-b67f-4df5-b410-a5a1e2d08a3c', departmentId: 'a8c7e9e4-3b1d-4f5a-9c2e-8d7f6b5a4c3d' },
  "Yasmin Sant'Anna": { userId: '62cf8e40-d3d3-49c6-a0e9-e27c7a1faae1', departmentId: 'a8c7e9e4-3b1d-4f5a-9c2e-8d7f6b5a4c3d' },
};

// Regex para extrair nome do vendedor do padrão *Nome*:
const VENDEDOR_PATTERN = /^\*([^*]+)\*:/;

interface AssignmentResult {
  conversationId: string;
  contactName: string;
  vendedorName: string;
  vendedorId: string;
  success: boolean;
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { mode = 'preview', limit } = await req.json().catch(() => ({}));
    
    console.log(`[AutoAssign] Starting with mode: ${mode}, limit: ${limit || 'none'}`);

    // Buscar conversas sem atribuição
    let query = supabase
      .from('conversations')
      .select('id, contact:contacts(id, full_name)')
      .is('assigned_to', null)
      .eq('status', 'open')
      .order('last_message_at', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data: conversations, error: convError } = await query;

    if (convError) {
      console.error('[AutoAssign] Error fetching conversations:', convError);
      throw convError;
    }

    console.log(`[AutoAssign] Found ${conversations?.length || 0} unassigned conversations`);

    const results: AssignmentResult[] = [];
    const vendedorCounts: Record<string, number> = {};

    // Para cada conversa, buscar a última mensagem com padrão de vendedor
    for (const conv of conversations || []) {
      // Buscar última mensagem enviada (is_from_me = true) que contém o padrão *Nome*:
      const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('content')
        .eq('conversation_id', conv.id)
        .eq('is_from_me', true)
        .not('content', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (msgError) {
        console.error(`[AutoAssign] Error fetching messages for ${conv.id}:`, msgError);
        continue;
      }

      // Encontrar a última mensagem com o padrão de vendedor
      let foundVendedor: string | null = null;
      for (const msg of messages || []) {
        const match = msg.content?.match(VENDEDOR_PATTERN);
        if (match) {
          foundVendedor = match[1];
          break;
        }
      }

      if (!foundVendedor) {
        continue;
      }

      // Verificar se o vendedor está no mapeamento
      const vendedorInfo = VENDEDOR_MAP[foundVendedor];
      if (!vendedorInfo) {
        console.log(`[AutoAssign] Vendedor não mapeado: ${foundVendedor}`);
        results.push({
          conversationId: conv.id,
          contactName: (conv.contact as any)?.full_name || 'Desconhecido',
          vendedorName: foundVendedor,
          vendedorId: '',
          success: false,
          error: 'Vendedor não encontrado no mapeamento',
        });
        continue;
      }

      // Contar atribuições por vendedor (para modo teste: 1 por vendedor)
      if (mode === 'test') {
        if (vendedorCounts[foundVendedor] && vendedorCounts[foundVendedor] >= 1) {
          continue;
        }
      }

      // Se for modo preview, não atualizar
      if (mode === 'preview') {
        results.push({
          conversationId: conv.id,
          contactName: (conv.contact as any)?.full_name || 'Desconhecido',
          vendedorName: foundVendedor,
          vendedorId: vendedorInfo.userId,
          success: true,
        });
        vendedorCounts[foundVendedor] = (vendedorCounts[foundVendedor] || 0) + 1;
        continue;
      }

      // Atualizar conversa
      const { error: updateError } = await supabase
        .from('conversations')
        .update({
          assigned_to: vendedorInfo.userId,
          department_id: vendedorInfo.departmentId,
        })
        .eq('id', conv.id);

      if (updateError) {
        console.error(`[AutoAssign] Error updating conversation ${conv.id}:`, updateError);
        results.push({
          conversationId: conv.id,
          contactName: (conv.contact as any)?.full_name || 'Desconhecido',
          vendedorName: foundVendedor,
          vendedorId: vendedorInfo.userId,
          success: false,
          error: updateError.message,
        });
        continue;
      }

      console.log(`[AutoAssign] Assigned ${conv.id} to ${foundVendedor}`);
      results.push({
        conversationId: conv.id,
        contactName: (conv.contact as any)?.full_name || 'Desconhecido',
        vendedorName: foundVendedor,
        vendedorId: vendedorInfo.userId,
        success: true,
      });
      vendedorCounts[foundVendedor] = (vendedorCounts[foundVendedor] || 0) + 1;
    }

    // Resumo
    const summary = {
      totalProcessed: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      byVendedor: vendedorCounts,
      mode,
    };

    console.log('[AutoAssign] Summary:', summary);

    return new Response(
      JSON.stringify({ success: true, summary, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[AutoAssign] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
