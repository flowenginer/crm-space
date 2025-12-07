import { useState, useEffect } from 'react';
import { RefreshCw, Tag, UserCheck, Users, AlertTriangle, CheckCircle, Loader2, ArrowRightLeft, Search, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAgentTagSyncStore } from '@/store/agentTagSyncStore';

type SyncMode = 'tag-to-assignment' | 'assignment-to-tag' | 'orphans' | 'conflicts';

interface AgentTagMapping {
  tagId: string;
  tagName: string;
  tagColor: string;
  agentId: string | null;
  agentName: string | null;
  matchConfidence: 'exact' | 'partial' | 'none';
}

interface SyncStats {
  tagToAssignment: number;
  assignmentToTag: number;
  orphans: number;
  conflicts: number;
}

interface SyncResult {
  contactId: string;
  contactName: string;
  contactPhone: string;
  action: string;
  tagName?: string;
  agentName?: string;
  success: boolean;
  error?: string;
}

export function AgentTagSyncSettings() {
  const {
    isProcessing,
    progress,
    summary,
    shouldCancel,
    startProcessing,
    updateProgress,
    setSummary,
    cancelProcessing,
  } = useAgentTagSyncStore();

  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [mode, setMode] = useState<SyncMode>('tag-to-assignment');
  const [mappings, setMappings] = useState<AgentTagMapping[]>([]);
  const [stats, setStats] = useState<SyncStats | null>(null);

  useEffect(() => {
    loadStatsAndMappings();
  }, []);

  const loadStatsAndMappings = async () => {
    setIsLoadingStats(true);
    try {
      const { data: agents, error: agentsError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('is_active', true)
        .not('full_name', 'is', null);

      if (agentsError) throw agentsError;

      const { data: allTags, error: tagsError } = await supabase
        .from('tags')
        .select('id, name, color')
        .order('name');

      if (tagsError) throw tagsError;

      const agentMappings: AgentTagMapping[] = [];
      const agentNames = agents?.map(a => ({
        id: a.id,
        name: a.full_name || '',
        firstName: (a.full_name || '').split(' ')[0].toUpperCase()
      })) || [];

      // Mapeamento APENAS por correspondência EXATA entre nome da tag e primeiro nome do vendedor
      for (const tag of allTags || []) {
        const tagNameUpper = tag.name.toUpperCase().trim();
        
        // Apenas match EXATO: nome da tag = primeiro nome do vendedor
        // Isso evita que tags de estados (ES, AL, SC) sejam mapeadas incorretamente
        const exactMatch = agentNames.find(a => a.firstName === tagNameUpper);

        if (exactMatch) {
          agentMappings.push({
            tagId: tag.id,
            tagName: tag.name,
            tagColor: tag.color || '#8B5CF6',
            agentId: exactMatch.id,
            agentName: exactMatch.name,
            matchConfidence: 'exact'
          });
        }
      }

      setMappings(agentMappings);

      const agentTagIds = agentMappings.map(m => m.tagId);
      const agentIds = agentMappings.filter(m => m.agentId).map(m => m.agentId);

      const { data: contactsWithTagNoAssignment } = await supabase
        .from('contacts')
        .select('id')
        .is('assigned_to', null);

      const contactIdsNoAssignment = contactsWithTagNoAssignment?.map(c => c.id) || [];

      let tagToAssignment = 0;
      if (agentTagIds.length > 0 && contactIdsNoAssignment.length > 0) {
        const { count } = await supabase
          .from('contact_tags')
          .select('contact_id', { count: 'exact', head: true })
          .in('tag_id', agentTagIds)
          .in('contact_id', contactIdsNoAssignment.slice(0, 1000));
        tagToAssignment = count || 0;
      }

      // Contagem correta de "Atribuição → Tag" usando paginação para buscar TODOS os contatos
      let assignmentToTag = 0;
      if (agentIds.length > 0 && agentMappings.length > 0) {
        for (const mapping of agentMappings) {
          if (!mapping.agentId) continue;
          
          // Buscar TODOS os IDs de contatos atribuídos a este vendedor usando paginação
          const allContactIds: string[] = [];
          let offset = 0;
          const pageSize = 1000;
          
          while (true) {
            const { data: contactsPage } = await supabase
              .from('contacts')
              .select('id')
              .eq('assigned_to', mapping.agentId)
              .range(offset, offset + pageSize - 1);
            
            if (!contactsPage || contactsPage.length === 0) break;
            allContactIds.push(...contactsPage.map(c => c.id));
            if (contactsPage.length < pageSize) break;
            offset += pageSize;
          }
          
          if (allContactIds.length === 0) continue;
          
          // Contar quantos desses contatos JÁ TÊM a tag usando paginação também
          let withTagCount = 0;
          for (let i = 0; i < allContactIds.length; i += 1000) {
            const batch = allContactIds.slice(i, i + 1000);
            const { count } = await supabase
              .from('contact_tags')
              .select('contact_id', { count: 'exact', head: true })
              .in('contact_id', batch)
              .eq('tag_id', mapping.tagId);
            withTagCount += count || 0;
          }
          
          // Contatos que precisam de tag = total atribuídos - contatos que já têm a tag
          const needsTag = allContactIds.length - withTagCount;
          console.log(`${mapping.agentName}: ${allContactIds.length} atribuídos, ${withTagCount} com tag, ${needsTag} precisam de tag`);
          assignmentToTag += needsTag;
        }
      }

      const { count: orphansCount } = await supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .is('assigned_to', null);

      const orphans = (orphansCount || 0) - tagToAssignment;

      let conflicts = 0;
      if (agentTagIds.length > 0 && agentIds.length > 0) {
        const { data: contactsWithTags } = await supabase
          .from('contact_tags')
          .select('contact_id, tag_id')
          .in('tag_id', agentTagIds);

        if (contactsWithTags && contactsWithTags.length > 0) {
          const contactIdsWithTags = [...new Set(contactsWithTags.map(ct => ct.contact_id))];
          
          const { data: assignedContactsWithTags } = await supabase
            .from('contacts')
            .select('id, assigned_to')
            .in('id', contactIdsWithTags.slice(0, 1000))
            .not('assigned_to', 'is', null);

          for (const contact of assignedContactsWithTags || []) {
            const contactTagIds = contactsWithTags
              .filter(ct => ct.contact_id === contact.id)
              .map(ct => ct.tag_id);

            const expectedMapping = agentMappings.find(m => contactTagIds.includes(m.tagId));
            if (expectedMapping && expectedMapping.agentId !== contact.assigned_to) {
              conflicts++;
            }
          }
        }
      }

      setStats({
        tagToAssignment,
        assignmentToTag,
        orphans: Math.max(0, orphans),
        conflicts
      });

    } catch (error: any) {
      console.error('Error loading stats:', error);
      toast.error('Erro ao carregar estatísticas');
    } finally {
      setIsLoadingStats(false);
    }
  };

  const executeSync = async () => {
    startProcessing();

    try {
      const results: SyncResult[] = [];
      let processed = 0;
      let successful = 0;
      let errors = 0;

      const agentTagIds = mappings.map(m => m.tagId);
      const agentIds = mappings.filter(m => m.agentId).map(m => m.agentId);

      if (mode === 'tag-to-assignment') {
        const { data: contactsNoAssignment } = await supabase
          .from('contacts')
          .select('id, full_name, phone')
          .is('assigned_to', null)
          .limit(500);

        if (contactsNoAssignment && contactsNoAssignment.length > 0) {
          const contactIds = contactsNoAssignment.map(c => c.id);
          
          const { data: contactTags } = await supabase
            .from('contact_tags')
            .select('contact_id, tag_id')
            .in('contact_id', contactIds)
            .in('tag_id', agentTagIds);

          const total = contactTags?.length || 1;

          for (const ct of contactTags || []) {
            if (useAgentTagSyncStore.getState().shouldCancel) {
              toast.info('Sincronização cancelada');
              setSummary({ total: processed, processed, successful, errors, results });
              return;
            }

            const contact = contactsNoAssignment.find(c => c.id === ct.contact_id);
            const mapping = mappings.find(m => m.tagId === ct.tag_id);

            if (contact && mapping && mapping.agentId) {
              const { error } = await supabase
                .from('contacts')
                .update({ assigned_to: mapping.agentId })
                .eq('id', contact.id);

              processed++;
              updateProgress(Math.round((processed / total) * 100));

              if (error) {
                errors++;
                results.push({
                  contactId: contact.id,
                  contactName: contact.full_name,
                  contactPhone: contact.phone,
                  action: 'Atribuir',
                  tagName: mapping.tagName,
                  agentName: mapping.agentName || undefined,
                  success: false,
                  error: error.message
                });
              } else {
                successful++;
                results.push({
                  contactId: contact.id,
                  contactName: contact.full_name,
                  contactPhone: contact.phone,
                  action: 'Atribuído',
                  tagName: mapping.tagName,
                  agentName: mapping.agentName || undefined,
                  success: true
                });
              }
            }
          }
        }
      } else if (mode === 'assignment-to-tag') {
        // Processar cada mapeamento para encontrar contatos que precisam de tag
        // Usando PAGINAÇÃO para buscar TODOS os contatos
        const contactsNeedingTags: Array<{
          contactId: string;
          contactName: string;
          contactPhone: string;
          assignedTo: string;
          mapping: AgentTagMapping;
        }> = [];

        // Para cada mapeamento, buscar TODOS os contatos usando paginação
        for (const mapping of mappings) {
          if (!mapping.agentId) continue;

          // Buscar TODOS os contatos atribuídos a este vendedor usando paginação
          const allContacts: Array<{ id: string; full_name: string; phone: string }> = [];
          let offset = 0;
          const pageSize = 1000;
          
          while (true) {
            const { data: contactsPage } = await supabase
              .from('contacts')
              .select('id, full_name, phone')
              .eq('assigned_to', mapping.agentId)
              .range(offset, offset + pageSize - 1);
            
            if (!contactsPage || contactsPage.length === 0) break;
            allContacts.push(...contactsPage);
            if (contactsPage.length < pageSize) break;
            offset += pageSize;
          }

          if (allContacts.length === 0) continue;
          console.log(`${mapping.agentName}: encontrados ${allContacts.length} contatos atribuídos`);

          // Buscar quais desses contatos JÁ têm a tag do vendedor (também com paginação)
          const contactIds = allContacts.map(c => c.id);
          const contactsWithTag = new Set<string>();
          
          for (let i = 0; i < contactIds.length; i += 1000) {
            const batch = contactIds.slice(i, i + 1000);
            const { data: existingTags } = await supabase
              .from('contact_tags')
              .select('contact_id')
              .in('contact_id', batch)
              .eq('tag_id', mapping.tagId);
            
            existingTags?.forEach(t => contactsWithTag.add(t.contact_id));
          }

          // Filtrar contatos que NÃO têm a tag
          for (const contact of allContacts) {
            if (!contactsWithTag.has(contact.id)) {
              contactsNeedingTags.push({
                contactId: contact.id,
                contactName: contact.full_name,
                contactPhone: contact.phone,
                assignedTo: mapping.agentId,
                mapping
              });
            }
          }
          
          console.log(`${mapping.agentName}: ${contactsWithTag.size} já têm tag, ${allContacts.length - contactsWithTag.size} precisam de tag`);
        }

        const totalToProcess = contactsNeedingTags.length;
        console.log(`Total de contatos que precisam de tag: ${totalToProcess}`);

        // Processar em lotes de 50 para não sobrecarregar
        const batchSize = 50;
        for (let i = 0; i < contactsNeedingTags.length; i += batchSize) {
          if (useAgentTagSyncStore.getState().shouldCancel) {
            toast.info('Sincronização cancelada');
            setSummary({ total: totalToProcess, processed, successful, errors, results });
            return;
          }

          const batch = contactsNeedingTags.slice(i, i + batchSize);
          
          // Inserir tags em lote
          const tagsToInsert = batch.map(c => ({
            contact_id: c.contactId,
            tag_id: c.mapping.tagId
          }));

          const { error } = await supabase
            .from('contact_tags')
            .insert(tagsToInsert);

          if (error) {
            // Se erro no lote, processar individualmente
            for (const contact of batch) {
              const { error: singleError } = await supabase
                .from('contact_tags')
                .insert({ contact_id: contact.contactId, tag_id: contact.mapping.tagId });

              processed++;
              if (singleError) {
                errors++;
                results.push({
                  contactId: contact.contactId,
                  contactName: contact.contactName,
                  contactPhone: contact.contactPhone,
                  action: 'Adicionar tag',
                  tagName: contact.mapping.tagName,
                  agentName: contact.mapping.agentName || undefined,
                  success: false,
                  error: singleError.message
                });
              } else {
                successful++;
                results.push({
                  contactId: contact.contactId,
                  contactName: contact.contactName,
                  contactPhone: contact.contactPhone,
                  action: 'Tag adicionada',
                  tagName: contact.mapping.tagName,
                  agentName: contact.mapping.agentName || undefined,
                  success: true
                });
              }
            }
          } else {
            // Sucesso no lote
            processed += batch.length;
            successful += batch.length;
            for (const contact of batch) {
              results.push({
                contactId: contact.contactId,
                contactName: contact.contactName,
                contactPhone: contact.contactPhone,
                action: 'Tag adicionada',
                tagName: contact.mapping.tagName,
                agentName: contact.mapping.agentName || undefined,
                success: true
              });
            }
          }

          updateProgress(Math.round((processed / Math.max(totalToProcess, 1)) * 100));
        }
      } else if (mode === 'orphans') {
        const { data: orphanContacts } = await supabase
          .from('contacts')
          .select('id, full_name, phone')
          .is('assigned_to', null)
          .limit(100);

        if (orphanContacts) {
          const contactIds = orphanContacts.map(c => c.id);
          
          const { data: contactTags } = await supabase
            .from('contact_tags')
            .select('contact_id, tag_id')
            .in('contact_id', contactIds)
            .in('tag_id', agentTagIds);

          const contactsWithAgentTags = new Set(contactTags?.map(ct => ct.contact_id) || []);

          for (const contact of orphanContacts) {
            if (!contactsWithAgentTags.has(contact.id)) {
              processed++;
              results.push({
                contactId: contact.id,
                contactName: contact.full_name,
                contactPhone: contact.phone,
                action: 'Órfão identificado',
                success: true
              });
            }
          }
        }

        updateProgress(100);
      } else if (mode === 'conflicts') {
        const { data: contactTags } = await supabase
          .from('contact_tags')
          .select('contact_id, tag_id')
          .in('tag_id', agentTagIds)
          .limit(1000);

        if (contactTags && contactTags.length > 0) {
          const contactIds = [...new Set(contactTags.map(ct => ct.contact_id))];
          
          const { data: contacts } = await supabase
            .from('contacts')
            .select('id, full_name, phone, assigned_to')
            .in('id', contactIds)
            .not('assigned_to', 'is', null);

          const { data: agents } = await supabase
            .from('profiles')
            .select('id, full_name');

          const agentsMap = new Map(agents?.map(a => [a.id, a.full_name]) || []);

          for (const contact of contacts || []) {
            const contactTagIds = contactTags
              .filter(ct => ct.contact_id === contact.id)
              .map(ct => ct.tag_id);

            const expectedMapping = mappings.find(m => contactTagIds.includes(m.tagId));
            
            if (expectedMapping && expectedMapping.agentId !== contact.assigned_to) {
              processed++;
              const currentAgentName = agentsMap.get(contact.assigned_to) || 'Desconhecido';
              
              results.push({
                contactId: contact.id,
                contactName: contact.full_name,
                contactPhone: contact.phone,
                action: `Conflito: Tag ${expectedMapping.tagName} ≠ Atribuído ${currentAgentName}`,
                tagName: expectedMapping.tagName,
                agentName: currentAgentName,
                success: true
              });
            }
          }
        }

        updateProgress(100);
      }

      setSummary({
        total: processed,
        processed,
        successful,
        errors,
        results
      });

      if (mode === 'orphans' || mode === 'conflicts') {
        toast.info(`${processed} contatos identificados`);
      } else {
        toast.success(`${successful} contatos sincronizados com sucesso!`);
      }

      await loadStatsAndMappings();

    } catch (error: any) {
      console.error('Sync error:', error);
      toast.error(error.message || 'Erro ao executar sincronização');
      setSummary({ total: 0, processed: 0, successful: 0, errors: 1, results: [] });
    }
  };

  const getModeInfo = () => {
    switch (mode) {
      case 'tag-to-assignment':
        return {
          icon: <Tag className="h-4 w-4" />,
          title: 'Tag → Atribuição',
          description: 'Atribui leads ao vendedor correspondente à sua tag',
          count: stats?.tagToAssignment || 0,
          color: 'text-blue-500',
          bgColor: 'bg-blue-500/10'
        };
      case 'assignment-to-tag':
        return {
          icon: <UserCheck className="h-4 w-4" />,
          title: 'Atribuição → Tag',
          description: 'Adiciona a tag do vendedor aos leads atribuídos a ele',
          count: stats?.assignmentToTag || 0,
          color: 'text-green-500',
          bgColor: 'bg-green-500/10'
        };
      case 'orphans':
        return {
          icon: <Search className="h-4 w-4" />,
          title: 'Diagnóstico Órfãos',
          description: 'Lista leads sem tag de vendedor e sem atribuição',
          count: stats?.orphans || 0,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-500/10'
        };
      case 'conflicts':
        return {
          icon: <XCircle className="h-4 w-4" />,
          title: 'Detectar Conflitos',
          description: 'Identifica leads com tag de um vendedor mas atribuídos a outro',
          count: stats?.conflicts || 0,
          color: 'text-red-500',
          bgColor: 'bg-red-500/10'
        };
    }
  };

  const modeInfo = getModeInfo();

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ArrowRightLeft className="w-5 h-5 text-primary" />
          </div>
          Sincronização Vendedor ↔ Etiqueta
        </CardTitle>
        <CardDescription>
          Sincroniza atribuições de leads com etiquetas de vendedores
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div 
            className={`p-3 rounded-lg border cursor-pointer transition-colors ${mode === 'tag-to-assignment' ? 'border-blue-500 bg-blue-500/10' : 'border-border bg-muted/30 hover:bg-muted/50'}`}
            onClick={() => setMode('tag-to-assignment')}
          >
            <div className="flex items-center gap-2 mb-1">
              <Tag className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium">Tag→Atrib</span>
            </div>
            <div className="text-2xl font-bold text-blue-500">
              {isLoadingStats ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.tagToAssignment || 0}
            </div>
          </div>

          <div 
            className={`p-3 rounded-lg border cursor-pointer transition-colors ${mode === 'assignment-to-tag' ? 'border-green-500 bg-green-500/10' : 'border-border bg-muted/30 hover:bg-muted/50'}`}
            onClick={() => setMode('assignment-to-tag')}
          >
            <div className="flex items-center gap-2 mb-1">
              <UserCheck className="h-4 w-4 text-green-500" />
              <span className="text-xs font-medium">Atrib→Tag</span>
            </div>
            <div className="text-2xl font-bold text-green-500">
              {isLoadingStats ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.assignmentToTag || 0}
            </div>
          </div>

          <div 
            className={`p-3 rounded-lg border cursor-pointer transition-colors ${mode === 'orphans' ? 'border-yellow-500 bg-yellow-500/10' : 'border-border bg-muted/30 hover:bg-muted/50'}`}
            onClick={() => setMode('orphans')}
          >
            <div className="flex items-center gap-2 mb-1">
              <Search className="h-4 w-4 text-yellow-500" />
              <span className="text-xs font-medium">Órfãos</span>
            </div>
            <div className="text-2xl font-bold text-yellow-500">
              {isLoadingStats ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.orphans || 0}
            </div>
          </div>

          <div 
            className={`p-3 rounded-lg border cursor-pointer transition-colors ${mode === 'conflicts' ? 'border-red-500 bg-red-500/10' : 'border-border bg-muted/30 hover:bg-muted/50'}`}
            onClick={() => setMode('conflicts')}
          >
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-xs font-medium">Conflitos</span>
            </div>
            <div className="text-2xl font-bold text-red-500">
              {isLoadingStats ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.conflicts || 0}
            </div>
          </div>
        </div>

        {/* Mode Description */}
        <div className={`p-4 rounded-lg border ${modeInfo.bgColor} border-border`}>
          <div className="flex items-center gap-2 mb-1">
            <span className={modeInfo.color}>{modeInfo.icon}</span>
            <span className="font-medium">{modeInfo.title}</span>
            <Badge variant="secondary" className="ml-auto">{modeInfo.count} contatos</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{modeInfo.description}</p>
        </div>

        {/* Mapeamento Tag -> Vendedor */}
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="mappings" className="border rounded-lg">
            <AccordionTrigger className="px-4 hover:no-underline">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span>Mapeamento Tag → Vendedor ({mappings.length})</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              {mappings.length > 0 ? (
                <div className="space-y-2">
                  {mappings.map((m) => (
                    <div key={m.tagId} className="flex items-center justify-between p-2 rounded bg-muted/50">
                      <div className="flex items-center gap-2">
                        <Badge 
                          style={{ backgroundColor: m.tagColor, color: '#fff' }}
                          className="text-xs"
                        >
                          {m.tagName}
                        </Badge>
                        <span className="text-muted-foreground">→</span>
                        <span className="text-sm font-medium">{m.agentName}</span>
                      </div>
                      <Badge variant={m.matchConfidence === 'exact' ? 'default' : 'secondary'} className="text-xs">
                        {m.matchConfidence === 'exact' ? '✓ Exato' : '~ Parcial'}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum mapeamento encontrado</p>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Progress */}
        {isProcessing && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Processando...</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Results */}
        {summary && !isProcessing && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <div className="text-lg font-bold text-primary">{summary.processed}</div>
                <div className="text-xs text-muted-foreground">Processados</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <div className="text-lg font-bold text-green-500">{summary.successful}</div>
                <div className="text-xs text-muted-foreground">Sucesso</div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <div className="text-lg font-bold text-red-500">{summary.errors}</div>
                <div className="text-xs text-muted-foreground">Erros</div>
              </div>
            </div>

            {summary.results.length > 0 && (
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="results" className="border rounded-lg">
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <span>Ver detalhes ({summary.results.length})</span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <ScrollArea className="h-[300px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Etiqueta</TableHead>
                            <TableHead>Vendedor</TableHead>
                            <TableHead className="text-right">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {summary.results.slice(0, 50).map((r, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{r.contactName}</TableCell>
                              <TableCell>
                                {r.tagName ? (
                                  <Badge variant="outline" className="text-xs">{r.tagName}</Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>{r.agentName || '-'}</TableCell>
                              <TableCell className="text-right">
                                <Badge 
                                  variant={r.success ? 'default' : 'destructive'}
                                  className="text-xs"
                                >
                                  {r.success ? '✓ Atribuído' : '✗ Erro'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {summary.results.length > 50 && (
                        <p className="text-xs text-muted-foreground text-center py-2">
                          ... e mais {summary.results.length - 50} resultados
                        </p>
                      )}
                    </ScrollArea>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={loadStatsAndMappings}
            disabled={isProcessing || isLoadingStats}
          >
            {isLoadingStats ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Atualizar
          </Button>

          {isProcessing ? (
            <Button
              variant="destructive"
              onClick={cancelProcessing}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
          ) : (
            <Button
              onClick={executeSync}
              disabled={isLoadingStats || mappings.length === 0}
            >
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              {mode === 'orphans' || mode === 'conflicts' ? 'Identificar' : 'Executar Sincronização'}
            </Button>
          )}
        </div>

        {/* Info */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border">
          <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            O mapeamento é feito automaticamente comparando o nome da tag com o primeiro nome do vendedor. 
            Verifique o mapeamento antes de executar.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
