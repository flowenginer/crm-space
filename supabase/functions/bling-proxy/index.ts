import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BLING_API_URL = "https://www.bling.com.br/Api/v3";
const BLING_TOKEN_URL = "https://www.bling.com.br/Api/v3/oauth/token";

async function refreshBlingToken(supabase: ReturnType<typeof createClient>, config: Record<string, unknown>): Promise<string | null> {
  console.log(`[bling-proxy] Token expirado, tentando refresh para tenant ${config.tenant_id}...`);

  if (!config.refresh_token) {
    console.error(`[bling-proxy] Sem refresh_token no banco para tenant ${config.tenant_id}`);
    return null;
  }

  if (!config.client_id || !config.client_secret) {
    console.error(`[bling-proxy] Sem client_id/client_secret para tenant ${config.tenant_id}`);
    return null;
  }

  try {
    console.log(`[bling-proxy] Chamando Bling token endpoint com grant_type=refresh_token`);
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

    const responseText = await tokenResponse.text();
    console.log(`[bling-proxy] Token refresh response status: ${tokenResponse.status}, body: ${responseText.substring(0, 300)}`);

    if (!tokenResponse.ok) {
      console.error(`[bling-proxy] Falha no refresh token (${tokenResponse.status}): ${responseText}`);
      // NÃO marcar is_active=false aqui - deixa o usuário tentar reconectar
      // Apenas limpar os tokens inválidos para sinalizar que precisa reconectar
      return null;
    }

    let tokens;
    try {
      tokens = JSON.parse(responseText);
    } catch {
      console.error(`[bling-proxy] Resposta do token não é JSON válido: ${responseText}`);
      return null;
    }

    if (!tokens.access_token) {
      console.error(`[bling-proxy] Token response sem access_token:`, JSON.stringify(tokens));
      return null;
    }

    const tokenExpiresAt = new Date(Date.now() + (tokens.expires_in || 21600) * 1000).toISOString();

    const { error: updateError } = await supabase
      .from("bling_integration_config")
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || config.refresh_token,
        token_expires_at: tokenExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", config.id);

    if (updateError) {
      console.error(`[bling-proxy] Erro ao salvar tokens no banco: ${updateError.message}`);
      // Retorna o token mesmo assim - pelo menos a chamada atual funciona
    }

    console.log(`[bling-proxy] Token renovado com sucesso, expira em: ${tokenExpiresAt}`);
    return tokens.access_token;
  } catch (err) {
    console.error(`[bling-proxy] Erro ao renovar token:`, err);
    return null;
  }
}

