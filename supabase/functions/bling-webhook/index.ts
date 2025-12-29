import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-bling-signature',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const url = new URL(req.url);
    const tenantId = url.searchParams.get('tenant_id');

    if (!tenantId) {
      console.error('[Bling Webhook] Missing tenant_id parameter');
      return new Response(JSON.stringify({ error: 'Missing tenant_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get Bling config for this tenant
    const { data: config, error: configError } = await supabase
      .from('bling_integration_config')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (configError || !config || !config.is_active) {
      console.error('[Bling Webhook] Integration not active for tenant:', tenantId);
      return new Response(JSON.stringify({ error: 'Integration not active' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse webhook payload
    const payload = await req.json();
    console.log('[Bling Webhook] Received event:', JSON.stringify(payload).substring(0, 500));

    // Bling webhook event structure
    const { retorno } = payload;
    
    if (!retorno) {
      // New Bling API v3 webhook format
      await processWebhookV3(supabase, tenantId, config, payload);
    } else {
      // Legacy Bling API v2 webhook format
      await processWebhookV2(supabase, tenantId, config, retorno);
    }

    // Log webhook receipt
    await supabase.from('bling_sync_logs').insert({
      tenant_id: tenantId,
      sync_type: 'webhook',
      entity_type: payload.evento || payload.event || 'unknown',
      status: 'completed',
      direction: 'from_bling',
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      details: { payload: JSON.stringify(payload).substring(0, 1000) },
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Bling Webhook] Error:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Process Bling API v3 webhook format
async function processWebhookV3(supabase: any, tenantId: string, config: any, payload: any) {
  const { event, data } = payload;

  console.log('[Bling Webhook V3] Processing event:', event);

  switch (event) {
    case 'pedidos.alteracao':
    case 'pedidos.inclusao':
      if (config.sync_orders) {
        await syncOrderFromBling(supabase, tenantId, config, data);
      }
      break;

    case 'contatos.alteracao':
    case 'contatos.inclusao':
      if (config.sync_contacts) {
        await syncContactFromBling(supabase, tenantId, config, data);
      }
      break;

    case 'produtos.alteracao':
    case 'produtos.inclusao':
      if (config.sync_products) {
        await syncProductFromBling(supabase, tenantId, config, data);
      }
      break;

    case 'pedidos.estoque':
      if (config.sync_products) {
        await updateStockFromBling(supabase, tenantId, config, data);
      }
      break;

    default:
      console.log('[Bling Webhook V3] Unhandled event type:', event);
  }
}

// Process legacy Bling API v2 webhook format
async function processWebhookV2(supabase: any, tenantId: string, config: any, retorno: any) {
  console.log('[Bling Webhook V2] Processing legacy format');

  if (retorno.pedidos && config.sync_orders) {
    for (const pedido of retorno.pedidos) {
      await syncOrderFromBling(supabase, tenantId, config, pedido.pedido);
    }
  }

  if (retorno.contatos && config.sync_contacts) {
    for (const contato of retorno.contatos) {
      await syncContactFromBling(supabase, tenantId, config, contato.contato);
    }
  }

  if (retorno.produtos && config.sync_products) {
    for (const produto of retorno.produtos) {
      await syncProductFromBling(supabase, tenantId, config, produto.produto);
    }
  }
}

// Sync order from Bling to local database
async function syncOrderFromBling(supabase: any, tenantId: string, config: any, orderData: any) {
  const blingId = String(orderData.id || orderData.numero);
  
  console.log('[Bling Webhook] Syncing order:', blingId);

  // Check if we have a mapping for this order
  const { data: mapping } = await supabase
    .from('bling_id_mappings')
    .select('local_id')
    .eq('tenant_id', tenantId)
    .eq('entity_type', 'order')
    .eq('bling_id', blingId)
    .single();

  if (mapping) {
    // Update existing order
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    // Map Bling status to local status
    const statusMap: Record<string, string> = {
      '0': 'pending',
      '1': 'pending',
      '2': 'pending',
      '3': 'approved',
      '4': 'in_production',
      '5': 'in_production',
      '6': 'shipped',
      '7': 'shipped',
      '8': 'shipped',
      '9': 'completed',
      '10': 'cancelled',
      '11': 'cancelled',
      '12': 'pending',
    };

    const blingStatus = String(orderData.situacao?.id || orderData.situacao || '');
    if (statusMap[blingStatus]) {
      updateData.status = statusMap[blingStatus];
    }

    // Update total if available
    if (orderData.total || orderData.totalProdutos) {
      updateData.total_amount = parseFloat(orderData.total || orderData.totalProdutos || 0);
    }

    await supabase
      .from('orders')
      .update(updateData)
      .eq('id', mapping.local_id)
      .eq('tenant_id', tenantId);

    // Update mapping sync timestamp
    await supabase
      .from('bling_id_mappings')
      .update({ 
        last_synced_at: new Date().toISOString(),
        sync_status: 'synced',
      })
      .eq('tenant_id', tenantId)
      .eq('entity_type', 'order')
      .eq('bling_id', blingId);

    console.log('[Bling Webhook] Order updated:', mapping.local_id);
  } else {
    console.log('[Bling Webhook] No local mapping found for order:', blingId);
    // Optionally create a new order here if needed
  }
}

// Sync contact from Bling to local database
async function syncContactFromBling(supabase: any, tenantId: string, config: any, contactData: any) {
  const blingId = String(contactData.id);
  
  console.log('[Bling Webhook] Syncing contact:', blingId);

  // Check if we have a mapping for this contact
  const { data: mapping } = await supabase
    .from('bling_id_mappings')
    .select('local_id')
    .eq('tenant_id', tenantId)
    .eq('entity_type', 'contact')
    .eq('bling_id', blingId)
    .single();

  if (mapping) {
    // Update existing contact
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (contactData.nome) updateData.full_name = contactData.nome;
    if (contactData.email) updateData.email = contactData.email;
    if (contactData.telefone || contactData.celular) {
      updateData.phone = contactData.celular || contactData.telefone;
    }
    
    // Address fields
    if (contactData.endereco) updateData.street = contactData.endereco;
    if (contactData.numero) updateData.number = contactData.numero;
    if (contactData.complemento) updateData.complement = contactData.complemento;
    if (contactData.bairro) updateData.neighborhood = contactData.bairro;
    if (contactData.cidade) updateData.city = contactData.cidade;
    if (contactData.uf) updateData.state = contactData.uf;
    if (contactData.cep) updateData.zip_code = contactData.cep;

    await supabase
      .from('contacts')
      .update(updateData)
      .eq('id', mapping.local_id)
      .eq('tenant_id', tenantId);

    // Update mapping sync timestamp
    await supabase
      .from('bling_id_mappings')
      .update({ 
        last_synced_at: new Date().toISOString(),
        sync_status: 'synced',
      })
      .eq('tenant_id', tenantId)
      .eq('entity_type', 'contact')
      .eq('bling_id', blingId);

    console.log('[Bling Webhook] Contact updated:', mapping.local_id);
  } else {
    console.log('[Bling Webhook] No local mapping found for contact:', blingId);
  }
}

// Sync product from Bling to local database
async function syncProductFromBling(supabase: any, tenantId: string, config: any, productData: any) {
  const blingId = String(productData.id);
  
  console.log('[Bling Webhook] Syncing product:', blingId);

  // Check if we have a mapping for this product
  const { data: mapping } = await supabase
    .from('bling_id_mappings')
    .select('local_id')
    .eq('tenant_id', tenantId)
    .eq('entity_type', 'product')
    .eq('bling_id', blingId)
    .single();

  if (mapping) {
    // Update existing product
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (productData.nome || productData.descricao) {
      updateData.name = productData.nome || productData.descricao;
    }
    if (productData.codigo) updateData.sku = productData.codigo;
    if (productData.preco || productData.precoCusto) {
      updateData.base_price = parseFloat(productData.preco || 0);
      updateData.cost_price = parseFloat(productData.precoCusto || 0);
    }
    if (productData.estoqueAtual !== undefined) {
      updateData.stock_quantity = parseInt(productData.estoqueAtual || 0);
    }
    if (productData.ncm) updateData.ncm = productData.ncm;
    if (productData.cest) updateData.cest = productData.cest;

    await supabase
      .from('products')
      .update(updateData)
      .eq('id', mapping.local_id)
      .eq('tenant_id', tenantId);

    // Update mapping sync timestamp
    await supabase
      .from('bling_id_mappings')
      .update({ 
        last_synced_at: new Date().toISOString(),
        sync_status: 'synced',
      })
      .eq('tenant_id', tenantId)
      .eq('entity_type', 'product')
      .eq('bling_id', blingId);

    console.log('[Bling Webhook] Product updated:', mapping.local_id);
  } else {
    console.log('[Bling Webhook] No local mapping found for product:', blingId);
  }
}

// Update stock from Bling event
async function updateStockFromBling(supabase: any, tenantId: string, config: any, stockData: any) {
  const blingId = String(stockData.produto?.id || stockData.idProduto);
  
  console.log('[Bling Webhook] Updating stock for product:', blingId);

  // Check if we have a mapping for this product
  const { data: mapping } = await supabase
    .from('bling_id_mappings')
    .select('local_id')
    .eq('tenant_id', tenantId)
    .eq('entity_type', 'product')
    .eq('bling_id', blingId)
    .single();

  if (mapping) {
    const newStock = parseInt(stockData.estoqueAtual || stockData.saldoFisico || 0);
    
    await supabase
      .from('products')
      .update({ 
        stock_quantity: newStock,
        updated_at: new Date().toISOString(),
      })
      .eq('id', mapping.local_id)
      .eq('tenant_id', tenantId);

    console.log('[Bling Webhook] Stock updated for product:', mapping.local_id, 'New stock:', newStock);
  }
}
