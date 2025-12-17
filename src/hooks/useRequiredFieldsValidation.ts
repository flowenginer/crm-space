import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserDepartments } from '@/hooks/useUserDepartments';
import { AVAILABLE_FIELDS, type AvailableFieldKey } from './useRequiredFieldsRules';

interface Contact {
  id: string;
  negotiated_value?: number | null;
  lead_status?: string | null;
  segment_id?: string | null;
  assigned_to?: string | null; // owner_agent
}

interface ValidationResult {
  isValid: boolean;
  missingFields: { key: string; label: string }[];
  requiredFields: string[];
  isLoading: boolean;
}

// Hook para buscar regras aplicáveis ao usuário atual
function useApplicableRules() {
  const { profile } = useAuth();
  const { data: userDepartments } = useUserDepartments(profile?.id);
  
  return useQuery({
    queryKey: ['required-fields-rules-applicable', profile?.id, userDepartments?.map(d => d.department_id)],
    queryFn: async () => {
      if (!profile?.id) return [];
      
      const departmentIds = userDepartments?.map(d => d.department_id) || [];
      
      // Buscar regras: por usuário específico OU por departamento do usuário
      const { data, error } = await supabase
        .from('required_fields_rules')
        .select('*')
        .eq('is_enabled', true)
        .or(`user_id.eq.${profile.id}${departmentIds.length > 0 ? `,department_id.in.(${departmentIds.join(',')})` : ''}`);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.id,
  });
}

// Função para obter campos obrigatórios aplicáveis
function getRequiredFieldsForUser(rules: any[], userId: string, departmentIds: string[]): string[] {
  // Prioridade: regra específica do usuário > regra do departamento
  const userRule = rules.find(r => r.user_id === userId);
  if (userRule) {
    return userRule.required_fields || [];
  }
  
  // Se não há regra específica do usuário, verificar departamentos
  const departmentRule = rules.find(r => 
    r.department_id && departmentIds.includes(r.department_id)
  );
  if (departmentRule) {
    return departmentRule.required_fields || [];
  }
  
  return [];
}

// Função para validar se um contato tem todos os campos preenchidos
function validateContactFields(contact: Contact | null, requiredFields: string[]): { key: string; label: string }[] {
  if (!contact || requiredFields.length === 0) return [];
  
  const missing: { key: string; label: string }[] = [];
  
  for (const fieldKey of requiredFields) {
    const fieldDef = AVAILABLE_FIELDS.find(f => f.key === fieldKey);
    if (!fieldDef) continue;
    
    let isFilled = false;
    
    switch (fieldKey) {
      case 'negotiated_value':
        isFilled = contact.negotiated_value !== null && contact.negotiated_value !== undefined && contact.negotiated_value > 0;
        break;
      case 'lead_status':
        isFilled = !!contact.lead_status && contact.lead_status.trim() !== '';
        break;
      case 'segment_id':
        isFilled = !!contact.segment_id;
        break;
      case 'owner_agent':
        isFilled = !!contact.assigned_to;
        break;
    }
    
    if (!isFilled) {
      missing.push({ key: fieldKey, label: fieldDef.label });
    }
  }
  
  return missing;
}

// Hook principal para validar campos obrigatórios
export function useRequiredFieldsValidation(contact: Contact | null): ValidationResult {
  const { profile } = useAuth();
  const { data: userDepartments } = useUserDepartments(profile?.id);
  const { data: rules, isLoading } = useApplicableRules();
  
  const result = useMemo(() => {
    if (!profile?.id || !rules || rules.length === 0) {
      return {
        isValid: true,
        missingFields: [],
        requiredFields: [],
        isLoading,
      };
    }
    
    const departmentIds = userDepartments?.map(d => d.department_id) || [];
    const requiredFields = getRequiredFieldsForUser(rules, profile.id, departmentIds);
    
    if (requiredFields.length === 0) {
      return {
        isValid: true,
        missingFields: [],
        requiredFields: [],
        isLoading,
      };
    }
    
    const missingFields = validateContactFields(contact, requiredFields);
    
    return {
      isValid: missingFields.length === 0,
      missingFields,
      requiredFields,
      isLoading,
    };
  }, [profile?.id, rules, userDepartments, contact, isLoading]);
  
  return result;
}

// Hook para verificar se o usuário tem alguma regra de campos obrigatórios
export function useHasRequiredFieldsRule(): boolean {
  const { data: rules, isLoading } = useApplicableRules();
  
  if (isLoading || !rules) return false;
  return rules.length > 0;
}
