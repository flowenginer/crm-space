import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SatisfactionConfig {
  is_active: boolean;
  survey_type: 'nps' | 'csat';
  delay_minutes: number;
  message_nps: string;
  message_csat: string;
  send_only_business_hours: boolean;
  auto_close_on_response: boolean;
  tenant_id: string;
}

interface PendingSurvey {
  id: string;
  conversation_id: string;
  contact_id: string;
  tenant_id: string;
  status: string;
  sent_at: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { action, conversationId, tenantId } = await req.json();
    console.log(`[Satisfaction] Action: ${action}, ConversationId: ${conversationId}`);

    if (action === "schedule") {
      // Called when a conversation is closed - schedule a survey
      return await scheduleSurvey(supabase, conversationId, tenantId);
    } else if (action === "process") {
      // Called by cron to send pending surveys
      return await processPendingSurveys(supabase);
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid action" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }
  } catch (error) {
    console.error("[Satisfaction] Error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

async function scheduleSurvey(supabase: any, conversationId: string, tenantId: string) {
  console.log(`[Satisfaction] Scheduling survey for conversation: ${conversationId}`);

  // Get satisfaction config for tenant
  const { data: config, error: configError } = await supabase
    .from("satisfaction_config")
    .select("*")
    .eq("tenant_id", tenantId)
    .single();

  if (configError || !config) {
    console.log("[Satisfaction] No config found or satisfaction disabled");
    return new Response(
      JSON.stringify({ success: false, reason: "no_config" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!config.is_active) {
    console.log("[Satisfaction] Satisfaction surveys are disabled");
    return new Response(
      JSON.stringify({ success: false, reason: "disabled" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get conversation details
  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("id, contact_id, channel_id, assigned_to")
    .eq("id", conversationId)
    .single();

  if (convError || !conversation) {
    console.error("[Satisfaction] Conversation not found:", convError);
    return new Response(
      JSON.stringify({ success: false, reason: "conversation_not_found" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
    );
  }

  // Check if already has a pending/sent survey for this conversation
  const { data: existingSurvey } = await supabase
    .from("satisfaction_surveys")
    .select("id")
    .eq("conversation_id", conversationId)
    .in("status", ["pending", "sent"])
    .single();

  if (existingSurvey) {
    console.log("[Satisfaction] Survey already exists for this conversation");
    return new Response(
      JSON.stringify({ success: false, reason: "already_scheduled" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Calculate send time
  const sendAt = new Date(Date.now() + config.delay_minutes * 60 * 1000);

  // Create pending survey
  const { data: survey, error: surveyError } = await supabase
    .from("satisfaction_surveys")
    .insert({
      conversation_id: conversationId,
      contact_id: conversation.contact_id,
      agent_id: conversation.assigned_to,
      survey_type: config.survey_type,
      status: "pending",
      sent_via_channel_id: conversation.channel_id,
      tenant_id: tenantId,
    })
    .select("id")
    .single();

  if (surveyError) {
    console.error("[Satisfaction] Error creating survey:", surveyError);
    return new Response(
      JSON.stringify({ success: false, error: surveyError.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }

  console.log(`[Satisfaction] Survey scheduled: ${survey.id}, will send at ${sendAt.toISOString()}`);

  return new Response(
    JSON.stringify({ success: true, surveyId: survey.id, sendAt: sendAt.toISOString() }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function processPendingSurveys(supabase: any) {
  console.log("[Satisfaction] Processing pending surveys...");

  // Get all pending surveys that are due
  const { data: pendingSurveys, error: fetchError } = await supabase
    .from("satisfaction_surveys")
    .select(`
      id,
      conversation_id,
      contact_id,
      tenant_id,
      status,
      sent_at,
      survey_type,
      sent_via_channel_id
    `)
    .eq("status", "pending")
    .is("sent_at", null)
    .limit(50);

  if (fetchError) {
    console.error("[Satisfaction] Error fetching pending surveys:", fetchError);
    return new Response(
      JSON.stringify({ success: false, error: fetchError.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }

  if (!pendingSurveys || pendingSurveys.length === 0) {
    console.log("[Satisfaction] No pending surveys to process");
    return new Response(
      JSON.stringify({ success: true, processed: 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`[Satisfaction] Found ${pendingSurveys.length} pending surveys`);

  let processed = 0;
  let errors = 0;

  for (const survey of pendingSurveys) {
    try {
      await sendSurveyMessage(supabase, survey);
      processed++;
    } catch (error) {
      console.error(`[Satisfaction] Error sending survey ${survey.id}:`, error);
      errors++;
    }
  }

  console.log(`[Satisfaction] Processed: ${processed}, Errors: ${errors}`);

  return new Response(
    JSON.stringify({ success: true, processed, errors }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function sendSurveyMessage(supabase: any, survey: any) {
  console.log(`[Satisfaction] Sending survey ${survey.id} for conversation ${survey.conversation_id}`);

  // Get tenant config for message
  const { data: config } = await supabase
    .from("satisfaction_config")
    .select("message_nps, message_csat, survey_type, send_only_business_hours")
    .eq("tenant_id", survey.tenant_id)
    .single();

  if (!config) {
    throw new Error("Satisfaction config not found");
  }

  // Check business hours if required
  if (config.send_only_business_hours) {
    const { data: companySettings } = await supabase
      .from("company_settings")
      .select("business_hours, timezone")
      .eq("tenant_id", survey.tenant_id)
      .single();

    if (companySettings && !isWithinBusinessHours(companySettings.business_hours, companySettings.timezone)) {
      console.log("[Satisfaction] Outside business hours, skipping");
      return;
    }
  }

  // Get contact phone
  const { data: contact } = await supabase
    .from("contacts")
    .select("phone")
    .eq("id", survey.contact_id)
    .single();

  if (!contact) {
    throw new Error("Contact not found");
  }

  // Get channel info
  const { data: channel } = await supabase
    .from("whatsapp_channels")
    .select("id, provider_id, instance_id")
    .eq("id", survey.sent_via_channel_id)
    .single();

  if (!channel) {
    throw new Error("Channel not found");
  }

  // Select message based on survey type
  const message = survey.survey_type === 'nps' ? config.message_nps : config.message_csat;

  // Send via WhatsApp using the whatsapp-instance edge function
  const whatsappUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-instance`;
  
  const sendResponse = await fetch(whatsappUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
    body: JSON.stringify({
      action: "send",
      channelId: channel.id,
      phone: contact.phone,
      content: message,
      type: "text",
    }),
  });

  if (!sendResponse.ok) {
    const errorText = await sendResponse.text();
    throw new Error(`Failed to send WhatsApp message: ${errorText}`);
  }

  const sendResult = await sendResponse.json();

  // Update survey status
  await supabase
    .from("satisfaction_surveys")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      survey_message_id: sendResult.messageId || null,
    })
    .eq("id", survey.id);

  console.log(`[Satisfaction] Survey ${survey.id} sent successfully`);
}

function isWithinBusinessHours(businessHours: any, timezone: string): boolean {
  if (!businessHours) return true;

  const now = new Date();
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = days[now.getDay()];
  
  const dayConfig = businessHours[dayName];
  if (!dayConfig || !dayConfig.active) return false;

  // Simple hour check (could be improved with proper timezone handling)
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;

  const [startHour, startMinute] = dayConfig.start.split(':').map(Number);
  const [endHour, endMinute] = dayConfig.end.split(':').map(Number);
  
  const startTime = startHour * 60 + startMinute;
  const endTime = endHour * 60 + endMinute;

  return currentTime >= startTime && currentTime <= endTime;
}
