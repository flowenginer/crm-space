import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Robust CSV parser that handles multiline fields in quotes
function parseCSV(text: string, delimiter = ';'): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const nextChar = text[i + 1]

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        currentField += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === delimiter) {
        currentRow.push(currentField.trim())
        currentField = ''
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        currentRow.push(currentField.trim())
        if (currentRow.length > 1) {
          rows.push(currentRow)
        }
        currentRow = []
        currentField = ''
        if (char === '\r') i++
      } else {
        currentField += char
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim())
    if (currentRow.length > 1) {
      rows.push(currentRow)
    }
  }

  return rows
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '')
}

function getLast8Digits(phone: string): string {
  const digits = normalizePhone(phone)
  return digits.slice(-8)
}

function categorizeOrigin(
  contactOrigin: string | null,
  referralSource: string | null,
  firstMessage: string | null,
  referralData: any | null,
  convReferralData: any | null,
): string {
  // Check Linktree - PRIORITY: first message containing "linktree" or known linktree patterns
  if (firstMessage && /linktree|linktr\.ee/i.test(firstMessage)) return 'Linktree'
  if (contactOrigin === 'linktree') return 'Linktree'

  // Check CTWA Ads (click-to-whatsapp)
  if (contactOrigin === 'ctwa' || contactOrigin === 'ctwa_ads' || contactOrigin === 'ctwa_ad') return 'CTWA Ads'
  if (referralSource === 'ctwa' || referralSource === 'ctwa_ads' || referralSource === 'ctwa_ad') return 'CTWA Ads'

  // Check Redirect (Meta UTM) vs Meta Ads Direto (API)
  if (referralSource === 'redirect' || contactOrigin === 'redirect') return 'Redirect (Meta UTM)'
  if (contactOrigin === 'meta_ads') return 'Meta Ads Direto (API)'

  // Check WhatsApp organic
  if (contactOrigin === 'whatsapp' || contactOrigin === 'organic') return 'WhatsApp Orgânico'

  // Check if first message suggests organic
  if (firstMessage && /^(oi|olá|ola|bom dia|boa tarde|boa noite|hi|hello)/i.test(firstMessage?.trim() || '')) {
    return 'WhatsApp Orgânico'
  }

  // Check manual
  if (contactOrigin === 'manual') return 'Manual'

  // Check referral data
  if (referralData || convReferralData) {
    const data = referralData || convReferralData
    if (data?.source === 'redirect' || data?.utm_source) return 'Redirect (Meta UTM)'
    if (data?.sourceType === 'ad' || data?.source_type === 'ad') return 'Meta Ads Direto (API)'
    if (data?.source === 'ctwa') return 'CTWA Ads'
  }

  if (contactOrigin) return `Outro (${contactOrigin})`
  return 'Sem origem definida'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { csvText, tenantId } = await req.json()

    if (!csvText || !tenantId) {
      return new Response(JSON.stringify({ error: 'csvText and tenantId are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 1. Fetch conversion_status_ids from company_settings
    const { data: companySettings } = await supabase
      .from('company_settings')
      .select('conversion_status_ids')
      .eq('tenant_id', tenantId)
      .single()

    const conversionStatusIds: string[] = companySettings?.conversion_status_ids || ['78f16fc9-39f5-47ff-9774-00a0af9fa7da']
    console.log('Conversion status IDs:', conversionStatusIds)

    // 2. Fetch all lead_statuses for this tenant to know which are conversion statuses (07-10)
    const { data: allStatuses } = await supabase
      .from('lead_statuses')
      .select('id, name, order_position')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('order_position', { ascending: true })

    // Build set of conversion status IDs: configured ones + any with order_position >= 7 (statuses 07-10)
    const conversionStatusSet = new Set(conversionStatusIds)
    for (const status of allStatuses || []) {
      if (status.order_position != null && status.order_position >= 7) {
        conversionStatusSet.add(status.id)
      }
    }
    console.log('Total conversion status IDs (including 07-10):', conversionStatusSet.size)

    // 3. Parse CSV
    console.log('Parsing CSV...')
    const rows = parseCSV(csvText)
    const header = rows[0]
    const dataRows = rows.slice(1)
    console.log(`Parsed ${dataRows.length} data rows, header: ${header?.length} columns`)

    const COL_PEDIDO = 0
    const COL_NOME = 1
    const COL_CELULAR = 12
    const COL_TOTAL = 20

    // Extract unique orders
    const ordersMap = new Map<string, { pedido: string; nome: string; celular: string; total: number }>()
    for (const row of dataRows) {
      const pedido = row[COL_PEDIDO]?.replace(/"/g, '').trim()
      if (!pedido || ordersMap.has(pedido)) continue

      const celular = row[COL_CELULAR]?.replace(/"/g, '').trim()
      const nome = row[COL_NOME]?.replace(/"/g, '').trim()
      const totalStr = row[COL_TOTAL]?.replace(/"/g, '').trim().replace('.', '').replace(',', '.')
      const total = parseFloat(totalStr) || 0

      if (celular) {
        ordersMap.set(pedido, { pedido, nome, celular, total })
      }
    }

    const orders = Array.from(ordersMap.values())
    console.log(`Extracted ${orders.length} unique orders with phone numbers`)

    // 4. Extract unique phone suffixes (8 and 9 digits) for SQL matching
    const phoneSuffixes8 = new Set<string>()
    const phoneSuffixes9 = new Set<string>()
    const orderPhoneMap = new Map<string, string>() // suffix8 -> original phone

    for (const order of orders) {
      const digits = normalizePhone(order.celular)
      const s8 = digits.slice(-8)
      const s9 = digits.slice(-9)
      if (s8.length === 8) {
        phoneSuffixes8.add(s8)
        orderPhoneMap.set(s8, order.celular)
      }
      if (s9.length === 9) {
        phoneSuffixes9.add(s9)
      }
    }

    const allSuffixes = [...new Set([...phoneSuffixes8, ...phoneSuffixes9])]
    console.log(`Unique phone suffixes to search: ${allSuffixes.length} (8-digit: ${phoneSuffixes8.size}, 9-digit: ${phoneSuffixes9.size})`)

    // 5. Query contacts directly by phone suffix using RPC or direct query in batches
    const contactsByPhone8 = new Map<string, any>()
    const contactsByPhone9 = new Map<string, any>()

    // Query in batches of 100 suffixes
    const suffixArray = [...phoneSuffixes8]
    for (let i = 0; i < suffixArray.length; i += 100) {
      const batch = suffixArray.slice(i, i + 100)
      
      // Use PostgREST filter - we need to get ALL contacts and filter by suffix
      // Since we can't use RIGHT() in PostgREST, we fetch by partial phone match
      // Strategy: fetch contacts whose phone ends with these digits
      const { data: contacts, error } = await supabase
        .from('contacts')
        .select('id, full_name, phone, origin, referral_data, origin_campaign, lead_status, custom_fields')
        .eq('tenant_id', tenantId)

      if (error) {
        console.error('Error fetching contacts batch:', error)
        continue
      }

      // This still has the limit problem, so let's use a different approach
      // We'll use supabase.rpc or raw SQL via the REST API
      break
    }

    // Better approach: Use PostgREST with phone LIKE patterns
    // For each suffix, build an OR filter
    console.log('Fetching contacts using phone suffix matching...')
    
    const matchedContacts = new Map<string, any>() // contactId -> contact
    const contactsByPhoneSuffix = new Map<string, any>() // suffix8 -> contact

    // Batch query using .or() with ilike patterns for phone endings
    const batchSize = 20
    const suffix8Array = [...phoneSuffixes8]
    
    for (let i = 0; i < suffix8Array.length; i += batchSize) {
      const batch = suffix8Array.slice(i, i + batchSize)
      
      // Build OR filter: phone.ilike.%96791974,phone.ilike.%99679197
      const orFilter = batch.map(s => `phone.ilike.%${s}`).join(',')
      
      const { data: contacts, error } = await supabase
        .from('contacts')
        .select('id, full_name, phone, origin, referral_data, origin_campaign, lead_status, custom_fields')
        .eq('tenant_id', tenantId)
        .or(orFilter)
      
      if (error) {
        console.error(`Error fetching contacts batch ${i}:`, error)
        continue
      }

      for (const contact of contacts || []) {
        const contactDigits = normalizePhone(contact.phone)
        const contactSuffix8 = contactDigits.slice(-8)
        matchedContacts.set(contact.id, contact)
        contactsByPhoneSuffix.set(contactSuffix8, contact)
      }
    }

    console.log(`Found ${matchedContacts.size} unique contacts matching phone suffixes`)

    // 6. Match orders to contacts
    const matchedContactIds: string[] = []
    const orderResults: any[] = []

    for (const order of orders) {
      const digits = normalizePhone(order.celular)
      const s8 = digits.slice(-8)
      
      const contact = contactsByPhoneSuffix.get(s8)

      // Check if contact is converted
      let convertidoCRM = false
      if (contact) {
        if (contact.lead_status && conversionStatusSet.has(contact.lead_status)) {
          convertidoCRM = true
        }
        const cf = contact.custom_fields as any
        if (cf?.conversoes && Array.isArray(cf.conversoes) && cf.conversoes.length > 0) {
          convertidoCRM = true
        }
      }

      orderResults.push({
        pedido: order.pedido,
        nomeComprador: order.nome,
        telefone: order.celular,
        totalPedido: order.total,
        matchCRM: !!contact,
        contactId: contact?.id || null,
        nomeCRM: contact?.full_name || null,
        contactOrigin: contact?.origin || null,
        referralData: contact?.referral_data || null,
        originCampaign: contact?.origin_campaign || null,
        convertidoCRM,
      })

      if (contact) {
        matchedContactIds.push(contact.id)
      }
    }

    console.log(`Matched ${matchedContactIds.length} orders to CRM contacts`)

    // 6. Fetch conversations for matched contacts
    const conversationMap = new Map<string, any>()
    if (matchedContactIds.length > 0) {
      for (let i = 0; i < matchedContactIds.length; i += 50) {
        const chunk = matchedContactIds.slice(i, i + 50)
        const { data: conversations } = await supabase
          .from('conversations')
          .select('id, contact_id, referral_source, referral_data')
          .eq('tenant_id', tenantId)
          .in('contact_id', chunk)
          .order('created_at', { ascending: true })

        for (const conv of conversations || []) {
          if (!conversationMap.has(conv.contact_id)) {
            conversationMap.set(conv.contact_id, conv)
          }
        }
      }
    }

    // 7. Fetch first messages for conversations
    const firstMessageMap = new Map<string, string>()
    const conversationIds = [...conversationMap.values()].map(c => c.id)

    if (conversationIds.length > 0) {
      for (let i = 0; i < conversationIds.length; i += 50) {
        const chunk = conversationIds.slice(i, i + 50)
        const { data: messages } = await supabase
          .from('messages')
          .select('conversation_id, content')
          .in('conversation_id', chunk)
          .eq('is_from_me', false)
          .order('created_at', { ascending: true })
          .limit(1)

        for (const msg of messages || []) {
          if (!firstMessageMap.has(msg.conversation_id)) {
            firstMessageMap.set(msg.conversation_id, msg.content || '')
          }
        }
      }
    }

    // 8. Fetch meta_ads for creative names
    const { data: metaAds } = await supabase
      .from('meta_ads')
      .select('id, ad_id, name, campaign_name, adset_name')
      .eq('tenant_id', tenantId)

    const metaAdsMap = new Map<string, any>()
    for (const ad of metaAds || []) {
      metaAdsMap.set(ad.ad_id, ad)
    }

    // 9. Build final results
    const results = orderResults.map(order => {
      const conv = order.contactId ? conversationMap.get(order.contactId) : null
      const firstMessage = conv ? firstMessageMap.get(conv.id) : null
      const convReferralData = conv?.referral_data

      const origem = order.matchCRM
        ? categorizeOrigin(order.contactOrigin, conv?.referral_source, firstMessage || null, order.referralData, convReferralData)
        : 'Não encontrado no CRM'

      // Try to find creative name
      let criativo = null
      const rd = order.referralData || convReferralData
      if (rd) {
        const sourceId = rd.sourceId || rd.source_id || rd.utm_term
        if (sourceId && metaAdsMap.has(sourceId)) {
          const ad = metaAdsMap.get(sourceId)
          criativo = ad.name
        } else if (rd.utm_content) {
          criativo = rd.utm_content
        }
      }

      return {
        pedido: order.pedido,
        nomeComprador: order.nomeComprador,
        telefone: order.telefone,
        totalPedido: order.totalPedido,
        matchCRM: order.matchCRM,
        nomeCRM: order.nomeCRM,
        origem,
        criativo,
        originCampaign: order.originCampaign,
        convertidoCRM: order.convertidoCRM,
      }
    })

    // 10. Aggregate summaries
    const summary: Record<string, { count: number; total: number }> = {}
    for (const r of results) {
      if (!summary[r.origem]) summary[r.origem] = { count: 0, total: 0 }
      summary[r.origem].count++
      summary[r.origem].total += r.totalPedido
    }

    const creativeSummary: Record<string, { count: number; total: number; origem: string }> = {}
    for (const r of results) {
      if (r.criativo) {
        if (!creativeSummary[r.criativo]) creativeSummary[r.criativo] = { count: 0, total: 0, origem: r.origem }
        creativeSummary[r.criativo].count++
        creativeSummary[r.criativo].total += r.totalPedido
      }
    }

    const convertedCount = results.filter(r => r.convertidoCRM).length
    const notConvertedInCRM = results.filter(r => r.matchCRM && !r.convertidoCRM).length

    const response = {
      totalOrders: results.length,
      matchedOrders: results.filter(r => r.matchCRM).length,
      unmatchedOrders: results.filter(r => !r.matchCRM).length,
      convertedOrders: convertedCount,
      notConvertedInCRM,
      totalRevenue: results.reduce((sum, r) => sum + r.totalPedido, 0),
      summary,
      creativeSummary,
      orders: results,
    }

    console.log(`Results: ${results.length} total, ${response.matchedOrders} matched, ${convertedCount} converted in CRM`)

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
