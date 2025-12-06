import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    console.log(`Fetching Google Sheet: ${spreadsheetId}, gid: ${gid || '0'}`);

    // Fetch CSV from Google Sheets
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid || '0'}`;
    const response = await fetch(csvUrl);
    
    if (!response.ok) {
      console.error(`Google Sheets response: ${response.status} ${response.statusText}`);
      throw new Error('Falha ao acessar a planilha. Verifique se está pública.');
    }
    
    const csvText = await response.text();
    console.log(`Received CSV with ${csvText.length} characters`);
    
    // Parse CSV to JSON
    const lines = csvText.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      throw new Error('Planilha vazia ou sem dados');
    }
    
    const headers = parseRow(lines[0]);
    console.log(`Headers found: ${headers.join(', ')}`);
    
    const rows = lines.slice(1).map(line => {
      const values = parseRow(line);
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = values[i] || '';
      });
      return obj;
    }).filter(row => Object.values(row).some(v => v));
    
    console.log(`Parsed ${rows.length} rows`);
    
    return new Response(JSON.stringify({ headers, rows }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Error:', errorMessage);
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
