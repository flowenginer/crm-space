import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BLING_API_URL = "https://www.bling.com.br/Api/v3";
const BLING_TOKEN_URL = "https://www.bling.com.br/Api/v3/oauth/token";

async function refreshBlingToken(supabase: ReturnType<typeof createClient>, config: Record<string, unknown>): Promise<string | null> {
  console.log(`[bling-proxy] Token expirado, tentando refresh para tenant ${config.tenant_id}...`);

  try {
    const tokenResponse = await fetch(BLING_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${btoa(`${config.client_id}:${config.client_secret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: config.refresh_token as string,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error(`[bling-proxy] Falha no refresh token: ${errorText}`);

      await supabase
        .from("bling_integration_config")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", config.id);

      return null;
    }

    const tokens = await tokenResponse.json();
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await supabase
      .from("bling_integration_config")
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: tokenExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", config.id);

    console.log(`[bling-proxy] Token renovado com sucesso, expira em: ${tokenExpiresAt}`);
    return tokens.access_token;
  } catch (err) {
    console.error(`[bling-proxy] Erro ao renovar token:`, err);
    return null;
  }
}

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
    let errorMessage = `Bling API ${response.status}`;

    // Bling v3 error format: { error: { type, message, fields: [{ field, message }] } }
    const blingError = responseData?.error;
    if (blingError?.message) {
      errorMessage = blingError.message;
      // Append field-level details if available
      if (Array.isArray(blingError.fields) && blingError.fields.length > 0) {
        const fieldDetails = blingError.fields.map((f: { field?: string; message?: string }) =>
          `${f.field || '?'}: ${f.message || 'inválido'}`
        ).join('; ');
        errorMessage = `${errorMessage} (${fieldDetails})`;
      }
    } else if (blingError?.description) {
      errorMessage = blingError.description;
    } else if (blingError?.type) {
      errorMessage = `${blingError.type}: ${JSON.stringify(blingError.fields || blingError)}`;
    } else if (typeof blingError === 'string') {
      errorMessage = blingError;
    } else {
      errorMessage = `Bling API erro ${response.status}: ${responseText.substring(0, 200)}`;
    }
    return { error: errorMessage, status: response.status, details: responseData };
  }

  return responseData;
}

function isTokenError(result: Record<string, unknown>): boolean {
  return result?.status === 401 ||
    result?.error === "invalid_token" ||
    (typeof result?.error === "string" && (result.error as string).toLowerCase().includes("invalid_token")) ||
    (typeof result?.error === "string" && (result.error as string).toLowerCase().includes("token")) && result?.status === 401;
}

async function blingApiFetchWithRetry(
  endpoint: string,
  accessToken: string,
  method: string,
  body: Record<string, unknown> | undefined,
  supabase: ReturnType<typeof createClient>,
  config: Record<string, unknown>
) {
  let result = await blingApiFetch(endpoint, accessToken, method, body);

  if (result?.error && isTokenError(result)) {
    const newToken = await refreshBlingToken(supabase, config);
    if (newToken) {
      console.log(`[bling-proxy] Retentando chamada com novo token...`);
      result = await blingApiFetch(endpoint, newToken, method, body);
    } else {
      return { error: "Token expirado e não foi possível renovar. Reconecte o Bling nas configurações.", status: 401 };
    }
  }

  return result;
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

    // Get Bling config (incluindo client_id, client_secret e refresh_token para poder renovar)
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
      const result = await blingApiFetchWithRetry("/contatos", accessToken, "POST", contact_data, supabase, config);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "create_pre_order") {
      const { order_data } = payload;
      console.log(`[bling-proxy] Creating pre-order:`, JSON.stringify(order_data));
      const result = await blingApiFetchWithRetry("/pedidos/vendas", accessToken, "POST", order_data, supabase, config);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update_contact") {
      const { contact_data, bling_id } = payload;
      console.log(`[bling-proxy] Updating contact ${bling_id}:`, JSON.stringify(contact_data));
      const result = await blingApiFetchWithRetry(`/contatos/${bling_id}`, accessToken, "PUT", contact_data, supabase, config);
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
