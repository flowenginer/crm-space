import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Space Sports tenant ID - única tenant que será processada
const SPACE_SPORTS_TENANT_ID = '00000000-0000-0000-0000-000000000001';

// Configuração do Google Gemini
const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`;

interface AudioMessage {
  id: string;
  media_url: string;
  conversation_id: string;
  created_at: string;
}

async function downloadAudio(mediaUrl: string): Promise<string | null> {
  try {
    console.log(`Baixando áudio de: ${mediaUrl}`);
    
    const response = await fetch(mediaUrl);
    if (!response.ok) {
      console.error(`Erro ao baixar áudio: ${response.status}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Converter para base64
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binary);
    
    console.log(`Áudio baixado: ${base64.length} caracteres em base64`);
    return base64;
  } catch (error) {
    console.error('Erro ao baixar áudio:', error);
    return null;
  }
}

async function transcribeWithGemini(audioBase64: string): Promise<string | null> {
  try {
    if (!GOOGLE_API_KEY) {
      console.error('GOOGLE_API_KEY não configurada');
      return null;
    }

    console.log('Enviando áudio para Gemini...');
    
    const payload = {
      contents: [{
        parts: [
          { 
            text: "Transcreva este áudio em português brasileiro. Retorne APENAS o texto falado, sem formatação, sem timestamps, sem identificação de falantes. Se não conseguir entender o áudio ou estiver vazio, retorne '[áudio inaudível]'." 
          },
          { 
            inline_data: { 
              mime_type: "audio/ogg", 
              data: audioBase64 
            } 
          }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
      }
    };

    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Erro do Gemini: ${response.status} - ${errorText}`);
      return null;
    }

    const data = await response.json();
    
    // Extrair texto da resposta
    const transcription = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (transcription) {
      console.log(`Transcrição obtida: ${transcription.substring(0, 100)}...`);
      return transcription.trim();
    }

    console.log('Nenhuma transcrição retornada pelo Gemini');
    return null;
  } catch (error) {
    console.error('Erro ao transcrever com Gemini:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Iniciando processamento de transcrição de áudios ===');
    console.log(`Tenant alvo: ${SPACE_SPORTS_TENANT_ID}`);

    // Verificar se a API key está configurada
    if (!GOOGLE_API_KEY) {
      console.error('GOOGLE_API_KEY não está configurada');
      return new Response(
        JSON.stringify({ error: 'GOOGLE_API_KEY não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente Supabase com service role para acesso total
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Buscar áudios pendentes APENAS do tenant Space Sports
    const { data: pendingAudios, error: fetchError } = await supabase
      .from('messages')
      .select('id, media_url, conversation_id, created_at')
      .eq('tenant_id', SPACE_SPORTS_TENANT_ID) // FILTRO CRÍTICO
      .eq('message_type', 'audio')
      .eq('transcription_status', 'pending')
      .not('media_url', 'is', null)
      .order('created_at', { ascending: true })
      .limit(20); // Processar 20 por vez para acelerar transcrição em massa

    if (fetchError) {
      console.error('Erro ao buscar áudios pendentes:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar áudios pendentes' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!pendingAudios || pendingAudios.length === 0) {
      console.log('Nenhum áudio pendente encontrado para Space Sports');
      return new Response(
        JSON.stringify({ message: 'Nenhum áudio pendente', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Encontrados ${pendingAudios.length} áudios pendentes para processar`);

    const results = {
      processed: 0,
      success: 0,
      failed: 0,
      details: [] as { id: string; status: string; error?: string }[]
    };

    // Processar cada áudio
    for (const audio of pendingAudios as AudioMessage[]) {
      console.log(`\n--- Processando áudio ${audio.id} ---`);
      
      // Marcar como em processamento
      await supabase
        .from('messages')
        .update({ transcription_status: 'processing' })
        .eq('id', audio.id);

      results.processed++;

      // Baixar o áudio
      const audioBase64 = await downloadAudio(audio.media_url);
      
      if (!audioBase64) {
        console.error(`Falha ao baixar áudio ${audio.id}`);
        await supabase
          .from('messages')
          .update({ 
            transcription_status: 'error',
            transcription: '[Erro ao baixar áudio]'
          })
          .eq('id', audio.id);
        
        results.failed++;
        results.details.push({ id: audio.id, status: 'error', error: 'download_failed' });
        continue;
      }

      // Transcrever com Gemini
      const transcription = await transcribeWithGemini(audioBase64);

      if (transcription) {
        await supabase
          .from('messages')
          .update({ 
            transcription_status: 'completed',
            transcription: transcription
          })
          .eq('id', audio.id);
        
        results.success++;
        results.details.push({ id: audio.id, status: 'completed' });
        console.log(`Áudio ${audio.id} transcrito com sucesso`);
      } else {
        await supabase
          .from('messages')
          .update({ 
            transcription_status: 'error',
            transcription: '[Erro na transcrição]'
          })
          .eq('id', audio.id);
        
        results.failed++;
        results.details.push({ id: audio.id, status: 'error', error: 'transcription_failed' });
        console.error(`Falha ao transcrever áudio ${audio.id}`);
      }

      // Pequena pausa entre requisições para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n=== Resumo do processamento ===');
    console.log(`Processados: ${results.processed}`);
    console.log(`Sucesso: ${results.success}`);
    console.log(`Falhas: ${results.failed}`);

    return new Response(
      JSON.stringify(results),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função transcribe-audio:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
