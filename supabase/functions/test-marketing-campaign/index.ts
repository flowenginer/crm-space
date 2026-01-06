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

interface MarketingAction {
  type: string;
  config: {
    agent_id?: string;
    department_id?: string;
    tag_id?: string;
    lead_status_id?: string;
    segment_id?: string;
    close_reason_id?: string;
    followup_template_id?: string;
    marketing_campaign_id?: string;
    automation_id?: string;
  };
}

interface ExecutedAction {
  type: string;
  description: string;
  success: boolean;
  error?: string;
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

// Get action description for logging
function getActionDescription(action: MarketingAction): string {
  const labels: Record<string, string> = {
    none: 'Nenhuma ação',
    send_next_message: 'Enviar próxima mensagem',
    cancel_campaign: 'Cancelar próximos envios',
    transfer_agent: 'Transferir para vendedor',
    transfer_department: 'Transferir para departamento',
    transfer_owner: 'Transferir para dono do contato',
    add_tag: 'Adicionar etiqueta',
    change_lead_status: 'Mudar status do lead',
    add_segment: 'Anexar segmento',
    close: 'Fechar conversa',
    start_followup: 'Iniciar Follow-up',
    start_marketing: 'Iniciar Campanha de Marketing',
    start_automation: 'Ativar automação',
  };
  return labels[action.type] || action.type;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { 
      mode = 'rapid',
      action,
      phone, 
      channelOption, 
      channelId, 
      steps, 
      step,
      stepIndex,
      actions,
      executeActions,
      tenantId, 
      campaignTitle 
    } = body;

    console.log(`[test-marketing-campaign] Mode: ${mode}, Action: ${action || 'full-test'}`);
    console.log(`[test-marketing-campaign] Campaign: "${campaignTitle}", Phone: ${phone}`);

    if (!phone || !tenantId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: phone, tenantId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine effective channel
    let effectiveChannelId = channelId;

    if (channelOption === 'existing') {
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
    const contactId = contact?.id;

    // Get conversation if exists
    let conversationId: string | null = null;
    if (contactId) {
      const { data: conv } = await supabase
        .from('conversations')
        .select('id')
        .eq('contact_id', contactId)
        .eq('channel_id', effectiveChannelId)
        .order('last_message_at', { ascending: false })
        .limit(1)
        .single();
      
      conversationId = conv?.id || null;
    }

    // Build provider config
    const provider = channel.provider;
    const providerCode = provider?.code || 'evolution';
    const providerBaseUrl = (provider?.base_url || 'https://evo.whatlead.com.br').replace(/\/+$/, '');
    const apiToken = channel.instance_token || '';
    
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };
    switch (providerCode) {
      case 'zapi':
        headers['Client-Token'] = apiToken;
        break;
      case 'uazapi':
        headers['Accept'] = 'application/json';
        headers['token'] = apiToken;
        headers['Token'] = apiToken;
        break;
      case 'evolution':
      default:
        headers['apikey'] = apiToken;
        break;
    }

    // INTERACTIVE MODE - Send single step
    if (mode === 'interactive' && action === 'send_step') {
      console.log(`[test-marketing-campaign] Interactive: sending step ${stepIndex + 1}`);
      
      if (!step) {
        return new Response(
          JSON.stringify({ error: 'Step not provided' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        const processedMessage = replaceVariables(step.message || '', contactName);
        
        let apiUrl = '';
        let apiPayload: any = {};

        switch (providerCode) {
          case 'zapi':
            apiUrl = `${providerBaseUrl}/send-text`;
            apiPayload = { phone, message: processedMessage };
            break;
          case 'uazapi': {
            const cleanPhone = String(phone).replace(/\D/g, '');
            const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
            apiUrl = `${providerBaseUrl}/send/text`;
            apiPayload = { number: formattedPhone, text: processedMessage };
            break;
          }
          case 'evolution':
          default:
            apiUrl = `${providerBaseUrl}/message/sendText/${channel.instance_id}`;
            apiPayload = { number: phone, text: processedMessage };
            break;
        }

        if (processedMessage) {
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(apiPayload),
          });

          if (!response.ok) {
            const raw = await response.text();
            throw new Error(raw || 'Erro ao enviar mensagem');
          }
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
              audioPayload = { number: formattedPhone, type: 'ptt', file: step.audio_url };
              break;
            }
            case 'evolution':
            default:
              audioApiUrl = `${providerBaseUrl}/message/sendWhatsAppAudio/${channel.instance_id}`;
              audioPayload = { number: phone, audio: step.audio_url };
              break;
          }

          await fetch(audioApiUrl, { method: 'POST', headers, body: JSON.stringify(audioPayload) });
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
              mediaPayload = { number: formattedPhone, type: step.attachment_type || 'document', file: step.attachment_url };
              break;
            }
            case 'evolution':
            default:
              mediaApiUrl = `${providerBaseUrl}/message/sendMedia/${channel.instance_id}`;
              mediaPayload = { number: phone, mediatype: step.attachment_type || 'document', media: step.attachment_url };
              break;
          }

          await fetch(mediaApiUrl, { method: 'POST', headers, body: JSON.stringify(mediaPayload) });
        }

        return new Response(
          JSON.stringify({ success: true, step: stepIndex }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (err) {
        const error = err as Error;
        console.error(`[test-marketing-campaign] Error sending step:`, error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // INTERACTIVE MODE - Simulate reply or no reply
    if (mode === 'interactive' && (action === 'simulate_reply' || action === 'simulate_no_reply')) {
      console.log(`[test-marketing-campaign] Interactive: ${action} for step ${stepIndex + 1}`);
      console.log(`[test-marketing-campaign] Actions to process:`, actions);
      console.log(`[test-marketing-campaign] Execute in DB: ${executeActions}`);

      const executedActions: ExecutedAction[] = [];

      if (actions && actions.length > 0) {
        for (const actionItem of actions as MarketingAction[]) {
          const description = getActionDescription(actionItem);
          
          if (!executeActions) {
            // Just simulate - don't execute
            executedActions.push({
              type: actionItem.type,
              description: `[Simulado] ${description}`,
              success: true,
            });
            continue;
          }

          // Execute action in database
          try {
            switch (actionItem.type) {
              case 'add_tag': {
                if (contactId && actionItem.config.tag_id) {
                  const { error } = await supabase
                    .from('contact_tags')
                    .upsert({
                      contact_id: contactId,
                      tag_id: actionItem.config.tag_id,
                      tenant_id: tenantId,
                    }, { onConflict: 'contact_id,tag_id' });

                  if (error) throw error;
                  
                  // Get tag name for description
                  const { data: tag } = await supabase
                    .from('tags')
                    .select('name')
                    .eq('id', actionItem.config.tag_id)
                    .single();

                  executedActions.push({
                    type: actionItem.type,
                    description: `Etiqueta "${tag?.name || 'desconhecida'}" adicionada`,
                    success: true,
                  });
                }
                break;
              }

              case 'transfer_agent': {
                if (conversationId && actionItem.config.agent_id) {
                  const { error } = await supabase
                    .from('conversations')
                    .update({ assigned_to: actionItem.config.agent_id })
                    .eq('id', conversationId);

                  if (error) throw error;

                  const { data: agent } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', actionItem.config.agent_id)
                    .single();

                  executedActions.push({
                    type: actionItem.type,
                    description: `Transferido para ${agent?.full_name || 'vendedor'}`,
                    success: true,
                  });
                }
                break;
              }

              case 'transfer_department': {
                if (conversationId && actionItem.config.department_id) {
                  const { error } = await supabase
                    .from('conversations')
                    .update({ 
                      department_id: actionItem.config.department_id,
                      assigned_to: null 
                    })
                    .eq('id', conversationId);

                  if (error) throw error;

                  const { data: dept } = await supabase
                    .from('departments')
                    .select('name')
                    .eq('id', actionItem.config.department_id)
                    .single();

                  executedActions.push({
                    type: actionItem.type,
                    description: `Transferido para ${dept?.name || 'departamento'}`,
                    success: true,
                  });
                }
                break;
              }

              case 'transfer_owner': {
                if (conversationId && contactId) {
                  const { data: contactData } = await supabase
                    .from('contacts')
                    .select('assigned_to')
                    .eq('id', contactId)
                    .single();

                  if (contactData?.assigned_to) {
                    const { error } = await supabase
                      .from('conversations')
                      .update({ assigned_to: contactData.assigned_to })
                      .eq('id', conversationId);

                    if (error) throw error;

                    executedActions.push({
                      type: actionItem.type,
                      description: `Transferido para dono do contato`,
                      success: true,
                    });
                  } else {
                    executedActions.push({
                      type: actionItem.type,
                      description: `Contato não tem dono atribuído`,
                      success: false,
                    });
                  }
                }
                break;
              }

              case 'change_lead_status': {
                if (contactId && actionItem.config.lead_status_id) {
                  const { data: status } = await supabase
                    .from('lead_statuses')
                    .select('name, value')
                    .eq('id', actionItem.config.lead_status_id)
                    .single();

                  if (status) {
                    const { error } = await supabase
                      .from('contacts')
                      .update({ lead_status: status.value })
                      .eq('id', contactId);

                    if (error) throw error;

                    executedActions.push({
                      type: actionItem.type,
                      description: `Status alterado para "${status.name}"`,
                      success: true,
                    });
                  }
                }
                break;
              }

              case 'add_segment': {
                if (contactId && actionItem.config.segment_id) {
                  const { error } = await supabase
                    .from('contacts')
                    .update({ segment_id: actionItem.config.segment_id })
                    .eq('id', contactId);

                  if (error) throw error;

                  const { data: segment } = await supabase
                    .from('segments')
                    .select('name')
                    .eq('id', actionItem.config.segment_id)
                    .single();

                  executedActions.push({
                    type: actionItem.type,
                    description: `Segmento "${segment?.name || 'desconhecido'}" anexado`,
                    success: true,
                  });
                }
                break;
              }

              case 'close': {
                if (conversationId) {
                  const { error } = await supabase
                    .from('conversations')
                    .update({ 
                      status: 'closed',
                      closed_at: new Date().toISOString(),
                      close_reason: actionItem.config.close_reason_id || null,
                    })
                    .eq('id', conversationId);

                  if (error) throw error;

                  executedActions.push({
                    type: actionItem.type,
                    description: `Conversa fechada`,
                    success: true,
                  });
                }
                break;
              }

              case 'start_marketing': {
                if (contactId && actionItem.config.marketing_campaign_id) {
                  const { error } = await supabase
                    .from('active_marketing_campaigns')
                    .insert({
                      campaign_id: actionItem.config.marketing_campaign_id,
                      contact_id: contactId,
                      conversation_id: conversationId,
                      tenant_id: tenantId,
                      status: 'active',
                      current_step: 0,
                    });

                  if (error) throw error;

                  executedActions.push({
                    type: actionItem.type,
                    description: `Nova campanha de marketing iniciada`,
                    success: true,
                  });
                }
                break;
              }

              case 'start_followup': {
                if (contactId && conversationId && actionItem.config.followup_template_id) {
                  const { error } = await supabase
                    .from('active_rescues')
                    .insert({
                      template_id: actionItem.config.followup_template_id,
                      contact_id: contactId,
                      conversation_id: conversationId,
                      tenant_id: tenantId,
                      status: 'active',
                      current_step: 0,
                    });

                  if (error) throw error;

                  executedActions.push({
                    type: actionItem.type,
                    description: `Follow-up iniciado`,
                    success: true,
                  });
                }
                break;
              }

              case 'start_automation': {
                // For automation, we'd typically start the chatbot flow
                // This is more complex and would need specific implementation
                executedActions.push({
                  type: actionItem.type,
                  description: `[Simulado] Automação seria ativada`,
                  success: true,
                });
                break;
              }

              case 'send_next_message':
              case 'cancel_campaign':
              case 'none':
              default:
                executedActions.push({
                  type: actionItem.type,
                  description,
                  success: true,
                });
                break;
            }
          } catch (err) {
            const error = err as Error;
            console.error(`[test-marketing-campaign] Error executing action ${actionItem.type}:`, error);
            executedActions.push({
              type: actionItem.type,
              description: `Erro: ${error.message}`,
              success: false,
              error: error.message,
            });
          }
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          action,
          stepIndex,
          executedActions,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // RAPID MODE - Send all messages
    if (!steps?.length) {
      return new Response(
        JSON.stringify({ error: 'No steps provided for rapid test' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[test-marketing-campaign] Rapid mode: sending ${steps.length} steps`);

    const results: TestResult[] = [];

    for (const stepItem of steps as TestStep[]) {
      console.log(`[test-marketing-campaign] Sending step ${stepItem.index + 1}...`);

      try {
        const processedMessage = replaceVariables(stepItem.message || '', contactName);
        
        let apiUrl = '';
        let apiPayload: any = {};

        switch (providerCode) {
          case 'zapi':
            apiUrl = `${providerBaseUrl}/send-text`;
            apiPayload = { phone, message: processedMessage };
            break;

          case 'uazapi': {
            const cleanPhone = String(phone).replace(/\D/g, '');
            const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
            apiUrl = `${providerBaseUrl}/send/text`;
            apiPayload = { number: formattedPhone, text: processedMessage };
            break;
          }

          case 'evolution':
          default:
            apiUrl = `${providerBaseUrl}/message/sendText/${channel.instance_id}`;
            apiPayload = { number: phone, text: processedMessage };
            break;
        }

        if (processedMessage) {
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(apiPayload),
          });

          const raw = await response.text();
          let responseData: any = null;
          try {
            responseData = raw ? JSON.parse(raw) : null;
          } catch {
            responseData = { raw };
          }

          console.log(`[test-marketing-campaign] Provider response`, {
            provider: providerCode,
            status: response.status,
            ok: response.ok,
          });

          if (!response.ok) {
            throw new Error(
              responseData?.message || responseData?.error || responseData?.raw || 'Erro ao enviar mensagem'
            );
          }
        }

        // Send audio if present
        if (stepItem.audio_url) {
          let audioApiUrl = '';
          let audioPayload: any = {};

          switch (providerCode) {
            case 'zapi':
              audioApiUrl = `${providerBaseUrl}/send-audio`;
              audioPayload = { phone, audio: stepItem.audio_url };
              break;
            case 'uazapi': {
              const cleanPhone = String(phone).replace(/\D/g, '');
              const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
              audioApiUrl = `${providerBaseUrl}/send/media`;
              audioPayload = { number: formattedPhone, type: 'ptt', file: stepItem.audio_url };
              break;
            }
            case 'evolution':
            default:
              audioApiUrl = `${providerBaseUrl}/message/sendWhatsAppAudio/${channel.instance_id}`;
              audioPayload = { number: phone, audio: stepItem.audio_url };
              break;
          }

          await fetch(audioApiUrl, { method: 'POST', headers, body: JSON.stringify(audioPayload) });
        }

        // Send attachment if present
        if (stepItem.attachment_url) {
          let mediaApiUrl = '';
          let mediaPayload: any = {};

          switch (providerCode) {
            case 'zapi':
              if (stepItem.attachment_type === 'image') {
                mediaApiUrl = `${providerBaseUrl}/send-image`;
                mediaPayload = { phone, image: stepItem.attachment_url };
              } else if (stepItem.attachment_type === 'video') {
                mediaApiUrl = `${providerBaseUrl}/send-video`;
                mediaPayload = { phone, video: stepItem.attachment_url };
              } else {
                mediaApiUrl = `${providerBaseUrl}/send-document`;
                mediaPayload = { phone, document: stepItem.attachment_url };
              }
              break;
            case 'uazapi': {
              const cleanPhone = String(phone).replace(/\D/g, '');
              const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
              mediaApiUrl = `${providerBaseUrl}/send/media`;
              mediaPayload = {
                number: formattedPhone,
                type: stepItem.attachment_type || 'document',
                file: stepItem.attachment_url,
              };
              break;
            }
            case 'evolution':
            default:
              mediaApiUrl = `${providerBaseUrl}/message/sendMedia/${channel.instance_id}`;
              mediaPayload = {
                number: phone,
                mediatype: stepItem.attachment_type || 'document',
                media: stepItem.attachment_url,
              };
              break;
          }

          await fetch(mediaApiUrl, { method: 'POST', headers, body: JSON.stringify(mediaPayload) });
        }

        results.push({ step: stepItem.index, success: true });

      } catch (err) {
        const error = err as Error;
        console.error(`[test-marketing-campaign] Error sending step ${stepItem.index + 1}:`, error);
        results.push({ step: stepItem.index, success: false, error: error.message });
      }

      // Wait 5-10 seconds before next step
      if (stepItem.index < steps.length - 1) {
        const waitMs = 5000 + Math.random() * 5000;
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
