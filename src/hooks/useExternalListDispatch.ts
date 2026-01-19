import { useState, useCallback, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ExternalListOrder {
  orderNumber: string;
  customerName: string;
  value?: number;
  status?: string;
  date?: string;
  rawData: Record<string, string>;
}

export interface MatchedContact {
  orderId: string;
  orderNumber: string;
  customerName: string;
  contactId: string;
  contactName: string;
  phone: string;
  value?: number;
  rawData?: Record<string, string>;
  matchScore: number; // 0-100 confidence score
  matchType: 'exact' | 'high' | 'medium' | 'low'; // Match quality indicator
}

export interface UnmatchedOrder {
  orderNumber: string;
  customerName: string;
  value?: number;
}

// Parse HTML from Bling export
export function parseBlingHtml(html: string): ExternalListOrder[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const orders: ExternalListOrder[] = [];
  
  // Find all table rows (skip header)
  const rows = doc.querySelectorAll('table tr');
  
  rows.forEach((row, index) => {
    if (index === 0) return; // Skip header
    
    const cells = row.querySelectorAll('td');
    if (cells.length < 2) return;
    
    const orderNumber = cells[0]?.textContent?.trim() || '';
    const customerName = cells[1]?.textContent?.trim() || '';
    
    if (!orderNumber || !customerName) return;
    
    // Parse value if present
    let value: number | undefined;
    const valueCell = cells[2]?.textContent?.trim();
    if (valueCell) {
      const parsed = parseFloat(valueCell.replace(/[^\d,.-]/g, '').replace(',', '.'));
      if (!isNaN(parsed)) value = parsed;
    }
    
    const status = cells[3]?.textContent?.trim();
    const date = cells[4]?.textContent?.trim();
    
    orders.push({
      orderNumber,
      customerName,
      value,
      status,
      date,
      rawData: {
        orderNumber,
        customerName,
        value: valueCell || '',
        status: status || '',
        date: date || '',
      }
    });
  });
  
  return orders;
}

// Extract first name from full name
export function extractFirstName(fullName: string): string {
  return fullName.split(' ')[0] || fullName;
}

// Levenshtein distance calculation for fuzzy matching
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  
  if (m === 0) return n;
  if (n === 0) return m;
  
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  
  return dp[m][n];
}

// Calculate string similarity (0 to 1) using Levenshtein distance
function stringSimilarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

// Helper function to calculate name similarity with STRICT bilateral rules
function calculateNameSimilarity(orderName: string, contactName: string): { score: number; matchType: 'exact' | 'high' | 'medium' | 'low' } {
  const orderNameLower = orderName.toLowerCase().trim();
  const contactNameLower = contactName.toLowerCase().trim();
  
  // Exact match = 100 points
  if (orderNameLower === contactNameLower) {
    return { score: 100, matchType: 'exact' };
  }
  
  // Split into parts, keeping only meaningful words (>2 chars)
  const orderParts = orderNameLower.split(/[\s\/]+/).filter(p => p.length > 2);
  const contactParts = contactNameLower.split(/[\s\/]+/).filter(p => p.length > 2);
  
  // CRITICAL: Bilateral requirement - if order has 2+ words, contact MUST have 2+ words
  // This prevents matching "EDUARDO GRUBER" with just "Eduardo"
  if (orderParts.length >= 2 && contactParts.length < 2) {
    return { score: 0, matchType: 'low' };
  }
  
  // If order has multiple name parts, require at least 2 to match with fuzzy logic
  if (orderParts.length >= 2) {
    let exactMatches = 0;
    let fuzzyMatches = 0;
    
    for (const orderPart of orderParts) {
      let bestPartSimilarity = 0;
      
      for (const contactPart of contactParts) {
        // Exact part match
        if (orderPart === contactPart) {
          bestPartSimilarity = 1.0;
          break;
        }
        
        // Fuzzy match using Levenshtein (e.g., GRUBER vs GRUBE)
        const similarity = stringSimilarity(orderPart, contactPart);
        if (similarity > bestPartSimilarity) {
          bestPartSimilarity = similarity;
        }
      }
      
      if (bestPartSimilarity === 1.0) {
        exactMatches++;
      } else if (bestPartSimilarity >= 0.80) {
        // Accept fuzzy match if 80%+ similar (e.g., GRUBE/GRUBER = 83%)
        fuzzyMatches++;
      }
    }
    
    const totalGoodMatches = exactMatches + fuzzyMatches;
    
    // Require at least 2 good matches for composite names
    if (totalGoodMatches < 2) {
      return { score: 0, matchType: 'low' };
    }
    
    // Calculate score based on matching quality
    const matchRatio = totalGoodMatches / orderParts.length;
    const exactRatio = exactMatches / orderParts.length;
    
    // Score: weight exact matches higher than fuzzy
    const score = Math.round((exactRatio * 60 + matchRatio * 40));
    
    if (exactMatches >= 2 && matchRatio >= 0.8) {
      return { score: Math.max(score, 90), matchType: 'high' };
    }
    if (totalGoodMatches >= 2 && matchRatio >= 0.5) {
      return { score: Math.max(score, 75), matchType: 'medium' };
    }
    
    return { score: 0, matchType: 'low' };
  }
  
  // Single word order name: require very high similarity and exact first word match
  // This is very restrictive - single word matches are risky
  const orderFirst = orderParts[0] || '';
  const contactFirst = contactParts[0] || '';
  
  // For single-word names, require exact first word match
  if (orderFirst === contactFirst && orderFirst.length >= 4) {
    return { score: 60, matchType: 'medium' }; // Lower score for single-word match
  }
  
  // Fuzzy match on single word - only if very high similarity
  const similarity = stringSimilarity(orderFirst, contactFirst);
  if (similarity >= 0.90 && orderFirst.length >= 4) {
    return { score: 55, matchType: 'low' };
  }
  
  return { score: 0, matchType: 'low' };
}

