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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Verificar autenticação
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Buscar tenant_id do usuário
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile?.tenant_id) {
      throw new Error('Tenant not found');
    }

    const tenantId = profile.tenant_id;

    // Buscar configuração Cloud API do tenant
    const { data: config } = await supabase
      .from('cloudapi_configs')
      .select('id, phone_number_id, waba_id, verify_token, webhook_configured')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single();

    if (!config) {
      return new Response(JSON.stringify({
        success: false,
        status: 'no_config',
        message: 'Nenhuma configuração Cloud API ativa encontrada para este tenant.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar se há logs recentes (últimas 24h) para este número
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: recentLogs, error: logsError } = await supabase
      .from('cloudapi_webhook_logs')
      .select('id, event_type, created_at, phone_number')
      .eq('config_id', config.id)
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false })
      .limit(10);

    // Buscar a última mensagem recebida (indica webhook funcionando)
    const { data: lastMessage } = await supabase
      .from('cloudapi_webhook_logs')
      .select('id, created_at, event_type')
      .eq('config_id', config.id)
      .eq('event_type', 'messages')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Verificar se há mensagens em conversas deste canal
    const { data: channelConfig } = await supabase
      .from('cloudapi_configs')
      .select('channel_id')
      .eq('id', config.id)
      .single();

    let lastConversationMessage = null;
    if (channelConfig?.channel_id) {
      const { data: lastMsg } = await supabase
        .from('messages')
        .select('id, created_at, is_from_me')
        .eq('channel_id', channelConfig.channel_id)
        .eq('is_from_me', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      lastConversationMessage = lastMsg;
    }

    // Determinar status de saúde
    let healthStatus: 'healthy' | 'warning' | 'error' | 'unknown' = 'unknown';
    let healthMessage = '';

    if (lastMessage) {
      const lastMessageTime = new Date(lastMessage.created_at);
      const hoursSinceLastMessage = (Date.now() - lastMessageTime.getTime()) / (1000 * 60 * 60);

      if (hoursSinceLastMessage < 1) {
        healthStatus = 'healthy';
        healthMessage = 'Webhook funcionando normalmente. Última mensagem recebida há menos de 1 hora.';
      } else if (hoursSinceLastMessage < 24) {
        healthStatus = 'healthy';
        healthMessage = `Webhook funcionando. Última mensagem há ${Math.round(hoursSinceLastMessage)} horas.`;
      } else if (hoursSinceLastMessage < 72) {
        healthStatus = 'warning';
        healthMessage = `Atenção: Nenhuma mensagem nas últimas 24 horas. Última: ${lastMessageTime.toLocaleString('pt-BR')}.`;
      } else {
        healthStatus = 'warning';
        healthMessage = `Aviso: Última mensagem recebida há mais de 72 horas.`;
      }
    } else if (lastConversationMessage) {
      // Tem mensagens no sistema mas não nos logs do webhook
      healthStatus = 'warning';
      healthMessage = 'Mensagens encontradas no sistema, mas nenhuma nos logs do webhook. Verifique a configuração.';
    } else if (config.webhook_configured) {
      healthStatus = 'unknown';
      healthMessage = 'Webhook configurado, mas ainda não recebeu mensagens. Envie uma mensagem de teste.';
    } else {
      healthStatus = 'error';
      healthMessage = 'Webhook não está configurado. Configure o webhook no Meta Business Suite.';
    }

    return new Response(JSON.stringify({
      success: true,
      config: {
        id: config.id,
        phone_number_id: config.phone_number_id,
        waba_id: config.waba_id,
        webhook_configured: config.webhook_configured,
      },
      health: {
        status: healthStatus,
        message: healthMessage,
        last_message_at: lastMessage?.created_at || null,
        last_conversation_message_at: lastConversationMessage?.created_at || null,
      },
      recent_logs: {
        count: recentLogs?.length || 0,
        logs: recentLogs || [],
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: error instanceof Error && error.message === 'Unauthorized' ? 401 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
