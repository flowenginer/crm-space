import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Regex para extrair nome do usuário do padrão *Nome*: ou *NOME - SETOR*:
const USER_PATTERN = /^\*([^*]+)\*:/;

interface UserInfo {
  userId: string;
  departmentId: string | null;
  fullName: string;
}

interface AssignmentResult {
  conversationId: string;
  contactName: string;
  userName: string;
  userId: string;
  success: boolean;
  error?: string;
}

// Função para normalizar nome (remover acentos, lowercase)
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// Função para extrair o primeiro nome de um padrão como "RAFIK - SAC" ou "Diego"
function extractFirstName(pattern: string): string {
  // Remove sufixos como " - SAC", " - EXPEDIÇÃO", etc.
  const cleanName = pattern.split('-')[0].trim();
  // Pega o primeiro nome
  return cleanName.split(' ')[0];
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

    const { mode = 'preview', limit, action } = await req.json().catch(() => ({}));
    
    console.log(`[AutoAssign] ========== INÍCIO ==========`);
    console.log(`[AutoAssign] Modo: ${mode}, Limite: ${limit || 'SEM LIMITE'}, Ação: ${action || 'assign'}`);

    // Se a ação for apenas listar usuários
    if (action === 'list-users') {
      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('id, full_name, department_id')
        .eq('is_active', true)
        .not('full_name', 'is', null);

      if (usersError) {
        console.error('[AutoAssign] Erro ao buscar usuários:', usersError);
        throw usersError;
      }

      const validUsers = users?.filter(u => u.full_name && u.full_name.trim() !== '') || [];
      
      console.log(`[AutoAssign] Encontrados ${validUsers.length} usuários ativos`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          users: validUsers.map(u => ({
            id: u.id,
            name: u.full_name,
            departmentId: u.department_id
          }))
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar todos os usuários ativos para criar o mapeamento dinâmico
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, full_name, department_id')
      .eq('is_active', true)
      .not('full_name', 'is', null);

    if (usersError) {
      console.error('[AutoAssign] Erro ao buscar usuários:', usersError);
      throw usersError;
    }

    // Criar mapeamento dinâmico de nomes para usuários
    const userMap: Record<string, UserInfo> = {};
    const userMapNormalized: Record<string, UserInfo> = {};

    for (const user of users || []) {
      if (!user.full_name) continue;
      
      const userInfo: UserInfo = {
        userId: user.id,
        departmentId: user.department_id,
        fullName: user.full_name
      };

      // Mapear por nome completo exato
      userMap[user.full_name] = userInfo;
      userMapNormalized[normalizeName(user.full_name)] = userInfo;

      // Mapear também por primeiro nome (para casos como "Diego" em vez de "Diego Silva")
      const firstName = user.full_name.split(' ')[0];
      if (firstName && !userMap[firstName]) {
        userMap[firstName] = userInfo;
        userMapNormalized[normalizeName(firstName)] = userInfo;
      }
    }

    console.log(`[AutoAssign] Mapa de usuários criado: ${Object.keys(userMap).length} entradas de ${users?.length || 0} usuários`);
    console.log(`[AutoAssign] Usuários disponíveis: ${users?.map(u => u.full_name).join(', ')}`);

    // PRIMEIRO: Contar total de conversas não atribuídas no banco (sem limite)
    const { count: totalUnassignedCount, error: countError } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .is('assigned_to', null)
      .eq('status', 'open');

    if (countError) {
      console.error('[AutoAssign] Erro ao contar conversas:', countError);
    } else {
      console.log(`[AutoAssign] *** TOTAL DE CONVERSAS NÃO ATRIBUÍDAS NO BANCO: ${totalUnassignedCount} ***`);
    }

    // Buscar conversas sem atribuição
    let query = supabase
      .from('conversations')
      .select('id, contact:contacts(id, full_name)')
      .is('assigned_to', null)
      .eq('status', 'open')
      .order('last_message_at', { ascending: false });

    // IMPORTANTE: Só aplicar limite se fornecido (modo test = limite implícito de 50)
    // Modo full ou preview sem limite = processa TODAS
    const effectiveLimit = mode === 'test' ? (limit || 50) : limit;
    if (effectiveLimit) {
      query = query.limit(effectiveLimit);
      console.log(`[AutoAssign] Aplicando limite de ${effectiveLimit} conversas`);
    } else {
      console.log(`[AutoAssign] *** PROCESSANDO TODAS AS CONVERSAS SEM LIMITE ***`);
    }

    const { data: conversations, error: convError } = await query;

    if (convError) {
      console.error('[AutoAssign] Erro ao buscar conversas:', convError);
      throw convError;
    }

    console.log(`[AutoAssign] Conversas carregadas para processar: ${conversations?.length || 0}`);

    const results: AssignmentResult[] = [];
    const userCounts: Record<string, number> = {};
    
    // Estatísticas detalhadas
    let statsNoPattern = 0;
    let statsUserNotFound = 0;
    let statsAssigned = 0;
    let statsSkippedTestMode = 0;
    let statsErrors = 0;

    // Função para encontrar usuário pelo nome no padrão da mensagem
    const findUser = (patternName: string): UserInfo | null => {
      // 1. Tentar match exato
      if (userMap[patternName]) {
        return userMap[patternName];
      }

      // 2. Tentar match normalizado
      const normalizedPattern = normalizeName(patternName);
      if (userMapNormalized[normalizedPattern]) {
        return userMapNormalized[normalizedPattern];
      }

      // 3. Extrair primeiro nome (ex: "RAFIK - SAC" -> "RAFIK")
      const firstName = extractFirstName(patternName);
      if (userMap[firstName]) {
        return userMap[firstName];
      }
      
      const normalizedFirstName = normalizeName(firstName);
      if (userMapNormalized[normalizedFirstName]) {
        return userMapNormalized[normalizedFirstName];
      }

      // 4. Busca parcial - verificar se algum usuário cadastrado corresponde
      for (const [key, info] of Object.entries(userMapNormalized)) {
        if (normalizedPattern.includes(key) || key.includes(normalizedPattern)) {
          return info;
        }
      }

      return null;
    };

    // Para cada conversa, buscar a última mensagem com padrão de usuário
    let processedIndex = 0;
    for (const conv of conversations || []) {
      processedIndex++;
      
      const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('content')
        .eq('conversation_id', conv.id)
        .eq('is_from_me', true)
        .not('content', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (msgError) {
        console.error(`[AutoAssign] [${processedIndex}/${conversations?.length}] Erro ao buscar mensagens para ${conv.id}:`, msgError);
        statsErrors++;
        continue;
      }

      // Encontrar a última mensagem com o padrão de usuário
      let foundPattern: string | null = null;
      for (const msg of messages || []) {
        const match = msg.content?.match(USER_PATTERN);
        if (match) {
          foundPattern = match[1];
          break;
        }
      }

      const contactName = (conv.contact as any)?.full_name || 'Desconhecido';

      if (!foundPattern) {
        // Log apenas a cada 100 para não poluir
        if (processedIndex % 100 === 0 || processedIndex <= 10) {
          console.log(`[AutoAssign] [${processedIndex}/${conversations?.length}] ${contactName}: Sem padrão *Nome*: nas mensagens`);
        }
        statsNoPattern++;
        continue;
      }

      // Encontrar o usuário correspondente
      const userInfo = findUser(foundPattern);
      
      if (!userInfo) {
        console.log(`[AutoAssign] [${processedIndex}/${conversations?.length}] ${contactName}: Padrão encontrado "*${foundPattern}*:" mas usuário não existe no sistema`);
        statsUserNotFound++;
        results.push({
          conversationId: conv.id,
          contactName,
          userName: foundPattern,
          userId: '',
          success: false,
          error: 'Usuário não encontrado no sistema',
        });
        continue;
      }

      // Contar atribuições por usuário (para modo teste: 1 por usuário)
      if (mode === 'test') {
        if (userCounts[userInfo.fullName] && userCounts[userInfo.fullName] >= 1) {
          statsSkippedTestMode++;
          continue;
        }
      }

      // Se for modo preview, não atualizar
      if (mode === 'preview') {
        console.log(`[AutoAssign] [${processedIndex}/${conversations?.length}] ${contactName} -> ${userInfo.fullName} (preview)`);
        results.push({
          conversationId: conv.id,
          contactName,
          userName: userInfo.fullName,
          userId: userInfo.userId,
          success: true,
        });
        userCounts[userInfo.fullName] = (userCounts[userInfo.fullName] || 0) + 1;
        statsAssigned++;
        continue;
      }

      // Atualizar conversa
      const { error: updateError } = await supabase
        .from('conversations')
        .update({
          assigned_to: userInfo.userId,
          department_id: userInfo.departmentId,
        })
        .eq('id', conv.id);

      if (updateError) {
        console.error(`[AutoAssign] [${processedIndex}/${conversations?.length}] Erro ao atribuir ${conv.id}:`, updateError);
        statsErrors++;
        results.push({
          conversationId: conv.id,
          contactName,
          userName: userInfo.fullName,
          userId: userInfo.userId,
          success: false,
          error: updateError.message,
        });
        continue;
      }

      console.log(`[AutoAssign] [${processedIndex}/${conversations?.length}] ✓ ${contactName} -> ${userInfo.fullName}`);
      statsAssigned++;
      results.push({
        conversationId: conv.id,
        contactName,
        userName: userInfo.fullName,
        userId: userInfo.userId,
        success: true,
      });
      userCounts[userInfo.fullName] = (userCounts[userInfo.fullName] || 0) + 1;
    }

    // Resumo detalhado
    console.log(`[AutoAssign] ========== ESTATÍSTICAS ==========`);
    console.log(`[AutoAssign] Total no banco (não atribuídas): ${totalUnassignedCount}`);
    console.log(`[AutoAssign] Conversas processadas: ${conversations?.length || 0}`);
    console.log(`[AutoAssign] - Sem padrão *Nome*: ${statsNoPattern}`);
    console.log(`[AutoAssign] - Padrão encontrado mas usuário não existe: ${statsUserNotFound}`);
    console.log(`[AutoAssign] - Atribuídas com sucesso: ${statsAssigned}`);
    console.log(`[AutoAssign] - Puladas (modo teste): ${statsSkippedTestMode}`);
    console.log(`[AutoAssign] - Erros: ${statsErrors}`);
    console.log(`[AutoAssign] Por usuário: ${JSON.stringify(userCounts)}`);
    console.log(`[AutoAssign] ========== FIM ==========`);

    const summary = {
      totalInDatabase: totalUnassignedCount || 0,
      totalProcessed: conversations?.length || 0,
      noPatternFound: statsNoPattern,
      userNotFound: statsUserNotFound,
      successful: statsAssigned,
      skippedTestMode: statsSkippedTestMode,
      errors: statsErrors,
      byUser: userCounts,
      mode,
      availableUsers: users?.map(u => u.full_name).filter(Boolean) || [],
    };

    return new Response(
      JSON.stringify({ success: true, summary, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[AutoAssign] Erro fatal:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