// Match orders with CRM contacts - STRICT matching with confidence scores
export function useMatchContacts() {
  return useMutation({
    mutationFn: async (orders: ExternalListOrder[]): Promise<{
      matched: MatchedContact[];
      unmatched: UnmatchedOrder[];
    }> => {
      const matched: MatchedContact[] = [];
      const unmatched: UnmatchedOrder[] = [];
      const processedPhones = new Set<string>();
      
      // Get all contacts with phones
      const { data: contacts, error } = await supabase
        .from('contacts')
        .select('id, full_name, phone')
        .not('phone', 'is', null);
      
      if (error) throw error;
      
      for (const order of orders) {
        // Try to find a matching contact with strict rules
        let bestMatch: typeof contacts[0] | null = null;
        let bestScore = 0;
        let bestMatchType: 'exact' | 'high' | 'medium' | 'low' = 'low';
        
        for (const contact of contacts || []) {
          const { score, matchType } = calculateNameSimilarity(order.customerName, contact.full_name);
          
          // Only consider matches with score >= 70 (stricter threshold)
          if (score > bestScore && score >= 70) {
            bestMatch = contact;
            bestScore = score;
            bestMatchType = matchType;
          }
        }
        
        if (bestMatch && !processedPhones.has(bestMatch.phone)) {
          processedPhones.add(bestMatch.phone);
          matched.push({
            orderId: `order-${order.orderNumber}`,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            contactId: bestMatch.id,
            contactName: bestMatch.full_name,
            phone: bestMatch.phone,
            value: order.value,
            rawData: order.rawData,
            matchScore: bestScore,
            matchType: bestMatchType,
          });
        } else if (!bestMatch) {
          unmatched.push({
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            value: order.value,
          });
        }
      }
      
      // Sort matched by score (lowest first to highlight potential issues)
      matched.sort((a, b) => a.matchScore - b.matchScore);
      
      return { matched, unmatched };
    },
  });
}

