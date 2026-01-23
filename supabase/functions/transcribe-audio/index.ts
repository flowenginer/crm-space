import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import OpenAI from 'openai';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Space Sports tenant ID - única tenant que será processada
const SPACE_SPORTS_TENANT_ID = '00000000-0000-0000-0000-000000000001';

// Configuração do OpenAI Whisper
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

interface AudioMessage {
  id: string;
  media_url: string;
  conversation_id: string;
  created_at: string;
}

async function downloadAudio(mediaUrl: string): Promise<ArrayBuffer | null> {
  try {
    console.log(`Baixando áudio de: ${mediaUrl}`);
    
    const response = await fetch(mediaUrl);
    if (!response.ok) {
      console.error(`Erro ao baixar áudio: ${response.status}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    
    console.log(`Áudio baixado: ${arrayBuffer.byteLength} bytes`);
    return arrayBuffer;
  } catch (error) {
    console.error('Erro ao baixar áudio:', error);
    return null;
  }
}

async function transcribeWithWhisper(audioBuffer: ArrayBuffer): Promise<string | null> {
  try {
    if (!openai) {
      console.error('OpenAI client não inicializado - OPENAI_API_KEY não configurada');
      return null;
    }

    console.log('Enviando áudio para Whisper...');
    
    // Criar File a partir do ArrayBuffer
    const file = new File([audioBuffer], "audio.ogg", { type: "audio/ogg" });
    
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      language: "pt",
      response_format: "text",
    });
    
    if (transcription) {
      console.log(`Transcrição obtida: ${transcription.substring(0, 100)}...`);
      return transcription.trim();
    }

    console.log('Nenhuma transcrição retornada pelo Whisper');
    return null;
  } catch (error) {
    console.error('Erro ao transcrever com Whisper:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Iniciando processamento de transcrição de áudios (Whisper) ===');
    console.log(`Tenant alvo: ${SPACE_SPORTS_TENANT_ID}`);

    // Verificar se a API key está configurada
    if (!OPENAI_API_KEY) {
      console.error('OPENAI_API_KEY não está configurada');
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY não configurada' }),
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
      .limit(20); // Processar 20 por vez

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
      const audioBuffer = await downloadAudio(audio.media_url);
      
      if (!audioBuffer) {
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

      // Transcrever com Whisper
      const transcription = await transcribeWithWhisper(audioBuffer);

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
      await new Promise(resolve => setTimeout(resolve, 300));
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
