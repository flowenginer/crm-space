import { useState, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';

// ============= TYPES =============

export interface SpreadsheetColumn {
  name: string;
  type: 'text' | 'number' | 'phone' | 'date' | 'unknown';
  sample: string;
  index: number;
}

export interface SpreadsheetData {
  headers: string[];
  columns: SpreadsheetColumn[];
  rows: Record<string, string>[];
  totalRows: number;
}

export interface ListRow {
  rowIndex: number;
  rawData: Record<string, string>;
}

export interface MatchedListContact {
  rowIndex: number;
  rawData: Record<string, string>;
  contactId: string;
  contactName: string;
  phone: string;
  matchedBy: 'phone' | 'name' | 'cpf';
  matchScore: number;
}

export interface UnmatchedListRow {
  rowIndex: number;
  rawData: Record<string, string>;
  identifier: string;
  searchedBy: 'phone' | 'name' | 'cpf';
}

export interface DispatchProgress {
  total: number;
  sent: number;
  errors: number;
  current: string | null;
  status: 'idle' | 'running' | 'completed' | 'error' | 'cancelled';
}

export interface ListDispatchConfig {
  contacts: MatchedListContact[];
  templateName: string;
  templateLanguage: string;
  channelId: string;
  apiKey: string;
  intervalSeconds: number;
  variableMapping: Record<string, string>; // { "1": "column_name", "2": "another_column" }
}

// ============= PARSING =============

// Detect column type based on sample values
function detectColumnType(values: string[]): SpreadsheetColumn['type'] {
  const samples = values.filter(v => v && v.trim()).slice(0, 10);
  if (samples.length === 0) return 'unknown';
  
  // Phone detection - Brazilian formats
  const phonePattern = /^[\d\s\-\(\)\+]+$/;
  const phoneCount = samples.filter(v => {
    const digits = v.replace(/\D/g, '');
    return phonePattern.test(v) && digits.length >= 10 && digits.length <= 13;
  }).length;
  if (phoneCount >= samples.length * 0.6) return 'phone';
  
  // Number detection
  const numberCount = samples.filter(v => {
    const cleaned = v.replace(/[R$\s.,]/g, '').replace(',', '.');
    return !isNaN(parseFloat(cleaned));
  }).length;
  if (numberCount >= samples.length * 0.8) return 'number';
  
  // Date detection
  const datePattern = /^\d{2}[\/\-]\d{2}[\/\-]\d{2,4}$|^\d{4}[\/\-]\d{2}[\/\-]\d{2}$/;
  const dateCount = samples.filter(v => datePattern.test(v.trim())).length;
  if (dateCount >= samples.length * 0.6) return 'date';
  
  return 'text';
}

// Universal spreadsheet parser (HTML, CSV, XLSX)
export async function parseSpreadsheet(file: File): Promise<SpreadsheetData> {
  const fileName = file.name.toLowerCase();
  
  if (fileName.endsWith('.html') || fileName.endsWith('.htm')) {
    return parseHtmlSpreadsheet(file);
  } else if (fileName.endsWith('.csv')) {
    return parseCsvSpreadsheet(file);
  } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return parseXlsxSpreadsheet(file);
  }
  
  // Try to parse as XLSX by default
  try {
    return await parseXlsxSpreadsheet(file);
  } catch {
    // Fallback to HTML
    return parseHtmlSpreadsheet(file);
  }
}

async function parseHtmlSpreadsheet(file: File): Promise<SpreadsheetData> {
  const text = await file.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');
  
  const rows = doc.querySelectorAll('table tr');
  if (rows.length === 0) {
    throw new Error('Nenhuma tabela encontrada no arquivo HTML');
  }
  
  // Get headers from first row
  const headerRow = rows[0];
  const headerCells = headerRow.querySelectorAll('th, td');
  const headers = Array.from(headerCells).map((cell, i) => 
    cell.textContent?.trim() || `Coluna ${i + 1}`
  );
  
  // Get data rows
  const dataRows: Record<string, string>[] = [];
  const columnValues: string[][] = headers.map(() => []);
  
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i].querySelectorAll('td');
    if (cells.length === 0) continue;
    
    const rowData: Record<string, string> = {};
    cells.forEach((cell, j) => {
      const value = cell.textContent?.trim() || '';
      if (headers[j]) {
        rowData[headers[j]] = value;
        columnValues[j]?.push(value);
      }
    });
    
    if (Object.values(rowData).some(v => v)) {
      dataRows.push(rowData);
    }
  }
  
  // Build column metadata
  const columns: SpreadsheetColumn[] = headers.map((name, index) => ({
    name,
    type: detectColumnType(columnValues[index] || []),
    sample: columnValues[index]?.[0] || '',
    index,
  }));
  
  return {
    headers,
    columns,
    rows: dataRows,
    totalRows: dataRows.length,
  };
}

