export interface ParsedWhatsAppData {
  nome?: string;
  cpf?: string;
  data_nascimento?: string;
  cep?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  email?: string;
  telefone?: string;
  tamanhos?: { PP: number; P: number; M: number; G: number; GG: number; XG: number };
  genero?: 'F' | 'M' | null;
  quantidade_total?: number;
}

function extractField(text: string, label: string): string | undefined {
  // Match "LABEL:" or "LABEL :" with content after it
  const regex = new RegExp(`${label}\\s*:\\s*(.+?)(?:\\n|$)`, 'i');
  const match = text.match(regex);
  return match?.[1]?.trim() || undefined;
}

function extractSizes(text: string): { PP: number; P: number; M: number; G: number; GG: number; XG: number } {
  const sizes = { PP: 0, P: 0, M: 0, G: 0, GG: 0, XG: 0 };
  const sizeKeys = ['PP', 'P', 'M', 'G', 'GG', 'XG'] as const;

  for (const size of sizeKeys) {
    // Match patterns like: PP(2), PP (2), PP( 2 ), PP 2, PP:2
    // Use word boundary for single-letter sizes to avoid matching inside other words
    const boundary = size.length === 1 ? `(?<![A-Z])${size}(?![A-Z])` : size;
    const patterns = [
      new RegExp(`${boundary}\\s*\\(\\s*(\\d+)\\s*\\)`, 'i'),
      new RegExp(`${boundary}\\s*:\\s*(\\d+)`, 'i'),
      new RegExp(`${boundary}\\s+(\\d+)(?!\\d)`, 'i'),
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const val = parseInt(match[1], 10);
        if (val > 0 && val < 1000) {
          sizes[size] = val;
          break;
        }
      }
    }
  }

  return sizes;
}

function extractGender(text: string): 'F' | 'M' | null {
  // Look for marked checkboxes or explicit selection
  const femininoMarked = /FEMININO\s*\(\s*[xX✓✔]\s*\)/i.test(text);
  const masculinoMarked = /MASCULINO\s*\(\s*[xX✓✔]\s*\)/i.test(text);

  if (femininoMarked && !masculinoMarked) return 'F';
  if (masculinoMarked && !femininoMarked) return 'M';

  // Check for standalone keywords
  if (/\bFEMININO\b/i.test(text) && !/\bMASCULINO\b/i.test(text)) return 'F';
  if (/\bMASCULINO\b/i.test(text) && !/\bFEMININO\b/i.test(text)) return 'M';

  return null;
}

export function parseWhatsAppResponse(text: string): ParsedWhatsAppData {
  const result: ParsedWhatsAppData = {};

  result.nome = extractField(text, 'NOME');
  result.cpf = extractField(text, 'CPF');
  result.data_nascimento = extractField(text, 'DATA DE NASCIMENTO') || extractField(text, 'NASCIMENTO');
  result.cep = extractField(text, 'CEP');
  result.endereco = extractField(text, 'ENDERE[ÇC]O') || extractField(text, 'RUA');
  result.numero = extractField(text, 'N[ºÚU°]?\\s*(?:DA\\s+)?CASA') || extractField(text, 'N[ÚUºu°]MERO');
  result.complemento = extractField(text, 'COMPLEMENTO');
  result.bairro = extractField(text, 'BAIRRO');
  result.cidade = extractField(text, 'CIDADE') || extractField(text, 'MUNIC[ÍI]PIO');
  result.estado = extractField(text, 'ESTADO') || extractField(text, 'UF');
  result.email = extractField(text, 'E-?MAIL');
  result.telefone = extractField(text, 'TELEFONE') || extractField(text, 'CELULAR') || extractField(text, 'FONE');

  // Extract sizes from the TAMANHOS section or full text
  const tamanhosSection = text.match(/TAMANHOS?\s*:?\s*(.*?)(?:\n\n|\n(?=[A-Z]{2,})|$)/is);
  const sizeText = tamanhosSection ? tamanhosSection[0] : text;
  const tamanhos = extractSizes(sizeText);
  const total = Object.values(tamanhos).reduce((sum, v) => sum + v, 0);

  if (total > 0) {
    result.tamanhos = tamanhos;
    result.quantidade_total = total;
  }

  result.genero = extractGender(text);

  // Clean up empty values
  for (const key of Object.keys(result) as (keyof ParsedWhatsAppData)[]) {
    if (result[key] === undefined || result[key] === '') {
      delete result[key];
    }
  }

  return result;
}
