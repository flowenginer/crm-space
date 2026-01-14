import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const API_OFICIAL_CHANNEL_ID = 'ee310180-2ead-49c2-bb8a-4d2e334a872f';

    // Contatos específicos com conversas duplicadas identificados (IDs corretos)
    const duplicateContacts = [
      {
        contactId: 'c1e42ef3-e8ba-422d-88df-3f9d6e3c9b4b', // ALTINO JOSÉ CAMILO COOPERRIGUE AGRO
        name: 'ALTINO JOSÉ CAMILO COOPERRIGUE AGRO'
      },
      {
        contactId: '5ea360c6-8fac-44b8-b8be-d03f1280fe82', // ANDERSON ESTÂNCIA RECREATIVA AMÉRICA
        name: 'ANDERSON ESTÂNCIA RECREATIVA AMÉRICA'
      },
      {
        contactId: '9c74873c-f1b4-4679-962b-a1747cbfcffd', // Atendimento * Magic Global
        name: 'Atendimento * Magic Global'
      },
      {
        contactId: 'c50d64d8-ab42-4f56-8d75-ed5c8ee322aa', // BRUNA
        name: 'BRUNA'
      }
    ];

    const results = [];

    for (const contact of duplicateContacts) {
      console.log(`\n=== Processando: ${contact.name} ===`);

      // Buscar todas as conversas abertas/pendentes deste contato
      const { data: conversations, error: convError } = await supabase
        .from('conversations')
        .select(`
          id,
          channel_id,
          assigned_to,
          department_id,
          status,
          created_at,
          whatsapp_channels!inner(id, name, type)
        `)
        .eq('contact_id', contact.contactId)
        .in('status', ['open', 'pending'])
        .order('created_at', { ascending: true });

      if (convError) {
        console.error(`Erro ao buscar conversas de ${contact.name}:`, convError);
        results.push({ contact: contact.name, success: false, error: convError.message });
        continue;
      }

      if (!conversations || conversations.length < 2) {
        console.log(`${contact.name}: Menos de 2 conversas encontradas, pulando`);
        results.push({ contact: contact.name, success: true, message: 'Nenhuma duplicata encontrada' });
        continue;
      }

      console.log(`${contact.name}: ${conversations.length} conversas encontradas`);

      // Contar mensagens de cada conversa
      const conversationsWithMsgCount = [];
      for (const conv of conversations) {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conv.id);

        conversationsWithMsgCount.push({
          ...conv,
          messageCount: count || 0
        });
      }

      // Ordenar: priorizar a que tem mais mensagens, depois a mais antiga
      conversationsWithMsgCount.sort((a, b) => {
        if (b.messageCount !== a.messageCount) {
          return b.messageCount - a.messageCount;
        }
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      // A principal é a que tem mais mensagens (ou mais antiga se empatar)
      const mainConversation = conversationsWithMsgCount[0];
      const duplicateConversations = conversationsWithMsgCount.slice(1);

      console.log(`Conversa principal: ${mainConversation.id} (${mainConversation.messageCount} msgs)`);
      console.log(`Conversas duplicadas: ${duplicateConversations.map(c => `${c.id} (${c.messageCount} msgs)`).join(', ')}`);

      let totalMessagesMoved = 0;
      const mergedConversationIds = [];

      for (const duplicate of duplicateConversations) {
        // Mover mensagens da conversa duplicada para a principal
        const { data: movedMessages, error: moveError } = await supabase
          .from('messages')
          .update({ conversation_id: mainConversation.id })
          .eq('conversation_id', duplicate.id)
          .select('id');

        if (moveError) {
          console.error(`Erro ao mover mensagens de ${duplicate.id}:`, moveError);
          continue;
        }

        const messagesMoved = movedMessages?.length || 0;
        totalMessagesMoved += messagesMoved;
        mergedConversationIds.push(duplicate.id);

        console.log(`Movidas ${messagesMoved} mensagens de ${duplicate.id} para ${mainConversation.id}`);

        // Fechar a conversa duplicada
        const { error: closeError } = await supabase
          .from('conversations')
          .update({
            status: 'closed',
            close_reason: 'Migrado para conversa principal',
            closed_at: new Date().toISOString()
          })
          .eq('id', duplicate.id);

        if (closeError) {
          console.error(`Erro ao fechar conversa ${duplicate.id}:`, closeError);
        } else {
          console.log(`Conversa ${duplicate.id} fechada com sucesso`);
        }
      }

      // Atualizar o canal da conversa principal para API_Oficial
      const oldChannelId = mainConversation.channel_id;
      const { error: updateError } = await supabase
        .from('conversations')
        .update({ channel_id: API_OFICIAL_CHANNEL_ID })
        .eq('id', mainConversation.id);

      if (updateError) {
        console.error(`Erro ao atualizar canal da conversa ${mainConversation.id}:`, updateError);
      } else {
        console.log(`Canal da conversa ${mainConversation.id} atualizado para API_Oficial`);
      }

      // Registrar evento de migração
      const { error: eventError } = await supabase
        .from('conversation_events')
        .insert({
          conversation_id: mainConversation.id,
          event_type: 'conversations_merged',
          data: {
            merged_from: mergedConversationIds,
            messages_moved: totalMessagesMoved,
            original_channel_id: oldChannelId,
            new_channel_id: API_OFICIAL_CHANNEL_ID,
            preserved_assigned_to: mainConversation.assigned_to,
            preserved_department_id: mainConversation.department_id,
            migration_timestamp: new Date().toISOString()
          }
        });

      if (eventError) {
        console.error(`Erro ao registrar evento de migração:`, eventError);
      }

      results.push({
        contact: contact.name,
        success: true,
        mainConversationId: mainConversation.id,
        mergedConversations: mergedConversationIds.length,
        messagesMoved: totalMessagesMoved,
        newChannel: 'API_Oficial'
      });
    }

    console.log('\n=== Migração concluída ===');
    console.log(JSON.stringify(results, null, 2));

    return new Response(JSON.stringify({
      success: true,
      message: 'Migração de conversas duplicadas concluída',
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Erro na migração:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
