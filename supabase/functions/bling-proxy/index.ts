import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BLING_API_URL = "https://www.bling.com.br/Api/v3";

async function blingApiFetch(endpoint: string, accessToken: string, method = "GET", body?: Record<string, unknown>) {
  const response = await fetch(`${BLING_API_URL}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const responseText = await response.text();
  let responseData;
  try {
    responseData = JSON.parse(responseText);
  } catch {
    responseData = { raw: responseText };
  }

  if (!response.ok) {
    console.error(`[bling-proxy] Bling API error ${response.status}: ${responseText}`);
    // Extract meaningful error message from Bling's response
    let errorMessage = `Bling API ${response.status}`;
    if (responseData?.error?.message) {
      errorMessage = responseData.error.message;
    } else if (responseData?.error?.description) {
      errorMessage = responseData.error.description;
    } else if (responseData?.error?.type) {
      errorMessage = `${responseData.error.type}: ${JSON.stringify(responseData.error.fields || responseData.error)}`;
    } else if (typeof responseData?.error === 'string') {
      errorMessage = responseData.error;
    } else {
      errorMessage = `Bling API erro ${response.status}: ${responseText.substring(0, 200)}`;
    }
    return { error: errorMessage, status: response.status, details: responseData };
  }

  return responseData;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, tenant_id, ...payload } = await req.json();

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ error: "Missing tenant_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Bling config
    const { data: config, error: configError } = await supabase
      .from("bling_integration_config")
      .select("*")
      .eq("tenant_id", tenant_id)
      .single();

    if (configError || !config?.access_token) {
      return new Response(
        JSON.stringify({ error: "Bling não configurado ou não conectado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = config.access_token;

    if (action === "create_contact") {
      const { contact_data } = payload;
      console.log(`[bling-proxy] Creating contact:`, JSON.stringify(contact_data));
      const result = await blingApiFetch("/contatos", accessToken, "POST", contact_data);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "create_pre_order") {
      const { order_data } = payload;
      console.log(`[bling-proxy] Creating pre-order:`, JSON.stringify(order_data));
      const result = await blingApiFetch("/pedidos/vendas", accessToken, "POST", order_data);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update_contact") {
      const { contact_data, bling_id } = payload;
      console.log(`[bling-proxy] Updating contact ${bling_id}:`, JSON.stringify(contact_data));
      const result = await blingApiFetch(`/contatos/${bling_id}`, accessToken, "PUT", contact_data);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[bling-proxy] Error:`, message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
