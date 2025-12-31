import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DedupeRequest {
  mode: 'preview' | 'execute';
  windowDays?: number | 'all';
  startOffset?: number;
  batchSize?: number;
}

interface MergeResult {
  keepPhone: string;
  dupPhone: string;
  keepId: string;
  dupId: string;
  success: boolean;
  error?: string;
}

// Normaliza telefone para formato canônico (55 + DDD + número)
// Mesmo critério do redirect-capture e whatsapp-webhook
function normalizePhoneForStorageBR(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  
  // Remover zeros à esquerda
  if (digits.startsWith('0')) {
    digits = digits.replace(/^0+/, '');
  }
  
  // Adicionar código do país se não tiver
  if (!digits.startsWith('55') && digits.length >= 10 && digits.length <= 11) {
    digits = `55${digits}`;
  }
  
  // Para celulares brasileiros (55 + DDD + 8 dígitos)
  // Só adicionar 9 se o bloco de 8 dígitos começar com 9
  if (digits.startsWith('55') && digits.length === 12) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    if (rest.length === 8 && rest.startsWith('9')) {
      digits = `55${ddd}9${rest}`;
    }
  }
  
  return digits;
}

// Gera variações do telefone para busca (com/sem 9º dígito)
function generatePhoneVariations(phone: string): string[] {
  const variations: string[] = [];
  const cleanPhone = phone.replace(/\D/g, '');
  
  if (!cleanPhone) return [phone];
  
  variations.push(cleanPhone);
  
  // Com/sem código do país
  if (cleanPhone.startsWith('55')) {
    variations.push(cleanPhone.slice(2));
  } else {
    variations.push(`55${cleanPhone}`);
  }
  
  // Variações do 9º dígito (celulares brasileiros)
  const hasCountry = cleanPhone.startsWith('55');
  const ddd = hasCountry ? cleanPhone.slice(2, 4) : cleanPhone.slice(0, 2);
  const rest = hasCountry ? cleanPhone.slice(4) : cleanPhone.slice(2);
  
  // Se tem 9 dígitos após o DDD e começa com 9, gerar versão sem o 9
  if (rest.length === 9 && rest.startsWith('9')) {
    const without9 = rest.slice(1);
    variations.push(`55${ddd}${without9}`);
    variations.push(`${ddd}${without9}`);
  }
  
  // Se tem 8 dígitos após o DDD e começa com 9, gerar versão com o 9
  if (rest.length === 8 && rest.startsWith('9')) {
    variations.push(`55${ddd}9${rest}`);
    variations.push(`${ddd}9${rest}`);
  }
  
  return [...new Set(variations)];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Autenticar usuário via JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Buscar tenant_id do usuário
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Perfil não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Verificar se é admin ou supervisor
    if (!['admin', 'supervisor'].includes(profile.role || '')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Apenas administradores podem executar esta ação' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const tenantId = profile.tenant_id;
    const body: DedupeRequest = await req.json();
    const { mode = 'preview', windowDays = 30, startOffset = 0, batchSize = 100 } = body;

    console.log(`[dedupe-redirect-contacts] Iniciando modo=${mode}, windowDays=${windowDays}, offset=${startOffset}`);

    // Buscar contatos que vieram do redirect (via redirect_logs)
    let query = supabase
      .from('redirect_logs')
      .select('contact_id, phone, created_at')
      .eq('tenant_id', tenantId)
      .not('contact_id', 'is', null)
      .order('created_at', { ascending: false })
      .range(startOffset, startOffset + batchSize - 1);

    // Filtrar por janela de tempo se não for "all"
    if (windowDays !== 'all' && typeof windowDays === 'number') {
      const since = new Date();
      since.setDate(since.getDate() - windowDays);
      query = query.gte('created_at', since.toISOString());
    }

    const { data: redirectLogs, error: logsError } = await query;

    if (logsError) {
      console.error('[dedupe-redirect-contacts] Erro ao buscar logs:', logsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao buscar logs do redirect' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`[dedupe-redirect-contacts] Encontrados ${redirectLogs?.length || 0} logs do redirect`);

    // Processar cada contato do redirect
    const results: MergeResult[] = [];
    let duplicatesFound = 0;
    let mergesExecuted = 0;
    let mergesFailed = 0;
    const processedContactIds = new Set<string>();

    for (const log of redirectLogs || []) {
      if (!log.contact_id || processedContactIds.has(log.contact_id)) {
        continue;
      }
      processedContactIds.add(log.contact_id);

      // Buscar o contato do redirect
      const { data: keepContact, error: keepError } = await supabase
        .from('contacts')
        .select('id, phone, full_name')
        .eq('id', log.contact_id)
        .eq('tenant_id', tenantId)
        .single();

      if (keepError || !keepContact) {
        console.log(`[dedupe-redirect-contacts] Contato ${log.contact_id} não encontrado`);
        continue;
      }

      // Gerar variações do telefone para buscar duplicatas
      const phoneVariations = generatePhoneVariations(keepContact.phone);
      console.log(`[dedupe-redirect-contacts] Buscando duplicatas para ${keepContact.phone.substring(0, 8)}... variações: ${phoneVariations.length}`);

      // Buscar contatos com telefones similares (exceto o próprio)
      const { data: duplicates, error: dupError } = await supabase
        .from('contacts')
        .select('id, phone, full_name')
        .eq('tenant_id', tenantId)
        .in('phone', phoneVariations)
        .neq('id', keepContact.id);

      if (dupError) {
        console.error(`[dedupe-redirect-contacts] Erro ao buscar duplicatas:`, dupError);
        continue;
      }

      if (!duplicates || duplicates.length === 0) {
        continue;
      }

      duplicatesFound += duplicates.length;
      console.log(`[dedupe-redirect-contacts] Encontradas ${duplicates.length} duplicatas para ${keepContact.phone.substring(0, 8)}***`);

      for (const duplicate of duplicates) {
        // Verificar qual nome é melhor
        const keepName = keepContact.full_name || '';
        const dupName = duplicate.full_name || '';
        const keepHasGenericName = keepName.startsWith('WhatsApp ') || keepName.startsWith('Lead ') || !keepName;
        const dupHasRealName = dupName && !dupName.startsWith('WhatsApp ') && !dupName.startsWith('Lead ');
        const useDuplicateName = keepHasGenericName && dupHasRealName;

        if (mode === 'preview') {
          results.push({
            keepPhone: keepContact.phone,
            dupPhone: duplicate.phone,
            keepId: keepContact.id,
            dupId: duplicate.id,
            success: true,
          });
        } else {
          // Executar merge
          console.log(`[dedupe-redirect-contacts] Executando merge: keep=${keepContact.id}, dup=${duplicate.id}, useDupName=${useDuplicateName}`);
          
          const { error: mergeError } = await supabase.rpc('merge_duplicate_contacts', {
            p_keep_contact_id: keepContact.id,
            p_duplicate_contact_id: duplicate.id,
            p_use_duplicate_name: useDuplicateName,
          });

          if (mergeError) {
            console.error(`[dedupe-redirect-contacts] Erro no merge:`, mergeError);
            results.push({
              keepPhone: keepContact.phone,
              dupPhone: duplicate.phone,
              keepId: keepContact.id,
              dupId: duplicate.id,
              success: false,
              error: mergeError.message,
            });
            mergesFailed++;
          } else {
            console.log(`[dedupe-redirect-contacts] ✅ Merge executado com sucesso`);
            results.push({
              keepPhone: keepContact.phone,
              dupPhone: duplicate.phone,
              keepId: keepContact.id,
              dupId: duplicate.id,
              success: true,
            });
            mergesExecuted++;
          }
        }
      }
    }

    // Verificar se há mais registros para processar
    const { count: totalCount } = await supabase
      .from('redirect_logs')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .not('contact_id', 'is', null);

    const nextOffset = startOffset + (redirectLogs?.length || 0);
    const canContinue = nextOffset < (totalCount || 0);

    const summary = {
      mode,
      windowDays,
      redirectLogsScanned: redirectLogs?.length || 0,
      uniqueContactsProcessed: processedContactIds.size,
      duplicatesFound,
      mergesExecuted,
      mergesFailed,
      startOffset,
      nextOffset,
      totalInDatabase: totalCount || 0,
      canContinue,
      examples: results.slice(0, 20),
    };

    console.log(`[dedupe-redirect-contacts] Concluído:`, JSON.stringify(summary));

    return new Response(
      JSON.stringify({ success: true, summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[dedupe-redirect-contacts] Erro geral:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
