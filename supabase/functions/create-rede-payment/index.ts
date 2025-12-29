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
    const REDE_PV = gatewayConfig?.client_id;
    const REDE_INTEGRATION_KEY = gatewayConfig?.client_secret;
    const isProduction = gatewayConfig?.environment === 'production';

    if (!REDE_PV || !REDE_INTEGRATION_KEY) {
      console.error('[REDE] Missing credentials - PV:', !!REDE_PV, 'Key:', !!REDE_INTEGRATION_KEY);
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

    // Calculate expiration date
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + (expirationDays || 3));

    // Generate reference
    const reference = orderId 
      ? `ORD-${orderId.substring(0, 8)}`
      : quoteId 
        ? `QUO-${quoteId.substring(0, 8)}`
        : `PAY-${Date.now()}`;

    // A API e.Rede não possui endpoint de "Link de Pagamento" nativo.
    // O e.Rede é uma API de transações diretas que requer dados do cartão.
    // 
    // Para implementar "links de pagamento" com a REDE, existem duas opções:
    // 1. Checkout Rede (antigo Komerci) - checkout hospedado pela REDE
    // 2. Checkout próprio - página de pagamento que coleta dados e processa via e.Rede
    //
    // Esta implementação cria um registro de link pendente que pode ser usado
    // com uma página de checkout própria ou integração futura.

    console.log('[REDE] Environment:', isProduction ? 'production' : 'sandbox');
    console.log('[REDE] PV configured:', REDE_PV);

    // Testar conectividade com a API e.Rede usando Basic Auth
    const credentials = btoa(`${REDE_PV}:${REDE_INTEGRATION_KEY}`);
    const baseUrl = isProduction 
      ? 'https://api.userede.com.br/erede'
      : 'https://sandbox-erede.useredecloud.com.br';

    // Testar autenticação fazendo uma consulta simples
    try {
      const testResponse = await fetch(`${baseUrl}/v1/transactions?reference=TEST_${Date.now()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log('[REDE] API connectivity test - Status:', testResponse.status);
      
      // 404 = transação não encontrada (esperado, significa que a autenticação funcionou)
      // 401 = credenciais inválidas
      if (testResponse.status === 401) {
        console.error('[REDE] Authentication failed - Invalid credentials');
        return new Response(
          JSON.stringify({ 
            error: 'Credenciais REDE inválidas. Verifique o PV e a Chave de Integração.',
            details: 'A autenticação com a API e.Rede falhou. Certifique-se de que o PV e a Chave de Integração estão corretos.'
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (testError) {
      console.log('[REDE] API connectivity test - Network error (may be expected for sandbox):', testError);
    }

    // Gerar URL de checkout interno
    // O link será processado por uma página de checkout que coletará os dados do cartão
    const paymentLinkId = crypto.randomUUID();
    const checkoutUrl = `${SUPABASE_URL.replace('.supabase.co', '.lovable.app')}/checkout/${paymentLinkId}`;
    
    // Para ambiente de produção, você pode usar um domínio personalizado
    const shortUrl = `https://pay.link/${paymentLinkId.substring(0, 8)}`;

    // Save payment link to database
    const { data: paymentLink, error: insertError } = await supabase
      .from('payment_links')
      .insert({
        id: paymentLinkId,
        order_id: orderId || null,
        quote_id: quoteId || null,
        conversation_id: conversationId || null,
        contact_id: contactId || null,
        provider: 'rede',
        external_id: reference,
        payment_url: checkoutUrl,
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
        gateway_response: {
          reference,
          environment: isProduction ? 'production' : 'sandbox',
          pv: REDE_PV,
          note: 'A API e.Rede não possui endpoint de Link de Pagamento nativo. Este link é gerenciado internamente e requer uma página de checkout para processar o pagamento.',
        },
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
        note: 'Link de pagamento criado. A API e.Rede requer uma página de checkout para coletar dados do cartão e processar a transação.',
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
