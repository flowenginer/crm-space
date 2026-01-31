import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/store/userStore';
import { normalizePhoneForStorage, getPhoneSearchVariations } from '@/utils/phone';
import { toast } from 'sonner';

// Types
export interface BulkUpdateRow {
  telefone: string;
  nomeContato?: string;
  valorNegociado?: number;
  qtdCamisas?: number;
  vendedor?: string;
  // Campos adicionais do contato
  cpfCnpj?: string;
  email?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  // Campos originais para exibição
  raw: Record<string, string>;
}

export interface BulkUpdateOptions {
  updateLeadStatus: boolean;
  updateNegotiatedValue: boolean;
  updateShirtQuantity: boolean;
  updateAssignee: boolean;
  targetLeadStatus: string;
}

export interface MatchedRow extends BulkUpdateRow {
  contactId: string | null;
  contactName: string | null;
  currentAssignee: string | null;
  matchedAgentId: string | null;
  matchedAgentName: string | null;
  matchStatus: 'found' | 'not_found' | 'duplicate';
  // Dados atuais do sistema para comparação
  currentValue: number | null;
  currentQuantity: number | null;
  currentLeadStatus: string | null;
  currentAssigneeName: string | null;
  // Controle por campo
  // Dados atuais adicionais
  currentCpfCnpj: string | null;
  currentEmail: string | null;
  currentBairro: string | null;
  currentCidade: string | null;
  currentEstado: string | null;
  // Controle por campo
  updateFields: {
    name: boolean;
    value: boolean;
    quantity: boolean;
    status: boolean;
    assignee: boolean;
    cpfCnpj: boolean;
    email: boolean;
    bairro: boolean;
    cidade: boolean;
    estado: boolean;
  };
}

export interface UpdateLogEntry {
  phone: string;
  contactName: string | null;
  success: boolean;
  error?: string;
  updatedFields: string[];
}

export interface BulkUpdateResult {
  total: number;
  updated: number;
  notFound: number;
  errors: number;
  summary: {
    totalValue: number;
    totalQuantity: number;
    byAgent: Record<string, number>;
  };
  log: UpdateLogEntry[];
}

interface ProfileCache {
  id: string;
  full_name: string;
}