async function parseCsvSpreadsheet(file: File): Promise<SpreadsheetData> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { 
    defval: '',
    raw: false,
  });
  
  if (data.length === 0) {
    throw new Error('Arquivo CSV vazio');
  }
  
  const headers = Object.keys(data[0]);
  const columnValues: string[][] = headers.map(() => []);
  
  data.forEach(row => {
    headers.forEach((h, i) => {
      columnValues[i].push(String(row[h] || ''));
    });
  });
  
  const columns: SpreadsheetColumn[] = headers.map((name, index) => ({
    name,
    type: detectColumnType(columnValues[index] || []),
    sample: columnValues[index]?.[0] || '',
    index,
  }));
  
  return {
    headers,
    columns,
    rows: data.map(row => {
      const cleanRow: Record<string, string> = {};
      headers.forEach(h => cleanRow[h] = String(row[h] || ''));
      return cleanRow;
    }),
    totalRows: data.length,
  };
}

async function parseXlsxSpreadsheet(file: File): Promise<SpreadsheetData> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { 
    defval: '',
    raw: false,
  });
  
  if (data.length === 0) {
    throw new Error('Arquivo Excel vazio');
  }
  
  const headers = Object.keys(data[0]);
  const columnValues: string[][] = headers.map(() => []);
  
  data.forEach(row => {
    headers.forEach((h, i) => {
      columnValues[i].push(String(row[h] || ''));
    });
  });
  
  const columns: SpreadsheetColumn[] = headers.map((name, index) => ({
    name,
    type: detectColumnType(columnValues[index] || []),
    sample: columnValues[index]?.[0] || '',
    index,
  }));
  
  return {
    headers,
    columns,
    rows: data.map(row => {
      const cleanRow: Record<string, string> = {};
      headers.forEach(h => cleanRow[h] = String(row[h] || ''));
      return cleanRow;
    }),
    totalRows: data.length,
  };
}

// ============= SMART MATCHING =============

// Normalize phone for comparison
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').replace(/^0+/, '');
}

// Calculate name similarity score (0-100) - Improved algorithm
function calculateNameSimilarity(name1: string, name2: string): number {
  const a = name1.toLowerCase().trim();
  const b = name2.toLowerCase().trim();
  
  // Exact match
  if (a === b) return 100;
  
  // One contains the other completely
  if (a.includes(b) || b.includes(a)) return 90;
  
  // Split into parts - keep words with >= 2 chars (not 3)
  const partsA = a.split(/\s+/).filter(p => p.length >= 2);
  const partsB = b.split(/\s+/).filter(p => p.length >= 2);
  
  if (partsA.length === 0 || partsB.length === 0) return 0;
  
  // Single word matching - check if CRM name starts with it or vice versa
  if (partsA.length === 1) {
    const singleWord = partsA[0];
    // Check if first word of CRM name starts with or matches the single word
    if (partsB[0].startsWith(singleWord) || singleWord.startsWith(partsB[0])) {
      return 85;
    }
    // Check if any part matches
    if (partsB.some(p => p === singleWord || p.startsWith(singleWord) || singleWord.startsWith(p))) {
      return 75;
    }
  }
  
  // Count matching parts with flexible comparison
  const matchingParts = partsA.filter(part => 
    partsB.some(partB => 
      partB.includes(part) || part.includes(partB) ||
      partB.startsWith(part) || part.startsWith(partB)
    )
  );
  
  // Score based on matches - use min length for better scoring with partial names
  const score = Math.round((matchingParts.length / Math.min(partsA.length, partsB.length)) * 100);
  return score;
}

