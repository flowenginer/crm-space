import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TestStep {
  index: number;
  message: string;
  audio_url?: string;
  attachment_url?: string;
  attachment_type?: string;
}

interface TestResult {
  step: number;
  success: boolean;
  error?: string;
  messageId?: string;
}

// Helper function to get greeting based on time of day
function getGreeting(): string {
  const now = new Date();
  const brasiliaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const hour = brasiliaTime.getHours();
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

// Helper function to get current date in pt-BR format
function getCurrentDate(): string {
  const now = new Date();
  const brasiliaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return brasiliaTime.toLocaleDateString('pt-BR');
}

// Replace variables in message
function replaceVariables(text: string, contactName: string): string {
  return text
    .replace(/\{\{nome\}\}/gi, contactName || 'Cliente')
    .replace(/\{\{telefone\}\}/gi, '')
    .replace(/\{\{email\}\}/gi, '')
    .replace(/\{\{data\}\}/gi, getCurrentDate())
    .replace(/\{\{saudacao\}\}/gi, getGreeting())
    .replace(/\{\{atendente\}\}/gi, '');
}

// Sleep helper
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { phone, channelOption, channelId, steps, tenantId, campaignTitle } = await req.json();

    console.log(`[test-marketing-campaign] Starting test for campaign "${campaignTitle}" to ${phone}`);
    console.log(`[test-marketing-campaign] Channel option: ${channelOption}, Steps: ${steps?.length}`);

    if (!phone || !steps?.length || !tenantId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: phone, steps, tenantId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine effective channel
    let effectiveChannelId = channelId;

    if (channelOption === 'existing') {
      // Find existing conversation for this phone
      const { data: contact } = await supabase
        .from('contacts')
        .select('id')
        .eq('phone', phone)
        .eq('tenant_id', tenantId)
        .single();

      if (contact) {
        const { data: existingConv } = await supabase
          .from('conversations')
          .select('channel_id')
          .eq('contact_id', contact.id)
          .not('channel_id', 'is', null)
          .order('last_message_at', { ascending: false })
          .limit(1)
          .single();

        if (existingConv?.channel_id) {
          effectiveChannelId = existingConv.channel_id;
          console.log(`[test-marketing-campaign] Using existing channel: ${effectiveChannelId}`);
        }
      }

      if (!effectiveChannelId) {
        return new Response(
          JSON.stringify({ error: 'Contato não encontrado ou sem conversa existente com canal' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!effectiveChannelId) {
      return new Response(
        JSON.stringify({ error: 'Canal não especificado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get channel config
    const { data: channel, error: channelError } = await supabase
      .from('whatsapp_channels')
      .select('*, provider:whatsapp_providers(*)')
      .eq('id', effectiveChannelId)
      .single();

    if (channelError || !channel) {
      console.error('[test-marketing-campaign] Channel not found:', channelError);
      return new Response(
        JSON.stringify({ error: 'Canal não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[test-marketing-campaign] Channel found:`, { 
      id: channel.id, 
      name: channel.name, 
      status: channel.status,
      type: channel.type,
      provider: channel.provider ? { code: channel.provider.code, base_url: channel.provider.base_url } : null
    });

    if (channel.status !== 'connected') {
      return new Response(
        JSON.stringify({ error: 'Canal não está conectado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get or create contact for test
    let { data: contact } = await supabase
      .from('contacts')
      .select('id, full_name')
      .eq('phone', phone)
      .eq('tenant_id', tenantId)
      .single();

    const contactName = contact?.full_name || 'Cliente Teste';

    const results: TestResult[] = [];

    // Send each step with 5-10 second intervals
    for (const step of steps as TestStep[]) {
      console.log(`[test-marketing-campaign] Sending step ${step.index + 1}...`);

      try {
        const processedMessage = replaceVariables(step.message || '', contactName);
        
        // Build API URL based on provider
        const provider = channel.provider;
        let apiUrl = '';
        let apiPayload: any = {};
        let headers: Record<string, string> = { 'Content-Type': 'application/json' };

        // Use 'code' instead of 'type' for provider identification
        const providerCode = provider?.code || 'evolution';
        // Normalize base URL (remove trailing slash)
        const providerBaseUrl = (provider?.base_url || 'https://evo.whatlead.com.br').replace(/\/+$/, '');
        // Use 'instance_token' instead of 'api_token'
        const apiToken = channel.instance_token || '';

        console.log(`[test-marketing-campaign] Using provider: ${providerCode}, base_url: ${providerBaseUrl}`);

        switch (providerCode) {
          case 'zapi':
            apiUrl = `${providerBaseUrl}/send-text`;
            apiPayload = { phone, message: processedMessage };
            headers['Client-Token'] = apiToken;
            break;

          case 'uazapi': {
            const cleanPhone = String(phone).replace(/\D/g, '');
            const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
            apiUrl = `${providerBaseUrl}/send/text`;
            apiPayload = { number: formattedPhone, text: processedMessage };
            headers['Accept'] = 'application/json';
            headers['token'] = apiToken;
            break;
          }

          case 'evolution':
          default:
            apiUrl = `${providerBaseUrl}/message/sendText/${channel.instance_id}`;
            apiPayload = { number: phone, text: processedMessage };
            headers['apikey'] = apiToken;
            break;
        }

        // Send text message
        if (processedMessage) {
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(apiPayload),
          });

          const responseData = await response.json();

          if (!response.ok) {
            throw new Error(responseData.message || responseData.error || 'Erro ao enviar mensagem');
          }

          console.log(`[test-marketing-campaign] Step ${step.index + 1} sent successfully`);
        }

        // Send audio if present
        if (step.audio_url) {
          let audioApiUrl = '';
          let audioPayload: any = {};

          switch (providerCode) {
            case 'zapi':
              audioApiUrl = `${providerBaseUrl}/send-audio`;
              audioPayload = { phone, audio: step.audio_url };
              break;
            case 'uazapi': {
              const cleanPhone = String(phone).replace(/\D/g, '');
              const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
              audioApiUrl = `${providerBaseUrl}/send/media`;
              // UAZAPI V2: áudio deve ser ptt
              audioPayload = { number: formattedPhone, type: 'ptt', file: step.audio_url };
              break;
            }
            case 'evolution':
            default:
              audioApiUrl = `${providerBaseUrl}/message/sendWhatsAppAudio/${channel.instance_id}`;
              audioPayload = { number: phone, audio: step.audio_url };
              break;
          }

          await fetch(audioApiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(audioPayload),
          });
          console.log(`[test-marketing-campaign] Step ${step.index + 1} audio sent`);
        }

        // Send attachment if present
        if (step.attachment_url) {
          let mediaApiUrl = '';
          let mediaPayload: any = {};

          switch (providerCode) {
            case 'zapi':
              if (step.attachment_type === 'image') {
                mediaApiUrl = `${providerBaseUrl}/send-image`;
                mediaPayload = { phone, image: step.attachment_url };
              } else if (step.attachment_type === 'video') {
                mediaApiUrl = `${providerBaseUrl}/send-video`;
                mediaPayload = { phone, video: step.attachment_url };
              } else {
                mediaApiUrl = `${providerBaseUrl}/send-document`;
                mediaPayload = { phone, document: step.attachment_url };
              }
              break;
            case 'uazapi': {
              const cleanPhone = String(phone).replace(/\D/g, '');
              const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
              mediaApiUrl = `${providerBaseUrl}/send/media`;
              mediaPayload = {
                number: formattedPhone,
                type: step.attachment_type || 'document',
                file: step.attachment_url,
              };
              // caption apenas se não for documento/áudio
              if (step.message && step.attachment_type !== 'audio' && step.attachment_type !== 'document') {
                mediaPayload.caption = replaceVariables(step.message, contactName);
              }
              break;
            }
            case 'evolution':
            default:
              mediaApiUrl = `${providerBaseUrl}/message/sendMedia/${channel.instance_id}`;
              mediaPayload = {
                number: phone,
                mediatype: step.attachment_type || 'document',
                media: step.attachment_url,
              };
              break;
          }

          await fetch(mediaApiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(mediaPayload),
          });
          console.log(`[test-marketing-campaign] Step ${step.index + 1} attachment sent`);
        }

        results.push({ step: step.index, success: true });

      } catch (err) {
        const error = err as Error;
        console.error(`[test-marketing-campaign] Error sending step ${step.index + 1}:`, error);
        results.push({ step: step.index, success: false, error: error.message });
      }

      // Wait 5-10 seconds before next step (random interval)
      if (step.index < steps.length - 1) {
        const waitMs = 5000 + Math.random() * 5000; // 5-10 seconds
        console.log(`[test-marketing-campaign] Waiting ${Math.round(waitMs / 1000)}s before next step...`);
        await sleep(waitMs);
      }
    }

    console.log(`[test-marketing-campaign] Test completed. Results:`, results);

    return new Response(
      JSON.stringify({ 
        success: true, 
        results,
        summary: {
          total: steps.length,
          sent: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const error = err as Error;
    console.error('[test-marketing-campaign] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
