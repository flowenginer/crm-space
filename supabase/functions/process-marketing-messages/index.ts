import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

// Helper function to replace variables in message
function replaceVariables(
  text: string,
  contact: { full_name?: string; phone?: string; email?: string },
  agentName?: string
): string {
  return text
    .replace(/\{\{nome\}\}/gi, contact.full_name || '')
    .replace(/\{\{telefone\}\}/gi, contact.phone || '')
    .replace(/\{\{email\}\}/gi, contact.email || '')
    .replace(/\{\{data\}\}/gi, getCurrentDate())
    .replace(/\{\{saudacao\}\}/gi, getGreeting())
    .replace(/\{\{atendente\}\}/gi, agentName || '');
}

interface MarketingAction {
  type: string;
  config: Record<string, unknown>;
}

// Helper function to execute a marketing action
async function executeAction(
  supabase: any,
  action: MarketingAction,
  conversationId: string,
  contactId: string,
  tenantId: string
): Promise<boolean> {
  const { type, config } = action;
  
  if (!type || type === 'none' || type === 'send_next_message') {
    return false; // No action executed or continue to next step
  }

  console.log(`[process-marketing-messages] Executing action: ${type}`, config);

  try {
    switch (type) {
      case 'close':
        await supabase
          .from('conversations')
          .update({
            status: 'closed',
            close_reason: config?.close_reason_id || 'marketing_completed',
            closed_at: new Date().toISOString(),
          })
          .eq('id', conversationId);
        console.log('[process-marketing-messages] Conversation closed');
        return true;

      case 'transfer_department':
        if (config?.department_id) {
          await supabase
            .from('conversations')
            .update({ department_id: config.department_id })
            .eq('id', conversationId);
          console.log('[process-marketing-messages] Transferred to department:', config.department_id);
        }
        return true;

      case 'transfer_agent':
        if (config?.agent_id) {
          await supabase
            .from('conversations')
            .update({ assigned_to: config.agent_id })
            .eq('id', conversationId);
          console.log('[process-marketing-messages] Transferred to agent:', config.agent_id);
        }
        return true;

      case 'transfer_owner':
        // Get the contact's assigned_to (owner)
        const { data: contact } = await supabase
          .from('contacts')
          .select('assigned_to')
          .eq('id', contactId)
          .single();
        
        if (contact?.assigned_to) {
          await supabase
            .from('conversations')
            .update({ assigned_to: contact.assigned_to })
            .eq('id', conversationId);
          console.log('[process-marketing-messages] Transferred to owner:', contact.assigned_to);
        }
        return true;

      case 'add_tag':
        if (config?.tag_id) {
          await supabase
            .from('contact_tags')
            .upsert(
              { contact_id: contactId, tag_id: config.tag_id, tenant_id: tenantId },
              { onConflict: 'contact_id,tag_id' }
            );
          console.log('[process-marketing-messages] Tag added:', config.tag_id);
        }
        return true;

      case 'remove_tag':
        if (config?.tag_id) {
          await supabase
            .from('contact_tags')
            .delete()
            .eq('contact_id', contactId)
            .eq('tag_id', config.tag_id);
          console.log('[process-marketing-messages] Tag removed:', config.tag_id);
        }
        return true;

      case 'change_lead_status':
        if (config?.lead_status) {
          await supabase
            .from('contacts')
            .update({ lead_status: config.lead_status })
            .eq('id', contactId);
          console.log('[process-marketing-messages] Lead status changed to:', config.lead_status);
        }
        return true;

      case 'add_segment':
        if (config?.segment_id) {
          await supabase
            .from('contacts')
            .update({ segment_id: config.segment_id })
            .eq('id', contactId);
          console.log('[process-marketing-messages] Segment added:', config.segment_id);
        }
        return true;

      case 'cancel_campaign':
        // Will be handled by caller - mark campaign as cancelled
        return true;

      case 'chain_campaign':
        if (config?.campaign_id) {
          // Start another marketing campaign for this contact
          const { data: campaign } = await supabase
            .from('marketing_campaigns')
            .select('steps')
            .eq('id', config.campaign_id)
            .single();
          
          if (campaign?.steps?.length > 0) {
            const firstStep = campaign.steps[0];
            const { data: contactData } = await supabase
              .from('contacts')
              .select('full_name, phone, email')
              .eq('id', contactId)
              .single();

            const { data: newActiveCampaign } = await supabase
              .from('active_marketing_campaigns')
              .insert({
                campaign_id: config.campaign_id,
                contact_id: contactId,
                conversation_id: conversationId,
                tenant_id: tenantId,
                current_step: 0,
                status: 'active',
                next_send_at: new Date().toISOString(),
              })
              .select()
              .single();

            if (newActiveCampaign) {
              await supabase
                .from('marketing_scheduled_messages')
                .insert({
                  active_campaign_id: newActiveCampaign.id,
                  step_number: 0,
                  scheduled_for: new Date().toISOString(),
                  status: 'pending',
                  content: replaceVariables(firstStep.message || '', contactData || {}, ''),
                  audio_url: firstStep.audio_url || null,
                  attachment_url: firstStep.attachment_url || null,
                  tenant_id: tenantId,
                });
              console.log('[process-marketing-messages] Chained to campaign:', config.campaign_id);
            }
          }
        }
        return true;

      case 'chain_rescue':
        if (config?.followup_template_id) {
          const { data: template } = await supabase
            .from('rescue_templates')
            .select('steps')
            .eq('id', config.followup_template_id)
            .single();
          
          if (template?.steps?.length > 0) {
            const firstStep = template.steps[0];
            const { data: contactData } = await supabase
              .from('contacts')
              .select('full_name, phone, email')
              .eq('id', contactId)
              .single();

            const { data: newRescue } = await supabase
              .from('active_rescues')
              .insert({
                template_id: config.followup_template_id,
                contact_id: contactId,
                conversation_id: conversationId,
                tenant_id: tenantId,
                current_step: 0,
                status: 'active',
                next_send_at: new Date().toISOString(),
              })
              .select()
              .single();

            if (newRescue) {
              await supabase
                .from('rescue_scheduled_messages')
                .insert({
                  rescue_id: newRescue.id,
                  step_number: 0,
                  scheduled_for: new Date().toISOString(),
                  status: 'pending',
                  content: replaceVariables(firstStep.message || '', contactData || {}, ''),
                  audio_url: firstStep.audio_url || null,
                  attachment_url: firstStep.attachment_url || null,
                });
              console.log('[process-marketing-messages] Chained to rescue template:', config.followup_template_id);
            }
          }
        }
        return true;

      default:
        console.log(`[process-marketing-messages] Unknown action type: ${type}`);
        return false;
    }
  } catch (error) {
    console.error(`[process-marketing-messages] Error executing action ${type}:`, error);
    return false;
  }
}