// Smart match contacts - phone first, then name
export function useSmartMatchContacts() {
  return useMutation({
    mutationFn: async ({
      rows,
      identifierColumn,
      identifierType,
    }: {
      rows: Record<string, string>[];
      identifierColumn: string;
      identifierType: 'phone' | 'name' | 'cpf';
    }): Promise<{
      matched: MatchedListContact[];
      unmatched: UnmatchedListRow[];
    }> => {
      const matched: MatchedListContact[] = [];
      const unmatched: UnmatchedListRow[] = [];
      const processedContactIds = new Set<string>();
      
      // Get all contacts
      const { data: contacts, error } = await supabase
        .from('contacts')
        .select('id, full_name, phone, cpf_cnpj')
        .not('phone', 'is', null);
      
      if (error) throw error;
      
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];
        const identifier = row[identifierColumn]?.trim() || '';
        
        if (!identifier) continue;
        
        let bestMatch: typeof contacts[0] | null = null;
        let matchScore = 0;
        let matchedBy: 'phone' | 'name' | 'cpf' = identifierType;
        
        // Strategy 1: Try phone first if identifier looks like phone
        if (identifierType === 'phone') {
          const normalizedIdentifier = normalizePhone(identifier);
          if (normalizedIdentifier.length >= 10) {
            for (const contact of contacts || []) {
              const contactPhone = normalizePhone(contact.phone || '');
              
              // Exact match
              if (contactPhone === normalizedIdentifier || 
                  contactPhone.endsWith(normalizedIdentifier) ||
                  normalizedIdentifier.endsWith(contactPhone)) {
                bestMatch = contact;
                matchScore = 100;
                matchedBy = 'phone';
                break;
              }
            }
          }
        }
        
        // Strategy 2: Try CPF/CNPJ if selected
        if (!bestMatch && identifierType === 'cpf') {
          const normalizedCpf = identifier.replace(/\D/g, '');
          for (const contact of contacts || []) {
            const contactCpf = (contact.cpf_cnpj || '').replace(/\D/g, '');
            if (contactCpf && contactCpf === normalizedCpf) {
              bestMatch = contact;
              matchScore = 100;
              matchedBy = 'cpf';
              break;
            }
          }
        }
        
        // Strategy 3: Try name matching
        if (!bestMatch && (identifierType === 'name' || identifierType === 'phone')) {
          // If phone matching failed, try name as fallback
          const searchName = identifierType === 'phone' 
            ? (row[identifierColumn] || identifier)  // Use original value
            : identifier;
            
          for (const contact of contacts || []) {
            const score = calculateNameSimilarity(searchName, contact.full_name);
            if (score > matchScore && score >= 40) {
              bestMatch = contact;
              matchScore = score;
              matchedBy = 'name';
            }
          }
        }
        
        // Allow multiple rows to match same contact (for multiple orders per customer)
        if (bestMatch) {
          processedContactIds.add(bestMatch.id);
          matched.push({
            rowIndex,
            rawData: row,
            contactId: bestMatch.id,
            contactName: bestMatch.full_name,
            phone: bestMatch.phone || '',
            matchedBy,
            matchScore,
          });
        } else {
          unmatched.push({
            rowIndex,
            rawData: row,
            identifier,
            searchedBy: identifierType,
          });
        }
      }
      
      return { matched, unmatched };
    },
  });
}

// ============= DATA HOOKS =============

