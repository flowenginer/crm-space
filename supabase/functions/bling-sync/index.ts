import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BLING_API_URL = "https://www.bling.com.br/Api/v3";

interface SyncRequest {
  tenant_id: string;
  entity_type?: "contacts" | "orders" | "products" | "quotes" | "financial" | "all";
  direction?: "local_to_bling" | "bling_to_local" | "bidirectional";
  triggered_by?: string;
  preview_only?: boolean;
  start_date?: string;
  end_date?: string;
  import_mode?: "all" | "new_only" | "update_existing";
  selected_ids?: string[];
  create_dependencies?: boolean;
  ignore_incomplete?: boolean;
}

interface BlingContact {
  id: number;
  nome: string;
  codigo?: string;
  fantasia?: string;
  tipo: string; // F = Física, J = Jurídica
  cpfCnpj?: string;
  email?: string;
  telefone?: string;
  celular?: string;
  endereco?: {
    endereco?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cep?: string;
    municipio?: string;
    uf?: string;
  };
}

interface BlingProduct {
  id: number;
  nome: string;
  codigo?: string;
  preco: number;
  precoCusto?: number;
  descricaoCurta?: string;
  imagemURL?: string;
  tipo?: string;
  situacao?: string;
  formato?: string;
  ncm?: string;
  cest?: string;
  origem?: number;
  // Campos extras para mapeamento completo
  gtin?: string;
  gtinEmbalagem?: string;
  unidade?: string;
  unidadeCompra?: string;
  pesoLiquido?: number;
  pesoBruto?: number;
  largura?: number;
  altura?: number;
  profundidade?: number;
  volumes?: number;
  itensPorCaixa?: number;
  categoria?: { id: number; descricao?: string };
  marca?: string;
  condicao?: number; // 0=Não especificado, 1=Novo, 2=Usado
  freteGratis?: boolean;
  linkExterno?: string;
  observacoes?: string;
  estoque?: {
    minimo?: number;
    maximo?: number;
    crossdocking?: number;
    localizacao?: string;
  };
  variacao?: {
    nome?: string;
    produtoPai?: { id: number };
  };
}

interface BlingOrder {
  id: number;
  numero?: number;
  data?: string;
  contato?: { id: number; nome?: string };
  situacao?: { id: number; valor?: number };
  total?: number;
  desconto?: number;
  frete?: number;
  observacoes?: string;
  itens?: Array<{
    produto?: { id: number };
    quantidade: number;
    valor: number;
    desconto?: number;
  }>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: SyncRequest = await req.json();
    const { 
      tenant_id, 
      entity_type = "all", 
      direction = "bidirectional", 
      triggered_by,
      preview_only = false,
      start_date,
      end_date,
      import_mode = "all",
      selected_ids,
      create_dependencies = true,
      ignore_incomplete = false,
    } = body;

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ error: "Missing tenant_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[bling-sync] Starting sync for tenant ${tenant_id}, type: ${entity_type}, direction: ${direction}`);

    // Get Bling config and check token
    const { data: config, error: configError } = await supabase
      .from("bling_integration_config")
      .select("*")
      .eq("tenant_id", tenant_id)
      .single();

