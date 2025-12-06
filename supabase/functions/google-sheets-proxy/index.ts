import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Headers que simulam um navegador para evitar bloqueios do Google
const browserHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/csv,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  'Cache-Control': 'no-cache',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { spreadsheetId, gid } = await req.json();
    
    if (!spreadsheetId) {
      throw new Error('spreadsheetId é obrigatório');
    }

    const sheetGid = gid || '0';
    console.log(`[Google Sheets Proxy] Fetching sheet: ${spreadsheetId}, gid: ${sheetGid}`);

    let csvText = '';
    let fetchSuccess = false;

    // Método 1: URL de exportação padrão
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${sheetGid}`;
    console.log(`[Google Sheets Proxy] Trying primary URL: ${csvUrl}`);
    
    try {
      const response = await fetch(csvUrl, { headers: browserHeaders });
      console.log(`[Google Sheets Proxy] Primary response status: ${response.status}`);
      
      if (response.ok) {
        csvText = await response.text();
        fetchSuccess = true;
        console.log(`[Google Sheets Proxy] Primary method succeeded, got ${csvText.length} chars`);
      } else {
        const errorBody = await response.text();
        console.log(`[Google Sheets Proxy] Primary method failed: ${response.status} - ${errorBody.substring(0, 200)}`);
      }
    } catch (primaryError) {
      console.error(`[Google Sheets Proxy] Primary method error:`, primaryError);
    }

    // Método 2: URL alternativa (gviz/tq)
    if (!fetchSuccess) {
      const altUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&gid=${sheetGid}`;
      console.log(`[Google Sheets Proxy] Trying alternative URL: ${altUrl}`);
      
      try {
        const altResponse = await fetch(altUrl, { headers: browserHeaders });
        console.log(`[Google Sheets Proxy] Alternative response status: ${altResponse.status}`);
        
        if (altResponse.ok) {
          csvText = await altResponse.text();
          fetchSuccess = true;
          console.log(`[Google Sheets Proxy] Alternative method succeeded, got ${csvText.length} chars`);
        } else {
          const altErrorBody = await altResponse.text();
          console.log(`[Google Sheets Proxy] Alternative method failed: ${altResponse.status} - ${altErrorBody.substring(0, 200)}`);
        }
      } catch (altError) {
        console.error(`[Google Sheets Proxy] Alternative method error:`, altError);
      }
    }

    // Método 3: URL pub (para planilhas publicadas na web)
    if (!fetchSuccess) {
      const pubUrl = `https://docs.google.com/spreadsheets/d/e/${spreadsheetId}/pub?output=csv&gid=${sheetGid}`;
      console.log(`[Google Sheets Proxy] Trying pub URL: ${pubUrl}`);
      
      try {
        const pubResponse = await fetch(pubUrl, { headers: browserHeaders });
        console.log(`[Google Sheets Proxy] Pub response status: ${pubResponse.status}`);
        
        if (pubResponse.ok) {
          csvText = await pubResponse.text();
          fetchSuccess = true;
          console.log(`[Google Sheets Proxy] Pub method succeeded, got ${csvText.length} chars`);
        }
      } catch (pubError) {
        console.error(`[Google Sheets Proxy] Pub method error:`, pubError);
      }
    }

    if (!fetchSuccess || !csvText) {
      throw new Error('Não foi possível acessar a planilha. Verifique se ela está compartilhada como "Qualquer pessoa com o link pode visualizar".');
    }

    // Verificar se recebemos HTML em vez de CSV (indica erro de permissão)
    if (csvText.trim().startsWith('<!DOCTYPE') || csvText.trim().startsWith('<html')) {
      console.log(`[Google Sheets Proxy] Received HTML instead of CSV - permission error`);
      throw new Error('A planilha não está pública. Vá em Compartilhar > Geral > Qualquer pessoa com o link pode visualizar.');
    }
    
    // Parse CSV to JSON
    const lines = csvText.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      throw new Error('Planilha vazia ou sem dados');
    }
    
    const headers = parseRow(lines[0]);
    console.log(`[Google Sheets Proxy] Headers found: ${headers.join(', ')}`);
    
    const rows = lines.slice(1).map(line => {
      const values = parseRow(line);
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = values[i] || '';
      });
      return obj;
    }).filter(row => Object.values(row).some(v => v));
    
    console.log(`[Google Sheets Proxy] Parsed ${rows.length} rows successfully`);
    
    return new Response(JSON.stringify({ headers, rows }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[Google Sheets Proxy] Error:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function parseRow(row: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (const char of row) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}