// Fetch Meta templates
export function useMetaTemplates() {
  return useQuery({
    queryKey: ['meta-templates-for-dispatch'],
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

// Get connected Cloud API channels
export function useCloudApiChannels() {
  return useQuery({
    queryKey: ['cloudapi-channels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_channels')
        .select('id, name, phone, provider_id')
        .eq('status', 'connected')
        .eq('provider_id', 'cloudapi');
      
      if (error) throw error;
      return data || [];
    },
  });
}

// Get API keys for dispatch
export function useApiKeys() {
  return useQuery({
    queryKey: ['api-keys-for-dispatch'],
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

export interface DispatchProgress {
  total: number;
  sent: number;
  errors: number;
  current: string | null;
  status: 'idle' | 'running' | 'completed' | 'error' | 'cancelled';
}

export interface DispatchConfig {
  contacts: MatchedContact[];
  templateName: string;
  templateLanguage: string;
  channelId: string;
  apiKey: string;
  intervalSeconds: number;
  variableMapping: Record<string, string>; // e.g., { "1": "firstName", "2": "orderNumber" }
}

// Execute dispatch
export function useExecuteDispatch() {
  const [progress, setProgress] = useState<DispatchProgress>({
    total: 0,
    sent: 0,
    errors: 0,
    current: null,
    status: 'idle',
  });
  const cancelRef = useRef(false);
  
  const execute = useCallback(async (config: DispatchConfig) => {
    const { contacts, templateName, templateLanguage, channelId, apiKey, intervalSeconds, variableMapping } = config;
    
    setProgress({
      total: contacts.length,
      sent: 0,
      errors: 0,
      current: null,
      status: 'running',
    });
    cancelRef.current = false;
    
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    
    for (let i = 0; i < contacts.length; i++) {
      // Check cancellation using ref for immediate effect
      if (cancelRef.current) {
        setProgress(prev => ({ ...prev, status: 'cancelled' }));
        break;
      }
      
      const contact = contacts[i];
      setProgress(prev => ({ ...prev, current: contact.contactName }));
      
      // Build template components based on variable mapping
      const bodyParams: { type: string; text: string }[] = [];
      const sortedVars = Object.keys(variableMapping).sort((a, b) => parseInt(a) - parseInt(b));
      
      let hasEmptyRequiredParam = false;
      
      for (const varIndex of sortedVars) {
        const field = variableMapping[varIndex];
        let value = '';
        
        switch (field) {
          case 'firstName':
            value = extractFirstName(contact.customerName || contact.contactName || '');
            break;
          case 'fullName':
            value = contact.customerName || contact.contactName || '';
            break;
          case 'orderNumber':
            value = contact.orderNumber || '';
            break;
          case 'contactName':
            value = contact.contactName || contact.customerName || '';
            break;
          case 'phone':
            value = contact.phone || '';
            break;
          default:
            // Check if it's a rawData field from CSV/spreadsheet
            if (field && contact.rawData && contact.rawData[field]) {
              value = contact.rawData[field];
            }
            break;
        }
        
        // Validate: Meta requires non-empty text parameters
        if (!value || value.trim() === '') {
          console.warn(`[Dispatch] Empty value for variable {{${varIndex}}} (field: ${field}) for contact:`, contact.contactName);
          hasEmptyRequiredParam = true;
        }
        
        bodyParams.push({ type: 'text', text: value || '-' }); // Fallback to "-" to prevent Meta error
      }
      
      // Log warning if required param was empty
      if (hasEmptyRequiredParam) {
        console.warn(`[Dispatch] Contact ${contact.contactName} has empty template variables, using fallback values`);
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
          console.error(`[Dispatch] Error sending to ${contact.phone}:`, result.error);
          setProgress(prev => ({ ...prev, errors: prev.errors + 1 }));
        }
      } catch (error) {
        console.error(`[Dispatch] Exception sending to ${contact.phone}:`, error);
        setProgress(prev => ({ ...prev, errors: prev.errors + 1 }));
      }
      
      // Wait interval before next send (except for last one)
      if (i < contacts.length - 1 && !cancelRef.current) {
        await new Promise(resolve => setTimeout(resolve, intervalSeconds * 1000));
      }
    }
    
    setProgress(prev => ({
      ...prev,
      current: null,
      status: prev.status === 'cancelled' ? 'cancelled' : 'completed',
    }));
  }, []);
  
  const cancel = useCallback(() => {
    cancelRef.current = true;
    setProgress(prev => ({ ...prev, status: 'cancelled' }));
  }, []);
  
  const reset = useCallback(() => {
    setProgress({
      total: 0,
      sent: 0,
      errors: 0,
      current: null,
      status: 'idle',
    });
    cancelRef.current = false;
  }, []);
  
  return { progress, execute, cancel, reset };
}