// Fetch Meta templates
export function useMetaTemplates() {
  return useQuery({
    queryKey: ['meta-templates-for-list-dispatch'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meta_message_templates')
        .select('id, name, components, status, language')
        .eq('status', 'APPROVED')
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
  });
}

// Get connected Cloud API channels - via cloudapi_configs relation
export function useCloudApiChannels() {
  return useQuery({
    queryKey: ['cloudapi-channels-list-dispatch'],
    queryFn: async () => {
      // Query channels that have active cloudapi_configs (the correct way to identify Cloud API channels)
      const { data: configsWithChannels, error: configError } = await supabase
        .from('cloudapi_configs')
        .select(`
          channel_id,
          whatsapp_channels!cloudapi_configs_channel_id_fkey(id, name, phone, status, provider_id)
        `)
        .eq('is_active', true);
      
      if (configError) throw configError;
      
      // Extract connected channels from configs
      const channels = (configsWithChannels || [])
        .map(config => config.whatsapp_channels)
        .filter(ch => ch && ch.status === 'connected')
        .map(ch => ({
          id: ch!.id,
          name: ch!.name,
          phone: ch!.phone,
          provider_id: ch!.provider_id,
        }));
      
      return channels;
    },
  });
}

// Get API keys for dispatch
export function useApiKeys() {
  return useQuery({
    queryKey: ['api-keys-list-dispatch'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integration_api_keys')
        .select('id, name, api_key, permissions')
        .eq('is_active', true);
      
      if (error) throw error;
      return data || [];
    },
  });
}

// ============= DISPATCH EXECUTION =============

export function extractFirstName(fullName: string): string {
  return fullName.split(' ')[0] || fullName;
}

export function useExecuteListDispatch() {
  const [progress, setProgress] = useState<DispatchProgress>({
    total: 0,
    sent: 0,
    errors: 0,
    current: null,
    status: 'idle',
  });
  const [shouldCancel, setShouldCancel] = useState(false);
  
  const execute = useCallback(async (config: ListDispatchConfig) => {
    const { contacts, templateName, templateLanguage, channelId, apiKey, intervalSeconds, variableMapping } = config;
    
    setProgress({
      total: contacts.length,
      sent: 0,
      errors: 0,
      current: null,
      status: 'running',
    });
    setShouldCancel(false);
    
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    
    for (let i = 0; i < contacts.length; i++) {
      if (shouldCancel) {
        setProgress(prev => ({ ...prev, status: 'cancelled' }));
        break;
      }
      
      const contact = contacts[i];
      setProgress(prev => ({ ...prev, current: contact.contactName }));
      
      // Build template components based on variable mapping
      const bodyParams: { type: string; text: string }[] = [];
      const sortedVars = Object.keys(variableMapping).sort((a, b) => parseInt(a) - parseInt(b));
      
      for (const varIndex of sortedVars) {
        const columnName = variableMapping[varIndex];
        let value = '';
        
        // Special mappings
        if (columnName === '__first_name__') {
          value = extractFirstName(contact.contactName);
        } else if (columnName === '__full_name__') {
          value = contact.contactName;
        } else if (columnName === '__phone__') {
          value = contact.phone;
        } else {
          // Use column from spreadsheet
          value = contact.rawData[columnName] || '';
        }
        
        bodyParams.push({ type: 'text', text: value });
      }
      
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/api-send-message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
          },
          body: JSON.stringify({
            channelId,
            phone: contact.phone,
            type: 'template',
            template: {
              name: templateName,
              language: templateLanguage,
              components: bodyParams.length > 0 ? [
                {
                  type: 'body',
                  parameters: bodyParams,
                },
              ] : [],
            },
          }),
        });
        
        const result = await response.json();
        
        if (result.success) {
          setProgress(prev => ({ ...prev, sent: prev.sent + 1 }));
        } else {
          console.error(`[ListDispatch] Error sending to ${contact.phone}:`, result.error);
          setProgress(prev => ({ ...prev, errors: prev.errors + 1 }));
        }
      } catch (error) {
        console.error(`[ListDispatch] Exception sending to ${contact.phone}:`, error);
        setProgress(prev => ({ ...prev, errors: prev.errors + 1 }));
      }
      
      // Wait interval before next send (except for last one)
      if (i < contacts.length - 1 && !shouldCancel) {
        await new Promise(resolve => setTimeout(resolve, intervalSeconds * 1000));
      }
    }
    
    setProgress(prev => ({
      ...prev,
      current: null,
      status: prev.status === 'cancelled' ? 'cancelled' : 'completed',
    }));
  }, [shouldCancel]);
  
  const cancel = useCallback(() => {
    setShouldCancel(true);
  }, []);
  
  const reset = useCallback(() => {
    setProgress({
      total: 0,
      sent: 0,
      errors: 0,
      current: null,
      status: 'idle',
    });
    setShouldCancel(false);
  }, []);
  
  return { progress, execute, cancel, reset };
}
