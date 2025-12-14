import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreatePaymentRequest {
  orderId?: string;
  quoteId?: string;
  conversationId?: string;
  contactId?: string;
  amount: number;
  description?: string;
  paymentMethods: string[];
  maxInstallments: number;
  expirationDays: number;
  customerName: string;
  customerDocument?: string;
  customerEmail?: string;
  customerPhone?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const REDE_CLIENT_ID = Deno.env.get('REDE_CLIENT_ID');
    const REDE_CLIENT_SECRET = Deno.env.get('REDE_CLIENT_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!REDE_CLIENT_ID || !REDE_CLIENT_SECRET) {
      console.error('Missing Rede credentials');
      return new Response(
        JSON.stringify({ error: 'Rede credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing Supabase credentials');
      return new Response(
        JSON.stringify({ error: 'Supabase credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get auth user from request
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && user) {
        userId = user.id;
      }
    }

    const body: CreatePaymentRequest = await req.json();
    console.log('Creating payment link with data:', JSON.stringify(body, null, 2));

    const {
      orderId,
      quoteId,
      conversationId,
      contactId,
      amount,
      description,
      paymentMethods,
      maxInstallments,
      expirationDays,
      customerName,
      customerDocument,
      customerEmail,
      customerPhone,
    } = body;

    // Validate required fields (conversationId and contactId are optional for manual charges)
    if (!amount || !customerName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: amount, customerName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate expiration date
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + (expirationDays || 3));
    const formattedExpiration = expirationDate.toISOString().split('T')[0];

    // Generate reference
    const reference = orderId 
      ? `ORD-${orderId.substring(0, 8)}`
      : quoteId 
        ? `QUO-${quoteId.substring(0, 8)}`
        : `PAY-${Date.now()}`;

    // Map payment methods to Rede format
    const redePaymentMethods: string[] = [];
    if (paymentMethods.includes('credit_card')) redePaymentMethods.push('CREDIT');
    if (paymentMethods.includes('debit_card')) redePaymentMethods.push('DEBIT');
    if (paymentMethods.includes('pix')) redePaymentMethods.push('PIX');

    // Prepare Rede API request
    const redePayload = {
      amount: Math.round(amount * 100), // Convert to cents
      reference,
      maxInstallments: maxInstallments || 1,
      expirationDate: formattedExpiration,
      description: description || `Pagamento ${reference}`,
      customer: {
        name: customerName,
        email: customerEmail || undefined,
        document: customerDocument?.replace(/\D/g, '') || undefined,
      },
      paymentMethods: redePaymentMethods.length > 0 ? redePaymentMethods : ['CREDIT', 'PIX'],
    };

    console.log('Rede API payload:', JSON.stringify(redePayload, null, 2));

    // Get company settings for environment
    const { data: settings } = await supabase
      .from('company_settings')
      .select('payment_gateway_config')
      .single();

    const isProduction = settings?.payment_gateway_config?.environment === 'production';
    const baseUrl = isProduction 
      ? 'https://api.userede.com.br' 
      : 'https://sandbox-erede.useredecloud.com.br';

    // Call Rede API to create payment link
    const redeResponse = await fetch(`${baseUrl}/erede/v1/payment-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(`${REDE_CLIENT_ID}:${REDE_CLIENT_SECRET}`)}`,
      },
      body: JSON.stringify(redePayload),
    });

    const redeData = await redeResponse.json();
    console.log('Rede API response:', JSON.stringify(redeData, null, 2));

    if (!redeResponse.ok) {
      console.error('Rede API error:', redeData);
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao criar link de pagamento na Rede',
          details: redeData 
        }),
        { status: redeResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Save payment link to database
    const { data: paymentLink, error: insertError } = await supabase
      .from('payment_links')
      .insert({
        order_id: orderId || null,
        quote_id: quoteId || null,
        conversation_id: conversationId || null,
        contact_id: contactId || null,
        provider: 'rede',
        external_id: redeData.id || redeData.paymentLinkId,
        payment_url: redeData.shortUrl || redeData.paymentUrl || redeData.url,
        amount,
        description: description || `Pagamento ${reference}`,
        payment_methods: paymentMethods,
        max_installments: maxInstallments || 1,
        expires_at: expirationDate.toISOString(),
        customer_name: customerName,
        customer_document: customerDocument,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        status: 'pending',
        gateway_response: redeData,
        created_by: userId,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error saving payment link:', insertError);
      return new Response(
        JSON.stringify({ error: 'Error saving payment link', details: insertError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Payment link created successfully:', paymentLink.id);

    return new Response(
      JSON.stringify({
        success: true,
        paymentLink: {
          id: paymentLink.id,
          url: paymentLink.payment_url,
          externalId: paymentLink.external_id,
          amount: paymentLink.amount,
          expiresAt: paymentLink.expires_at,
        },
      }),
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
