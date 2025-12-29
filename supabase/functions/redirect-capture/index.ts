import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CaptureRequest {
  campaign_id: string;
  tenant_id: string;
  phone: string;
  country_code: string;
  utms: {
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    utm_term: string | null;
    utm_content: string | null;
  };
  referrer?: string;
  user_agent?: string;
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

    const body: CaptureRequest = await req.json();
    const { campaign_id, tenant_id, phone, country_code, utms, referrer, user_agent } = body;

    console.log('[redirect-capture] Processando lead:', { campaign_id, phone: phone.substring(0, 5) + '***' });

    // 1. Buscar campanha com canais
    const { data: campaign, error: campaignError } = await supabase
      .from('redirect_campaigns')
      .select(`
        *,
        channels:redirect_campaign_channels(
          *,
          channel:whatsapp_channels(id, name, phone, status)
        )
      `)
      .eq('id', campaign_id)
      .eq('is_active', true)
      .single();

    if (campaignError || !campaign) {
      console.error('[redirect-capture] Campanha não encontrada:', campaignError);
      return new Response(
        JSON.stringify({ success: false, error: 'Campanha não encontrada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // 2. Filtrar canais ativos
    const activeChannels = campaign.channels
      ?.filter((c: any) => c.is_active && c.channel?.status === 'connected')
      .sort((a: any, b: any) => a.position - b.position) || [];

    if (activeChannels.length === 0) {
      console.error('[redirect-capture] Nenhum canal ativo');
      return new Response(
        JSON.stringify({ success: false, error: 'Nenhum canal disponível' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // 3. Selecionar canal baseado no modo de distribuição
    let selectedChannelLink;
    const distributionMode = campaign.distribution_mode || 'equal';
    
    if (distributionMode === 'percentage') {
      // Distribuição por porcentagem
      const random = Math.floor(Math.random() * 100) + 1;
      let accumulator = 0;
      
      for (const channelLink of activeChannels) {
        accumulator += channelLink.percentage || 0;
        if (random <= accumulator) {
          selectedChannelLink = channelLink;
          break;
        }
      }
      
      // Fallback para o primeiro canal se nenhum foi selecionado
      if (!selectedChannelLink) {
        selectedChannelLink = activeChannels[0];
      }
      
      console.log('[redirect-capture] Distribuição por porcentagem - Random:', random, '- Canal:', selectedChannelLink.channel.name);
    } else {
      // Distribuição igual (round-robin)
      const channelIndex = campaign.current_channel_index % activeChannels.length;
      selectedChannelLink = activeChannels[channelIndex];
      console.log('[redirect-capture] Round-robin - Index:', channelIndex, '- Canal:', selectedChannelLink.channel.name);
    }
    
    const selectedChannel = selectedChannelLink.channel;

    // 4. Atualizar índice round-robin e contador de cliques
    await supabase
      .from('redirect_campaigns')
      .update({ 
        current_channel_index: campaign.current_channel_index + 1,
        total_clicks: campaign.total_clicks + 1,
      })
      .eq('id', campaign_id);

    // 5. Buscar ou criar contato
    let contactId: string | null = null;
    
    // Tentar encontrar contato existente pelo telefone
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('tenant_id', tenant_id)
      .eq('phone', phone)
      .single();

    if (existingContact) {
      contactId = existingContact.id;
      console.log('[redirect-capture] Contato existente:', contactId);
    } else {
      // Criar novo contato
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          tenant_id,
          phone,
          full_name: `Lead ${phone.slice(-4)}`,
          origin: 'redirect',
          origin_campaign: utms.utm_campaign || campaign.name,
          referral_data: utms,
          lead_status: 'new',
        })
        .select('id')
        .single();

      if (contactError) {
        console.error('[redirect-capture] Erro ao criar contato:', contactError);
      } else {
        contactId = newContact.id;
        console.log('[redirect-capture] Novo contato criado:', contactId);

        // Incrementar total de leads
        await supabase
          .from('redirect_campaigns')
          .update({ total_leads: campaign.total_leads + 1 })
          .eq('id', campaign_id);
      }
    }

    // 6. Registrar log
    const { error: logError } = await supabase
      .from('redirect_logs')
      .insert({
        campaign_id,
        tenant_id,
        contact_id: contactId,
        channel_id: selectedChannel.id,
        phone,
        country_code,
        utm_source: utms.utm_source,
        utm_medium: utms.utm_medium,
        utm_campaign: utms.utm_campaign,
        utm_term: utms.utm_term,
        utm_content: utms.utm_content,
        referrer,
        user_agent,
      });

    if (logError) {
      console.error('[redirect-capture] Erro ao registrar log:', logError);
    }

    // 7. Formatar número do canal para wa.me
    let redirectPhone = selectedChannel.phone.replace(/\D/g, '');
    
    // Garantir que começa com código do país
    if (!redirectPhone.startsWith('55') && redirectPhone.length === 11) {
      redirectPhone = '55' + redirectPhone;
    }

    console.log('[redirect-capture] Redirecionando para:', redirectPhone);

    return new Response(
      JSON.stringify({
        success: true,
        redirect_phone: redirectPhone,
        channel_name: selectedChannel.name,
        welcome_message: campaign.welcome_message,
        contact_id: contactId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[redirect-capture] Erro geral:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
