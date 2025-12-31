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

// Gera variações do telefone para busca (com/sem 9º dígito, com/sem código do país)
// REGRA CELULAR BRASILEIRO: Celulares começam com 6, 7, 8 ou 9 no primeiro dígito após DDD
function generatePhoneVariations(phone: string): string[] {
  const variations: string[] = [];
  const cleanPhone = phone.replace(/\D/g, '');
  
  if (!cleanPhone) return [phone];
  
  variations.push(cleanPhone);
  
  // Com/sem código do país
  if (cleanPhone.startsWith('55')) {
    variations.push(cleanPhone.slice(2));
  } else {
    variations.push(`55${cleanPhone}`);
  }
  
  // Variações do 9º dígito (celulares brasileiros)
  const hasCountry = cleanPhone.startsWith('55');
  const ddd = hasCountry ? cleanPhone.slice(2, 4) : cleanPhone.slice(0, 2);
  const rest = hasCountry ? cleanPhone.slice(4) : cleanPhone.slice(2);
  
  // Se tem 9 dígitos após o DDD e começa com 9, gerar versão sem o 9
  if (rest.length === 9 && rest.startsWith('9')) {
    const without9 = rest.slice(1);
    variations.push(`55${ddd}${without9}`);
    variations.push(`${ddd}${without9}`);
  }
  
  // CORREÇÃO: Se tem 8 dígitos após o DDD e começa com [6-9], é celular - gerar versão com 9
  if (rest.length === 8 && /^[6-9]/.test(rest)) {
    variations.push(`55${ddd}9${rest}`);
    variations.push(`${ddd}9${rest}`);
  }
  
  return [...new Set(variations)];
}

// Normaliza telefone para formato padrão de armazenamento (55 + DDD + número)
// REGRA: Celulares BR (começando com 6-9 após DDD) devem ter 9 dígitos
// Se recebemos 8 dígitos começando com [6-9], adicionamos o 9 na frente
function normalizePhoneForStorage(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  
  // Remover zeros à esquerda que não sejam parte do código do país
  if (digits.startsWith('0')) {
    digits = digits.replace(/^0+/, '');
  }
  
  // Adicionar código do país se não tiver
  if (!digits.startsWith('55') && digits.length >= 10 && digits.length <= 11) {
    digits = `55${digits}`;
  }
  
  // Para celulares brasileiros (55 + DDD + 8 dígitos)
  // Adicionar 9 se o bloco de 8 dígitos começar com [6-9] (celular sem o nono dígito)
  if (digits.startsWith('55') && digits.length === 12) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    if (rest.length === 8 && /^[6-9]/.test(rest)) {
      digits = `55${ddd}9${rest}`;
      console.log(`[redirect-capture] Adicionado 9º dígito: ${ddd}${rest} -> ${ddd}9${rest}`);
    }
  }
  
  return digits;
}

