import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { normalizePhoneForStorage, getPhoneSearchVariations } from '@/utils/phone';
import { getStateFromPhone } from '@/utils/ddd';
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
  // New fields
  defaultAssigneeId?: string;
  channelId?: string;
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
  statesIdentified: number;
  stateTagsAssigned: number;
  conversationsCreated: number;
  skipped: number;
  errors: number;
  log: ImportLogEntry[];
}

interface ContactCache {
  id: string;
  full_name: string | null;
  phone: string;
  assigned_to: string | null;
  lead_status: string | null;
}

interface ProfileCache {
  id: string;
  full_name: string | null;
}

interface TagCache {
  id: string;
  name: string;
}

interface LeadStatusCache {
  id: string;
  name: string;
}

export function useImportContacts() {
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

  const processImport = useCallback(async (rows: ImportRow[], options: ImportOptions) => {
    setIsImporting(true);
    setProgress(0);
    
    console.log('[Import] Starting optimized batch import with options:', options);
    console.log(`[Import] Total rows to process: ${rows.length}`);
    
    const importResult: ImportResult = {
      total: rows.length,
      processed: 0,
      created: 0,
      updated: 0,
      tagsCreated: 0,
      tagsAssigned: 0,
      statesIdentified: 0,
      stateTagsAssigned: 0,
      conversationsCreated: 0,
      skipped: 0,
      errors: 0,
      log: [],
    };

    try {
      // ===== PHASE 1: PRE-LOAD ALL DATA =====
      setProgress(5);
      
      // Normalize all phones first
      const normalizedPhones = rows.map(r => ({
        original: r.telefone,
        normalized: r.telefone ? normalizePhoneForStorage(r.telefone) : '',
      }));
      
      // Get all unique phone variations for lookup
      const allPhoneVariations = new Set<string>();
      normalizedPhones.forEach(p => {
        if (p.normalized) {
          getPhoneSearchVariations(p.normalized).forEach(v => allPhoneVariations.add(v));
        }
      });

      // Batch fetch existing contacts
      const { data: existingContactsData } = await supabase
        .from('contacts')
        .select('id, full_name, phone, assigned_to, lead_status')
        .in('phone', Array.from(allPhoneVariations));
      
      const contactsCache = new Map<string, ContactCache>();
      existingContactsData?.forEach(c => {
        contactsCache.set(c.phone, c);
      });

      setProgress(10);

      // Batch fetch profiles
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('is_active', true);
      
      const profilesCache = new Map<string, ProfileCache>();
      const profilesByName = new Map<string, ProfileCache>();
      profilesData?.forEach(p => {
        profilesCache.set(p.id, p);
        if (p.full_name) {
          profilesByName.set(p.full_name.toLowerCase().trim(), p);
        }
      });

      setProgress(15);

      // Batch fetch existing tags
      const { data: tagsData } = await supabase
        .from('tags')
        .select('id, name');
      
      const tagsCache = new Map<string, TagCache>();
      tagsData?.forEach(t => {
        tagsCache.set(t.name.toLowerCase().trim(), t);
      });

      // Batch fetch lead statuses
      const { data: leadStatusesData } = await supabase
        .from('lead_statuses')
        .select('id, name')
        .eq('is_active', true);
      
      const leadStatusesCache = new Map<string, LeadStatusCache>();
      leadStatusesData?.forEach(s => {
        const cleanName = s.name.replace(/^\d+\s*[-–]\s*/, '').trim().toLowerCase();
        leadStatusesCache.set(cleanName, s);
        leadStatusesCache.set(s.name.toLowerCase(), s);
      });

      setProgress(20);

      // Batch fetch existing contact_tags for all contacts
      const contactIds = Array.from(new Set(existingContactsData?.map(c => c.id) || []));
      const { data: existingContactTags } = contactIds.length > 0 
        ? await supabase
            .from('contact_tags')
            .select('contact_id, tag_id')
            .in('contact_id', contactIds)
        : { data: [] };
      
      const contactTagsMap = new Map<string, Set<string>>();
      existingContactTags?.forEach(ct => {
        if (!contactTagsMap.has(ct.contact_id)) {
          contactTagsMap.set(ct.contact_id, new Set());
        }
        contactTagsMap.get(ct.contact_id)!.add(ct.tag_id);
      });

      // If channel specified, fetch existing conversations
      let existingConversations = new Map<string, string>();
      if (options.channelId) {
        const { data: convData } = await supabase
          .from('conversations')
          .select('id, contact_id')
          .eq('channel_id', options.channelId)
          .in('contact_id', contactIds);
        
        convData?.forEach(c => {
          existingConversations.set(c.contact_id, c.id);
        });
      }

      setProgress(25);

      // ===== PHASE 2: PROCESS ROWS AND PREPARE BATCHES =====
      const contactsToCreate: any[] = [];
      const contactsToUpdate: { id: string; data: any }[] = [];
      const tagsToCreate: { name: string; color?: string }[] = [];
      const contactTagsToInsert: { contact_id: string; tag_id: string }[] = [];
      const conversationsToCreate: any[] = [];
      const conversationsToUpdate: { id: string; assigned_to: string }[] = [];
      const stateTagCache: Record<string, string> = {};

      // Helper to find profile by name (fuzzy)
      const findProfileByName = (name: string): ProfileCache | null => {
        const searchTerm = name.toLowerCase().trim();
        // Exact match first
        if (profilesByName.has(searchTerm)) {
          return profilesByName.get(searchTerm)!;
        }
        // Partial match
        for (const [key, profile] of profilesByName.entries()) {
          if (key.includes(searchTerm) || searchTerm.includes(key)) {
            return profile;
          }
        }
        return null;
      };

      // Helper to find lead status by name
      const findLeadStatus = (name: string): LeadStatusCache | null => {
        const cleanTerm = name.replace(/^\d+\s*[-–]\s*/, '').trim().toLowerCase();
        return leadStatusesCache.get(cleanTerm) || leadStatusesCache.get(name.toLowerCase()) || null;
      };

      // Track processed contacts for this batch
      const processedContacts = new Map<string, { id: string | null; isNew: boolean; name: string }>();

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;
        
        try {
          if (!row.telefone || row.telefone.trim() === '') {
            importResult.skipped++;
            continue;
          }

          const normalizedPhone = normalizePhoneForStorage(row.telefone);
          const identifiedState = getStateFromPhone(normalizedPhone);
          
          // Find existing contact
          let contact: ContactCache | null = null;
          const variations = getPhoneSearchVariations(normalizedPhone);
          for (const v of variations) {
            if (contactsCache.has(v)) {
              contact = contactsCache.get(v)!;
              break;
            }
          }
          
          if (!contact) {
            if (options.createMissingContacts && row.nome) {
              // Queue for batch creation
              const newContactData = {
                full_name: row.nome.trim(),
                phone: normalizedPhone,
                state: identifiedState || null,
                assigned_to: options.defaultAssigneeId || null,
              };
              
              contactsToCreate.push(newContactData);
              processedContacts.set(normalizedPhone, { id: null, isNew: true, name: row.nome });
              
              if (identifiedState) {
                importResult.statesIdentified++;
              }
              
              importResult.log.push({
                type: 'info',
                message: `Contato a criar: ${row.nome}${identifiedState ? ` (${identifiedState})` : ''}`,
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
          } else {
            processedContacts.set(normalizedPhone, { id: contact.id, isNew: false, name: contact.full_name || row.nome });
          }

          // Determine assignee
          let assigneeId: string | null = null;
          
          // Priority: defaultAssigneeId > vendedor column
          if (options.defaultAssigneeId) {
            assigneeId = options.defaultAssigneeId;
          } else if (options.updateAssignee && row.vendedor && row.vendedor.trim()) {
            const agent = findProfileByName(row.vendedor);
            if (agent) {
              assigneeId = agent.id;
            } else {
              importResult.log.push({
                type: 'warning',
                message: `Vendedor não encontrado: "${row.vendedor}"`,
                row: rowNum,
              });
            }
          }

          // For existing contacts, queue updates
          if (contact) {
            const updateData: any = {};
            let shouldUpdate = false;

            // Update lead status
            if (options.updateLeadStatus && row.statusLead && row.statusLead.trim()) {
              const status = findLeadStatus(row.statusLead);
              if (status) {
                updateData.lead_status = status.name;
                shouldUpdate = true;
              } else {
                importResult.log.push({
                  type: 'warning',
                  message: `Status de lead não encontrado: "${row.statusLead}"`,
                  row: rowNum,
                });
              }
            }

            // Update assignee
            if (assigneeId && options.updateAssignee) {
              const shouldAssign = !options.onlyAssignIfEmpty || !contact.assigned_to;
              if (shouldAssign) {
                updateData.assigned_to = assigneeId;
                shouldUpdate = true;
              }
            }

            if (shouldUpdate) {
              contactsToUpdate.push({ id: contact.id, data: updateData });
            }
          }

        } catch (error: any) {
          importResult.errors++;
          importResult.log.push({
            type: 'error',
            message: `Erro na linha ${rowNum}: ${error.message}`,
            row: rowNum,
          });
        }

        // Update progress for phase 2
        setProgress(25 + Math.round((i / rows.length) * 25));
      }

      // ===== PHASE 3: BATCH INSERT NEW CONTACTS =====
      setProgress(50);
      const batchSize = 100;
      const createdContactsMap = new Map<string, string>(); // phone -> id

      if (contactsToCreate.length > 0) {
        for (let i = 0; i < contactsToCreate.length; i += batchSize) {
          const batch = contactsToCreate.slice(i, i + batchSize);
          const { data: created, error } = await supabase
            .from('contacts')
            .insert(batch as any)
            .select('id, phone');
          
          if (error) {
            importResult.errors += batch.length;
            importResult.log.push({
              type: 'error',
              message: `Erro ao criar lote de contatos: ${error.message}`,
            });
          } else if (created) {
            created.forEach(c => {
              createdContactsMap.set(c.phone, c.id);
              contactsCache.set(c.phone, { ...c, full_name: null, assigned_to: null, lead_status: null });
            });
            importResult.created += created.length;
          }
          
          setProgress(50 + Math.round((i / contactsToCreate.length) * 10));
        }
      }

      // ===== PHASE 4: BATCH UPDATE EXISTING CONTACTS =====
      setProgress(60);
      
      for (const update of contactsToUpdate) {
        const { error } = await supabase
          .from('contacts')
          .update(update.data)
          .eq('id', update.id);
        
        if (error) {
          importResult.errors++;
        } else {
          importResult.updated++;
        }
      }

      // Also update conversations lead_status if needed
      const statusUpdates = contactsToUpdate.filter(u => u.data.lead_status);
      if (statusUpdates.length > 0) {
        for (const update of statusUpdates) {
          await supabase
            .from('conversations')
            .update({ lead_status: update.data.lead_status })
            .eq('contact_id', update.id)
            .eq('status', 'open');
        }
      }

      setProgress(65);

      // ===== PHASE 5: PROCESS TAGS =====
      // Process tags from rows (need contact IDs now)
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row.telefone) continue;
        
        const normalizedPhone = normalizePhoneForStorage(row.telefone);
        const variations = getPhoneSearchVariations(normalizedPhone);
        
        let contactId: string | null = null;
        for (const v of variations) {
          if (contactsCache.has(v)) {
            contactId = contactsCache.get(v)!.id;
            break;
          }
          if (createdContactsMap.has(v)) {
            contactId = createdContactsMap.get(v)!;
            break;
          }
        }
        
        if (!contactId) continue;

        const existingTags = contactTagsMap.get(contactId) || new Set();
        const identifiedState = getStateFromPhone(normalizedPhone);

        // Process explicit tags
        if (row.etiquetas && row.etiquetas.trim()) {
          const tagNames = row.etiquetas.split(',').map(t => t.trim()).filter(t => t);
          
          for (const tagName of tagNames) {
            const tagKey = tagName.toLowerCase().trim();
            let tag = tagsCache.get(tagKey);
            
            if (!tag && options.createMissingTags) {
              // Create tag
              const created = await findOrCreateTag(tagName);
              tag = { id: created.id, name: tagName };
              tagsCache.set(tagKey, tag);
              if (created.isNew) {
                importResult.tagsCreated++;
              }
            }
            
            if (tag && !existingTags.has(tag.id)) {
              contactTagsToInsert.push({ contact_id: contactId, tag_id: tag.id });
              existingTags.add(tag.id);
              importResult.tagsAssigned++;
            }
          }
        }

        // Process state tag
        if (identifiedState && options.createMissingTags) {
          const stateTagKey = identifiedState.toLowerCase();
          let stateTag = tagsCache.get(stateTagKey);
          
          if (!stateTag) {
            if (!stateTagCache[identifiedState]) {
              const created = await findOrCreateTag(identifiedState, '#10B981');
              stateTagCache[identifiedState] = created.id;
              tagsCache.set(stateTagKey, { id: created.id, name: identifiedState });
              if (created.isNew) {
                importResult.tagsCreated++;
              }
            }
            stateTag = { id: stateTagCache[identifiedState], name: identifiedState };
          }
          
          if (stateTag && !existingTags.has(stateTag.id)) {
            contactTagsToInsert.push({ contact_id: contactId, tag_id: stateTag.id });
            existingTags.add(stateTag.id);
            importResult.stateTagsAssigned++;
          }
        }
      }

      setProgress(75);

      // Batch insert contact_tags
      if (contactTagsToInsert.length > 0) {
        for (let i = 0; i < contactTagsToInsert.length; i += batchSize) {
          const batch = contactTagsToInsert.slice(i, i + batchSize);
          await supabase
            .from('contact_tags')
            .upsert(batch, { onConflict: 'contact_id,tag_id', ignoreDuplicates: true });
        }
      }

      setProgress(85);

      // ===== PHASE 6: CREATE/UPDATE CONVERSATIONS FOR CHANNEL =====
      if (options.channelId) {
        // Get all contact IDs that need conversations
        const allContactIds = new Set<string>();
        
        for (const row of rows) {
          if (!row.telefone) continue;
          const normalizedPhone = normalizePhoneForStorage(row.telefone);
          const variations = getPhoneSearchVariations(normalizedPhone);
          
          for (const v of variations) {
            if (contactsCache.has(v)) {
              allContactIds.add(contactsCache.get(v)!.id);
              break;
            }
            if (createdContactsMap.has(v)) {
              allContactIds.add(createdContactsMap.get(v)!);
              break;
            }
          }
        }

        // Create conversations for contacts that don't have one in this channel
        for (const contactId of allContactIds) {
          if (!existingConversations.has(contactId)) {
            conversationsToCreate.push({
              contact_id: contactId,
              channel_id: options.channelId,
              assigned_to: options.defaultAssigneeId || null,
              status: 'open',
            });
          } else if (options.defaultAssigneeId) {
            // Update existing conversation with assignee
            conversationsToUpdate.push({
              id: existingConversations.get(contactId)!,
              assigned_to: options.defaultAssigneeId,
            });
          }
        }

        // Batch create conversations
        if (conversationsToCreate.length > 0) {
          for (let i = 0; i < conversationsToCreate.length; i += batchSize) {
            const batch = conversationsToCreate.slice(i, i + batchSize);
            const { data: created, error } = await supabase
              .from('conversations')
              .insert(batch as any)
              .select('id');
            
            if (!error && created) {
              importResult.conversationsCreated += created.length;
            }
          }
        }

        // Batch update conversations
        for (const update of conversationsToUpdate) {
          await supabase
            .from('conversations')
            .update({ assigned_to: update.assigned_to })
            .eq('id', update.id);
        }
      }

      setProgress(95);

      // Calculate processed
      importResult.processed = rows.length - importResult.skipped - importResult.errors;

    } catch (error: any) {
      console.error('[Import] Fatal error:', error);
      importResult.errors++;
      importResult.log.push({
        type: 'error',
        message: `Erro fatal: ${error.message}`,
      });
    }

    setProgress(100);
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
