import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentRequest {
  paymentLinkId: string;
  cardNumber: string;
  cardholderName: string;
  expirationMonth: number;
  expirationYear: number;
  securityCode: string;
  installments: number;
  cpf: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: PaymentRequest = await req.json();
    console.log("Processing payment for link:", body.paymentLinkId);

    // Validate required fields
    if (!body.paymentLinkId || !body.cardNumber || !body.cardholderName || 
        !body.expirationMonth || !body.expirationYear || !body.securityCode) {
      return new Response(
        JSON.stringify({ success: false, message: "Dados incompletos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch payment link details
    const { data: paymentLink, error: linkError } = await supabase
      .from("payment_links")
      .select("*, tenant_id")
      .eq("id", body.paymentLinkId)
      .single();

    if (linkError || !paymentLink) {
      console.error("Payment link not found:", linkError);
      return new Response(
        JSON.stringify({ success: false, message: "Link de pagamento não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already paid
    if (paymentLink.status === "paid") {
      return new Response(
        JSON.stringify({ success: false, message: "Este link já foi pago" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if expired
    if (paymentLink.expires_at && new Date(paymentLink.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, message: "Link de pagamento expirado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch gateway configuration
    const { data: companySettings, error: settingsError } = await supabase
      .from("company_settings")
      .select("payment_gateway_config")
      .eq("tenant_id", paymentLink.tenant_id)
      .single();

    if (settingsError || !companySettings?.payment_gateway_config) {
      console.error("Gateway config not found:", settingsError);
      return new Response(
        JSON.stringify({ success: false, message: "Gateway de pagamento não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const gatewayConfig = companySettings.payment_gateway_config as {
      pv: string;
      token: string;
      environment: string;
    };

    // Determine e.Rede API URL based on environment
    const isProduction = gatewayConfig.environment === "production";
    const redeApiUrl = isProduction
      ? "https://api.userede.com.br/erede/v1/transactions"
      : "https://sandbox-erede.useredecloud.com.br/v1/transactions";

    // Convert amount to cents (integer)
    const amountInCents = Math.round(Number(paymentLink.amount) * 100);

    // Generate unique reference
    const reference = `PAY-${paymentLink.id.substring(0, 8)}-${Date.now()}`;

    // Prepare e.Rede request payload
    const redePayload = {
      capture: true,
      kind: "credit",
      reference: reference,
      amount: amountInCents,
      installments: body.installments,
      cardholderName: body.cardholderName,
      cardNumber: body.cardNumber,
      expirationMonth: body.expirationMonth,
      expirationYear: body.expirationYear,
      securityCode: body.securityCode,
    };

    console.log("Calling e.Rede API:", redeApiUrl);
    console.log("Payload:", { ...redePayload, cardNumber: "****", securityCode: "***" });

    // Create Basic Auth header
    const authString = `${gatewayConfig.pv}:${gatewayConfig.token}`;
    const authBase64 = btoa(authString);

    // Call e.Rede API
    const redeResponse = await fetch(redeApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${authBase64}`,
      },
      body: JSON.stringify(redePayload),
    });

    const redeResult = await redeResponse.json();
    console.log("e.Rede response status:", redeResponse.status);
    console.log("e.Rede response:", JSON.stringify(redeResult, null, 2));

    // Check if transaction was authorized
    // Return code "00" means approved
    const isApproved = redeResult.returnCode === "00";

    if (isApproved) {
      // Update payment link status to paid
      const { error: updateError } = await supabase
        .from("payment_links")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          transaction_id: redeResult.tid,
          authorization_code: redeResult.authorizationCode,
          nsu: redeResult.nsu,
          card_brand: redeResult.brand,
          card_last_digits: body.cardNumber.slice(-4),
          installments_used: body.installments,
          gateway_response: redeResult,
        })
        .eq("id", body.paymentLinkId);

      if (updateError) {
        console.error("Error updating payment link:", updateError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Pagamento aprovado",
          transactionId: redeResult.tid,
          authorizationCode: redeResult.authorizationCode,
          nsu: redeResult.nsu,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Payment was not approved
      const errorMessage = redeResult.returnMessage || "Transação não autorizada";
      
      // Update payment link with failed attempt info
      await supabase
        .from("payment_links")
        .update({
          gateway_response: redeResult,
        })
        .eq("id", body.paymentLinkId);

      console.log("Payment declined:", errorMessage);

      return new Response(
        JSON.stringify({
          success: false,
          message: errorMessage,
          returnCode: redeResult.returnCode,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Error processing payment:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: "Erro interno ao processar pagamento" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
