import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Regex para extrair nome do usuário do padrão *Nome*: ou *NOME - SETOR*:
const USER_PATTERN = /^\*([^*]+)\*:/;

const BATCH_SIZE = 50; // Reduzido para processar mais rápido com batch de mensagens
const MAX_EXECUTION_TIME_MS = 55000; // 55 segundos máximo

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
  patternFound?: string;
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

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { mode = 'preview', limit, action, startOffset = 0 } = await req.json().catch(() => ({}));
    
    console.log(`[AutoAssign] ========== INÍCIO ==========`);
    console.log(`[AutoAssign] Modo: ${mode}, Limite: ${limit || 'SEM LIMITE'}, Ação: ${action || 'assign'}, Offset inicial: ${startOffset}`);

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
    const allUserNames: Set<string> = new Set();

    for (const user of users || []) {
      if (!user.full_name) continue;
      
      const userInfo: UserInfo = {
        userId: user.id,
        departmentId: user.department_id,
        fullName: user.full_name
      };

      allUserNames.add(user.full_name);

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

    // Contar total de conversas não atribuídas no banco
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

    const results: AssignmentResult[] = [];
    const userCounts: Record<string, number> = {};
    
    // Estatísticas detalhadas
    let statsNoPattern = 0;
    let statsUserNotFound = 0;
    let statsAssigned = 0;
    let statsSkippedTestMode = 0;
    let statsErrors = 0;
    let totalProcessed = 0;
    let stoppedByTimeout = false;
    let stoppedByTestComplete = false;
    
    // Estatísticas extras para debug
    const unrecognizedPatterns: Record<string, number> = {};
    const conversationsWithoutPattern: string[] = [];

    // ========== MODO TESTE: Encontrar 1 para cada usuário ==========
    if (mode === 'test') {
      console.log(`[AutoAssign] MODO TESTE: Buscando 1 conversa para cada um dos ${allUserNames.size} usuários`);
      
      const usersWithAssignment: Set<string> = new Set();
      let offset = startOffset;
      
      // Continuar até encontrar 1 para cada usuário OU processar todas as conversas
      while (usersWithAssignment.size < allUserNames.size) {
        // Verificar timeout
        if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
          console.log(`[AutoAssign] Timeout atingido após ${totalProcessed} conversas processadas`);
          stoppedByTimeout = true;
          break;
        }

        // Buscar próximo batch de conversas
        const { data: conversations, error: convError } = await supabase
          .from('conversations')
          .select('id, contact:contacts(id, full_name)')
          .is('assigned_to', null)
          .eq('status', 'open')
          .order('last_message_at', { ascending: false })
          .range(offset, offset + BATCH_SIZE - 1);

        if (convError) {
          console.error('[AutoAssign] Erro ao buscar conversas:', convError);
          throw convError;
        }

        if (!conversations || conversations.length === 0) {
          console.log(`[AutoAssign] Fim das conversas após ${totalProcessed} processadas`);
          break;
        }

        console.log(`[AutoAssign] Batch ${Math.floor(offset / BATCH_SIZE) + 1}: Buscando mensagens de ${conversations.length} conversas...`);

        // ⚡ OTIMIZAÇÃO: Buscar mensagens de TODAS as conversas do batch de uma vez
        const conversationIds = conversations.map(c => c.id);
        const { data: allMessages, error: msgBatchError } = await supabase
          .from('messages')
          .select('conversation_id, content')
          .in('conversation_id', conversationIds)
          .eq('is_from_me', true)
          .not('content', 'is', null)
          .order('created_at', { ascending: false });

        if (msgBatchError) {
          console.error('[AutoAssign] Erro ao buscar mensagens em batch:', msgBatchError);
          statsErrors += conversations.length;
          offset += BATCH_SIZE;
          continue;
        }

        // Agrupar mensagens por conversa
        const messagesByConversation: Record<string, string[]> = {};
        for (const msg of allMessages || []) {
          if (!messagesByConversation[msg.conversation_id]) {
            messagesByConversation[msg.conversation_id] = [];
          }
          // Limitar a 30 mensagens por conversa para performance
          if (messagesByConversation[msg.conversation_id].length < 30) {
            messagesByConversation[msg.conversation_id].push(msg.content);
          }
        }

        for (const conv of conversations) {
          totalProcessed++;

          // Se todos os usuários já têm 1 conversa, parar
          if (usersWithAssignment.size >= allUserNames.size) {
            stoppedByTestComplete = true;
            console.log(`[AutoAssign] ✓ Todos os ${allUserNames.size} usuários têm pelo menos 1 conversa atribuída!`);
            break;
          }

          const messages = messagesByConversation[conv.id] || [];
          const contactName = (conv.contact as any)?.full_name || 'Desconhecido';

          // Encontrar padrão *Nome*: nas mensagens
          let foundPattern: string | null = null;
          for (const content of messages) {
            const match = content?.match(USER_PATTERN);
            if (match) {
              foundPattern = match[1];
              break;
            }
          }

          if (!foundPattern) {
            statsNoPattern++;
            continue;
          }

          const userInfo = findUser(foundPattern);
          
          if (!userInfo) {
            statsUserNotFound++;
            unrecognizedPatterns[foundPattern] = (unrecognizedPatterns[foundPattern] || 0) + 1;
            continue;
          }

          // Se este usuário JÁ tem uma conversa atribuída neste teste, pular
          if (usersWithAssignment.has(userInfo.fullName)) {
            statsSkippedTestMode++;
            continue;
          }

          // Atribuir a conversa
          const { error: updateError } = await supabase
            .from('conversations')
            .update({
              assigned_to: userInfo.userId,
              department_id: userInfo.departmentId,
            })
            .eq('id', conv.id);

          if (updateError) {
            statsErrors++;
            results.push({
              conversationId: conv.id,
              contactName,
              userName: userInfo.fullName,
              userId: userInfo.userId,
              success: false,
              error: updateError.message,
              patternFound: foundPattern,
            });
            continue;
          }

          console.log(`[AutoAssign] ✓ ${contactName} -> ${userInfo.fullName} (${usersWithAssignment.size + 1}/${allUserNames.size} usuários)`);
          statsAssigned++;
          usersWithAssignment.add(userInfo.fullName);
          userCounts[userInfo.fullName] = 1;
          results.push({
            conversationId: conv.id,
            contactName,
            userName: userInfo.fullName,
            userId: userInfo.userId,
            success: true,
            patternFound: foundPattern,
          });
        }

        if (stoppedByTestComplete) break;
        offset += BATCH_SIZE;
      }

      // Log usuários que não tiveram conversas encontradas
      const usersWithoutAssignment = [...allUserNames].filter(name => !usersWithAssignment.has(name));
      if (usersWithoutAssignment.length > 0) {
        console.log(`[AutoAssign] Usuários SEM conversas encontradas: ${usersWithoutAssignment.join(', ')}`);
      }
    }
    // ========== MODO COMPLETO (full) ou PREVIEW: Processar em batches ==========
    else {
      console.log(`[AutoAssign] MODO ${mode.toUpperCase()}: Processando em batches de ${BATCH_SIZE}`);
      
      let offset = startOffset;
      let hasMore = true;
      
      while (hasMore) {
        // Verificar timeout
        if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
          console.log(`[AutoAssign] Timeout atingido após ${totalProcessed} conversas processadas. Próximo offset: ${offset}`);
          stoppedByTimeout = true;
          break;
        }

        // Buscar próximo batch de conversas
        const { data: conversations, error: convError } = await supabase
          .from('conversations')
          .select('id, contact:contacts(id, full_name)')
          .is('assigned_to', null)
          .eq('status', 'open')
          .order('last_message_at', { ascending: false })
          .range(offset, offset + BATCH_SIZE - 1);

        if (convError) {
          console.error('[AutoAssign] Erro ao buscar conversas:', convError);
          throw convError;
        }

        if (!conversations || conversations.length === 0) {
          hasMore = false;
          console.log(`[AutoAssign] Fim das conversas após ${totalProcessed} processadas`);
          break;
        }

        console.log(`[AutoAssign] Batch ${Math.floor(offset / BATCH_SIZE) + 1}: Buscando mensagens de ${conversations.length} conversas...`);

        // ⚡ OTIMIZAÇÃO: Buscar mensagens de TODAS as conversas do batch de uma vez
        const conversationIds = conversations.map(c => c.id);
        const { data: allMessages, error: msgBatchError } = await supabase
          .from('messages')
          .select('conversation_id, content')
          .in('conversation_id', conversationIds)
          .eq('is_from_me', true)
          .not('content', 'is', null)
          .order('created_at', { ascending: false });

        if (msgBatchError) {
          console.error('[AutoAssign] Erro ao buscar mensagens em batch:', msgBatchError);
          statsErrors += conversations.length;
          offset += BATCH_SIZE;
          continue;
        }

        // Agrupar mensagens por conversa
        const messagesByConversation: Record<string, string[]> = {};
        for (const msg of allMessages || []) {
          if (!messagesByConversation[msg.conversation_id]) {
            messagesByConversation[msg.conversation_id] = [];
          }
          // Limitar a 30 mensagens por conversa para performance
          if (messagesByConversation[msg.conversation_id].length < 30) {
            messagesByConversation[msg.conversation_id].push(msg.content);
          }
        }

        for (const conv of conversations) {
          totalProcessed++;

          const messages = messagesByConversation[conv.id] || [];
          const contactName = (conv.contact as any)?.full_name || 'Desconhecido';

          // Encontrar padrão *Nome*: nas mensagens
          let foundPattern: string | null = null;
          for (const content of messages) {
            const match = content?.match(USER_PATTERN);
            if (match) {
              foundPattern = match[1];
              break;
            }
          }

          if (!foundPattern) {
            statsNoPattern++;
            // Registrar algumas conversas sem padrão para debug (máximo 10)
            if (conversationsWithoutPattern.length < 10) {
              conversationsWithoutPattern.push(`${contactName} (${conv.id.substring(0,8)}...)`);
            }
            continue;
          }

          const userInfo = findUser(foundPattern);
          
          if (!userInfo) {
            statsUserNotFound++;
            unrecognizedPatterns[foundPattern] = (unrecognizedPatterns[foundPattern] || 0) + 1;
            results.push({
              conversationId: conv.id,
              contactName,
              userName: foundPattern,
              userId: '',
              success: false,
              error: 'Usuário não encontrado no sistema',
              patternFound: foundPattern,
            });
            continue;
          }

          // Se for modo preview, não atualizar
          if (mode === 'preview') {
            statsAssigned++;
            userCounts[userInfo.fullName] = (userCounts[userInfo.fullName] || 0) + 1;
            results.push({
              conversationId: conv.id,
              contactName,
              userName: userInfo.fullName,
              userId: userInfo.userId,
              success: true,
              patternFound: foundPattern,
            });
            continue;
          }

          // Modo full: Atualizar conversa
          const { error: updateError } = await supabase
            .from('conversations')
            .update({
              assigned_to: userInfo.userId,
              department_id: userInfo.departmentId,
            })
            .eq('id', conv.id);

          if (updateError) {
            statsErrors++;
            results.push({
              conversationId: conv.id,
              contactName,
              userName: userInfo.fullName,
              userId: userInfo.userId,
              success: false,
              error: updateError.message,
              patternFound: foundPattern,
            });
            continue;
          }

          if (totalProcessed % 100 === 0 || totalProcessed <= 10) {
            console.log(`[AutoAssign] [${totalProcessed}/${totalUnassignedCount}] ✓ ${contactName} -> ${userInfo.fullName}`);
          }
          
          statsAssigned++;
          userCounts[userInfo.fullName] = (userCounts[userInfo.fullName] || 0) + 1;
          results.push({
            conversationId: conv.id,
            contactName,
            userName: userInfo.fullName,
            userId: userInfo.userId,
            success: true,
            patternFound: foundPattern,
          });
        }

        offset += BATCH_SIZE;
        
        // Se pegou menos que o batch size, acabou
        if (conversations.length < BATCH_SIZE) {
          hasMore = false;
        }
      }
    }

    const elapsedTime = Date.now() - startTime;
    const nextOffset = startOffset + totalProcessed;

    // Resumo detalhado
    console.log(`[AutoAssign] ========== ESTATÍSTICAS ==========`);
    console.log(`[AutoAssign] Tempo de execução: ${(elapsedTime / 1000).toFixed(1)}s`);
    console.log(`[AutoAssign] Total no banco (não atribuídas): ${totalUnassignedCount}`);
    console.log(`[AutoAssign] Conversas processadas nesta execução: ${totalProcessed}`);
    console.log(`[AutoAssign] Offset inicial: ${startOffset} | Próximo offset: ${nextOffset}`);
    console.log(`[AutoAssign] - Sem padrão *Nome*: ${statsNoPattern} (${((statsNoPattern/totalProcessed)*100).toFixed(1)}%)`);
    console.log(`[AutoAssign] - Padrão encontrado mas usuário não existe: ${statsUserNotFound}`);
    console.log(`[AutoAssign] - Atribuídas com sucesso: ${statsAssigned}`);
    console.log(`[AutoAssign] - Puladas (já atribuído no teste): ${statsSkippedTestMode}`);
    console.log(`[AutoAssign] - Erros: ${statsErrors}`);
    console.log(`[AutoAssign] Por usuário: ${JSON.stringify(userCounts)}`);
    
    // Log padrões não reconhecidos
    if (Object.keys(unrecognizedPatterns).length > 0) {
      console.log(`[AutoAssign] Padrões NÃO reconhecidos (top 10):`);
      const topUnrecognized = Object.entries(unrecognizedPatterns)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      for (const [pattern, count] of topUnrecognized) {
        console.log(`[AutoAssign]   "${pattern}": ${count}x`);
      }
    }
    
    // Log conversas sem padrão
    if (conversationsWithoutPattern.length > 0) {
      console.log(`[AutoAssign] Exemplos de conversas sem padrão *Nome*: ${conversationsWithoutPattern.join(', ')}`);
    }
    
    if (stoppedByTimeout) console.log(`[AutoAssign] ⚠️ PARADO POR TIMEOUT - Execute novamente com startOffset: ${nextOffset}`);
    if (stoppedByTestComplete) console.log(`[AutoAssign] ✓ TESTE COMPLETO - todos os usuários atendidos`);
    console.log(`[AutoAssign] ========== FIM ==========`);

    const summary = {
      totalInDatabase: totalUnassignedCount || 0,
      totalProcessed,
      noPatternFound: statsNoPattern,
      userNotFound: statsUserNotFound,
      successful: statsAssigned,
      skippedTestMode: statsSkippedTestMode,
      errors: statsErrors,
      byUser: userCounts,
      mode,
      executionTimeMs: elapsedTime,
      stoppedByTimeout,
      stoppedByTestComplete,
      startOffset,
      nextOffset,
      canContinue: stoppedByTimeout && nextOffset < (totalUnassignedCount || 0),
      unrecognizedPatterns: Object.entries(unrecognizedPatterns)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {}),
      conversationsWithoutPatternExamples: conversationsWithoutPattern,
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
