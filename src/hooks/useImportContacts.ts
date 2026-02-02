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
      
      // Helper to split array into chunks
      const chunkArray = <T>(arr: T[], size: number): T[][] => {
        const chunks: T[][] = [];
        for (let i = 0; i < arr.length; i += size) {
          chunks.push(arr.slice(i, i + size));
        }
        return chunks;
      };
      
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

      // FIXED: Batch fetch existing contacts in chunks to avoid Supabase 1000-record limit
      const contactsCache = new Map<string, ContactCache>();
      const phoneChunks = chunkArray(Array.from(allPhoneVariations), 300);
      
      console.log(`[Import] Fetching contacts in ${phoneChunks.length} chunks (${allPhoneVariations.size} variations)`);
      
      for (const chunk of phoneChunks) {
        const { data: chunkData } = await supabase
          .from('contacts')
          .select('id, full_name, phone, assigned_to, lead_status')
          .in('phone', chunk);
        
        chunkData?.forEach(c => {
          contactsCache.set(c.phone, c);
        });
      }
      
      console.log(`[Import] Found ${contactsCache.size} existing contacts`);

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

      // Batch fetch existing contact_tags for all contacts (using contactsCache)
      const contactIds = Array.from(new Set(
        Array.from(contactsCache.values()).map(c => c.id)
      ));
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
      if (options.channelId && contactIds.length > 0) {
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

      // Helper to find profile by name (fuzzy - more flexible matching)
      const findProfileByName = (name: string): ProfileCache | null => {
        const searchTerm = name.toLowerCase().trim();
        
        // Exact match first
        if (profilesByName.has(searchTerm)) {
          return profilesByName.get(searchTerm)!;
        }
        
        // Try matching without accents and special chars
        const normalizeStr = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        const normalizedSearch = normalizeStr(searchTerm);
        
        for (const [key, profile] of profilesByName.entries()) {
          const normalizedKey = normalizeStr(key);
          
          // Check if names match after normalization
          if (normalizedKey === normalizedSearch) {
            return profile;
          }
          
          // Partial match - if search term is contained or contains the key
          if (normalizedKey.includes(normalizedSearch) || normalizedSearch.includes(normalizedKey)) {
            return profile;
          }
          
          // First name match
          const searchFirstName = normalizedSearch.split(/\s+/)[0];
          const keyFirstName = normalizedKey.split(/\s+/)[0];
          if (searchFirstName === keyFirstName && searchFirstName.length >= 3) {
            return profile;
          }
        }
        return null;
      };

      // Normalize strings for comparison
      const normalizeStr = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      
      // Fix common encoding issues (UTF-8 interpreted as Latin-1)
      const fixEncoding = (s: string) => s
        .replace(/Ã©/g, 'é').replace(/Ã¡/g, 'á').replace(/Ã£/g, 'ã')
        .replace(/Ã³/g, 'ó').replace(/Ãº/g, 'ú').replace(/Ã§/g, 'ç')
        .replace(/Ã­/g, 'í').replace(/Ãª/g, 'ê').replace(/Ã´/g, 'ô')
        .replace(/Ã/g, 'Á');

      // Helper to find lead status by name (fuzzy matching with encoding fix)
      const findLeadStatus = (name: string): LeadStatusCache | null => {
        const fixedName = fixEncoding(name);
        
        // Clean numeric prefixes like "01 - ", "(1) ", etc
        const cleanTerm = fixedName
          .replace(/^\(\d+\)\s*/, '')  // Remove "(1) " prefix
          .replace(/^\d+\s*[-–]\s*/, '') // Remove "01 - " prefix
          .trim();
        
        const normalizedSearch = normalizeStr(cleanTerm);
        
        // Try exact match first
        if (leadStatusesCache.has(cleanTerm.toLowerCase())) {
          return leadStatusesCache.get(cleanTerm.toLowerCase())!;
        }
        
        // Fuzzy matching against all cached statuses
        for (const [key, status] of leadStatusesCache.entries()) {
          const normalizedKey = normalizeStr(key);
          
          // Exact normalized match
          if (normalizedKey === normalizedSearch) {
            return status;
          }
          
          // Partial match (contains)
          if (normalizedKey.includes(normalizedSearch) || normalizedSearch.includes(normalizedKey)) {
            // Require minimum 4 chars to avoid false positives
            if (normalizedSearch.length >= 4 || normalizedKey.length >= 4) {
              return status;
            }
          }
          
          // Keywords matching for common status names
          const keywords: Record<string, string[]> = {
            'agendado': ['agendamento', 'agenda', 'agendad'],
            'pre-venda': ['pre-contato', 'precontato', 'pre contato', 'prevenda'],
            'abordagem': ['abordagem sem resposta', 'nao respondeu', 'não respondeu', 'sem resposta'],
            'oferta': ['oferta', 'proposta'],
            'qualificacao': ['qualificacao', 'qualificação'],
          };
          
          for (const [statusKey, aliases] of Object.entries(keywords)) {
            if (normalizedKey.includes(normalizeStr(statusKey))) {
              for (const alias of aliases) {
                if (normalizedSearch.includes(normalizeStr(alias)) || normalizeStr(alias).includes(normalizedSearch)) {
                  return status;
                }
              }
            }
          }
        }
        
        return null;
      };
      
      // Helper to find OR CREATE lead status
      const findOrCreateLeadStatus = async (name: string): Promise<LeadStatusCache | null> => {
        // First try to find existing
        const found = findLeadStatus(name);
        if (found) return found;
        
        // If not found, create new status
        const fixedName = fixEncoding(name);
        const cleanName = fixedName
          .replace(/^\(\d+\)\s*/, '')
          .replace(/^\d+\s*[-–]\s*/, '')
          .trim();
        
        // Don't create empty status
        if (!cleanName) return null;
        
        try {
          // Get next order_position
          const { data: maxOrder } = await supabase
            .from('lead_statuses')
            .select('order_position')
            .order('order_position', { ascending: false })
            .limit(1)
            .single();
          
          const nextOrder = (maxOrder?.order_position || 0) + 1;
          
          // Create new status with tenant_id = null for trigger
          const { data, error } = await supabase
            .from('lead_statuses')
            .insert({
              name: cleanName,
              order_position: nextOrder,
              color: '#8B5CF6',
              is_active: true,
              tenant_id: null, // Let trigger assign
            } as any)
            .select('id, name')
            .single();
          
          if (error) {
            console.error('[Import] Error creating lead status:', cleanName, error);
            return null;
          }
          
          // Add to cache for future lookups
          leadStatusesCache.set(cleanName.toLowerCase(), data);
          leadStatusesCache.set(normalizeStr(cleanName), data);
          
          console.log(`[Import] Created new lead status: ${cleanName} (${data.id})`);
          return data;
        } catch (err) {
          console.error('[Import] Failed to create lead status:', cleanName, err);
          return null;
        }
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
            // FIXED: Check if we already processed this phone in this batch (internal duplicates)
            if (processedContacts.has(normalizedPhone)) {
              importResult.skipped++;
              importResult.log.push({
                type: 'warning',
                message: `Telefone duplicado na planilha: ${row.telefone}`,
                row: rowNum,
              });
              continue;
            }
            
            if (options.createMissingContacts && row.nome) {
              // FIX #1: Resolver vendedor da planilha ANTES de criar contato
              let newContactAssigneeId: string | null = null;
              if (options.defaultAssigneeId) {
                newContactAssigneeId = options.defaultAssigneeId;
              } else if (options.updateAssignee && row.vendedor && row.vendedor.trim()) {
                const agent = findProfileByName(row.vendedor);
                if (agent) {
                  newContactAssigneeId = agent.id;
                } else {
                  importResult.log.push({
                    type: 'warning',
                    message: `Vendedor não encontrado para novo contato: "${row.vendedor}"`,
                    row: rowNum,
                  });
                }
              }

              // FIX #2: Resolver status de lead ANTES de criar contato
              let newContactLeadStatus: string | null = null;
              if (options.updateLeadStatus && row.statusLead && row.statusLead.trim()) {
                const status = await findOrCreateLeadStatus(row.statusLead);
                if (status) {
                  newContactLeadStatus = status.name;
                } else {
                  importResult.log.push({
                    type: 'warning',
                    message: `Não foi possível processar status para novo contato: "${row.statusLead}"`,
                    row: rowNum,
                  });
                }
              }

              // Queue for batch creation - agora com assignee e lead_status corretos
              const newContactData = {
                full_name: row.nome.trim(),
                phone: normalizedPhone,
                state: identifiedState || null,
                assigned_to: newContactAssigneeId,
                lead_status: newContactLeadStatus,
              };
              
              contactsToCreate.push(newContactData);
              processedContacts.set(normalizedPhone, { id: null, isNew: true, name: row.nome });
              
              if (identifiedState) {
                importResult.statesIdentified++;
              }
              
              importResult.log.push({
                type: 'info',
                message: `Contato a criar: ${row.nome}${newContactAssigneeId ? ' (c/ agente)' : ''}${newContactLeadStatus ? ` [${newContactLeadStatus}]` : ''}${identifiedState ? ` (${identifiedState})` : ''}`,
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

            // Update lead status - use findOrCreateLeadStatus (async)
            if (options.updateLeadStatus && row.statusLead && row.statusLead.trim()) {
              const status = await findOrCreateLeadStatus(row.statusLead);
              if (status) {
                updateData.lead_status = status.name;
                shouldUpdate = true;
              } else {
                importResult.log.push({
                  type: 'warning',
                  message: `Não foi possível processar status: "${row.statusLead}"`,
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
        console.log(`[Import] Creating ${contactsToCreate.length} new contacts with UPSERT`);
        
        for (let i = 0; i < contactsToCreate.length; i += batchSize) {
          const batch = contactsToCreate.slice(i, i + batchSize);
          
          // FIXED: Use upsert with onConflict to handle any remaining duplicates gracefully
          const { data: created, error } = await supabase
            .from('contacts')
            .upsert(batch as any, { 
              onConflict: 'phone,tenant_id',
              ignoreDuplicates: false 
            })
            .select('id, phone');
          
          if (error) {
            console.error('[Import] Batch upsert error:', error);
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

      // ===== PHASE 4: BATCH UPDATE EXISTING CONTACTS (OPTIMIZED) =====
      setProgress(60);
      
      // Group contacts by update data for batch updates
      const updateGroups = new Map<string, string[]>();
      for (const update of contactsToUpdate) {
        const key = JSON.stringify(update.data);
        if (!updateGroups.has(key)) {
          updateGroups.set(key, []);
        }
        updateGroups.get(key)!.push(update.id);
      }
      
      console.log(`[Import] Optimized: ${contactsToUpdate.length} contacts grouped into ${updateGroups.size} batch updates`);
      
      // Perform batch updates by group
      let groupIndex = 0;
      for (const [dataKey, ids] of updateGroups) {
        const data = JSON.parse(dataKey);
        
        // Split into chunks of 300 to avoid query limits
        for (let i = 0; i < ids.length; i += 300) {
          const chunk = ids.slice(i, i + 300);
          const { error } = await supabase
            .from('contacts')
            .update(data)
            .in('id', chunk);
          
          if (error) {
            console.error(`[Import] Batch update error:`, error);
            importResult.errors += chunk.length;
          } else {
            importResult.updated += chunk.length;
          }
        }
        
        groupIndex++;
        setProgress(60 + Math.round((groupIndex / updateGroups.size) * 3));
      }

      // OPTIMIZED: Batch update conversations with lead_status AND assigned_to
      const conversationUpdates = contactsToUpdate.filter(u => u.data.lead_status || u.data.assigned_to);
      if (conversationUpdates.length > 0) {
        console.log(`[Import] Updating ${conversationUpdates.length} conversations with assignee/status (batch mode)`);
        
        // Group conversation updates by data
        const convUpdateGroups = new Map<string, string[]>();
        for (const update of conversationUpdates) {
          const convData: any = {};
          if (update.data.lead_status) convData.lead_status = update.data.lead_status;
          if (update.data.assigned_to) convData.assigned_to = update.data.assigned_to;
          
          const key = JSON.stringify(convData);
          if (!convUpdateGroups.has(key)) {
            convUpdateGroups.set(key, []);
          }
          convUpdateGroups.get(key)!.push(update.id);
        }
        
        // Batch update conversations by group
        for (const [dataKey, contactIds] of convUpdateGroups) {
          const data = JSON.parse(dataKey);
          
          // Split into chunks
          for (let i = 0; i < contactIds.length; i += 300) {
            const chunk = contactIds.slice(i, i + 300);
            await supabase
              .from('conversations')
              .update(data)
              .in('contact_id', chunk)
              .eq('status', 'open');
          }
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
        
        // FIX #3: Primeiro tentar pelo phone normalizado EXATO no createdContactsMap
        // Isso garante que novos contatos recebam suas tags corretamente
        if (createdContactsMap.has(normalizedPhone)) {
          contactId = createdContactsMap.get(normalizedPhone)!;
        }
        
        // Se não encontrou, tentar pelas variações no contactsCache (contatos existentes)
        if (!contactId) {
          for (const v of variations) {
            if (contactsCache.has(v)) {
              contactId = contactsCache.get(v)!.id;
              break;
            }
          }
        }
        
        // Se ainda não encontrou, tentar variações no createdContactsMap como fallback
        if (!contactId) {
          for (const v of variations) {
            if (createdContactsMap.has(v)) {
              contactId = createdContactsMap.get(v)!;
              break;
            }
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
