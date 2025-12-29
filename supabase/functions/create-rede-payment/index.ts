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

// Função para obter ou renovar access token OAuth 2.0 da REDE
async function getRedeAccessToken(
  supabase: any,
  clientId: string,
  clientSecret: string,
  isProduction: boolean,
  tenantId?: string
): Promise<string> {
  const environment = isProduction ? 'production' : 'sandbox';
  
  // Verificar cache primeiro
  const { data: cached } = await supabase
    .from('rede_oauth_tokens')
    .select('*')
    .eq('environment', environment)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (cached?.access_token) {
    console.log('[REDE] Usando token em cache');
    return cached.access_token;
  }

  console.log('[REDE] Gerando novo access token via OAuth 2.0');

  // Endpoints de autenticação conforme documentação REDE
  const authUrl = isProduction 
    ? 'https://api.userede.com.br/redelabs/oauth2/token'
    : 'https://rl7-sandbox-api.useredecloud.com.br/oauth2/token';

  // Gerar novo token usando OAuth 2.0
  const credentials = btoa(`${clientId}:${clientSecret}`);
  
  const response = await fetch(authUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[REDE] Erro ao obter token:', errorText);
    throw new Error(`Erro ao autenticar com REDE: ${response.status} - ${errorText}`);
  }

  const tokenData = await response.json();
  console.log('[REDE] Token obtido com sucesso');

  // O token expira em 24 minutos (1440 segundos), salvamos com 20 minutos para margem
  const expiresAt = new Date(Date.now() + 20 * 60 * 1000);
  
  // Salvar no cache (upsert)
  await supabase.from('rede_oauth_tokens').upsert({
    tenant_id: tenantId,
    environment,
    access_token: tokenData.access_token,
    expires_at: expiresAt.toISOString(),
    updated_at: new Date().toISOString()
  }, {
    onConflict: 'tenant_id,environment'
  });

  return tokenData.access_token;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[REDE] Missing Supabase credentials');
      return new Response(
        JSON.stringify({ error: 'Supabase credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get auth user from request
    const authHeader = req.headers.get('authorization');
    let userId: string | null = null;
    let tenantId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && user) {
        userId = user.id;
        // Get tenant_id from profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('id', user.id)
          .single();
        tenantId = profile?.tenant_id;
      }
    }

    if (!tenantId) {
      console.error('[REDE] User not authenticated or no tenant');
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar configuração do gateway do tenant
    const { data: settings, error: settingsError } = await supabase
      .from('company_settings')
      .select('payment_gateway_config')
      .eq('tenant_id', tenantId)
      .single();

    if (settingsError) {
      console.error('[REDE] Error fetching settings:', settingsError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar configurações' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const gatewayConfig = settings?.payment_gateway_config;
    const REDE_CLIENT_ID = gatewayConfig?.client_id;
    const REDE_CLIENT_SECRET = gatewayConfig?.client_secret;
    const isProduction = gatewayConfig?.environment === 'production';

    if (!REDE_CLIENT_ID || !REDE_CLIENT_SECRET) {
      console.error('[REDE] Missing credentials - PV:', !!REDE_CLIENT_ID, 'Key:', !!REDE_CLIENT_SECRET);
      return new Response(
        JSON.stringify({ error: 'Credenciais REDE não configuradas. Configure o PV e a Chave de Integração em Configurações > Integrações.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: CreatePaymentRequest = await req.json();
    console.log('[REDE] Creating payment link:', JSON.stringify(body, null, 2));

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

    // Validate required fields
    if (!amount || !customerName) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios: valor e nome do cliente' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Obter access token via OAuth 2.0
    let accessToken: string;
    try {
      accessToken = await getRedeAccessToken(
        supabase,
        REDE_CLIENT_ID,
        REDE_CLIENT_SECRET,
        isProduction,
        tenantId || undefined
      );
    } catch (tokenError) {
      console.error('[REDE] Token error:', tokenError);
      return new Response(
        JSON.stringify({ 
          error: 'Erro de autenticação com REDE',
          details: tokenError instanceof Error ? tokenError.message : 'Erro desconhecido'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      amount: Math.round(amount),
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

    console.log('[REDE] API payload:', JSON.stringify(redePayload, null, 2));

    // Endpoints de transação conforme documentação
    const baseUrl = isProduction 
      ? 'https://api.userede.com.br/erede'
      : 'https://sandbox-erede.useredecloud.com.br';

    // Call Rede API to create payment link usando Bearer token
    const redeResponse = await fetch(`${baseUrl}/v1/payment-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(redePayload),
    });

    const redeData = await redeResponse.json();
    console.log('[REDE] API response:', JSON.stringify(redeData, null, 2));

    if (!redeResponse.ok) {
      console.error('[REDE] API error:', redeData);
      
      // Se for erro de autenticação, limpar cache do token
      if (redeResponse.status === 401) {
        await supabase
          .from('rede_oauth_tokens')
          .delete()
          .eq('environment', isProduction ? 'production' : 'sandbox');
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao criar link de pagamento na REDE',
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
        tenant_id: tenantId,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[REDE] Error saving payment link:', insertError);
      return new Response(
        JSON.stringify({ error: 'Erro ao salvar link de pagamento', details: insertError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[REDE] Payment link created:', paymentLink.id);

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
    console.error('[REDE] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Erro interno', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