function determineOrigin(utms: CaptureRequest['utms']): string {
  const campaign = (utms.utm_campaign || '').toLowerCase();
  const source = (utms.utm_source || '').toLowerCase();
  
  // Meta Ads (Facebook/Instagram)
  if (
    campaign.includes('ads') ||
    campaign.includes('fb') ||
    campaign.includes('meta') ||
    campaign.includes('facebook') ||
    campaign.includes('instagram') ||
    source === 'facebook' ||
    source === 'instagram' ||
    source === 'fb' ||
    source === 'meta'
  ) {
    return 'meta_ads';
  }
  
  // Linktree
  if (campaign.includes('linktree') || source === 'linktree') {
    return 'linktree';
  }
  
  // Site orgânico
  if (campaign.includes('site') || campaign.includes('organico') || source === 'site') {
    return 'site';
  }
  
  // Google Ads
  if (campaign.includes('google') || campaign.includes('gads') || source === 'google') {
    return 'google_ads';
  }
  
  // Indicação/Referral
  if (campaign.includes('indicacao') || campaign.includes('referral') || source === 'referral') {
    return 'referral';
  }
  
  // Fallback para redirect
  return 'redirect';
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

    // 1. Buscar campanha com canais e novos campos
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

    // 2. Filtrar canais ativos (opcional - não bloqueia se não houver)
    const activeChannels = campaign.channels
      ?.filter((c: any) => c.is_active && c.channel?.status === 'connected')
      .sort((a: any, b: any) => a.position - b.position) || [];

    // 3. Selecionar canal - lógica com auto_distribute_channels
    let selectedChannel: any = null;
    
    if (activeChannels.length > 0) {
      // Campanha tem canais configurados - usar a seleção normal
      let selectedChannelLink;
      const distributionMode = campaign.distribution_mode || 'equal';
      
      if (distributionMode === 'percentage') {
        const random = Math.floor(Math.random() * 100) + 1;
        let accumulator = 0;
        
        for (const channelLink of activeChannels) {
          accumulator += channelLink.percentage || 0;
          if (random <= accumulator) {
            selectedChannelLink = channelLink;
            break;
          }
        }
        
        if (!selectedChannelLink) {
          selectedChannelLink = activeChannels[0];
        }
        
        console.log('[redirect-capture] Distribuição por porcentagem - Canal:', selectedChannelLink.channel.name);
      } else {
        const channelIndex = campaign.current_channel_index % activeChannels.length;
        selectedChannelLink = activeChannels[channelIndex];
        console.log('[redirect-capture] Round-robin - Canal:', selectedChannelLink.channel.name);
      }
      
      selectedChannel = selectedChannelLink.channel;
    } else if (campaign.auto_distribute_channels !== false) {
      // auto_distribute_channels = true (ou não definido = default true)
      // FALLBACK: Buscar qualquer canal conectado do tenant e distribuir aleatoriamente
      console.log('[redirect-capture] Auto-distribuição ativa - buscando canais conectados do tenant...');
      
      const { data: availableChannels } = await supabase
        .from('whatsapp_channels')
        .select('id, name, phone, status')
        .eq('tenant_id', tenant_id)
        .eq('status', 'connected')
        .eq('is_deleted', false)
        .limit(10);
      
      if (availableChannels && availableChannels.length > 0) {
        // Selecionar aleatoriamente para distribuir carga
        const randomIndex = Math.floor(Math.random() * availableChannels.length);
        selectedChannel = availableChannels[randomIndex];
        console.log('[redirect-capture] Auto-distribuição: canal selecionado:', selectedChannel.name);
      } else {
        console.log('[redirect-capture] ⚠️ Nenhum canal conectado disponível no tenant');
      }
    } else {
      // auto_distribute_channels = false e não há canais configurados
      console.log('[redirect-capture] ⚠️ Auto-distribuição desativada e nenhum canal configurado');
    }

    // 4. Atualizar contador de cliques
    await supabase
      .from('redirect_campaigns')
      .update({ 
        current_channel_index: campaign.current_channel_index + 1,
        total_clicks: campaign.total_clicks + 1,
      })
      .eq('id', campaign_id);

    // 5. Buscar ou criar contato
    let contactId: string | null = null;
    let isNewContact = false;
    
    // Gerar variações do telefone para busca (com/sem 9º dígito)
    const phoneVariations = generatePhoneVariations(phone);
    console.log('[redirect-capture] Buscando contato por variações:', phoneVariations);
    
    // Tentar encontrar contato existente por qualquer variação do telefone
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id, phone')
      .eq('tenant_id', tenant_id)
      .in('phone', phoneVariations)
      .limit(1)
      .maybeSingle();

    if (existingContact) {
      contactId = existingContact.id;
      console.log('[redirect-capture] Contato existente encontrado:', contactId, 'telefone:', existingContact.phone);
    } else {
      // Normalizar telefone para padrão de armazenamento (sempre com 9º dígito)
      const normalizedPhone = normalizePhoneForStorage(phone);
      console.log('[redirect-capture] Telefone normalizado:', phone, '->', normalizedPhone);
      
      // Criar novo contato com department_id se definido
      // USAR UPSERT para garantir idempotência e evitar duplicatas em race conditions
      const contactData: any = {
        tenant_id,
        phone: normalizedPhone,
        full_name: `Lead ${normalizedPhone.slice(-4)}`,
        origin: determineOrigin(utms),
        origin_campaign: utms.utm_campaign || campaign.name,
        referral_data: utms,
        lead_status: 'new',
      };

      // Adicionar department_id se a campanha tiver
      if (campaign.department_id) {
        contactData.department_id = campaign.department_id;
      }

      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .upsert(contactData, {
          onConflict: 'phone,tenant_id',
          ignoreDuplicates: false
        })
        .select('id')
        .single();

      if (contactError) {
        console.error('[redirect-capture] Erro ao criar/upsert contato:', contactError);
        
        // Fallback: buscar por variações caso upsert falhe
        const { data: fallbackContact } = await supabase
          .from('contacts')
          .select('id')
          .eq('tenant_id', tenant_id)
          .in('phone', phoneVariations)
          .limit(1)
          .maybeSingle();
        
        if (fallbackContact) {
          contactId = fallbackContact.id;
          console.log('[redirect-capture] Encontrou contato existente após erro:', contactId);
        }
      } else {
        contactId = newContact.id;
        isNewContact = true;
        console.log('[redirect-capture] Novo contato criado/upserted:', contactId);

        // Incrementar total de leads
        await supabase
          .from('redirect_campaigns')
          .update({ total_leads: campaign.total_leads + 1 })
          .eq('id', campaign_id);

        // Adicionar TAG ao contato se definida
        if (campaign.tag_id && contactId) {
          const { error: tagError } = await supabase
            .from('contact_tags')
            .insert({
              contact_id: contactId,
              tag_id: campaign.tag_id,
              tenant_id,
            });

          if (tagError) {
            console.error('[redirect-capture] Erro ao adicionar tag:', tagError);
          } else {
            console.log('[redirect-capture] Tag adicionada ao contato');
          }
        }

        // CRIAR CONVERSA ANTES de disparar o trigger para garantir que existe
        let conversationId: string | null = null;
        if (selectedChannel?.id && contactId) {
          // Buscar conversa existente ou criar uma nova
          const { data: existingConv } = await supabase
            .from('conversations')
            .select('id')
            .eq('contact_id', contactId)
            .eq('channel_id', selectedChannel.id)
            .in('status', ['open', 'pending'])
            .maybeSingle();

          if (existingConv) {
            conversationId = existingConv.id;
            console.log('[redirect-capture] Conversa existente encontrada:', conversationId?.substring(0, 8));
          } else {
            // Criar nova conversa
            const { data: newConv, error: convError } = await supabase
              .from('conversations')
              .insert({
                tenant_id,
                contact_id: contactId,
                channel_id: selectedChannel.id,
                status: 'pending',
                referral_source: 'redirect',
                referral_data: {
                  campaign_id,
                  campaign_name: campaign.name,
                  ...utms
                },
              })
              .select('id')
              .single();

            if (convError) {
              console.error('[redirect-capture] Erro ao criar conversa:', convError);
            } else {
              conversationId = newConv.id;
              console.log('[redirect-capture] Nova conversa criada:', conversationId?.substring(0, 8));
            }
          }
        }

        // Disparar fluxos de automação para o novo lead
        try {
          await supabase.functions.invoke('process-flow-triggers', {
            body: {
              trigger_type: 'redirect_lead',
              tenant_id,
              contact_id: contactId,
              channel_id: selectedChannel?.id || null,
              conversation_id: conversationId, // Passar conversation_id já criada
              metadata: {
                campaign_id,
                campaign_name: campaign.name,
                utm_source: utms.utm_source,
                utm_medium: utms.utm_medium,
                utm_campaign: utms.utm_campaign,
                utm_term: utms.utm_term,
                utm_content: utms.utm_content,
                referrer,
              }
            }
          });
          console.log('[redirect-capture] Trigger de fluxo disparado com conversation_id:', conversationId?.substring(0, 8));
        } catch (triggerError) {
          console.error('[redirect-capture] Erro ao disparar trigger:', triggerError);
        }
      }
    }

    // 6. Registrar log
    const { error: logError } = await supabase
      .from('redirect_logs')
      .insert({
        campaign_id,
        tenant_id,
        contact_id: contactId,
        channel_id: selectedChannel?.id || null,
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

    console.log('[redirect-capture] Lead capturado com sucesso');

    // 7. Retornar sucesso com mensagem de obrigado (sem redirect para WhatsApp)
    return new Response(
      JSON.stringify({
        success: true,
        contact_id: contactId,
        thank_you_message: campaign.thank_you_message || 'Obrigado! Entraremos em contato em breve.',
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
