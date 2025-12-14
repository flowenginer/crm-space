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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting check-expiring-quotes job...');

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
      errors: [] as string[],
    };

    for (const config of configs || []) {
      try {
        console.log(`Processing tenant: ${config.tenant_id}`);
        
        const useClientChannel = config.use_client_channel ?? true;

        // Get expiring quotes for each configured day
        const notificationDays = config.quote_expiration_days || [3, 1];
        
        for (const daysBeforeExpiry of notificationDays) {
          const targetDate = new Date();
          targetDate.setDate(targetDate.getDate() + daysBeforeExpiry);
          const dateStr = targetDate.toISOString().split('T')[0];

          // Find quotes expiring on this date
          const { data: expiringQuotes, error: quotesError } = await supabase
            .from('quotes')
            .select(`
              id,
              quote_number,
              total,
              valid_until,
              contact_id,
              contact:contacts(id, full_name, phone)
            `)
            .eq('tenant_id', config.tenant_id)
            .in('status', ['sent', 'approved'])
            .gte('valid_until', dateStr + 'T00:00:00')
            .lte('valid_until', dateStr + 'T23:59:59');

          if (quotesError) {
            console.error(`Error fetching quotes for tenant ${config.tenant_id}:`, quotesError);
            continue;
          }

          console.log(`Found ${expiringQuotes?.length || 0} quotes expiring in ${daysBeforeExpiry} days for tenant ${config.tenant_id}`);

          for (const quote of expiringQuotes || []) {
            results.processed++;

            // Check if already notified for this period
            const { data: existingNotification } = await supabase
              .from('quote_expiration_notifications')
              .select('id')
              .eq('quote_id', quote.id)
              .eq('days_before', daysBeforeExpiry)
              .maybeSingle();

            if (existingNotification) {
              console.log(`Quote ${quote.quote_number} already notified for ${daysBeforeExpiry} days`);
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
              // Try to find the last conversation channel for this contact
              const { data: lastConversation, error: convError } = await supabase
                .from('conversations')
                .select('channel_id')
                .eq('contact_id', quote.contact_id)
                .not('channel_id', 'is', null)
                .order('last_message_at', { ascending: false })
                .limit(1)
                .maybeSingle();

              if (!convError && lastConversation?.channel_id) {
                // Get the channel details
                const { data: clientChannel, error: chError } = await supabase
                  .from('whatsapp_channels')
                  .select('*, provider:providers(*)')
                  .eq('id', lastConversation.channel_id)
                  .eq('status', 'connected')
                  .single();

                if (!chError && clientChannel) {
                  channelToUse = clientChannel;
                  usedClientChannel = true;
                  console.log(`Using client's last channel: ${clientChannel.name} for quote ${quote.quote_number}`);
                }
              }
            }

            // If no client channel found or use_client_channel is false, use the fallback/default channel
            if (!channelToUse) {
              if (!config.notification_channel_id) {
                console.log(`No channel available for quote ${quote.quote_number} (no client channel and no fallback configured)`);
                continue;
              }

              const { data: fallbackChannel, error: fbError } = await supabase
                .from('whatsapp_channels')
                .select('*, provider:providers(*)')
                .eq('id', config.notification_channel_id)
                .eq('status', 'connected')
                .single();

              if (fbError || !fallbackChannel) {
                console.log(`Fallback channel not found or not connected for tenant ${config.tenant_id}`);
                continue;
              }

              channelToUse = fallbackChannel;
              console.log(`Using fallback channel: ${fallbackChannel.name} for quote ${quote.quote_number}`);
            }

            // Create notification record
            const { data: notification, error: notifError } = await supabase
              .from('quote_expiration_notifications')
              .insert({
                tenant_id: config.tenant_id,
                quote_id: quote.id,
                contact_id: quote.contact_id,
                channel_id: channelToUse.id,
                notification_type: `expiring_${daysBeforeExpiry}days`,
                days_before: daysBeforeExpiry,
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
            const formatCurrency = (value: number) => {
              return new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              }).format(value);
            };

            const formatDate = (dateStr: string) => {
              const date = new Date(dateStr);
              return date.toLocaleDateString('pt-BR');
            };

            const getDaysText = (days: number) => {
              if (days === 0) return 'hoje';
              if (days === 1) return '1 dia';
              return `${days} dias`;
            };

            let message = config.quote_expiration_template || 
              `Olá {cliente_nome}! 👋\n\nSeu orçamento #{numero} no valor de {valor} expira em {dias_restantes}.\n\n📅 Validade: {data_validade}\n\nPosso te ajudar a finalizar?`;

            message = message
              .replace('{cliente_nome}', contact.full_name || 'Cliente')
              .replace('{numero}', quote.quote_number)
              .replace('{valor}', formatCurrency(quote.total || 0))
              .replace('{dias_restantes}', getDaysText(daysBeforeExpiry))
              .replace('{data_validade}', quote.valid_until ? formatDate(quote.valid_until) : '-');

            // Send WhatsApp message
            try {
              const provider = channelToUse.provider as any;
              let sendSuccess = false;
              let errorMessage = '';

              // Format phone number
              let phone = contact.phone.replace(/\D/g, '');
              if (!phone.startsWith('55')) {
                phone = '55' + phone;
              }

              // Send based on provider
              if (provider?.code === 'zapi') {
                const response = await fetch(`https://api.z-api.io/instances/${channelToUse.instance_id}/token/${channelToUse.api_token}/send-text`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    phone: phone,
                    message: message,
                  }),
                });

                if (response.ok) {
                  sendSuccess = true;
                } else {
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
                  body: JSON.stringify({
                    number: phone,
                    text: message,
                  }),
                });

                if (response.ok) {
                  sendSuccess = true;
                } else {
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
                  body: JSON.stringify({
                    phone: phone,
                    message: message,
                  }),
                });

                if (response.ok) {
                  sendSuccess = true;
                } else {
                  const errorData = await response.json();
                  errorMessage = errorData.message || 'Unknown UAZAPI error';
                }
              }

              // Update notification status
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
                console.log(`Notification sent for quote ${quote.quote_number} via ${usedClientChannel ? 'client channel' : 'fallback channel'}: ${channelToUse.name}`);
              } else {
                console.error(`Failed to send notification for quote ${quote.quote_number}: ${errorMessage}`);
                results.errors.push(`Quote ${quote.quote_number}: ${errorMessage}`);
              }
            } catch (sendError: any) {
              console.error(`Error sending notification for quote ${quote.quote_number}:`, sendError);
              
              await supabase
                .from('quote_expiration_notifications')
                .update({
                  status: 'failed',
                  error_message: sendError.message,
                })
                .eq('id', notification.id);

              results.errors.push(`Quote ${quote.quote_number}: ${sendError.message}`);
            }
          }
        }
      } catch (tenantError: any) {
        console.error(`Error processing tenant ${config.tenant_id}:`, tenantError);
        results.errors.push(`Tenant ${config.tenant_id}: ${tenantError.message}`);
      }
    }

    console.log('Check-expiring-quotes job completed:', results);

    return new Response(JSON.stringify({
      success: true,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in check-expiring-quotes:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