    if (configError || !config?.access_token) {
      return new Response(
        JSON.stringify({ error: "Bling not configured or not connected" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token needs refresh
    let accessToken = config.access_token;
    if (config.token_expires_at && new Date(config.token_expires_at) < new Date()) {
      console.log(`[bling-sync] Token expired, refreshing...`);
      const refreshResult = await refreshToken(supabase, tenant_id, config);
      if (!refreshResult.success) {
        return new Response(
          JSON.stringify({ error: "Token expired and refresh failed" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      accessToken = refreshResult.access_token!;
    }

    // Create sync log
    const { data: syncLog, error: logError } = await supabase
      .from("bling_sync_logs")
      .insert({
        tenant_id,
        sync_type: "manual",
        entity_type,
        direction,
        status: "running",
        triggered_by,
      })
      .select()
      .single();

    if (logError) {
      console.error(`[bling-sync] Error creating sync log: ${logError.message}`);
    }

    const results = {
      contacts: { created: 0, updated: 0, skipped: 0, errors: 0 },
      orders: { created: 0, updated: 0, skipped: 0, errors: 0 },
      products: { created: 0, updated: 0, skipped: 0, errors: 0 },
      quotes: { created: 0, updated: 0, skipped: 0, errors: 0 },
      financial: { created: 0, updated: 0, skipped: 0, errors: 0 },
    };
    const errors: Array<{ entity: string; message: string; details?: string }> = [];
    const previewData: any[] = [];
    const dependenciesData: any[] = [];

    // Sync based on config flags and request
    // Handle financial as a special case
    if (entity_type === "financial") {
      try {
        const financialResults = await syncFinancial(supabase, tenant_id, accessToken, direction, preview_only, start_date, end_date, import_mode, selected_ids);
        results.financial = financialResults.counts;
        errors.push(...financialResults.errors);
        if (preview_only) {
          previewData.push(...financialResults.preview);
          dependenciesData.push(...financialResults.dependencies);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`[bling-sync] Error syncing financial: ${errorMessage}`);
        errors.push({ entity: "financial", message: errorMessage });
      }
    } else {
      const entitiesToSync: Array<"contacts" | "orders" | "products" | "quotes"> = 
        entity_type === "all" 
          ? ["contacts", "orders", "products", "quotes"].filter(e => {
              if (e === "contacts") return config.sync_contacts;
              if (e === "orders") return config.sync_orders;
              if (e === "products") return config.sync_products;
              if (e === "quotes") return config.sync_quotes;
              return false;
            }) as Array<"contacts" | "orders" | "products" | "quotes">
          : [entity_type as "contacts" | "orders" | "products" | "quotes"];

    for (const entityType of entitiesToSync) {
      try {
        if (entityType === "contacts") {
          const contactResults = await syncContacts(supabase, tenant_id, accessToken, direction, preview_only, start_date, end_date, import_mode, selected_ids, ignore_incomplete);
          results.contacts = contactResults.counts;
          errors.push(...contactResults.errors);
          if (preview_only && contactResults.preview) {
            previewData.push(...contactResults.preview);
          }
        } else if (entityType === "products") {
          const productResults = await syncProducts(supabase, tenant_id, accessToken, direction, preview_only, import_mode, selected_ids);
          results.products = productResults.counts;
          errors.push(...productResults.errors);
          if (preview_only && productResults.preview) {
            previewData.push(...productResults.preview);
          }
        } else if (entityType === "orders") {
          const orderResults = await syncOrders(supabase, tenant_id, accessToken, direction);
          results.orders = orderResults.counts;
          errors.push(...orderResults.errors);
        } else if (entityType === "quotes") {
          // Quotes sync - similar to orders but for proposals
          const quoteResults = await syncQuotes(supabase, tenant_id, accessToken, direction);
          results.quotes = quoteResults.counts;
          errors.push(...quoteResults.errors);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`[bling-sync] Error syncing ${entityType}: ${errorMessage}`);
        errors.push({ entity: entityType, message: errorMessage });
      }
    }
  }

    // Calculate totals
    const totalRecords = Object.values(results).reduce((sum, r) => sum + r.created + r.updated + r.skipped, 0);
    const totalCreated = Object.values(results).reduce((sum, r) => sum + r.created, 0);
    const totalUpdated = Object.values(results).reduce((sum, r) => sum + r.updated, 0);
    const totalSkipped = Object.values(results).reduce((sum, r) => sum + r.skipped, 0);
    const totalErrors = errors.length;

    // Update sync log
    if (syncLog) {
      await supabase
        .from("bling_sync_logs")
        .update({
          status: totalErrors > 0 && totalCreated === 0 && totalUpdated === 0 ? "failed" : "completed",
          completed_at: new Date().toISOString(),
          total_records: totalRecords,
          created_count: totalCreated,
          updated_count: totalUpdated,
          skipped_count: totalSkipped,
          error_count: totalErrors,
          errors: errors,
          details: results,
        })
        .eq("id", syncLog.id);
    }

    // Update last_sync_at in config
    await supabase
      .from("bling_integration_config")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("tenant_id", tenant_id);

    console.log(`[bling-sync] Completed: ${totalCreated} created, ${totalUpdated} updated, ${totalSkipped} skipped, ${totalErrors} errors`);

    // Return preview data if requested
    if (preview_only && previewData.length > 0) {
      return new Response(
        JSON.stringify({
          success: true,
          preview: previewData,
          dependencies: dependenciesData,
          summary: {
            total: previewData.length,
            new: previewData.filter((i: any) => !i.exists_locally).length,
            existing: previewData.filter((i: any) => i.exists_locally).length,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        summary: {
          total_records: totalRecords,
          created: totalCreated,
          updated: totalUpdated,
          skipped: totalSkipped,
          errors: totalErrors,
        },
        error_details: errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[bling-sync] Error: ${errorMessage}`);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper to refresh token
async function refreshToken(supabase: any, tenantId: string, config: any) {
  try {
    const tokenResponse = await fetch("https://www.bling.com.br/Api/v3/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${btoa(`${config.client_id}:${config.client_secret}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: config.refresh_token,
      }),
    });

    if (!tokenResponse.ok) {
      return { success: false };
    }

    const tokens = await tokenResponse.json();
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    await supabase
      .from("bling_integration_config")
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: tokenExpiresAt,
      })
      .eq("tenant_id", tenantId);

    return { success: true, access_token: tokens.access_token };
  } catch {
    return { success: false };
  }
}

// Rate limiting: Bling API allows max 3 requests per second
// We use a simple delay to avoid hitting the limit
const BLING_RATE_LIMIT_DELAY = 350; // 350ms between requests = ~2.8 req/sec (safe margin)
let lastBlingRequestTime = 0;

async function waitForRateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastBlingRequestTime;
  if (timeSinceLastRequest < BLING_RATE_LIMIT_DELAY) {
    const waitTime = BLING_RATE_LIMIT_DELAY - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  lastBlingRequestTime = Date.now();
}

// Helper for Bling API calls with rate limiting and retry
async function blingApi(endpoint: string, accessToken: string, method = "GET", body?: any, retries = 3): Promise<any> {
  await waitForRateLimit();
  
  const response = await fetch(`${BLING_API_URL}${endpoint}`, {
    method,
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // Handle rate limit (429) with exponential backoff
  if (response.status === 429 && retries > 0) {
    const retryAfter = parseInt(response.headers.get("Retry-After") || "2", 10);
    const waitTime = Math.max(retryAfter * 1000, 2000) * (4 - retries); // Exponential backoff
    console.log(`[bling-sync] Rate limited (429), waiting ${waitTime}ms before retry (${retries} retries left)`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    return blingApi(endpoint, accessToken, method, body, retries - 1);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Bling API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// Helper: Normalize phone for storage (Brazilian format)
function normalizePhoneForStorage(phone: string): string {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  digits = digits.replace(/^0+/, '');
  
  if (digits.startsWith('55') && digits.length >= 12 && digits.length <= 13) {
    return digits;
  }
  
  if (digits.length >= 10 && digits.length <= 11) {
    return `55${digits}`;
  }
  
  return digits;
}

// Helper: Get all phone variations for search (handles 9th digit)
function getPhoneSearchVariations(phone: string): string[] {
  const normalized = normalizePhoneForStorage(phone);
  if (!normalized || normalized.length < 10) return [];
  
  const variations: string[] = [normalized];
  
  // Without country code
  if (normalized.startsWith('55')) {
    variations.push(normalized.slice(2));
  }
  
  // With country code if missing
  if (!normalized.startsWith('55') && normalized.length >= 10) {
    variations.push(`55${normalized}`);
  }
  
  // Handle 9th digit variations (Brazilian mobile)
  const hasCountry = normalized.startsWith('55');
  const baseNumber = hasCountry ? normalized.slice(2) : normalized;
  const ddd = baseNumber.slice(0, 2);
  const rest = baseNumber.slice(2);
  
  // If has 9th digit, add version without
  if (rest.length === 9 && rest.startsWith('9')) {
    const without9 = rest.slice(1);
    variations.push(`55${ddd}${without9}`, `${ddd}${without9}`);
  }
  
  // If missing 9th digit, add version with
  if (rest.length === 8) {
    const with9 = `9${rest}`;
    variations.push(`55${ddd}${with9}`, `${ddd}${with9}`);
  }
  
  return [...new Set(variations)];
}

// Helper: Find existing contact by CPF/CNPJ, phone, or name
async function findExistingContact(
  supabase: any, 
  tenantId: string, 
  cpfCnpj: string | null, 
  phone: string | null, 
  name: string
): Promise<{ id: string; matchedBy: string } | null> {
  
  // 1. Check by CPF/CNPJ (most reliable)
  if (cpfCnpj) {
    const cleanCpfCnpj = cpfCnpj.replace(/\D/g, '');
    if (cleanCpfCnpj.length >= 11) {
      const { data } = await supabase
        .from('contacts')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('cpf_cnpj', cleanCpfCnpj)
        .maybeSingle();
      
      if (data) {
        console.log(`[bling-sync] Found duplicate by CPF/CNPJ: ${cleanCpfCnpj}`);
        return { id: data.id, matchedBy: 'CPF/CNPJ' };
      }
    }
  }
  
  // 2. Check by phone (all variations)
  if (phone) {
    const variations = getPhoneSearchVariations(phone);
    for (const variation of variations) {
      if (!variation) continue;
      const { data } = await supabase
        .from('contacts')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('phone', variation)
        .maybeSingle();
      
      if (data) {
        console.log(`[bling-sync] Found duplicate by phone: ${variation}`);
        return { id: data.id, matchedBy: 'Telefone' };
      }
    }
  }
  
  // 3. Check by exact name (case-insensitive, normalized for extra spaces)
  if (name && name.trim()) {
    // Normalize: trim + collapse multiple spaces into single space
    const normalizedName = name.trim().replace(/\s+/g, ' ');
    
    // Fetch contacts and compare with normalized names (more reliable than ilike with spaces)
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, full_name')
      .eq('tenant_id', tenantId)
      .not('full_name', 'is', null);
    
    if (contacts) {
      const match = contacts.find((c: { id: string; full_name: string | null }) => {
        if (!c.full_name) return false;
        const normalizedDbName = c.full_name.trim().replace(/\s+/g, ' ');
        return normalizedDbName.toLowerCase() === normalizedName.toLowerCase();
      });
      
      if (match) {
        console.log(`[bling-sync] Found duplicate by name: ${name} -> ${match.full_name}`);
        return { id: match.id, matchedBy: 'Nome' };
      }
    }
  }
  
  return null;
}

// Check if a Bling contact has complete data (phone and basic address)
function isContactComplete(blingContact: BlingContact): { 
  isComplete: boolean; 
  missingFields: string[] 
} {
  const missingFields: string[] = [];
  
  // Check phone (celular or telefone)
  if (!blingContact.celular && !blingContact.telefone) {
    missingFields.push('Telefone');
  }
  
  // Check basic address (city and state are essential)
  const endereco = blingContact.endereco;
  if (!endereco?.municipio) missingFields.push('Cidade');
  if (!endereco?.uf) missingFields.push('Estado');
  
  return {
    isComplete: missingFields.length === 0,
    missingFields,
  };
}

// Process a single contact (for parallel processing)
async function processContact(
  supabase: any,
  tenantId: string,
  blingContact: BlingContact,
  importMode: string,
  selectedIds: string[] | undefined,
  ignoreIncomplete: boolean
): Promise<{ action: 'created' | 'updated' | 'skipped' | 'error'; error?: string }> {
  try {
    // Check if mapping already exists
    const { data: existingMapping } = await supabase
      .from("bling_id_mappings")
      .select("local_id")
      .eq("tenant_id", tenantId)
      .eq("entity_type", "contact")
      .eq("bling_id", String(blingContact.id))
      .maybeSingle();

    const hasBlingMapping = !!existingMapping?.local_id;
    
    // Check for duplicates in CRM (by CPF/CNPJ, phone, or name)
    const blingPhone = blingContact.celular || blingContact.telefone;
    const existingContact = await findExistingContact(
      supabase,
      tenantId,
      blingContact.cpfCnpj || null,
      blingPhone || null,
      blingContact.nome || ""
    );
    
    const existsInCRM = !!existingContact;
    const isNew = !hasBlingMapping && !existsInCRM;

    // Skip if not in selected IDs (when provided)
    if (selectedIds && selectedIds.length > 0 && !selectedIds.includes(String(blingContact.id))) {
      return { action: 'skipped' };
    }

    // Skip incomplete contacts if ignoreIncomplete is enabled
    if (ignoreIncomplete) {
      const completeness = isContactComplete(blingContact);
      if (!completeness.isComplete) {
        console.log(`[bling-sync] Skipping incomplete contact: ${blingContact.nome} (missing: ${completeness.missingFields.join(', ')})`);
        return { action: 'skipped' };
      }
    }

    // Skip based on import mode
    if (importMode === "new_only" && !isNew) {
      return { action: 'skipped' };
    }

    // If contact exists in CRM, SKIP (preserve CRM data) and just create mapping if needed
    if (existsInCRM) {
      console.log(`[bling-sync] Skipping duplicate: ${blingContact.nome} (${existingContact.matchedBy})`);
      
      // Create mapping if it doesn't exist
      if (!hasBlingMapping) {
        const { data: existingBlingMapping } = await supabase
          .from("bling_id_mappings")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("entity_type", "contact")
          .eq("local_id", existingContact.id)
          .maybeSingle();
        
        if (!existingBlingMapping) {
          await supabase.from("bling_id_mappings").insert({
            tenant_id: tenantId,
            entity_type: "contact",
            local_id: existingContact.id,
            bling_id: String(blingContact.id),
            sync_direction: "bling_to_local",
          });
        }
      }
      
      return { action: 'skipped' };
    }

    // If has Bling mapping, update the existing contact
    if (hasBlingMapping) {
      const phoneValue = blingPhone 
        ? (normalizePhoneForStorage(blingPhone) || `BLING_${blingContact.id}`)
        : `BLING_${blingContact.id}`;
      
      const contactData = {
        full_name: (blingContact.nome || "Sem nome").trim().replace(/\s+/g, ' '),
        phone: phoneValue,
        email: blingContact.email || null,
        cpf_cnpj: blingContact.cpfCnpj?.replace(/\D/g, '') || null,
        person_type: blingContact.tipo === "J" ? "company" : "individual",
        street: blingContact.endereco?.endereco || null,
        number: blingContact.endereco?.numero || null,
        complement: blingContact.endereco?.complemento || null,
        neighborhood: blingContact.endereco?.bairro || null,
        zip_code: blingContact.endereco?.cep || null,
        city: blingContact.endereco?.municipio || null,
        state: blingContact.endereco?.uf || null,
      };

      await supabase
        .from("contacts")
        .update(contactData)
        .eq("id", existingMapping.local_id);
      return { action: 'updated' };
    }

    // Create new contact (no duplicate found)
    const newPhoneValue = blingPhone 
      ? (normalizePhoneForStorage(blingPhone) || `BLING_${blingContact.id}`)
      : `BLING_${blingContact.id}`;
    
    const contactData = {
      full_name: (blingContact.nome || "Sem nome").trim().replace(/\s+/g, ' '),
      phone: newPhoneValue,
      email: blingContact.email || null,
      cpf_cnpj: blingContact.cpfCnpj?.replace(/\D/g, '') || null,
      person_type: blingContact.tipo === "J" ? "company" : "individual",
      street: blingContact.endereco?.endereco || null,
      number: blingContact.endereco?.numero || null,
      complement: blingContact.endereco?.complemento || null,
      neighborhood: blingContact.endereco?.bairro || null,
      zip_code: blingContact.endereco?.cep || null,
      city: blingContact.endereco?.municipio || null,
      state: blingContact.endereco?.uf || null,
      tenant_id: tenantId,
    };

    const { data: newContact, error: insertError } = await supabase
      .from("contacts")
      .insert(contactData)
      .select("id")
      .single();

    if (insertError) {
      throw new Error(insertError.message);
    }

    await supabase.from("bling_id_mappings").insert({
      tenant_id: tenantId,
      entity_type: "contact",
      local_id: newContact.id,
      bling_id: String(blingContact.id),
      sync_direction: "bling_to_local",
    });
    
    return { action: 'created' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[bling-sync] Error importing contact ${blingContact.nome}: ${msg}`);
    return { action: 'error', error: msg };
  }
}

// Sync Contacts with parallel batch processing
async function syncContacts(
  supabase: any, 
  tenantId: string, 
  accessToken: string, 
  direction: string,
  previewOnly: boolean = false,
  startDate?: string,
  endDate?: string,
  importMode: string = "all",
  selectedIds?: string[],
  ignoreIncomplete: boolean = false
) {
  const counts = { created: 0, updated: 0, skipped: 0, errors: 0 };
  const errors: Array<{ entity: string; message: string; details?: string }> = [];
  const preview: any[] = [];
  const BATCH_SIZE = 10; // Process 10 contacts in parallel

  try {
    // Import from Bling to Local
    if (direction === "bling_to_local" || direction === "bidirectional") {
      console.log(`[bling-sync] Importing contacts from Bling...`);
      
      // First, collect all contacts from Bling
      const allBlingContacts: BlingContact[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        let endpoint = `/contatos?pagina=${page}&limite=100`;
        if (startDate) {
          endpoint += `&dataInclusaoInicial=${startDate}`;
        }
        if (endDate) {
          endpoint += `&dataInclusaoFinal=${endDate}`;
        }
        
        console.log(`[bling-sync] Fetching contacts page ${page}: ${endpoint}`);
        const response = await blingApi(endpoint, accessToken);
        const blingContacts: BlingContact[] = response.data || [];

        if (blingContacts.length === 0) {
          hasMore = false;
          break;
        }

        allBlingContacts.push(...blingContacts);
        page++;
        if (blingContacts.length < 100) hasMore = false;
      }

      console.log(`[bling-sync] Fetched ${allBlingContacts.length} contacts from Bling`);

      // For preview mode, process sequentially (quick lookups)
      if (previewOnly) {
        for (const blingContact of allBlingContacts) {
          const { data: existingMapping } = await supabase
            .from("bling_id_mappings")
            .select("local_id")
            .eq("tenant_id", tenantId)
            .eq("entity_type", "contact")
            .eq("bling_id", String(blingContact.id))
            .maybeSingle();

          const hasBlingMapping = !!existingMapping?.local_id;
          const blingPhone = blingContact.celular || blingContact.telefone;
          const existingContact = await findExistingContact(
            supabase,
            tenantId,
            blingContact.cpfCnpj || null,
            blingPhone || null,
            blingContact.nome || ""
          );
          
          const existsInCRM = !!existingContact;
          const isNew = !hasBlingMapping && !existsInCRM;

          let willBeSkipped = existsInCRM;
          let skipReason = existsInCRM ? `Já existe no CRM (${existingContact.matchedBy})` : null;
          
          if (ignoreIncomplete && !willBeSkipped) {
            const completeness = isContactComplete(blingContact);
            if (!completeness.isComplete) {
              willBeSkipped = true;
              skipReason = `Incompleto: falta ${completeness.missingFields.join(', ')}`;
            }
          }
          
          preview.push({
            id: String(blingContact.id),
            name: blingContact.nome || "Sem nome",
            code: blingContact.cpfCnpj || blingContact.codigo || null,
            phone: blingPhone || null,
            isNew,
            exists_locally: existsInCRM || hasBlingMapping,
            willBeSkipped,
            skipReason,
          });
        }
      } else {
        // Process contacts in parallel batches
        console.log(`[bling-sync] Processing ${allBlingContacts.length} contacts in batches of ${BATCH_SIZE}`);
        
        for (let i = 0; i < allBlingContacts.length; i += BATCH_SIZE) {
          const batch = allBlingContacts.slice(i, i + BATCH_SIZE);
          const results = await Promise.all(
            batch.map(contact => processContact(supabase, tenantId, contact, importMode, selectedIds, ignoreIncomplete))
          );
          
          // Aggregate results
          for (let j = 0; j < results.length; j++) {
            const result = results[j];
            const contact = batch[j];
            
            switch (result.action) {
              case 'created':
                counts.created++;
                break;
              case 'updated':
                counts.updated++;
                break;
              case 'skipped':
                counts.skipped++;
                break;
              case 'error':
                counts.errors++;
                errors.push({ entity: "contact", message: result.error || "Unknown error", details: contact.nome });
                break;
            }
          }
          
          // Log progress every 50 contacts
          if ((i + BATCH_SIZE) % 50 === 0 || i + BATCH_SIZE >= allBlingContacts.length) {
            console.log(`[bling-sync] Progress: ${Math.min(i + BATCH_SIZE, allBlingContacts.length)}/${allBlingContacts.length} contacts processed`);
          }
        }
      }
    }

    // Export from Local to Bling
    if (direction === "local_to_bling" || direction === "bidirectional") {
      console.log(`[bling-sync] Exporting contacts to Bling...`);

      // Get contacts without Bling mapping
      const { data: localContacts } = await supabase
        .from("contacts")
        .select("*")
        .eq("tenant_id", tenantId)
        .not("id", "in", `(SELECT local_id FROM bling_id_mappings WHERE entity_type = 'contact' AND tenant_id = '${tenantId}')`);

      // Simpler approach - get all contacts and filter
      const { data: allContacts } = await supabase
        .from("contacts")
        .select("*")
        .eq("tenant_id", tenantId)
        .limit(500);

      const { data: existingMappings } = await supabase
        .from("bling_id_mappings")
        .select("local_id")
        .eq("tenant_id", tenantId)
        .eq("entity_type", "contact");

      const mappedIds = new Set((existingMappings || []).map((m: any) => m.local_id));
      const contactsToExport = (allContacts || []).filter((c: any) => !mappedIds.has(c.id));

      for (const contact of contactsToExport) {
        try {
          const blingData = {
            nome: contact.full_name,
            tipo: contact.person_type === "company" ? "J" : "F",
            cpfCnpj: contact.cpf_cnpj || undefined,
            email: contact.email || undefined,
            celular: contact.phone,
            endereco: contact.street ? {
              endereco: contact.street,
              numero: contact.number || "S/N",
              complemento: contact.complement,
              bairro: contact.neighborhood,
              cep: contact.zip_code?.replace(/\D/g, ""),
              municipio: contact.city,
              uf: contact.state,
            } : undefined,
          };

          const response = await blingApi("/contatos", accessToken, "POST", blingData);
          const blingId = response.data?.id;

          if (blingId) {
            await supabase
              .from("bling_id_mappings")
              .insert({
                tenant_id: tenantId,
                entity_type: "contact",
                local_id: contact.id,
                bling_id: String(blingId),
                sync_direction: "local_to_bling",
              });
            counts.created++;
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          errors.push({ entity: "contact", message: msg, details: contact.full_name });
          counts.errors++;
        }
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    errors.push({ entity: "contacts", message: msg });
  }

  return { counts, errors, preview };
}

// Sync Products
async function syncProducts(
  supabase: any, 
  tenantId: string, 
  accessToken: string, 
  direction: string,
  previewOnly: boolean = false,
  importMode: string = "all",
  selectedIds?: string[]
) {
  const counts = { created: 0, updated: 0, skipped: 0, errors: 0 };
  const errors: Array<{ entity: string; message: string; details?: string }> = [];
  const preview: any[] = [];

  try {
    // Import from Bling to Local
    if (direction === "bling_to_local" || direction === "bidirectional") {
      console.log(`[bling-sync] ${previewOnly ? 'Loading preview of' : 'Importing'} products from Bling...`);

      // Collect all products from Bling first
      const allBlingProducts: BlingProduct[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await blingApi(`/produtos?pagina=${page}&limite=100`, accessToken);
        const blingProducts: BlingProduct[] = response.data || [];

        if (blingProducts.length === 0) {
          hasMore = false;
          break;
        }

        allBlingProducts.push(...blingProducts);
        page++;
        if (blingProducts.length < 100) hasMore = false;
      }

      console.log(`[bling-sync] Found ${allBlingProducts.length} products in Bling`);

      // Get all existing mappings in batch for performance
      const { data: existingMappings } = await supabase
        .from("bling_id_mappings")
        .select("local_id, bling_id")
        .eq("tenant_id", tenantId)
        .eq("entity_type", "product");

      const mappingsByBlingId = new Map((existingMappings || []).map((m: any) => [m.bling_id, m.local_id]));

      // Get all SKUs for duplicate check
      const { data: existingProducts } = await supabase
        .from("products")
        .select("id, sku")
        .eq("tenant_id", tenantId);

      const productsBySku = new Map((existingProducts || []).filter((p: any) => p.sku).map((p: any) => [p.sku, p.id]));

      // Filter products based on mode and selection
      let productsToProcess = allBlingProducts;
      
      // If selected_ids provided, filter to only those
      if (selectedIds && selectedIds.length > 0) {
        productsToProcess = allBlingProducts.filter(p => selectedIds.includes(String(p.id)));
        console.log(`[bling-sync] Filtered to ${productsToProcess.length} selected products`);
      }

      // Preview mode - return product list with status
      if (previewOnly) {
        for (const blingProduct of productsToProcess) {
          const existsLocally = mappingsByBlingId.has(String(blingProduct.id)) || 
                               (blingProduct.codigo && productsBySku.has(blingProduct.codigo));
          
          // Apply import mode filter for preview
          if (importMode === "new_only" && existsLocally) continue;
          if (importMode === "update_existing" && !existsLocally) continue;

          preview.push({
            id: String(blingProduct.id),
            bling_id: String(blingProduct.id),
            nome: blingProduct.nome,
            codigo: blingProduct.codigo,
            preco: blingProduct.preco,
            exists_locally: existsLocally,
            isNew: !existsLocally,
          });
        }
        console.log(`[bling-sync] Preview: ${preview.length} products ready for import`);
        return { counts, errors, preview };
      }

      // Actual import
      for (const blingProduct of productsToProcess) {
        try {
          const existingLocalId = mappingsByBlingId.get(String(blingProduct.id));
          const existingBySku = blingProduct.codigo ? productsBySku.get(blingProduct.codigo) : null;
          const existsLocally = existingLocalId || existingBySku;

          // Apply import mode filter
          if (importMode === "new_only" && existsLocally) {
            counts.skipped++;
            continue;
          }
          if (importMode === "update_existing" && !existsLocally) {
            counts.skipped++;
            continue;
          }

          // Build complete product data with all fields mapped
          const productData: any = {
            name: blingProduct.nome,
            sku: blingProduct.codigo || null,
            base_price: blingProduct.preco || 0,
            cost_price: blingProduct.precoCusto || null,
            short_description: blingProduct.descricaoCurta || null,
            main_image_url: blingProduct.imagemURL || null,
            ncm: blingProduct.ncm || null,
            cest: blingProduct.cest || null,
            origem: blingProduct.origem || null,
            is_active: blingProduct.situacao === "A",
            tenant_id: tenantId,
            // Extended fields
            gtin: blingProduct.gtin || null,
            gtin_tributavel: blingProduct.gtinEmbalagem || null,
            unidade_comercial: blingProduct.unidade || 'UN',
            unidade_tributavel: blingProduct.unidadeCompra || blingProduct.unidade || 'UN',
            peso_liquido: blingProduct.pesoLiquido || null,
            peso_bruto: blingProduct.pesoBruto || null,
            // Dimensions - Bling returns in cm
            width_cm: blingProduct.largura || null,
            height_cm: blingProduct.altura || null,
            length_cm: blingProduct.profundidade || null,
          };

          if (existingLocalId) {
            // Update existing via mapping
            await supabase
              .from("products")
              .update(productData)
              .eq("id", existingLocalId);
            counts.updated++;
          } else if (existingBySku) {
            // Update existing via SKU match
            await supabase
              .from("products")
              .update(productData)
              .eq("id", existingBySku);

            // Create mapping
            await supabase
              .from("bling_id_mappings")
              .insert({
                tenant_id: tenantId,
                entity_type: "product",
                local_id: existingBySku,
                bling_id: String(blingProduct.id),
                sync_direction: "bling_to_local",
              });
            counts.updated++;
          } else {
            // Create new product
            const { data: newProduct, error: insertError } = await supabase
              .from("products")
              .insert(productData)
              .select("id")
              .single();

            if (insertError) throw new Error(insertError.message);

            // Create mapping
            await supabase
              .from("bling_id_mappings")
              .insert({
                tenant_id: tenantId,
                entity_type: "product",
                local_id: newProduct.id,
                bling_id: String(blingProduct.id),
                sync_direction: "bling_to_local",
              });
            counts.created++;
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          errors.push({ entity: "product", message: msg, details: blingProduct.nome });
          counts.errors++;
        }
      }
      
      console.log(`[bling-sync] Products processed: ${counts.created} created, ${counts.updated} updated, ${counts.skipped} skipped, ${counts.errors} errors`);
    }

    // Export from Local to Bling
    if (direction === "local_to_bling" || direction === "bidirectional") {
      console.log(`[bling-sync] Exporting products to Bling...`);

      const { data: allProducts } = await supabase
        .from("products")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .limit(500);

      const { data: existingMappings } = await supabase
        .from("bling_id_mappings")
        .select("local_id")
        .eq("tenant_id", tenantId)
        .eq("entity_type", "product");

      const mappedIds = new Set((existingMappings || []).map((m: any) => m.local_id));
      const productsToExport = (allProducts || []).filter((p: any) => !mappedIds.has(p.id));

      for (const product of productsToExport) {
        try {
          const blingData: any = {
            nome: product.name,
            codigo: product.sku || undefined,
            preco: product.base_price,
            precoCusto: product.cost_price || undefined,
            tipo: "P", // Produto
            situacao: product.is_active ? "A" : "I",
            formato: "S", // Simples
            ncm: product.ncm || undefined,
            cest: product.cest || undefined,
            origem: product.origem || 0,
            // Extended fields for export
            gtin: product.gtin || undefined,
            gtinEmbalagem: product.gtin_tributavel || undefined,
            unidade: product.unidade_comercial || 'UN',
            unidadeCompra: product.unidade_tributavel || undefined,
            pesoLiquido: product.peso_liquido || undefined,
            pesoBruto: product.peso_bruto || undefined,
            largura: product.width_cm || undefined,
            altura: product.height_cm || undefined,
            profundidade: product.length_cm || undefined,
          };

          const response = await blingApi("/produtos", accessToken, "POST", blingData);
          const blingId = response.data?.id;

          if (blingId) {
            await supabase
              .from("bling_id_mappings")
              .insert({
                tenant_id: tenantId,
                entity_type: "product",
                local_id: product.id,
                bling_id: String(blingId),
                sync_direction: "local_to_bling",
              });
            counts.created++;
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          errors.push({ entity: "product", message: msg, details: product.name });
          counts.errors++;
        }
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    errors.push({ entity: "products", message: msg });
  }

  return { counts, errors, preview };
}

// Sync Orders
async function syncOrders(supabase: any, tenantId: string, accessToken: string, direction: string) {
  const counts = { created: 0, updated: 0, skipped: 0, errors: 0 };
  const errors: Array<{ entity: string; message: string; details?: string }> = [];

  try {
    // Import from Bling to Local
    if (direction === "bling_to_local" || direction === "bidirectional") {
      console.log(`[bling-sync] Importing orders from Bling...`);

      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await blingApi(`/pedidos/vendas?pagina=${page}&limite=100`, accessToken);
        const blingOrders: BlingOrder[] = response.data || [];

        if (blingOrders.length === 0) {
          hasMore = false;
          break;
        }

        for (const blingOrder of blingOrders) {
          try {
            const { data: existingMapping } = await supabase
              .from("bling_id_mappings")
              .select("local_id, bling_numero")
              .eq("tenant_id", tenantId)
              .eq("entity_type", "order")
              .eq("bling_id", String(blingOrder.id))
              .maybeSingle();

            // Get contact mapping if exists
            let contactId = null;
            if (blingOrder.contato?.id) {
              const { data: contactMapping } = await supabase
                .from("bling_id_mappings")
                .select("local_id")
                .eq("tenant_id", tenantId)
                .eq("entity_type", "contact")
                .eq("bling_id", String(blingOrder.contato.id))
                .maybeSingle();
              contactId = contactMapping?.local_id;
            }

            const orderData = {
              order_number: `BLING-${blingOrder.numero || blingOrder.id}`,
              contact_id: contactId,
              status: "confirmed",
              total: blingOrder.total || 0,
              discount_amount: blingOrder.desconto || 0,
              shipping_cost: blingOrder.frete || 0,
              notes: blingOrder.observacoes || null,
              tenant_id: tenantId,
            };

            if (existingMapping?.local_id) {
              await supabase
                .from("orders")
                .update(orderData)
                .eq("id", existingMapping.local_id);
              counts.updated++;
            } else {
              const { data: newOrder, error: insertError } = await supabase
                .from("orders")
                .insert(orderData)
                .select("id")
                .single();

              if (insertError) throw new Error(insertError.message);

              await supabase
                .from("bling_id_mappings")
                .insert({
                  tenant_id: tenantId,
                  entity_type: "order",
                  local_id: newOrder.id,
                  bling_id: String(blingOrder.id),
                  bling_numero: String(blingOrder.numero || ""),
                  sync_direction: "bling_to_local",
                });
              counts.created++;
            }
          } catch (error) {
            const msg = error instanceof Error ? error.message : "Unknown error";
            errors.push({ entity: "order", message: msg, details: `Pedido ${blingOrder.numero}` });
            counts.errors++;
          }
        }

        page++;
        if (blingOrders.length < 100) hasMore = false;
      }
    }

    // Export from Local to Bling
    if (direction === "local_to_bling" || direction === "bidirectional") {
      console.log(`[bling-sync] Exporting orders to Bling...`);

      const { data: allOrders } = await supabase
        .from("orders")
        .select("*, contact:contacts(*)")
        .eq("tenant_id", tenantId)
        .in("status", ["confirmed", "processing", "shipped"])
        .limit(200);

      const { data: existingMappings } = await supabase
        .from("bling_id_mappings")
        .select("local_id")
        .eq("tenant_id", tenantId)
        .eq("entity_type", "order");

      const mappedIds = new Set((existingMappings || []).map((m: any) => m.local_id));
      const ordersToExport = (allOrders || []).filter((o: any) => !mappedIds.has(o.id));

      for (const order of ordersToExport) {
        try {
          // Get contact Bling ID
          let contatoId = null;
          if (order.contact_id) {
            const { data: contactMapping } = await supabase
              .from("bling_id_mappings")
              .select("bling_id")
              .eq("tenant_id", tenantId)
              .eq("entity_type", "contact")
              .eq("local_id", order.contact_id)
              .maybeSingle();
            contatoId = contactMapping?.bling_id ? parseInt(contactMapping.bling_id) : null;
          }

          // Get order items
          const { data: orderItems } = await supabase
            .from("order_items")
            .select("*, product:products(*)")
            .eq("order_id", order.id);

          const itens = [];
          for (const item of orderItems || []) {
            // Get product Bling ID
            const { data: productMapping } = await supabase
              .from("bling_id_mappings")
              .select("bling_id")
              .eq("tenant_id", tenantId)
              .eq("entity_type", "product")
              .eq("local_id", item.product_id)
              .maybeSingle();

            if (productMapping?.bling_id) {
              itens.push({
                produto: { id: parseInt(productMapping.bling_id) },
                quantidade: item.quantity,
                valor: item.unit_price,
                desconto: item.discount_amount || 0,
              });
            }
          }

          const blingData: any = {
            data: new Date().toISOString().split("T")[0],
            desconto: order.discount_amount || 0,
            frete: order.shipping_cost || 0,
            observacoes: order.notes || "",
            itens,
          };

          if (contatoId) {
            blingData.contato = { id: contatoId };
          }

          const response = await blingApi("/pedidos/vendas", accessToken, "POST", blingData);
          const blingId = response.data?.id;
          const blingNumero = response.data?.numero;

          if (blingId) {
            await supabase
              .from("bling_id_mappings")
              .insert({
                tenant_id: tenantId,
                entity_type: "order",
                local_id: order.id,
                bling_id: String(blingId),
                bling_numero: blingNumero ? String(blingNumero) : null,
                sync_direction: "local_to_bling",
              });
            counts.created++;
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          errors.push({ entity: "order", message: msg, details: order.order_number });
          counts.errors++;
        }
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    errors.push({ entity: "orders", message: msg });
  }

  return { counts, errors };
}

// Sync Quotes (similar structure to orders)
async function syncQuotes(supabase: any, tenantId: string, accessToken: string, direction: string) {
  const counts = { created: 0, updated: 0, skipped: 0, errors: 0 };
  const errors: Array<{ entity: string; message: string; details?: string }> = [];

  try {
    // Export from Local to Bling (quotes typically originate locally)
    if (direction === "local_to_bling" || direction === "bidirectional") {
      console.log(`[bling-sync] Exporting quotes to Bling...`);

      const { data: allQuotes } = await supabase
        .from("quotes")
        .select("*, contact:contacts(*)")
        .eq("tenant_id", tenantId)
        .in("status", ["draft", "sent", "pending"])
        .limit(200);

      const { data: existingMappings } = await supabase
        .from("bling_id_mappings")
        .select("local_id")
        .eq("tenant_id", tenantId)
        .eq("entity_type", "quote");

      const mappedIds = new Set((existingMappings || []).map((m: any) => m.local_id));
      const quotesToExport = (allQuotes || []).filter((q: any) => !mappedIds.has(q.id));

      for (const quote of quotesToExport) {
        try {
          // Get contact Bling ID
          let contatoId = null;
          if (quote.contact_id) {
            const { data: contactMapping } = await supabase
              .from("bling_id_mappings")
              .select("bling_id")
              .eq("tenant_id", tenantId)
              .eq("entity_type", "contact")
              .eq("local_id", quote.contact_id)
              .maybeSingle();
            contatoId = contactMapping?.bling_id ? parseInt(contactMapping.bling_id) : null;
          }

          // Get quote items
          const { data: quoteItems } = await supabase
            .from("quote_items")
            .select("*, product:products(*)")
            .eq("quote_id", quote.id);

          const itens = [];
          for (const item of quoteItems || []) {
            const { data: productMapping } = await supabase
              .from("bling_id_mappings")
              .select("bling_id")
              .eq("tenant_id", tenantId)
              .eq("entity_type", "product")
              .eq("local_id", item.product_id)
              .maybeSingle();

            if (productMapping?.bling_id) {
              itens.push({
                produto: { id: parseInt(productMapping.bling_id) },
                quantidade: item.quantity,
                valor: item.unit_price,
                desconto: item.discount_amount || 0,
              });
            }
          }

          // Bling uses "propostas comerciais" for quotes
          const blingData: any = {
            data: new Date().toISOString().split("T")[0],
            desconto: quote.discount_amount || 0,
            frete: quote.shipping_cost || 0,
            observacoes: quote.notes || "",
            itens,
          };

          if (contatoId) {
            blingData.contato = { id: contatoId };
          }

          // Note: Bling may use different endpoint for proposals
          // Using pedidos/vendas with situacao for quotes
          const response = await blingApi("/pedidos/vendas", accessToken, "POST", blingData);
          const blingId = response.data?.id;
          const blingNumero = response.data?.numero;

          if (blingId) {
            await supabase
              .from("bling_id_mappings")
              .insert({
                tenant_id: tenantId,
                entity_type: "quote",
                local_id: quote.id,
                bling_id: String(blingId),
                bling_numero: blingNumero ? String(blingNumero) : null,
                sync_direction: "local_to_bling",
              });
            counts.created++;
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          errors.push({ entity: "quote", message: msg, details: quote.quote_number });
          counts.errors++;
        }
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    errors.push({ entity: "quotes", message: msg });
  }

  return { counts, errors };
}

// Sync Financial Data (Contas a Pagar e Receber)
async function syncFinancial(
  supabase: any, 
  tenantId: string, 
  accessToken: string, 
  direction: string,
  previewOnly: boolean = false,
  startDate?: string,
  endDate?: string,
  importMode: string = "all",
  selectedIds?: string[]
) {
  const counts = { created: 0, updated: 0, skipped: 0, errors: 0 };
  const errors: Array<{ entity: string; message: string; details?: string }> = [];
  const preview: any[] = [];
  const dependencies: any[] = [];

  try {
    // Build date filter for Bling API
    const dateFilter = startDate && endDate 
      ? `&dataInicial=${startDate}&dataFinal=${endDate}` 
      : "";

    console.log(`[bling-sync] Syncing financial data from Bling... ${previewOnly ? '(preview only)' : ''} ${dateFilter}`);

    // Fetch "Contas a Receber" (Accounts Receivable)
    const receivablesData: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      try {
        const response = await blingApi(
          `/contas/receber?pagina=${page}&limite=100${dateFilter}`,
          accessToken
        );
        const items = response.data || [];
        
        if (items.length === 0) {
          hasMore = false;
        } else {
          receivablesData.push(...items);
          page++;
          if (items.length < 100) hasMore = false;
          // Limit to prevent timeout
          if (page > 10 && previewOnly) {
            console.log(`[bling-sync] Preview limit reached for receivables`);
            hasMore = false;
          }
        }
      } catch (error) {
        console.error(`[bling-sync] Error fetching receivables page ${page}:`, error);
        hasMore = false;
      }
    }

    // Fetch "Contas a Pagar" (Accounts Payable)
    const payablesData: any[] = [];
    page = 1;
    hasMore = true;

    while (hasMore) {
      try {
        const response = await blingApi(
          `/contas/pagar?pagina=${page}&limite=100${dateFilter}`,
          accessToken
        );
        const items = response.data || [];
        
        if (items.length === 0) {
          hasMore = false;
        } else {
          payablesData.push(...items);
          page++;
          if (items.length < 100) hasMore = false;
          // Limit to prevent timeout
          if (page > 10 && previewOnly) {
            console.log(`[bling-sync] Preview limit reached for payables`);
            hasMore = false;
          }
        }
      } catch (error) {
        console.error(`[bling-sync] Error fetching payables page ${page}:`, error);
        hasMore = false;
      }
    }

    console.log(`[bling-sync] Found ${receivablesData.length} receivables, ${payablesData.length} payables`);

    // Process all financial items
    const allFinancialItems = [
      ...receivablesData.map(item => ({ ...item, _type: 'receivable' })),
      ...payablesData.map(item => ({ ...item, _type: 'payable' })),
    ];

    for (const item of allFinancialItems) {
      const blingId = String(item.id);
      
      // Check if mapping exists
      const { data: existingMapping } = await supabase
        .from("bling_id_mappings")
        .select("local_id")
        .eq("tenant_id", tenantId)
        .eq("entity_type", "financial")
        .eq("bling_id", blingId)
        .maybeSingle();

      const existsLocally = !!existingMapping?.local_id;

      if (previewOnly) {
        // Just collect preview data
        preview.push({
          id: blingId,
          bling_id: blingId,
          nome: item.historico || item.descricao || `${item._type === 'receivable' ? 'A Receber' : 'A Pagar'} #${blingId}`,
          descricao: item.historico || item.descricao || '',
          numero: item.numeroDocumento || blingId,
          data: item.dataEmissao || item.vencimento,
          vencimento: item.vencimento,
          valor: item.valor || 0,
          tipo: item._type,
          situacao: item.situacao,
          exists_locally: existsLocally,
          contato: item.contato?.nome || null,
        });
        continue;
      }

      // Filter by selected_ids if provided
      if (selectedIds && selectedIds.length > 0 && !selectedIds.includes(blingId)) {
        counts.skipped++;
        continue;
      }

      // Filter by import mode
      if (importMode === 'new_only' && existsLocally) {
        counts.skipped++;
        continue;
      }

      try {
        // Create transaction data for local financial_transactions table
        const transactionData = {
          tenant_id: tenantId,
          type: item._type === 'receivable' ? 'income' : 'expense',
          description: item.historico || item.descricao || `Importado do Bling #${blingId}`,
          amount: Math.abs(item.valor || 0),
          due_date: item.vencimento || null,
          payment_date: item.dataPagamento || null,
          status: item.situacao === 1 ? 'paid' : 'pending',
          document_number: item.numeroDocumento || null,
          notes: `Importado do Bling. ID: ${blingId}`,
          // Use default account if not set - will be created in fallback
          category_name: item.categoria?.descricao || 'Importado do Bling',
        };

        if (existsLocally && existingMapping?.local_id) {
          // Update existing
          await supabase
            .from("financial_transactions")
            .update({
              description: transactionData.description,
              amount: transactionData.amount,
              due_date: transactionData.due_date,
              payment_date: transactionData.payment_date,
              status: transactionData.status,
            })
            .eq("id", existingMapping.local_id);

          await supabase
            .from("bling_id_mappings")
            .update({ 
              last_synced_at: new Date().toISOString(),
              sync_status: 'synced'
            })
            .eq("tenant_id", tenantId)
            .eq("entity_type", "financial")
            .eq("bling_id", blingId);

          counts.updated++;
        } else {
          // Create new transaction
          const { data: newTransaction, error: insertError } = await supabase
            .from("financial_transactions")
            .insert({
              tenant_id: tenantId,
              type: transactionData.type,
              description: transactionData.description,
              amount: transactionData.amount,
              due_date: transactionData.due_date,
              payment_date: transactionData.payment_date,
              status: transactionData.status,
            })
            .select("id")
            .single();

          if (insertError) {
            throw new Error(insertError.message);
          }

          // Create mapping
          await supabase
            .from("bling_id_mappings")
            .insert({
              tenant_id: tenantId,
              entity_type: "financial",
              local_id: newTransaction.id,
              bling_id: blingId,
              bling_numero: item.numeroDocumento || null,
              sync_direction: "bling_to_local",
              sync_status: 'synced',
              last_synced_at: new Date().toISOString(),
            });

          counts.created++;
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        errors.push({ 
          entity: "financial", 
          message: msg, 
          details: `${item._type === 'receivable' ? 'Receber' : 'Pagar'} #${blingId}` 
        });
        counts.errors++;
      }
    }

    console.log(`[bling-sync] Financial sync complete: ${counts.created} created, ${counts.updated} updated, ${counts.errors} errors`);

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[bling-sync] Financial sync error: ${msg}`);
    errors.push({ entity: "financial", message: msg });
  }

  return { counts, errors, preview, dependencies };
}
