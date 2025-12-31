import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[resend-initial-messages] Iniciando reenvio de mensagens...');

    // Buscar leads PG01 sem mensagens
    const { data: leads, error: queryError } = await supabase
      .from('contacts')
      .select(`
        id,
        phone,
        full_name,
        tenant_id,
        conversations!inner (
          id,
          channel_id,
          status
        ),
        contact_tags!inner (
          tag_id,
          tags!inner (
            name
          )
        )
      `)
      .eq('contact_tags.tags.name', 'PG01');

    if (queryError) {
      console.error('[resend-initial-messages] Erro ao buscar leads:', queryError);
      throw queryError;
    }

    console.log(`[resend-initial-messages] Total de leads PG01: ${leads?.length || 0}`);

    // Filtrar leads sem mensagens nas conversas
    const leadsWithoutMessages: any[] = [];
    
    for (const lead of leads || []) {
      const conversation = lead.conversations[0];
      if (!conversation) continue;

      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conversation.id);

      if (count === 0) {
        leadsWithoutMessages.push({
          contact_id: lead.id,
          phone: lead.phone,
          full_name: lead.full_name,
          tenant_id: lead.tenant_id,
          conversation_id: conversation.id,
          channel_id: conversation.channel_id
        });
      }
    }

    console.log(`[resend-initial-messages] Leads sem mensagens: ${leadsWithoutMessages.length}`);

    const MESSAGE_TO_SEND = 'Oi, você está ai?';
    const results = {
      total: leadsWithoutMessages.length,
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const lead of leadsWithoutMessages) {
      try {
        console.log(`[resend-initial-messages] Enviando para ${lead.phone} (${lead.full_name})`);

        // Buscar config do canal
        const { data: channel } = await supabase
          .from('whatsapp_channels')
          .select('*')
          .eq('id', lead.channel_id)
          .single();

        if (!channel) {
          console.error(`[resend-initial-messages] Canal não encontrado: ${lead.channel_id}`);
          results.failed++;
          results.errors.push(`Canal não encontrado para ${lead.phone}`);
          continue;
        }

        // Enviar mensagem via whatsapp-instance
        const { data: sendResult, error: sendError } = await supabase.functions.invoke('whatsapp-instance', {
          body: {
            action: 'send',
            channelId: lead.channel_id,
            phone: lead.phone,
            content: MESSAGE_TO_SEND,
            type: 'text'
          }
        });

        if (sendError) {
          console.error(`[resend-initial-messages] Erro ao enviar para ${lead.phone}:`, sendError);
          results.failed++;
          results.errors.push(`Erro ao enviar para ${lead.phone}: ${sendError.message}`);
          continue;
        }

        console.log(`[resend-initial-messages] Mensagem enviada para ${lead.phone}:`, sendResult);

        // Registrar mensagem no banco (usando campos corretos do schema)
        const { error: msgError } = await supabase
          .from('messages')
          .insert({
            conversation_id: lead.conversation_id,
            tenant_id: lead.tenant_id,
            content: MESSAGE_TO_SEND,
            message_type: 'text',
            is_from_me: true,
            status: 'sent',
            whatsapp_message_id: sendResult?.messageId || null,
          });

        if (msgError) {
          console.error(`[resend-initial-messages] Erro ao salvar mensagem para ${lead.phone}:`, msgError);
        }

        // Atualizar conversa
        await supabase
          .from('conversations')
          .update({
            last_message_at: new Date().toISOString(),
            last_message_preview: MESSAGE_TO_SEND,
            last_message_is_from_me: true,
            status: 'open'
          })
          .eq('id', lead.conversation_id);

        results.success++;
        console.log(`[resend-initial-messages] ✅ Sucesso para ${lead.phone}`);

        // Pequena pausa para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`[resend-initial-messages] Erro inesperado para ${lead.phone}:`, err);
        results.failed++;
        results.errors.push(`Erro para ${lead.phone}: ${errorMessage}`);
      }
    }

    console.log('[resend-initial-messages] Finalizado:', results);

    return new Response(JSON.stringify({
      success: true,
      message: `Reenvio concluído: ${results.success} enviados, ${results.failed} falhas`,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[resend-initial-messages] Erro geral:', error);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
