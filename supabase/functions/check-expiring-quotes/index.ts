import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationConfig {
  tenant_id: string;
  quote_expiration_enabled: boolean;
  quote_expiration_days: number[];
  quote_expiration_template: string;
  notification_channel_id: string | null;
  notification_send_times: string[];
  notification_trigger_type: 'before_expiry' | 'after_sent';
  days_after_sent: number[];
  daily_limit: number;
  min_interval_hours: number;
  pause_on_weekends: boolean;
  use_client_channel: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting check-expiring-quotes job...');

    // Get current time in Brazil timezone
    const now = new Date();
    const brazilFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      hour12: false,
    });
    const brazilDateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    
    const currentHour = brazilFormatter.format(now).padStart(2, '0') + ':00';
    const todayStr = brazilDateFormatter.format(now);
    
    const brazilDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const dayOfWeek = brazilDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    console.log(`Current hour: ${currentHour}, Today: ${todayStr}, Day: ${dayOfWeek}, Weekend: ${isWeekend}`);

    // Get all tenants with notifications enabled
    const { data: configs, error: configError } = await supabase
      .from('tenant_notification_config')
      .select('*')
      .eq('quote_expiration_enabled', true);

    if (configError) {
      console.error('Error fetching configs:', configError);
      throw configError;
    }

    console.log(`Found ${configs?.length || 0} tenants with notifications enabled`);

    const results = {
      processed: 0,
      notifications_created: 0,
      notifications_sent: 0,
      skipped: [] as { tenant_id: string; reason: string }[],
      errors: [] as string[],
    };

    for (const config of (configs || []) as NotificationConfig[]) {
      try {
        console.log(`Processing tenant: ${config.tenant_id}`);

        // Check weekend pause
        if (config.pause_on_weekends && isWeekend) {
          console.log(`Skipping tenant ${config.tenant_id}: weekend pause enabled`);
          results.skipped.push({ tenant_id: config.tenant_id, reason: 'weekend' });
          continue;
        }

        // Check if current hour is in configured send times
        const sendTimes = config.notification_send_times || ['09:00'];
        if (!sendTimes.includes(currentHour)) {
          console.log(`Skipping tenant ${config.tenant_id}: current hour ${currentHour} not in schedule [${sendTimes.join(', ')}]`);
          results.skipped.push({ tenant_id: config.tenant_id, reason: 'not_scheduled_hour' });
          continue;
        }

        // Check daily limit
        const { count: todayCount } = await supabase
          .from('quote_expiration_notifications')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', config.tenant_id)
          .gte('sent_at', `${todayStr}T00:00:00`)
          .eq('status', 'sent');

        const sentToday = todayCount || 0;
        const dailyLimit = config.daily_limit || 50;
        const remaining = dailyLimit - sentToday;

        if (remaining <= 0) {
          console.log(`Skipping tenant ${config.tenant_id}: daily limit reached (${sentToday}/${dailyLimit})`);
          results.skipped.push({ tenant_id: config.tenant_id, reason: 'daily_limit' });
          continue;
        }

        const useClientChannel = config.use_client_channel ?? true;
        const triggerType = config.notification_trigger_type || 'before_expiry';

        // Get quotes to notify based on trigger type
        let quotesToNotify: any[] = [];

        if (triggerType === 'after_sent') {
          // Notify X days after quote was sent
          const daysAfter = config.days_after_sent || [1, 3];
          
          for (const days of daysAfter) {
            const targetDate = new Date(brazilDate);
            targetDate.setDate(targetDate.getDate() - days);
            const dateStr = targetDate.toISOString().slice(0, 10);

            const { data: quotes } = await supabase
              .from('quotes')
              .select(`
                id, quote_number, total, valid_until, contact_id, conversation_id, created_at, status,
                notifications_paused, notifications_auto_paused, converted_to_order_id, tenant_id,
                contact:contacts(id, full_name, phone)
              `)
              .eq('tenant_id', config.tenant_id)
              .eq('status', 'sent')
              .eq('notifications_paused', false)
              .gte('created_at', `${dateStr}T00:00:00`)
              .lte('created_at', `${dateStr}T23:59:59`);

            if (quotes) {
              quotesToNotify.push(...quotes.map(q => ({ ...q, triggerDay: days, triggerType: 'after_sent' })));
            }
          }
          console.log(`Found ${quotesToNotify.length} quotes for after_sent trigger`);
        } else {
          // Default: notify X days before expiry
          const expirationDays = config.quote_expiration_days || [3, 1];

          for (const daysBefore of expirationDays) {
            const targetDate = new Date(brazilDate);
            targetDate.setDate(targetDate.getDate() + daysBefore);
            const dateStr = targetDate.toISOString().slice(0, 10);

            const { data: quotes } = await supabase
              .from('quotes')
              .select(`
                id, quote_number, total, valid_until, contact_id, conversation_id, created_at, status,
                notifications_paused, notifications_auto_paused, converted_to_order_id, tenant_id,
                contact:contacts(id, full_name, phone)
              `)
              .eq('tenant_id', config.tenant_id)
              .in('status', ['sent', 'approved'])
              .eq('notifications_paused', false)
              .gte('valid_until', `${dateStr}T00:00:00`)
              .lte('valid_until', `${dateStr}T23:59:59`);

            if (quotes) {
              quotesToNotify.push(...quotes.map(q => ({ ...q, triggerDay: daysBefore, triggerType: 'before_expiry' })));
            }
          }
          console.log(`Found ${quotesToNotify.length} quotes for before_expiry trigger`);
        }

        let tenantSent = 0;

        for (const quote of quotesToNotify) {
          if (tenantSent >= remaining) {
            console.log(`Daily limit reached for tenant ${config.tenant_id}`);
            break;
          }

          results.processed++;

          // Check if notifications are manually paused
          if (quote.notifications_paused) {
            console.log(`Quote ${quote.quote_number}: notifications manually paused, skipping`);
            continue;
          }

          // Check if already auto-paused
          if (quote.notifications_auto_paused) {
            console.log(`Quote ${quote.quote_number}: notifications auto-paused, skipping`);
            continue;
          }

          // Check if converted to order
          if (quote.converted_to_order_id) {
            console.log(`Quote ${quote.quote_number}: already converted to order, auto-pausing`);
            await supabase
              .from('quotes')
              .update({
                notifications_auto_paused: true,
                notifications_auto_pause_reason: 'converted',
              })
              .eq('id', quote.id);
            continue;
          }

          // Check if quote status changed to non-notifiable
          if (['negotiating', 'rejected', 'converted', 'cancelled'].includes(quote.status)) {
            console.log(`Quote ${quote.quote_number}: status is ${quote.status}, auto-pausing`);
            await supabase
              .from('quotes')
              .update({
                notifications_auto_paused: true,
                notifications_auto_pause_reason: 'status_changed',
              })
              .eq('id', quote.id);
            continue;
          }

          // Check if client responded after quote was created
          if (quote.conversation_id && quote.created_at) {
            const { data: clientMessages } = await supabase
              .from('messages')
              .select('id')
              .eq('conversation_id', quote.conversation_id)
              .eq('is_from_me', false)
              .gt('created_at', quote.created_at)
              .limit(1);

            if (clientMessages && clientMessages.length > 0) {
              console.log(`Quote ${quote.quote_number}: client responded after quote creation, auto-pausing`);
              await supabase
                .from('quotes')
                .update({
                  notifications_auto_paused: true,
                  notifications_auto_pause_reason: 'client_responded',
                })
                .eq('id', quote.id);
              continue;
            }
          }

          // Check minimum interval per client
          const minIntervalHours = config.min_interval_hours || 24;
          const { data: lastClientNotif } = await supabase
            .from('quote_expiration_notifications')
            .select('sent_at')
            .eq('contact_id', quote.contact_id)
            .eq('status', 'sent')
            .order('sent_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (lastClientNotif?.sent_at) {
            const hoursSince = (Date.now() - new Date(lastClientNotif.sent_at).getTime()) / (1000 * 60 * 60);
            if (hoursSince < minIntervalHours) {
              console.log(`Quote ${quote.quote_number}: client notified ${hoursSince.toFixed(1)}h ago (min: ${minIntervalHours}h), skipping`);
              continue;
            }
          }

          // Check if already notified for this trigger
          const { data: existingNotification } = await supabase
            .from('quote_expiration_notifications')
            .select('id')
            .eq('quote_id', quote.id)
            .eq('days_before', quote.triggerDay)
            .maybeSingle();

          if (existingNotification) {
            console.log(`Quote ${quote.quote_number} already notified for ${quote.triggerDay} days`);
            continue;
          }

          const contact = quote.contact as any;
          if (!contact?.phone) {
            console.log(`Quote ${quote.quote_number} has no contact phone`);
            continue;
          }

          // Determine which channel to use
          let channelToUse: any = null;
          let usedClientChannel = false;

          if (useClientChannel) {
            const { data: lastConversation } = await supabase
              .from('conversations')
              .select('channel_id')
              .eq('contact_id', quote.contact_id)
              .not('channel_id', 'is', null)
              .order('last_message_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (lastConversation?.channel_id) {
              const { data: clientChannel } = await supabase
                .from('whatsapp_channels')
                .select('*, provider:providers(*)')
                .eq('id', lastConversation.channel_id)
                .eq('status', 'connected')
                .single();

              if (clientChannel) {
                channelToUse = clientChannel;
                usedClientChannel = true;
                console.log(`Using client's last channel: ${clientChannel.name}`);
              }
            }
          }

          if (!channelToUse) {
            if (!config.notification_channel_id) {
              console.log(`No channel available for quote ${quote.quote_number}`);
              continue;
            }

            const { data: fallbackChannel } = await supabase
              .from('whatsapp_channels')
              .select('*, provider:providers(*)')
              .eq('id', config.notification_channel_id)
              .eq('status', 'connected')
              .single();

            if (!fallbackChannel) {
              console.log(`Fallback channel not found or not connected`);
              continue;
            }

            channelToUse = fallbackChannel;
            console.log(`Using fallback channel: ${fallbackChannel.name}`);
          }

          // Create notification record
          const { data: notification, error: notifError } = await supabase
            .from('quote_expiration_notifications')
            .insert({
              tenant_id: config.tenant_id,
              quote_id: quote.id,
              contact_id: quote.contact_id,
              channel_id: channelToUse.id,
              notification_type: quote.triggerType === 'after_sent' 
                ? `followup_${quote.triggerDay}days` 
                : `expiring_${quote.triggerDay}days`,
              days_before: quote.triggerDay,
              scheduled_for: new Date().toISOString(),
              status: 'pending',
            })
            .select()
            .single();

          if (notifError) {
            console.error(`Error creating notification for quote ${quote.quote_number}:`, notifError);
            results.errors.push(`Quote ${quote.quote_number}: ${notifError.message}`);
            continue;
          }

          results.notifications_created++;

          // Format the message
          const formatCurrency = (value: number) => 
            new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

          const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('pt-BR');

          const getDaysText = (days: number, type: string) => {
            if (type === 'after_sent') {
              return days === 1 ? '1 dia atrás' : `${days} dias atrás`;
            }
            if (days === 0) return 'hoje';
            return days === 1 ? '1 dia' : `${days} dias`;
          };

          let message = config.quote_expiration_template || 
            `Olá {cliente_nome}! 👋\n\nSeu orçamento #{numero} no valor de {valor} expira em {dias_restantes}.\n\n📅 Validade: {data_validade}\n\nPosso te ajudar a finalizar?`;

          message = message
            .replace('{cliente_nome}', contact.full_name || 'Cliente')
            .replace('{numero}', String(quote.quote_number))
            .replace('{valor}', formatCurrency(quote.total || 0))
            .replace('{dias_restantes}', getDaysText(quote.triggerDay, quote.triggerType))
            .replace('{data_validade}', quote.valid_until ? formatDate(quote.valid_until) : '-');

          // Send WhatsApp message
          try {
            const provider = channelToUse.provider as any;
            let sendSuccess = false;
            let errorMessage = '';

            let phone = contact.phone.replace(/\D/g, '');
            if (!phone.startsWith('55')) {
              phone = '55' + phone;
            }

            if (provider?.code === 'zapi') {
              const response = await fetch(`https://api.z-api.io/instances/${channelToUse.instance_id}/token/${channelToUse.api_token}/send-text`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, message }),
              });
              sendSuccess = response.ok;
              if (!sendSuccess) {
                const errorData = await response.json();
                errorMessage = errorData.error || 'Unknown ZAPI error';
              }
            } else if (provider?.code === 'evolution') {
              const apiUrl = channelToUse.api_url?.replace(/\/$/, '');
              const response = await fetch(`${apiUrl}/message/sendText/${channelToUse.instance_id}`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': channelToUse.api_token || '',
                },
                body: JSON.stringify({ number: phone, text: message }),
              });
              sendSuccess = response.ok;
              if (!sendSuccess) {
                const errorData = await response.json();
                errorMessage = errorData.message || 'Unknown Evolution error';
              }
            } else if (provider?.code === 'uazapi') {
              const response = await fetch(`${channelToUse.api_url}/chat/send`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${channelToUse.api_token}`,
                },
                body: JSON.stringify({ phone, message }),
              });
              sendSuccess = response.ok;
              if (!sendSuccess) {
                const errorData = await response.json();
                errorMessage = errorData.message || 'Unknown UAZAPI error';
              }
            }

            await supabase
              .from('quote_expiration_notifications')
              .update({
                status: sendSuccess ? 'sent' : 'failed',
                sent_at: sendSuccess ? new Date().toISOString() : null,
                error_message: sendSuccess ? null : errorMessage,
              })
              .eq('id', notification.id);

            if (sendSuccess) {
              results.notifications_sent++;
              tenantSent++;
              console.log(`Notification sent for quote ${quote.quote_number} via ${usedClientChannel ? 'client' : 'fallback'} channel`);
            } else {
              console.error(`Failed to send notification for quote ${quote.quote_number}: ${errorMessage}`);
              results.errors.push(`Quote ${quote.quote_number}: ${errorMessage}`);
            }
          } catch (sendError: any) {
            console.error(`Error sending notification for quote ${quote.quote_number}:`, sendError);
            await supabase
              .from('quote_expiration_notifications')
              .update({ status: 'failed', error_message: sendError.message })
              .eq('id', notification.id);
            results.errors.push(`Quote ${quote.quote_number}: ${sendError.message}`);
          }
        }
      } catch (tenantError: any) {
        console.error(`Error processing tenant ${config.tenant_id}:`, tenantError);
        results.errors.push(`Tenant ${config.tenant_id}: ${tenantError.message}`);
      }
    }

    console.log('Check-expiring-quotes job completed:', results);

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in check-expiring-quotes:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
