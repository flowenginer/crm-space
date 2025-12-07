import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { normalizePhoneForStorage, getPhoneSearchVariations } from '@/utils/phone';
import { findTagByName, findOrCreateTag } from './useTags';

export interface ImportRow {
  nome: string;
  telefone: string;
  vendedor?: string;
  etiquetas?: string;
  statusLead?: string;
}

export interface ImportOptions {
  createMissingContacts: boolean;
  createMissingTags: boolean;
  updateLeadStatus: boolean;
  updateAssignee: boolean;
  onlyAssignIfEmpty: boolean;
}

export interface ImportLogEntry {
  type: 'success' | 'warning' | 'error' | 'info';
  message: string;
  row?: number;
}

export interface ImportResult {
  total: number;
  processed: number;
  created: number;
  updated: number;
  tagsCreated: number;
  tagsAssigned: number;
  skipped: number;
  errors: number;
  log: ImportLogEntry[];
}

export function useImportContacts() {
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  const findContactByPhone = async (phone: string) => {
    const variations = getPhoneSearchVariations(phone);
    
    for (const variation of variations) {
      const { data } = await supabase
        .from('contacts')
        .select('id, full_name, phone, assigned_to, lead_status')
        .eq('phone', variation)
        .maybeSingle();
      
      if (data) return data;
    }
    
    return null;
  };

  const findProfileByName = async (name: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .ilike('full_name', `%${name.trim()}%`)
      .maybeSingle();
    
    return data;
  };

  const findLeadStatusByName = async (statusName: string) => {
    const searchTerm = statusName.trim();
    
    // Remove numeric prefix like "01 - ", "02 - " for matching
    const cleanTerm = searchTerm.replace(/^\d+\s*[-–]\s*/, '').trim();
    
    // Try exact match first (full name)
    const { data: exactMatch } = await supabase
      .from('lead_statuses')
      .select('id, name')
      .ilike('name', searchTerm)
      .eq('is_active', true)
      .maybeSingle();
    
    if (exactMatch) return exactMatch;
    
    // Try match with cleaned term (without prefix)
    const { data: cleanMatch } = await supabase
      .from('lead_statuses')
      .select('id, name')
      .ilike('name', `%${cleanTerm}%`)
      .eq('is_active', true)
      .maybeSingle();
    
    if (cleanMatch) return cleanMatch;
    
    // Get all statuses and try to match by cleaning both sides
    const { data: allStatuses } = await supabase
      .from('lead_statuses')
      .select('id, name')
      .eq('is_active', true);
    
    if (allStatuses) {
      for (const status of allStatuses) {
        const cleanStatusName = status.name.replace(/^\d+\s*[-–]\s*/, '').trim().toLowerCase();
        if (cleanStatusName === cleanTerm.toLowerCase()) {
          return status;
        }
      }
    }
    
    return null;
  };

  const getContactTags = async (contactId: string): Promise<string[]> => {
    const { data } = await supabase
      .from('contact_tags')
      .select('tag_id')
      .eq('contact_id', contactId);
    
    return data?.map(t => t.tag_id) || [];
  };

  const addTagToContact = async (contactId: string, tagId: string) => {
    const { error } = await supabase
      .from('contact_tags')
      .insert({ contact_id: contactId, tag_id: tagId });
    
    if (error && !error.message.includes('duplicate')) {
      throw error;
    }
  };

  const processImport = useCallback(async (rows: ImportRow[], options: ImportOptions) => {
    setIsImporting(true);
    setProgress(0);
    
    console.log('[Import] Starting import with options:', options);
    console.log(`[Import] Total rows to process: ${rows.length}`);
    
    const importResult: ImportResult = {
      total: rows.length,
      processed: 0,
      created: 0,
      updated: 0,
      tagsCreated: 0,
      tagsAssigned: 0,
      skipped: 0,
      errors: 0,
      log: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 because row 1 is header and array is 0-indexed
      
      try {
        // Skip empty rows
        if (!row.telefone || row.telefone.trim() === '') {
          importResult.skipped++;
          continue;
        }

        // Normalize phone
        const normalizedPhone = normalizePhoneForStorage(row.telefone);
        
        // Find contact
        let contact = await findContactByPhone(normalizedPhone);
        
        if (!contact) {
          if (options.createMissingContacts && row.nome) {
            // Create new contact
            const { data: newContact, error } = await supabase
              .from('contacts')
              .insert({
                full_name: row.nome.trim(),
                phone: normalizedPhone,
              })
              .select('id, full_name, phone, assigned_to, lead_status')
              .single();
            
            if (error) throw error;
            contact = newContact;
            importResult.created++;
            importResult.log.push({
              type: 'info',
              message: `Contato criado: ${row.nome}`,
              row: rowNum,
            });
          } else {
            importResult.skipped++;
            importResult.log.push({
              type: 'warning',
              message: `Contato não encontrado: ${row.telefone}`,
              row: rowNum,
            });
            continue;
          }
        }

        let wasUpdated = false;

        // Process tags
        if (row.etiquetas && row.etiquetas.trim()) {
          const tagNames = row.etiquetas.split(',').map(t => t.trim()).filter(t => t);
          const existingTagIds = await getContactTags(contact.id);
          
          for (const tagName of tagNames) {
            try {
              let tag = await findTagByName(tagName);
              
              if (!tag && options.createMissingTags) {
                tag = await findOrCreateTag(tagName);
                importResult.tagsCreated++;
              }
              
              if (tag && !existingTagIds.includes(tag.id)) {
                await addTagToContact(contact.id, tag.id);
                importResult.tagsAssigned++;
                wasUpdated = true;
              }
            } catch (tagError: any) {
              importResult.log.push({
                type: 'warning',
                message: `Erro ao processar etiqueta "${tagName}": ${tagError.message}`,
                row: rowNum,
              });
            }
          }
        }

        // Update lead status (both in contacts AND conversations)
        if (options.updateLeadStatus && row.statusLead && row.statusLead.trim()) {
          console.log(`[Import] Row ${rowNum}: Looking for lead status "${row.statusLead}"`);
          const status = await findLeadStatusByName(row.statusLead);
          
          if (status) {
            console.log(`[Import] Row ${rowNum}: Found status "${status.name}" (id: ${status.id})`);
            
            // Update contact lead_status
            const { error: updateError } = await supabase
              .from('contacts')
              .update({ lead_status: status.name })
              .eq('id', contact.id);
            
            if (updateError) {
              console.error(`[Import] Row ${rowNum}: Error updating contact:`, updateError);
            } else {
              console.log(`[Import] Row ${rowNum}: Updated contact ${contact.id} to status "${status.name}"`);
            }
            
            // Also update lead_status in all open conversations for this contact
            await supabase
              .from('conversations')
              .update({ lead_status: status.name })
              .eq('contact_id', contact.id)
              .eq('status', 'open');
            
            wasUpdated = true;
          } else {
            console.warn(`[Import] Row ${rowNum}: Status NOT FOUND for "${row.statusLead}"`);
            importResult.log.push({
              type: 'warning',
              message: `Status de lead não encontrado: "${row.statusLead}"`,
              row: rowNum,
            });
          }
        } else if (row.statusLead && row.statusLead.trim() && !options.updateLeadStatus) {
          console.log(`[Import] Row ${rowNum}: Status "${row.statusLead}" ignored (updateLeadStatus option is OFF)`);
        }

        // Update assignee
        if (options.updateAssignee && row.vendedor && row.vendedor.trim()) {
          // Check if should assign: only if onlyAssignIfEmpty is false OR contact has no assignee
          const shouldAssign = !options.onlyAssignIfEmpty || !contact.assigned_to;
          
          if (shouldAssign) {
            const agent = await findProfileByName(row.vendedor);
            if (agent) {
              await supabase
                .from('contacts')
                .update({ assigned_to: agent.id })
                .eq('id', contact.id);
              wasUpdated = true;
            } else {
              importResult.log.push({
                type: 'warning',
                message: `Vendedor não encontrado: "${row.vendedor}"`,
                row: rowNum,
              });
            }
          } else {
            // Log that assignee was kept because contact already has one
            importResult.log.push({
              type: 'info',
              message: `Vendedor mantido (já tinha responsável): ${contact.full_name || row.nome}`,
              row: rowNum,
            });
          }
        }

        if (wasUpdated) {
          importResult.updated++;
          importResult.log.push({
            type: 'success',
            message: `Atualizado: ${contact.full_name || row.nome}`,
            row: rowNum,
          });
        }

        importResult.processed++;
      } catch (error: any) {
        importResult.errors++;
        importResult.log.push({
          type: 'error',
          message: `Erro na linha ${rowNum}: ${error.message}`,
          row: rowNum,
        });
      }

      // Update progress
      setProgress(Math.round(((i + 1) / rows.length) * 100));
    }

    setResult(importResult);
    setIsImporting(false);
    
    return importResult;
  }, []);

  const reset = useCallback(() => {
    setProgress(0);
    setResult(null);
  }, []);

  return {
    isImporting,
    progress,
    result,
    processImport,
    reset,
  };
}
