import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing Supabase credentials');
      return new Response(
        JSON.stringify({ error: 'Supabase credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    console.log('Rede webhook received:', JSON.stringify(body, null, 2));

    // Extract payment info from webhook
    // Rede webhook format may vary, adjust according to actual API documentation
    const {
      paymentLinkId,
      id: transactionId,
      status,
      amount,
      paymentMethod,
      installments,
      paidAt,
    } = body;

    const externalId = paymentLinkId || transactionId;

    if (!externalId) {
      console.error('Missing payment link ID in webhook');
      return new Response(
        JSON.stringify({ error: 'Missing payment link ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find payment link by external ID
    const { data: paymentLink, error: findError } = await supabase
      .from('payment_links')
      .select('*')
      .eq('external_id', externalId)
      .single();

    if (findError || !paymentLink) {
      console.error('Payment link not found:', externalId, findError);
      return new Response(
        JSON.stringify({ error: 'Payment link not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found payment link:', paymentLink.id);

    // Check if payment was approved
    const isPaid = status === 'APPROVED' || status === 'PAID' || status === 'approved' || status === 'paid';
    
    if (!isPaid) {
      // Update status for non-paid events
      const newStatus = status === 'EXPIRED' || status === 'expired' ? 'expired' 
        : status === 'CANCELED' || status === 'canceled' ? 'canceled' 
        : 'pending';

      await supabase
        .from('payment_links')
        .update({
          status: newStatus,
          gateway_response: body,
          webhook_received_at: new Date().toISOString(),
        })
        .eq('id', paymentLink.id);

      console.log('Payment link updated with status:', newStatus);
      
      return new Response(
        JSON.stringify({ success: true, status: newStatus }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Payment was approved - update payment link
    const paidAmount = amount ? amount / 100 : paymentLink.amount; // Convert from cents
    const paidTime = paidAt || new Date().toISOString();

    const { error: updateError } = await supabase
      .from('payment_links')
      .update({
        status: 'paid',
        paid_at: paidTime,
        paid_amount: paidAmount,
        payment_method_used: paymentMethod || 'unknown',
        installments_used: installments || 1,
        gateway_response: body,
        webhook_received_at: new Date().toISOString(),
      })
      .eq('id', paymentLink.id);

    if (updateError) {
      console.error('Error updating payment link:', updateError);
    }

    // Update order status if linked
    if (paymentLink.order_id) {
      console.log('Updating order payment status:', paymentLink.order_id);
      
      // Update order payment status
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          status: 'in_production', // Move to production
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentLink.order_id);

      if (orderError) {
        console.error('Error updating order:', orderError);
      }

      // Create order payment record
      await supabase
        .from('order_payments')
        .insert({
          order_id: paymentLink.order_id,
          amount: paidAmount,
          payment_method: paymentMethod || 'rede_payment_link',
          status: 'paid',
          paid_at: paidTime,
          gateway_reference: externalId,
          tenant_id: paymentLink.tenant_id, // CORREÇÃO: Adicionar tenant_id
        });

      // Create financial transaction
      const { data: order } = await supabase
        .from('orders')
        .select('order_number, contact_id')
        .eq('id', paymentLink.order_id)
        .single();

      if (order) {
        await supabase
          .from('financial_transactions')
          .insert({
            type: 'income',
            description: `Pagamento Pedido ${order.order_number}`,
            amount: paidAmount,
            due_date: paidTime.split('T')[0],
            status: 'paid',
            paid_at: paidTime,
            paid_amount: paidAmount,
            contact_id: order.contact_id,
            order_id: paymentLink.order_id,
            tenant_id: paymentLink.tenant_id, // CORREÇÃO: Adicionar tenant_id
          });
      }
    }

    // Send notification in conversation
    if (paymentLink.conversation_id) {
      console.log('Creating payment confirmation event in conversation:', paymentLink.conversation_id);

      await supabase
        .from('conversation_events')
        .insert({
          conversation_id: paymentLink.conversation_id,
          event_type: 'payment_confirmed',
          data: {
            payment_link_id: paymentLink.id,
            amount: paidAmount,
            payment_method: paymentMethod,
            installments,
            order_id: paymentLink.order_id,
          },
          tenant_id: paymentLink.tenant_id, // CORREÇÃO: Adicionar tenant_id
        });
    }

    console.log('Payment webhook processed successfully');

    return new Response(
      JSON.stringify({ success: true, status: 'paid' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
