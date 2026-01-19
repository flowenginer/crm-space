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

// Helper function to calculate name similarity with stricter rules
function calculateNameSimilarity(orderName: string, contactName: string): { score: number; matchType: 'exact' | 'high' | 'medium' | 'low' } {
  const orderNameLower = orderName.toLowerCase().trim();
  const contactNameLower = contactName.toLowerCase().trim();
  
  // Exact match = 100 points
  if (orderNameLower === contactNameLower) {
    return { score: 100, matchType: 'exact' };
  }
  
  const orderParts = orderNameLower.split(' ').filter(p => p.length > 2);
  const contactParts = contactNameLower.split(' ').filter(p => p.length > 2);
  
  // If order has multiple name parts, require at least 2 to match
  if (orderParts.length >= 2) {
    const matchingParts = orderParts.filter(part => 
      contactParts.some(cp => cp === part || cp.includes(part) || part.includes(cp))
    );
    
    // Require at least 2 parts to match for composite names
    if (matchingParts.length < 2) {
      return { score: 0, matchType: 'low' };
    }
    
    // Calculate score based on matching parts
    const score = Math.round((matchingParts.length / orderParts.length) * 100);
    
    if (score >= 90) return { score, matchType: 'high' };
    if (score >= 75) return { score, matchType: 'medium' };
    return { score: 0, matchType: 'low' }; // Below 75% threshold = no match
  }
  
  // Single word name: require very high similarity
  const orderFirst = orderParts[0] || '';
  const contactFirst = contactParts[0] || '';
  
  // For single-word names, require exact first word match
  if (orderFirst === contactFirst) {
    return { score: 70, matchType: 'medium' }; // Lower score for single-word match
  }
  
  // Partial match on single word - very restrictive
  if (orderFirst.length >= 4 && contactFirst.includes(orderFirst)) {
    return { score: 50, matchType: 'low' };
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