// Execute multiple actions
async function executeActions(
  supabase: any,
  actions: MarketingAction[],
  conversationId: string,
  contactId: string,
  tenantId: string
): Promise<boolean> {
  let shouldCancel = false;
  
  for (const action of actions) {
    if (action.type === 'cancel_campaign') {
      shouldCancel = true;
    }
    await executeAction(supabase, action, conversationId, contactId, tenantId);
    
    // If action is 'close', we should stop processing
    if (action.type === 'close') {
      break;
    }
  }
  
  return shouldCancel;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[process-marketing-messages] Starting processing...');

    // Find pending messages that are due
    const { data: pendingMessages, error: fetchError } = await supabase
      .from('marketing_scheduled_messages')
      .select(`
        *,
        campaign:active_marketing_campaigns(
          id,
          conversation_id,
          contact_id,
          status,
          campaign_id,
          current_step,
          tenant_id,
          marketing_campaign:marketing_campaigns(id, steps, title)
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error('[process-marketing-messages] Error fetching messages:', fetchError);
      throw fetchError;
    }

    console.log(`[process-marketing-messages] Found ${pendingMessages?.length || 0} pending messages`);

    let processed = 0;
    let errors = 0;

    for (const msg of pendingMessages || []) {
      // Skip if campaign is no longer active
      if (msg.campaign?.status !== 'active') {
        console.log(`[process-marketing-messages] Campaign ${msg.campaign?.id} not active, cancelling message`);
        await supabase
          .from('marketing_scheduled_messages')
          .update({ status: 'cancelled' })
          .eq('id', msg.id);
        continue;
      }

      try {
        const activeCampaign = msg.campaign;
        const marketingCampaign = activeCampaign?.marketing_campaign;
        const steps = marketingCampaign?.steps || [];
        const currentStepIndex = msg.step_number;
        const currentStepData = steps[currentStepIndex] as any;

        if (!currentStepData) {
          console.error('[process-marketing-messages] Step data not found for step:', currentStepIndex);
          errors++;
          continue;
        }

        // Get conversation and channel info
        const { data: conversation, error: convError } = await supabase
          .from('conversations')
          .select('channel_id, assigned_to')
          .eq('id', activeCampaign.conversation_id)
          .single();

        if (convError || !conversation?.channel_id) {
          console.error('[process-marketing-messages] Missing channel for message:', msg.id, convError);
          errors++;
          continue;
        }

        // Get contact info
        const { data: contact, error: contactError } = await supabase
          .from('contacts')
          .select('phone, full_name, email')
          .eq('id', activeCampaign.contact_id)
          .single();

        if (contactError || !contact?.phone) {
          console.error('[process-marketing-messages] Missing phone for message:', msg.id, contactError);
          errors++;
          continue;
        }

        // Get agent name if assigned
        let agentName = '';
        if (conversation.assigned_to) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', conversation.assigned_to)
            .single();
          agentName = profile?.full_name || '';
        }

        console.log(`[process-marketing-messages] Processing message for ${contact.phone}...`);

        // Helper function: INSERT first -> SEND to WhatsApp -> UPDATE with messageId
        const sendWithInsertFirst = async (type: string, content: string, mediaUrl: string | null) => {
          // 1. INSERT message first with status 'pending'
          const { data: insertedMsg, error: insertError } = await supabase
            .from('messages')
            .insert({
              conversation_id: activeCampaign.conversation_id,
              contact_id: activeCampaign.contact_id,
              content: content,
              is_from_me: true,
              message_type: type,
              media_url: mediaUrl,
              status: 'pending',
              whatsapp_message_id: null,
            })
            .select('id')
            .single();

          if (insertError) {
            console.error(`[process-marketing-messages] Error inserting ${type} message:`, insertError);
            throw new Error(`Failed to insert ${type} message`);
          }

          console.log(`[process-marketing-messages] Inserted pending ${type} message:`, insertedMsg.id);

          // 2. SEND to WhatsApp
          const sendResponse = await fetch(`${supabaseUrl}/functions/v1/whatsapp-instance`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              action: 'send',
              channelId: conversation.channel_id,
              phone: contact.phone,
              content: content,
              type: type,
              mediaUrl: mediaUrl,
            }),
          });

          const sendResult = await sendResponse.json();
          
          if (!sendResponse.ok || sendResult.error) {
            console.error(`[process-marketing-messages] Error sending ${type}:`, sendResult);
            // Rollback: delete the pending message
            await supabase.from('messages').delete().eq('id', insertedMsg.id);
            throw new Error(`Failed to send ${type}`);
          }

          console.log(`[process-marketing-messages] ${type} sent:`, sendResult);

          // 3. UPDATE message with whatsapp_message_id and status 'sent'
          const { error: updateError } = await supabase
            .from('messages')
            .update({
              whatsapp_message_id: sendResult?.messageId,
              status: 'sent',
            })
            .eq('id', insertedMsg.id);

          if (updateError) {
            console.error(`[process-marketing-messages] Error updating ${type} message:`, updateError);
          }

          console.log(`[process-marketing-messages] ${type} message updated with whatsapp_message_id`);
        };

        // 1. Send TEXT message (if exists)
        if (msg.content?.trim()) {
          console.log('[process-marketing-messages] Sending text...');
          const processedContent = replaceVariables(msg.content, contact, agentName);
          await sendWithInsertFirst('text', processedContent, null);
        }
        
        // 2. Send AUDIO (if exists)
        if (msg.audio_url) {
          console.log('[process-marketing-messages] Sending audio...');
          await sendWithInsertFirst('audio', '', msg.audio_url);
        }
        
        // 3. Send ATTACHMENT (if exists)
        if (msg.attachment_url) {
          console.log('[process-marketing-messages] Sending attachment...');
          await sendWithInsertFirst('document', '', msg.attachment_url);
        }

        // Mark scheduled message as sent
        await supabase
          .from('marketing_scheduled_messages')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', msg.id);

        // Determine next steps
        const nextStep = currentStepIndex + 1;
        const isLastMessage = nextStep >= steps.length;

        // Get on_no_reply_actions for this step (will be executed when timer expires without reply)
        const onNoReplyActions = (currentStepData?.on_no_reply_actions || []) as MarketingAction[];

        if (isLastMessage) {
          // Last message - execute on_no_reply_actions as final action
          console.log('[process-marketing-messages] Last message sent, executing final actions');
          
          const shouldCancel = await executeActions(
            supabase,
            onNoReplyActions,
            activeCampaign.conversation_id,
            activeCampaign.contact_id,
            activeCampaign.tenant_id
          );

          // Mark campaign as completed
          await supabase
            .from('active_marketing_campaigns')
            .update({ status: 'completed' })
            .eq('id', activeCampaign.id);
            
          console.log(`[process-marketing-messages] Campaign ${activeCampaign.id} completed`);
        } else {
          // Not the last message - schedule next message based on timer
          const nextStepData = steps[nextStep] as any;
          const timerMinutes = nextStepData?.timer_minutes || 60;
          const nextSendAt = new Date(Date.now() + timerMinutes * 60 * 1000);

          // Update active campaign with next step info
          await supabase
            .from('active_marketing_campaigns')
            .update({ 
              current_step: nextStep, 
              next_send_at: nextSendAt.toISOString() 
            })
            .eq('id', activeCampaign.id);

          // Schedule next message
          await supabase
            .from('marketing_scheduled_messages')
            .insert({
              active_campaign_id: activeCampaign.id,
              step_number: nextStep,
              scheduled_for: nextSendAt.toISOString(),
              status: 'pending',
              content: replaceVariables(nextStepData.message || '', contact, agentName),
              audio_url: nextStepData.audio_url || null,
              attachment_url: nextStepData.attachment_url || null,
              tenant_id: activeCampaign.tenant_id,
            });

          console.log(`[process-marketing-messages] Scheduled next message for step ${nextStep} at ${nextSendAt.toISOString()}`);
        }

        processed++;
      } catch (err) {
        console.error('[process-marketing-messages] Error processing message:', msg.id, err);
        errors++;
      }
    }

    console.log(`[process-marketing-messages] Done. Processed: ${processed}, Errors: ${errors}`);

    return new Response(
      JSON.stringify({ success: true, processed, errors }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[process-marketing-messages] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