function isTokenExpiringSoon(config: Record<string, unknown>): boolean {
  if (!config.token_expires_at) return true;
  const expiresAt = new Date(config.token_expires_at as string);
  const now = new Date();
  // Renovar se expira em menos de 30 minutos
  return expiresAt.getTime() - now.getTime() < 30 * 60 * 1000;
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

    const blingError = responseData?.error;
    if (blingError?.message) {
      errorMessage = blingError.message;
      if (Array.isArray(blingError.fields) && blingError.fields.length > 0) {
        const fieldDetails = blingError.fields.map((f: { code?: number; msg?: string; element?: string; field?: string; message?: string; collection?: Array<{ msg?: string; element?: string }> }) => {
          const fieldName = f.element || f.field || '?';
          const fieldMsg = f.msg || f.message || 'inválido';
          if (Array.isArray(f.collection) && f.collection.length > 0) {
            const collectionDetails = f.collection.map((c: { msg?: string; element?: string }) =>
              `${c.element || '?'}: ${c.msg || 'inválido'}`
            ).join(', ');
            return `${fieldName}: ${fieldMsg} [${collectionDetails}]`;
          }
          return `${fieldName}: ${fieldMsg}`;
        }).join('; ');
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
  if (result?.status === 401) return true;
  if (result?.error === "invalid_token") return true;
  const errStr = typeof result?.error === "string" ? (result.error as string).toLowerCase() : "";
  if (errStr.includes("invalid_token") || errStr.includes("token expirado") || errStr.includes("unauthorized")) return true;
  return false;
}

async function blingApiFetchWithRetry(
  endpoint: string,
  accessToken: string,
  method: string,
  body: Record<string, unknown> | undefined,
  supabase: ReturnType<typeof createClient>,
  config: Record<string, unknown>
) {
  // Refresh proativo: se o token vai expirar em breve, renova ANTES de chamar
  let currentToken = accessToken;
  if (isTokenExpiringSoon(config)) {
    console.log(`[bling-proxy] Token expirando em breve, tentando refresh proativo...`);
    const newToken = await refreshBlingToken(supabase, config);
    if (newToken) {
      currentToken = newToken;
      console.log(`[bling-proxy] Refresh proativo OK, usando novo token`);
    } else {
      console.warn(`[bling-proxy] Refresh proativo falhou, tentando com token atual...`);
    }
  }

  let result = await blingApiFetch(endpoint, currentToken, method, body);

  // Se ainda deu 401 (token inválido mesmo), tenta refresh reativo
  if (result?.error && isTokenError(result) && currentToken === accessToken) {
    console.log(`[bling-proxy] 401 recebido, tentando refresh reativo...`);
    const newToken = await refreshBlingToken(supabase, config);
    if (newToken) {
      console.log(`[bling-proxy] Retentando chamada com novo token...`);
      result = await blingApiFetch(endpoint, newToken, method, body);
    } else {
      return {
        error: "Token expirado e não foi possível renovar. Reconecte o Bling nas configurações.",
        status: 401,
        debug: {
          has_refresh_token: !!config.refresh_token,
          has_client_id: !!config.client_id,
          has_client_secret: !!config.client_secret,
          token_expires_at: config.token_expires_at,
          is_active: config.is_active,
        }
      };
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

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: "Bling não configurado para este tenant", debug: { configError: configError?.message } }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!config.access_token && !config.refresh_token) {
      return new Response(
        JSON.stringify({ error: "Bling não conectado. Faça a autenticação OAuth nas configurações." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Se não tem access_token mas tem refresh_token, tenta renovar
    let accessToken = config.access_token;
    if (!accessToken && config.refresh_token) {
      console.log(`[bling-proxy] Sem access_token mas tem refresh_token, tentando refresh...`);
      const newToken = await refreshBlingToken(supabase, config);
      if (newToken) {
        accessToken = newToken;
      } else {
        return new Response(
          JSON.stringify({ error: "Token expirado e não foi possível renovar. Reconecte o Bling nas configurações." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (action === "create_contact") {
      const { contact_data } = payload;
      console.log(`[bling-proxy] Creating contact - FULL PAYLOAD:`, JSON.stringify(contact_data, null, 2));
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

    if (action === "list_vendedores") {
      console.log(`[bling-proxy] Listing vendedores`);
      const result = await blingApiFetchWithRetry("/vendedores?pagina=1&limite=100&situacaoContato=A", accessToken, "GET", undefined, supabase, config);
      console.log(`[bling-proxy] Vendedores result:`, JSON.stringify(result).substring(0, 500));
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get_order") {
      const { order_id } = payload;
      console.log(`[bling-proxy] Getting order ${order_id}`);
      const result = await blingApiFetchWithRetry(`/pedidos/vendas/${order_id}`, accessToken, "GET", undefined, supabase, config);
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: diagnose - retorna estado da config sem fazer chamadas ao Bling
    if (action === "diagnose") {
      return new Response(
        JSON.stringify({
          status: "ok",
          has_access_token: !!config.access_token,
          has_refresh_token: !!config.refresh_token,
          has_client_id: !!config.client_id,
          has_client_secret: !!config.client_secret,
          is_active: config.is_active,
          is_configured: config.is_configured,
          token_expires_at: config.token_expires_at,
          token_expired: config.token_expires_at ? new Date(config.token_expires_at) < new Date() : null,
          updated_at: config.updated_at,
        }),
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
