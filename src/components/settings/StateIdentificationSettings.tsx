import { useState, useEffect } from 'react';
import { MapPin, Play, Loader2, CheckCircle, Tag, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getStateFromPhone, STATE_NAMES } from '@/utils/ddd';
import { findOrCreateTag } from '@/hooks/useTags';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ProcessResult {
  processed: number;
  statesIdentified: number;
  tagsCreated: number;
  tagsAssigned: number;
  errors: number;
}

export function StateIdentificationSettings() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [contactsWithoutState, setContactsWithoutState] = useState<number | null>(null);
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
      .insert({ contact_id: contactId, tag_id: tagId });
    
    if (error && !error.message.includes('duplicate')) {
      throw error;
    }
  };

  const processContacts = async () => {
    setIsProcessing(true);
    setProgress(0);
    setResult(null);

    const processResult: ProcessResult = {
      processed: 0,
      statesIdentified: 0,
      tagsCreated: 0,
      tagsAssigned: 0,
      errors: 0,
    };

    try {
      // Busca contatos sem estado em lotes
      const BATCH_SIZE = 100;
      let offset = 0;
      let hasMore = true;

      // Cache de tags de estado já criadas
      const stateTagCache: Record<string, { id: string; isNew: boolean }> = {};

      while (hasMore) {
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
          try {
            const state = getStateFromPhone(contact.phone);
            
            if (state) {
              // Atualiza o estado do contato
              await supabase
                .from('contacts')
                .update({ state })
                .eq('id', contact.id);
              
              processResult.statesIdentified++;

              // Busca ou cria a tag do estado
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

              // Verifica se o contato já tem a tag
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
        
        // Atualiza progresso
        const total = contactsWithoutState || 1;
        setProgress(Math.min(100, Math.round((offset / total) * 100)));

        // Se retornou menos que o batch, não tem mais
        if (contacts.length < BATCH_SIZE) {
          hasMore = false;
        }
      }

      setProgress(100);
      setResult(processResult);
      setContactsWithoutState(0);
      toast.success(`Processamento concluído! ${processResult.statesIdentified} estados identificados.`);
    } catch (error) {
      console.error('Error processing contacts:', error);
      toast.error('Erro durante o processamento');
    } finally {
      setIsProcessing(false);
    }
  };

  // Carrega a contagem ao montar
  useEffect(() => {
    loadContactsCount();
  }, []);

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-primary" />
          </div>
          <div>
            <span className="text-lg">Identificação de Estado</span>
          </div>
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
            <button
              onClick={loadContactsCount}
              disabled={isLoadingCount}
              className="px-3 py-1.5 text-sm bg-background border border-border rounded-lg hover:bg-muted transition-colors"
            >
              Atualizar
            </button>
          </div>
        </div>

        {/* Progress */}
        {isProcessing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Processando contatos...</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Results */}
        {result && (
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

        {/* Action Button */}
        <button
          onClick={processContacts}
          disabled={isProcessing || contactsWithoutState === 0}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 btn-gradient text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              Identificar Estados e Criar Etiquetas
            </>
          )}
        </button>

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
