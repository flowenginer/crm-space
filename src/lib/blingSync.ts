import { supabase } from '@/integrations/supabase/client';

const BLING_API_URL = 'https://www.bling.com.br/Api/v3';

interface BlingConfig {
  access_token: string;
  tenant_id: string;
  sync_contacts: boolean;
  sync_orders: boolean;
  sync_products: boolean;
  sync_quotes: boolean;
  is_active: boolean;
  is_configured: boolean;
  token_expires_at: string | null;
}

// Cache for config to avoid repeated queries
let configCache: BlingConfig | null = null;
let configCacheTime = 0;
const CACHE_TTL = 30000; // 30 seconds

export async function getBlingConfig(): Promise<BlingConfig | null> {
  const now = Date.now();
  
  // Return cached config if valid
  if (configCache && (now - configCacheTime) < CACHE_TTL) {
    return configCache;
  }

  const { data, error } = await supabase
    .from('bling_integration_config')
    .select('*')
    .maybeSingle();

  if (error || !data) {
    configCache = null;
    return null;
  }

  configCache = data as BlingConfig;
  configCacheTime = now;
  return configCache;
}

export function clearBlingConfigCache() {
  configCache = null;
  configCacheTime = 0;
}

export async function isBlingActive(): Promise<boolean> {
  const config = await getBlingConfig();
  if (!config?.is_active || !config?.is_configured || !config?.access_token) {
    return false;
  }
  
  // Check if token is expired
  if (config.token_expires_at && new Date(config.token_expires_at) < new Date()) {
    return false;
  }
  
  return true;
}

export async function isBlingEntitySyncEnabled(entityType: 'contacts' | 'orders' | 'products' | 'quotes'): Promise<boolean> {
  const config = await getBlingConfig();
  if (!config?.is_active || !config?.is_configured) return false;
  
  switch (entityType) {
    case 'contacts': return config.sync_contacts;
    case 'orders': return config.sync_orders;
    case 'products': return config.sync_products;
    case 'quotes': return config.sync_quotes;
    default: return false;
  }
}

