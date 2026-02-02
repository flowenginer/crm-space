import { useState, useEffect } from 'react';
import { MapPin, Play, Loader2, CheckCircle, Tag, AlertCircle, RefreshCw, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getStateFromPhone } from '@/utils/ddd';
import { findOrCreateTag } from '@/hooks/useTags';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useStateIdentificationStore } from '@/store/stateIdentificationStore';

export function StateIdentificationSettings() {
  const {
    isProcessing,
    progress,
    result,
    shouldCancel,
    contactsWithoutState,
    startProcessing,
    updateProgress,
    setResult,
    cancelProcessing,
    setContactsWithoutState,
  } = useStateIdentificationStore();

  const [isLoadingCount, setIsLoadingCount] = useState(false);

  const loadContactsCount = async () => {
    setIsLoadingCount(true);
    try {
      const { count, error } = await supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .is('state', null);

      if (error) throw error;
      setContactsWithoutState(count || 0);
    } catch (error) {
      console.error('Error loading count:', error);
      toast.error('Erro ao carregar contagem');
    } finally {
      setIsLoadingCount(false);
    }
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
      .upsert({ contact_id: contactId, tag_id: tagId }, { onConflict: 'contact_id,tag_id', ignoreDuplicates: true });
    
    if (error && !error.message.includes('duplicate')) {
      throw error;
    }
  };

  const processContacts = async () => {
    startProcessing();

    const processResult = {
      processed: 0,
      statesIdentified: 0,
      tagsCreated: 0,
      tagsAssigned: 0,
      errors: 0,
    };

    try {
      const BATCH_SIZE = 100;
      let offset = 0;
      let hasMore = true;
      const stateTagCache: Record<string, { id: string; isNew: boolean }> = {};
      const store = useStateIdentificationStore.getState();

      while (hasMore) {
        // Verificar cancelamento
        if (useStateIdentificationStore.getState().shouldCancel) {
          toast.info('Processamento cancelado');
          setResult(processResult);
          return;
        }

        const { data: contacts, error } = await supabase
          .from('contacts')
          .select('id, phone')
          .is('state', null)
          .range(offset, offset + BATCH_SIZE - 1);

        if (error) throw error;

        if (!contacts || contacts.length === 0) {
          hasMore = false;
          break;
        }

        for (const contact of contacts) {
          // Verificar cancelamento a cada contato
          if (useStateIdentificationStore.getState().shouldCancel) {
            toast.info('Processamento cancelado');
            setResult(processResult);
            return;
          }

          try {
            const state = getStateFromPhone(contact.phone);
            
            if (state) {
              await supabase
                .from('contacts')
                .update({ state })
                .eq('id', contact.id);
              
              processResult.statesIdentified++;

              if (!stateTagCache[state]) {
                const existingTag = await findOrCreateTag(state, '#10B981');
                stateTagCache[state] = { 
                  id: existingTag.id, 
                  isNew: existingTag.isNew || false 
                };
                if (existingTag.isNew) {
                  processResult.tagsCreated++;
                }
              }

              const existingTags = await getContactTags(contact.id);
              if (!existingTags.includes(stateTagCache[state].id)) {
                await addTagToContact(contact.id, stateTagCache[state].id);
                processResult.tagsAssigned++;
              }
            }

            processResult.processed++;
          } catch (err) {
            console.error('Error processing contact:', err);
            processResult.errors++;
          }
        }

        offset += BATCH_SIZE;
        const total = contactsWithoutState || 1;
        updateProgress(Math.min(100, Math.round((offset / total) * 100)));

        if (contacts.length < BATCH_SIZE) {
          hasMore = false;
        }
      }

      setResult(processResult);
      setContactsWithoutState(0);
      toast.success(`Processamento concluído! ${processResult.statesIdentified} estados identificados.`);
    } catch (error) {
      console.error('Error processing contacts:', error);
      toast.error('Erro durante o processamento');
      setResult(processResult);
    }
  };

  useEffect(() => {
    if (contactsWithoutState === null) {
      loadContactsCount();
    }
  }, []);

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-primary" />
          </div>
          Identificação de Estado
        </CardTitle>
        <CardDescription>
          Identifica estados pelo DDD e cria etiquetas automaticamente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Card */}
        <div className="bg-muted/50 rounded-xl p-4 border border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-warning" />
              <div>
                <p className="text-sm font-medium text-foreground">Contatos sem estado identificado</p>
                <p className="text-2xl font-bold text-foreground">
                  {isLoadingCount ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    contactsWithoutState?.toLocaleString('pt-BR') ?? '--'
                  )}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadContactsCount}
              disabled={isLoadingCount}
            >
              {isLoadingCount ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2">Atualizar</span>
            </Button>
          </div>
        </div>

        {/* Progress */}
        {isProcessing && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Processando contatos...</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Results */}
        {result && !isProcessing && (
          <div className="bg-status-success/10 rounded-xl p-4 border border-status-success/20">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-5 h-5 text-status-success" />
              <span className="font-medium text-foreground">Processamento Concluído</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Processados</p>
                <p className="text-lg font-semibold text-foreground">{result.processed}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Estados Identificados</p>
                <p className="text-lg font-semibold text-status-success">{result.statesIdentified}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Etiquetas Criadas</p>
                <p className="text-lg font-semibold text-primary">{result.tagsCreated}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Etiquetas Atribuídas</p>
                <p className="text-lg font-semibold text-accent">{result.tagsAssigned}</p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          {isProcessing ? (
            <Button
              variant="destructive"
              onClick={cancelProcessing}
              className="flex-1"
            >
              <XCircle className="w-5 h-5 mr-2" />
              Cancelar
            </Button>
          ) : (
            <Button
              onClick={processContacts}
              disabled={contactsWithoutState === 0}
              className="flex-1 btn-gradient"
            >
              <Play className="w-5 h-5 mr-2" />
              Identificar Estados e Criar Etiquetas
            </Button>
          )}
        </div>

        {/* Info Box */}
        <div className="bg-muted/30 rounded-xl p-4 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <Tag className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground mb-1">Como funciona:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Analisa o DDD do telefone de cada contato</li>
                <li>Identifica o estado brasileiro correspondente (SP, RJ, MG, etc.)</li>
                <li>Atualiza o campo "Estado" do contato</li>
                <li>Cria uma etiqueta com a sigla do estado (se não existir)</li>
                <li>Atribui a etiqueta do estado ao contato</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
