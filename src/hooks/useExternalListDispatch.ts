import { useState, useCallback } from 'react';
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

// Match orders with CRM contacts
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
        const customerNameLower = order.customerName.toLowerCase();
        const nameParts = customerNameLower.split(' ').filter(p => p.length > 2);
        
        // Try to find a matching contact
        let bestMatch: typeof contacts[0] | null = null;
        let bestScore = 0;
        
        for (const contact of contacts || []) {
          const contactNameLower = contact.full_name.toLowerCase();
          
          // Exact match
          if (contactNameLower === customerNameLower) {
            bestMatch = contact;
            bestScore = 100;
            break;
          }
          
          // Partial match - all name parts present
          const matchingParts = nameParts.filter(part => contactNameLower.includes(part));
          const score = (matchingParts.length / nameParts.length) * 100;
          
          if (score > bestScore && score >= 60) { // At least 60% of name parts match
            bestMatch = contact;
            bestScore = score;
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
          });
        } else if (!bestMatch) {
          unmatched.push({
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            value: order.value,
          });
        }
      }
      
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
  const [shouldCancel, setShouldCancel] = useState(false);
  
  const execute = useCallback(async (config: DispatchConfig) => {
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
        const field = variableMapping[varIndex];
        let value = '';
        
        switch (field) {
          case 'firstName':
            value = extractFirstName(contact.customerName);
            break;
          case 'fullName':
            value = contact.customerName;
            break;
          case 'orderNumber':
            value = contact.orderNumber;
            break;
          case 'contactName':
            value = contact.contactName;
            break;
          case 'phone':
            value = contact.phone;
            break;
          default:
            value = '';
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
          console.error(`[Dispatch] Error sending to ${contact.phone}:`, result.error);
          setProgress(prev => ({ ...prev, errors: prev.errors + 1 }));
        }
      } catch (error) {
        console.error(`[Dispatch] Exception sending to ${contact.phone}:`, error);
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