// Helper to make Bling API calls via Edge Function proxy (avoids CORS)
export async function blingApi(endpoint: string, _accessToken: string, method = 'GET', body?: Record<string, unknown>) {
  // Determine action and payload from endpoint+method
  let action: string;
  let proxyPayload: Record<string, unknown> = {};

  if (method === 'POST' && endpoint === '/contatos') {
    action = 'create_contact';
    proxyPayload = { contact_data: body };
  } else if (method === 'POST' && endpoint === '/pedidos/vendas') {
    action = 'create_pre_order';
    proxyPayload = { order_data: body };
  } else if (method === 'PUT' && endpoint.startsWith('/contatos/')) {
    action = 'update_contact';
    const blingId = endpoint.split('/contatos/')[1];
    proxyPayload = { contact_data: body, bling_id: blingId };
  } else {
    // Fallback: direct call (only works server-side / Edge Functions)
    console.warn(`[Bling API] No proxy action for ${method} ${endpoint}, attempting direct call`);
    const response = await fetch(`${BLING_API_URL}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${_accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Bling API] Error ${response.status}: ${errorText}`);
      throw new Error(`Bling API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  // Get tenant_id from config cache or fresh query
  const config = await getBlingConfig();
  if (!config?.tenant_id) throw new Error('Bling não configurado');

  const { data, error } = await supabase.functions.invoke('bling-proxy', {
    body: {
      action,
      tenant_id: config.tenant_id,
      ...proxyPayload,
    },
  });

  if (error) {
    console.error(`[Bling API Proxy] Invoke error:`, error);
    throw new Error(`Erro de conexão com Bling: ${error.message}`);
  }

  if (data?.error) {
    console.error(`[Bling API Proxy] Bling error:`, data.error, data.details);
    throw new Error(data.error);
  }

  return data;
}

// Sync individual contact to Bling
export async function syncContactToBling(contactId: string, contactData: {
  full_name: string;
  phone: string;
  email?: string | null;
  cpf_cnpj?: string | null;
  person_type?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  zip_code?: string | null;
  city?: string | null;
  state?: string | null;
}): Promise<{ success: boolean; bling_id?: string; error?: string }> {
  try {
    if (!await isBlingEntitySyncEnabled('contacts')) {
      return { success: true }; // Skip silently if not enabled
    }

    const config = await getBlingConfig();
    if (!config?.access_token || !config?.tenant_id) {
      return { success: false, error: 'Bling not configured' };
    }

    // Check if already mapped
    const { data: existingMapping } = await supabase
      .from('bling_id_mappings')
      .select('bling_id')
      .eq('tenant_id', config.tenant_id)
      .eq('entity_type', 'contact')
      .eq('local_id', contactId)
      .maybeSingle();

    // Format phone: remove non-digits
    const celular = contactData.phone?.replace(/\D/g, '') || undefined;
    const cpfCnpjClean = contactData.cpf_cnpj?.replace(/\D/g, '') || undefined;

    const blingData: Record<string, unknown> = {
      nome: contactData.full_name,
      tipo: contactData.person_type === 'company' ? 'J' : 'F',
      contribuinte: 9, // 9 = Não contribuinte (default)
    };

    // Only send optional fields if they have values
    if (cpfCnpjClean) blingData.numeroDocumento = cpfCnpjClean;
    if (contactData.email) blingData.email = contactData.email;
    if (celular) blingData.celular = celular;

    if (contactData.street) {
      blingData.enderecos = {
        geral: {
          endereco: contactData.street,
          numero: contactData.number || 'S/N',
          complemento: contactData.complement || '',
          bairro: contactData.neighborhood || '',
          cep: contactData.zip_code?.replace(/\D/g, '') || '',
          municipio: contactData.city || '',
          uf: contactData.state || '',
        },
      };
    }

    if (existingMapping?.bling_id) {
      // Update existing
      await blingApi(`/contatos/${existingMapping.bling_id}`, config.access_token, 'PUT', blingData);
      
      await supabase
        .from('bling_id_mappings')
        .update({ last_synced_at: new Date().toISOString(), sync_status: 'synced' })
        .eq('tenant_id', config.tenant_id)
        .eq('entity_type', 'contact')
        .eq('local_id', contactId);

      return { success: true, bling_id: existingMapping.bling_id };
    } else {
      // Create new
      const response = await blingApi('/contatos', config.access_token, 'POST', blingData);
      const blingId = response.data?.id;

      if (blingId) {
        await supabase
          .from('bling_id_mappings')
          .insert({
            tenant_id: config.tenant_id,
            entity_type: 'contact',
            local_id: contactId,
            bling_id: String(blingId),
            sync_direction: 'local_to_bling',
          });

        return { success: true, bling_id: String(blingId) };
      }

      return { success: false, error: 'No Bling ID returned' };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Bling Sync] Contact sync error:', message);
    return { success: false, error: message };
  }
}

// Sync individual product to Bling
export async function syncProductToBling(productId: string, productData: {
  name: string;
  sku?: string | null;
  base_price: number;
  cost_price?: number | null;
  short_description?: string | null;
  ncm?: string | null;
  cest?: string | null;
  origem?: number | null;
  is_active?: boolean;
}): Promise<{ success: boolean; bling_id?: string; error?: string }> {
  try {
    if (!await isBlingEntitySyncEnabled('products')) {
      return { success: true };
    }

    const config = await getBlingConfig();
    if (!config?.access_token || !config?.tenant_id) {
      return { success: false, error: 'Bling not configured' };
    }

    const { data: existingMapping } = await supabase
      .from('bling_id_mappings')
      .select('bling_id')
      .eq('tenant_id', config.tenant_id)
      .eq('entity_type', 'product')
      .eq('local_id', productId)
      .maybeSingle();

    const blingData = {
      nome: productData.name,
      codigo: productData.sku || undefined,
      preco: productData.base_price,
      precoCusto: productData.cost_price || undefined,
      tipo: 'P',
      situacao: productData.is_active !== false ? 'A' : 'I',
      formato: 'S',
      ncm: productData.ncm || undefined,
      cest: productData.cest || undefined,
      origem: productData.origem ?? 0,
    };

    if (existingMapping?.bling_id) {
      await blingApi(`/produtos/${existingMapping.bling_id}`, config.access_token, 'PUT', blingData);
      
      await supabase
        .from('bling_id_mappings')
        .update({ last_synced_at: new Date().toISOString(), sync_status: 'synced' })
        .eq('tenant_id', config.tenant_id)
        .eq('entity_type', 'product')
        .eq('local_id', productId);

      return { success: true, bling_id: existingMapping.bling_id };
    } else {
      const response = await blingApi('/produtos', config.access_token, 'POST', blingData);
      const blingId = response.data?.id;

      if (blingId) {
        await supabase
          .from('bling_id_mappings')
          .insert({
            tenant_id: config.tenant_id,
            entity_type: 'product',
            local_id: productId,
            bling_id: String(blingId),
            sync_direction: 'local_to_bling',
          });

        return { success: true, bling_id: String(blingId) };
      }

      return { success: false, error: 'No Bling ID returned' };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Bling Sync] Product sync error:', message);
    return { success: false, error: message };
  }
}

// Sync individual order to Bling
export async function syncOrderToBling(orderId: string, orderData: {
  contact_id?: string | null;
  total: number;
  discount_amount?: number | null;
  shipping_cost?: number | null;
  notes?: string | null;
}, orderItems?: Array<{
  product_id?: string | null;
  quantity: number;
  unit_price: number;
  discount_amount?: number | null;
}>): Promise<{ success: boolean; bling_id?: string; bling_numero?: string; error?: string }> {
  try {
    if (!await isBlingEntitySyncEnabled('orders')) {
      return { success: true };
    }

    const config = await getBlingConfig();
    if (!config?.access_token || !config?.tenant_id) {
      return { success: false, error: 'Bling not configured' };
    }

    const { data: existingMapping } = await supabase
      .from('bling_id_mappings')
      .select('bling_id, bling_numero')
      .eq('tenant_id', config.tenant_id)
      .eq('entity_type', 'order')
      .eq('local_id', orderId)
      .maybeSingle();

    // Get contact Bling ID if exists
    let contatoId = null;
    if (orderData.contact_id) {
      const { data: contactMapping } = await supabase
        .from('bling_id_mappings')
        .select('bling_id')
        .eq('tenant_id', config.tenant_id)
        .eq('entity_type', 'contact')
        .eq('local_id', orderData.contact_id)
        .maybeSingle();
      contatoId = contactMapping?.bling_id ? parseInt(contactMapping.bling_id) : null;
    }

    // Build items array
    const itens = [];
    if (orderItems && orderItems.length > 0) {
      for (const item of orderItems) {
        if (item.product_id) {
          const { data: productMapping } = await supabase
            .from('bling_id_mappings')
            .select('bling_id')
            .eq('tenant_id', config.tenant_id)
            .eq('entity_type', 'product')
            .eq('local_id', item.product_id)
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
      }
    }

    const blingData: Record<string, unknown> = {
      data: new Date().toISOString().split('T')[0],
      desconto: orderData.discount_amount || 0,
      frete: orderData.shipping_cost || 0,
      observacoes: orderData.notes || '',
      itens,
    };

    if (contatoId) {
      blingData.contato = { id: contatoId };
    }

    if (existingMapping?.bling_id) {
      // Update existing order
      await blingApi(`/pedidos/vendas/${existingMapping.bling_id}`, config.access_token, 'PUT', blingData);
      
      await supabase
        .from('bling_id_mappings')
        .update({ last_synced_at: new Date().toISOString(), sync_status: 'synced' })
        .eq('tenant_id', config.tenant_id)
        .eq('entity_type', 'order')
        .eq('local_id', orderId);

      return { success: true, bling_id: existingMapping.bling_id, bling_numero: existingMapping.bling_numero || undefined };
    } else {
      const response = await blingApi('/pedidos/vendas', config.access_token, 'POST', blingData);
      const blingId = response.data?.id;
      const blingNumero = response.data?.numero;

      if (blingId) {
        await supabase
          .from('bling_id_mappings')
          .insert({
            tenant_id: config.tenant_id,
            entity_type: 'order',
            local_id: orderId,
            bling_id: String(blingId),
            bling_numero: blingNumero ? String(blingNumero) : null,
            sync_direction: 'local_to_bling',
          });

        return { success: true, bling_id: String(blingId), bling_numero: blingNumero ? String(blingNumero) : undefined };
      }

      return { success: false, error: 'No Bling ID returned' };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Bling Sync] Order sync error:', message);
    return { success: false, error: message };
  }
}

// Sync individual quote to Bling
export async function syncQuoteToBling(quoteId: string, quoteData: {
  contact_id?: string | null;
  total: number | null;
  discount_amount?: number | null;
  shipping_cost?: number | null;
  notes?: string | null;
}, quoteItems?: Array<{
  product_id?: string | null;
  quantity: number;
  unit_price: number;
  discount_amount?: number | null;
}>): Promise<{ success: boolean; bling_id?: string; bling_numero?: string; error?: string }> {
  try {
    if (!await isBlingEntitySyncEnabled('quotes')) {
      return { success: true };
    }

    const config = await getBlingConfig();
    if (!config?.access_token || !config?.tenant_id) {
      return { success: false, error: 'Bling not configured' };
    }

    const { data: existingMapping } = await supabase
      .from('bling_id_mappings')
      .select('bling_id, bling_numero')
      .eq('tenant_id', config.tenant_id)
      .eq('entity_type', 'quote')
      .eq('local_id', quoteId)
      .maybeSingle();

    // Quotes don't update, only create once
    if (existingMapping?.bling_id) {
      return { success: true, bling_id: existingMapping.bling_id, bling_numero: existingMapping.bling_numero || undefined };
    }

    let contatoId = null;
    if (quoteData.contact_id) {
      const { data: contactMapping } = await supabase
        .from('bling_id_mappings')
        .select('bling_id')
        .eq('tenant_id', config.tenant_id)
        .eq('entity_type', 'contact')
        .eq('local_id', quoteData.contact_id)
        .maybeSingle();
      contatoId = contactMapping?.bling_id ? parseInt(contactMapping.bling_id) : null;
    }

    const itens = [];
    if (quoteItems && quoteItems.length > 0) {
      for (const item of quoteItems) {
        if (item.product_id) {
          const { data: productMapping } = await supabase
            .from('bling_id_mappings')
            .select('bling_id')
            .eq('tenant_id', config.tenant_id)
            .eq('entity_type', 'product')
            .eq('local_id', item.product_id)
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
      }
    }

    const blingData: Record<string, unknown> = {
      data: new Date().toISOString().split('T')[0],
      desconto: quoteData.discount_amount || 0,
      frete: quoteData.shipping_cost || 0,
      observacoes: quoteData.notes || '',
      itens,
    };

    if (contatoId) {
      blingData.contato = { id: contatoId };
    }

    const response = await blingApi('/pedidos/vendas', config.access_token, 'POST', blingData);
    const blingId = response.data?.id;
    const blingNumero = response.data?.numero;

    if (blingId) {
      await supabase
        .from('bling_id_mappings')
        .insert({
          tenant_id: config.tenant_id,
          entity_type: 'quote',
          local_id: quoteId,
          bling_id: String(blingId),
          bling_numero: blingNumero ? String(blingNumero) : null,
          sync_direction: 'local_to_bling',
        });

      return { success: true, bling_id: String(blingId), bling_numero: blingNumero ? String(blingNumero) : undefined };
    }

    return { success: false, error: 'No Bling ID returned' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Bling Sync] Quote sync error:', message);
    return { success: false, error: message };
  }
}

// Create a pre-order in Bling (minimal data - seller completes in Bling)
export async function createPreOrderInBling(data: {
  contactBlingId: number;
  endereco?: {
    nome: string;
    endereco: string;
    numero: string;
    complemento?: string;
    municipio: string;
    uf: string;
    cep: string;
    bairro: string;
  };
  observacoes: string;
  observacoesInternas?: string;
}): Promise<{ blingId: string; blingNumero: string }> {
  const config = await getBlingConfig();
  if (!config?.access_token || !config?.tenant_id) {
    throw new Error('Bling não configurado');
  }

  const blingData: Record<string, unknown> = {
    contato: { id: data.contactBlingId },
    data: new Date().toISOString().split('T')[0],
    observacoes: data.observacoes,
    observacoesInternas: data.observacoesInternas || 'Pré-pedido criado via CRM',
  };

  if (data.endereco) {
    blingData.transporte = {
      etiqueta: {
        nome: data.endereco.nome,
        endereco: data.endereco.endereco,
        numero: data.endereco.numero,
        complemento: data.endereco.complemento || '',
        municipio: data.endereco.municipio,
        uf: data.endereco.uf,
        cep: data.endereco.cep.replace(/\D/g, ''),
        bairro: data.endereco.bairro,
      },
    };
  }

  const response = await blingApi('/pedidos/vendas', config.access_token, 'POST', blingData);
  const blingId = response.data?.id;
  const blingNumero = response.data?.numero;

  if (!blingId) {
    throw new Error('Bling não retornou ID do pedido');
  }

  return { blingId: String(blingId), blingNumero: blingNumero ? String(blingNumero) : String(blingId) };
}

// Get Bling mapping for an entity
export async function getBlingMapping(entityType: 'contact' | 'order' | 'product' | 'quote', localId: string) {
  const config = await getBlingConfig();
  if (!config?.tenant_id) return null;

  const { data } = await supabase
    .from('bling_id_mappings')
    .select('bling_id, bling_numero, sync_status, last_synced_at')
    .eq('tenant_id', config.tenant_id)
    .eq('entity_type', entityType)
    .eq('local_id', localId)
    .maybeSingle();

  return data;
}