// Normaliza string para comparação (remove acentos, lowercase)
function normalizeStr(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

// Remove sufixos numéricos do nome (ex: "SCARLET 07" -> "SCARLET")
function removeNumericSuffix(name: string): string {
  return name.replace(/\s+\d+$/, '').trim();
}

export function useBulkLeadUpdate() {
  const queryClient = useQueryClient();
  const { tenantId } = useUserStore();
  const [profiles, setProfiles] = useState<ProfileCache[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);

  // Carrega perfis de agentes
  const loadProfiles = async () => {
    if (!tenantId) return;
    setIsLoadingProfiles(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error loading profiles:', error);
    } finally {
      setIsLoadingProfiles(false);
    }
  };

  // Matching fuzzy de vendedor para perfil
  const findProfileByName = (name: string): ProfileCache | null => {
    if (!name) return null;
    
    const searchTerm = normalizeStr(removeNumericSuffix(name));
    
    for (const profile of profiles) {
      const profileName = normalizeStr(profile.full_name);
      
      // Exact match
      if (profileName === searchTerm) {
        return profile;
      }
      
      // Partial match
      if (profileName.includes(searchTerm) || searchTerm.includes(profileName)) {
        return profile;
      }
      
      // First name match
      const searchFirstName = searchTerm.split(/\s+/)[0];
      const profileFirstName = profileName.split(/\s+/)[0];
      if (searchFirstName === profileFirstName && searchFirstName.length >= 3) {
        return profile;
      }
    }
    
    return null;
  };

  // Processa dados brutos e faz matching com contatos
  const processAndMatch = async (rows: BulkUpdateRow[]): Promise<MatchedRow[]> => {
    if (!tenantId) return [];

    // Normalizar telefones
    const phonesToSearch: string[] = [];
    rows.forEach(row => {
      if (row.telefone) {
        const variations = getPhoneSearchVariations(row.telefone);
        variations.forEach(v => phonesToSearch.push(v));
      }
    });

    // Buscar contatos existentes COM dados adicionais para comparação
    const { data: contacts, error } = await supabase
      .from('contacts')
      .select('id, phone, full_name, assigned_to, negotiated_value, shirt_quantity, lead_status, cpf_cnpj, email, neighborhood, city, state')
      .eq('tenant_id', tenantId)
      .in('phone', [...new Set(phonesToSearch)]);

    if (error) {
      console.error('Error fetching contacts:', error);
      throw error;
    }

    // Buscar nomes dos assigned_to
    const assigneeIds = [...new Set(contacts?.filter(c => c.assigned_to).map(c => c.assigned_to) || [])];
    let assigneeMap = new Map<string, string>();
    if (assigneeIds.length > 0) {
      const { data: assignees } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', assigneeIds);
      assignees?.forEach(a => assigneeMap.set(a.id, a.full_name));
    }

    // Criar map de telefone -> contato
    const contactMap = new Map<string, typeof contacts[0]>();
    contacts?.forEach(contact => {
      contactMap.set(contact.phone, contact);
      // Adicionar variações sem código do país
      if (contact.phone.startsWith('55')) {
        contactMap.set(contact.phone.slice(2), contact);
      }
    });

    // Processar cada linha
    const matched: MatchedRow[] = rows.map(row => {
      const normalizedPhone = normalizePhoneForStorage(row.telefone);
      const variations = getPhoneSearchVariations(row.telefone);
      
      let foundContact: typeof contacts[0] | null = null;
      for (const variation of variations) {
        if (contactMap.has(variation)) {
          foundContact = contactMap.get(variation)!;
          break;
        }
      }

      // Match vendedor
      const matchedProfile = row.vendedor ? findProfileByName(row.vendedor) : null;

      // Dados atuais do sistema
      const currentValue = foundContact?.negotiated_value ?? null;
      const currentQuantity = foundContact?.shirt_quantity ?? null;
      const currentLeadStatus = foundContact?.lead_status ?? null;
      const currentAssigneeName = foundContact?.assigned_to 
        ? assigneeMap.get(foundContact.assigned_to) ?? null 
        : null;
      const currentCpfCnpj = foundContact?.cpf_cnpj ?? null;
      const currentEmail = foundContact?.email ?? null;
      const currentBairro = foundContact?.neighborhood ?? null;
      const currentCidade = foundContact?.city ?? null;
      const currentEstado = foundContact?.state ?? null;

      // Detectar diferenças para auto-marcar checkboxes
      const nameIsDifferent = row.nomeContato && foundContact?.full_name && 
        row.nomeContato.toLowerCase() !== foundContact.full_name.toLowerCase();
      const valueIsDifferent = row.valorNegociado !== undefined && row.valorNegociado !== currentValue;
      const quantityIsDifferent = row.qtdCamisas !== undefined && row.qtdCamisas !== currentQuantity;
      const assigneeIsDifferent = matchedProfile && matchedProfile.id !== foundContact?.assigned_to;
      const cpfCnpjIsDifferent = row.cpfCnpj && row.cpfCnpj !== currentCpfCnpj;
      const emailIsDifferent = row.email && row.email !== currentEmail;
      const bairroIsDifferent = row.bairro && row.bairro !== currentBairro;
      const cidadeIsDifferent = row.cidade && row.cidade !== currentCidade;
      const estadoIsDifferent = row.estado && row.estado !== currentEstado;

      return {
        ...row,
        telefone: normalizedPhone,
        contactId: foundContact?.id || null,
        contactName: foundContact?.full_name || null,
        currentAssignee: foundContact?.assigned_to || null,
        matchedAgentId: matchedProfile?.id || null,
        matchedAgentName: matchedProfile?.full_name || null,
        matchStatus: foundContact ? 'found' : 'not_found',
        // Dados atuais para comparação
        currentValue,
        currentQuantity,
        currentLeadStatus,
        currentAssigneeName,
        currentCpfCnpj,
        currentEmail,
        currentBairro,
        currentCidade,
        currentEstado,
        // Campos a atualizar (auto-marcados se diferentes)
        updateFields: {
          name: !!nameIsDifferent,
          value: valueIsDifferent,
          quantity: quantityIsDifferent,
          status: true, // Status sempre marcado por padrão
          assignee: !!assigneeIsDifferent,
          cpfCnpj: !!cpfCnpjIsDifferent,
          email: !!emailIsDifferent,
          bairro: !!bairroIsDifferent,
          cidade: !!cidadeIsDifferent,
          estado: !!estadoIsDifferent,
        },
      };
    });

    return matched;
  };

  // Mutation para executar atualização
  const updateMutation = useMutation({
    mutationFn: async ({
      rows,
      options,
    }: {
      rows: MatchedRow[];
      options: BulkUpdateOptions;
    }): Promise<BulkUpdateResult> => {
      const log: UpdateLogEntry[] = [];
      let updated = 0;
      let notFound = 0;
      let errors = 0;
      let totalValue = 0;
      let totalQuantity = 0;
      const byAgent: Record<string, number> = {};

      for (const row of rows) {
        if (!row.contactId) {
          notFound++;
          log.push({
            phone: row.telefone,
            contactName: null,
            success: false,
            error: 'Contato não encontrado',
            updatedFields: [],
          });
          continue;
        }

        try {
          const updateData: Record<string, any> = {
            updated_at: new Date().toISOString(),
          };
          const updatedFields: string[] = [];

          // Usar updateFields individual da linha em vez das opções globais
          const fieldSettings = row.updateFields;

          // Atualizar nome do contato
          if (fieldSettings.name && row.nomeContato) {
            updateData.full_name = row.nomeContato;
            updatedFields.push('nome');
          }

          // Atualizar valor negociado
          if (fieldSettings.value && row.valorNegociado !== undefined) {
            updateData.negotiated_value = row.valorNegociado;
            updatedFields.push('valor_negociado');
            totalValue += row.valorNegociado;
          }

          // Atualizar quantidade
          if (fieldSettings.quantity && row.qtdCamisas !== undefined) {
            updateData.shirt_quantity = row.qtdCamisas;
            updatedFields.push('qtd_camisas');
            totalQuantity += row.qtdCamisas;
          }

          // Atualizar status
          if (fieldSettings.status && options.targetLeadStatus) {
            updateData.lead_status = options.targetLeadStatus;
            updatedFields.push('lead_status');
          }

          // Atualizar vendedor (dual-field)
          if (fieldSettings.assignee && row.matchedAgentId) {
            updateData.assigned_to = row.matchedAgentId;
            updatedFields.push('assigned_to');
            
            // Contar por agente
            const agentName = row.matchedAgentName || 'Desconhecido';
            byAgent[agentName] = (byAgent[agentName] || 0) + 1;
          }

          // Atualizar CPF/CNPJ
          if (fieldSettings.cpfCnpj && row.cpfCnpj) {
            updateData.cpf_cnpj = row.cpfCnpj;
            updatedFields.push('cpf_cnpj');
          }

          // Atualizar E-mail
          if (fieldSettings.email && row.email) {
            updateData.email = row.email;
            updatedFields.push('email');
          }

          // Atualizar Bairro
          if (fieldSettings.bairro && row.bairro) {
            updateData.neighborhood = row.bairro;
            updatedFields.push('bairro');
          }

          // Atualizar Cidade
          if (fieldSettings.cidade && row.cidade) {
            updateData.city = row.cidade;
            updatedFields.push('cidade');
          }

          // Atualizar Estado
          if (fieldSettings.estado && row.estado) {
            updateData.state = row.estado;
            updatedFields.push('estado');
          }

          // Atualizar contato
          const { error: contactError } = await supabase
            .from('contacts')
            .update(updateData)
            .eq('id', row.contactId);

          if (contactError) throw contactError;

          // Sincronizar conversa ativa (dual-field requirement)
          if (fieldSettings.assignee && row.matchedAgentId) {
            await supabase
              .from('conversations')
              .update({
                assigned_to: row.matchedAgentId,
                updated_at: new Date().toISOString(),
              })
              .eq('contact_id', row.contactId)
              .in('status', ['open', 'pending']);
          }

          updated++;
          log.push({
            phone: row.telefone,
            contactName: row.contactName,
            success: true,
            updatedFields,
          });
        } catch (error: any) {
          errors++;
          log.push({
            phone: row.telefone,
            contactName: row.contactName,
            success: false,
            error: error.message,
            updatedFields: [],
          });
        }
      }

      return {
        total: rows.length,
        updated,
        notFound,
        errors,
        summary: {
          totalValue,
          totalQuantity,
          byAgent,
        },
        log,
      };
    },
    onSuccess: () => {
      // Invalidar queries para refletir mudanças
      queryClient.invalidateQueries({ queryKey: ['conversation-details'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['contacts-for-kanban'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Leads atualizados com sucesso!');
    },
    onError: (error: any) => {
      console.error('Bulk update error:', error);
      toast.error('Erro ao atualizar leads: ' + error.message);
    },
  });

  return {
    profiles,
    isLoadingProfiles,
    loadProfiles,
    findProfileByName,
    processAndMatch,
    updateLeads: updateMutation.mutate,
    updateLeadsAsync: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  };
}

// Auto-mapeamento de colunas do Bling
export function autoMapBlingColumns(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  
  headers.forEach(h => {
    const lower = h.toLowerCase().trim();
    
    // Telefone
    if (lower.includes('celular') || lower.includes('telefone') || lower.includes('fone')) {
      mapping.telefone = h;
    }
    
    // Nome do contato
    if (lower === 'nome' || lower === 'cliente' || lower === 'comprador' || 
        lower.includes('nome do cliente') || lower.includes('nome cliente') ||
        lower.includes('razao social') || lower === 'contato') {
      mapping.nomeContato = h;
    }
    
    // Quantidade - adicionar mais variações
    if (lower === 'qtd' || lower === 'qtde' || lower.includes('quantidade') || lower.includes('qty')) {
      mapping.qtdCamisas = h;
    }
    
    // Valor
    if (lower.includes('total') && lower.includes('pedido')) {
      mapping.valorNegociado = h;
    } else if (lower.includes('valor') && !mapping.valorNegociado) {
      mapping.valorNegociado = h;
    }
    
    // Vendedor
    if (lower.includes('vendedor') || lower.includes('agente') || lower.includes('responsavel')) {
      mapping.vendedor = h;
    }

    // CPF/CNPJ
    if (lower === 'cpf' || lower === 'cnpj' || lower === 'cpf/cnpj' || 
        lower.includes('cpf') || lower.includes('cnpj') || lower === 'documento') {
      mapping.cpfCnpj = h;
    }

    // E-mail
    if (lower === 'email' || lower === 'e-mail' || lower.includes('email')) {
      mapping.email = h;
    }

    // Bairro
    if (lower === 'bairro' || lower.includes('bairro')) {
      mapping.bairro = h;
    }

    // Cidade
    if (lower === 'cidade' || lower === 'municipio' || lower.includes('cidade')) {
      mapping.cidade = h;
    }

    // Estado/UF
    if (lower === 'estado' || lower === 'uf' || lower.includes('estado')) {
      mapping.estado = h;
    }
  });
  
  return mapping;
}

// Parse valor monetário brasileiro
export function parseBRLValue(value: string): number {
  if (!value) return 0;
  // Remove R$, espaços, pontos de milhar e converte vírgula para ponto
  const cleaned = value
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  return parseFloat(cleaned) || 0;
}

// Parse quantidade
export function parseQuantity(value: string): number {
  if (!value) return 0;
  return parseInt(value.replace(/\D/g, ''), 10) || 0;
}
