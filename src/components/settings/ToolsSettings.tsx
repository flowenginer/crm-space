import { useState, useEffect } from 'react';
import { Wand2, Loader2, AlertTriangle, CheckCircle, Users, RefreshCw, Clock, SkipForward, Play, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ContactImporter } from './ContactImporter';
import { StateIdentificationSettings } from './StateIdentificationSettings';
import { AgentTagSyncSettings } from './AgentTagSyncSettings';

interface AssignmentResult {
  conversationId: string;
  contactName: string;
  userName: string;
  userId: string;
  success: boolean;
  error?: string;
  patternFound?: string;
}

interface AssignmentSummary {
  totalInDatabase: number;
  totalProcessed: number;
  noPatternFound: number;
  userNotFound: number;
  successful: number;
  contactsUpdated: number;
  skippedTestMode: number;
  errors: number;
  byUser: Record<string, number>;
  mode: string;
  processAll: boolean;
  executionTimeMs: number;
  stoppedByTimeout: boolean;
  stoppedByTestComplete: boolean;
  startOffset: number;
  nextOffset: number;
  canContinue: boolean;
  unrecognizedPatterns: Record<string, number>;
  conversationsWithoutPatternExamples: string[];
  availableUsers: string[];
}

interface RecognizedUser {
  id: string;
  name: string;
  departmentId: string | null;
}

export function ToolsSettings() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [mode, setMode] = useState<'preview' | 'test' | 'full'>('preview');
  const [processAll, setProcessAll] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [results, setResults] = useState<AssignmentResult[] | null>(null);
  const [summary, setSummary] = useState<AssignmentSummary | null>(null);
  const [recognizedUsers, setRecognizedUsers] = useState<RecognizedUser[]>([]);
  const [nextOffset, setNextOffset] = useState(0);

  const fetchRecognizedUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `https://lkxrmjqrzhaivviuuamp.supabase.co/functions/v1/auto-assign-conversations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ action: 'list-users' }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao buscar usuários');
      }

      setRecognizedUsers(data.users);
      toast.success(`${data.users.length} usuários disponíveis para atribuição`);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast.error(error.message || 'Erro ao buscar usuários');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchRecognizedUsers();
  }, []);

  const handleAutoAssign = async (continueFromOffset = 0) => {
    setIsLoading(true);
    if (continueFromOffset === 0) {
      setResults(null);
      setSummary(null);
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `https://lkxrmjqrzhaivviuuamp.supabase.co/functions/v1/auto-assign-conversations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ 
            mode,
            startOffset: continueFromOffset,
            processAll,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao executar atribuição automática');
      }

      // Merge results if continuing
      if (continueFromOffset > 0 && results) {
        setResults([...results, ...data.results]);
      } else {
        setResults(data.results);
      }
      
      setSummary(data.summary);
      setNextOffset(data.summary.nextOffset);

      if (mode === 'preview') {
        toast.info(`Preview: ${data.summary.successful} conversas seriam atribuídas`);
      } else if (data.summary.stoppedByTimeout) {
        toast.warning(`Processadas ${data.summary.totalProcessed} conversas. Clique em "Continuar" para processar mais.`);
      } else {
        toast.success(`${data.summary.successful} conversas atribuídas com sucesso!`);
      }
    } catch (error: any) {
      console.error('Auto-assign error:', error);
      toast.error(error.message || 'Erro ao executar atribuição automática');
    } finally {
      setIsLoading(false);
    }
  };

  const resetDialog = () => {
    setResults(null);
    setSummary(null);
    setMode('preview');
    setProcessAll(false);
    setNextOffset(0);
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    return `${seconds}s`;
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Atribuição Automática de Conversas
          </CardTitle>
          <CardDescription>
            Atribui conversas automaticamente aos usuários baseado no padrão de nome nas mensagens (*Nome*:)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border">
              <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 shrink-0" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Como funciona:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Busca mensagens enviadas com o padrão <code className="bg-muted px-1 rounded">*Nome*:</code></li>
                  <li>Identifica o usuário pelo nome e atribui a conversa a ele</li>
                  <li>Conversas já atribuídas são ignoradas automaticamente</li>
                </ul>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">
                    Usuários disponíveis ({recognizedUsers.length})
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchRecognizedUsers}
                  disabled={isLoadingUsers}
                >
                  {isLoadingUsers ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  <span className="ml-2">Atualizar</span>
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recognizedUsers.length > 0 ? (
                  recognizedUsers.map((user) => (
                    <Badge key={user.id} variant="secondary" className="text-xs">
                      {user.name}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {isLoadingUsers ? 'Carregando...' : 'Nenhum usuário encontrado'}
                  </span>
                )}
              </div>
            </div>

            <Button
              onClick={() => {
                resetDialog();
                setIsDialogOpen(true);
              }}
              className="w-full sm:w-auto"
            >
              <Wand2 className="h-4 w-4 mr-2" />
              Executar Atribuição Automática
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              Atribuição Automática de Conversas
            </DialogTitle>
            <DialogDescription>
              Selecione o modo de execução e clique em executar
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Modo de Execução</label>
                <Select value={mode} onValueChange={(v) => setMode(v as any)} disabled={isLoading}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preview">
                      <div className="flex items-center gap-2">
                        <span>🔍 Preview</span>
                        <span className="text-muted-foreground text-xs">- Apenas visualizar (não altera nada)</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="test">
                      <div className="flex items-center gap-2">
                        <span>🧪 Teste</span>
                        <span className="text-muted-foreground text-xs">- Atribui 1 conversa por usuário</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="full">
                      <div className="flex items-center gap-2">
                        <span>🚀 Completo</span>
                        <span className="text-muted-foreground text-xs">- Atribui todas as conversas</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Checkbox para processar todas as conversas */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                <Checkbox 
                  id="processAll" 
                  checked={processAll} 
                  onCheckedChange={(checked) => setProcessAll(checked === true)}
                  disabled={isLoading}
                />
                <div className="grid gap-1.5 leading-none">
                  <Label 
                    htmlFor="processAll" 
                    className="text-sm font-medium cursor-pointer flex items-center gap-2"
                  >
                    <UserCheck className="h-4 w-4 text-yellow-500" />
                    Processar TODAS as conversas
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Inclui conversas já atribuídas. Use apenas para corrigir atribuições existentes ou definir o "Atendente Responsável" em todos os contatos.
                  </p>
                </div>
              </div>
            </div>

            {summary && (
              <div className="space-y-4">
                {/* Header com status */}
                <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {summary.stoppedByTimeout ? (
                        <Clock className="h-5 w-5 text-yellow-500" />
                      ) : summary.mode === 'preview' ? (
                        <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      ) : (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                      <span className="font-medium">
                        {summary.stoppedByTimeout 
                          ? 'Pausado por Timeout' 
                          : summary.mode === 'preview' 
                            ? 'Preview' 
                            : 'Resultado'}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      {formatTime(summary.executionTimeMs)}
                    </Badge>
                  </div>

                  {/* Grid de estatísticas principais */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="p-3 rounded-lg bg-background text-center">
                      <div className="text-xl font-bold text-muted-foreground">{summary.totalInDatabase}</div>
                      <div className="text-xs text-muted-foreground">No Banco</div>
                    </div>
                    <div className="p-3 rounded-lg bg-background text-center">
                      <div className="text-xl font-bold text-primary">{summary.totalProcessed}</div>
                      <div className="text-xs text-muted-foreground">Processadas</div>
                    </div>
                    <div className="p-3 rounded-lg bg-background text-center">
                      <div className="text-xl font-bold text-green-500">{summary.successful}</div>
                      <div className="text-xs text-muted-foreground">Atribuídas</div>
                    </div>
                    <div className="p-3 rounded-lg bg-background text-center">
                      <div className="text-xl font-bold text-emerald-500">{summary.contactsUpdated || 0}</div>
                      <div className="text-xs text-muted-foreground">Donos Definidos</div>
                    </div>
                    <div className="p-3 rounded-lg bg-background text-center">
                      <div className="text-xl font-bold text-red-500">{summary.errors}</div>
                      <div className="text-xs text-muted-foreground">Erros</div>
                    </div>
                  </div>

                  {/* Estatísticas detalhadas */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                    <div className="flex justify-between p-2 bg-background rounded">
                      <span className="text-muted-foreground">Sem padrão *Nome*:</span>
                      <span className="font-medium">{summary.noPatternFound}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-background rounded">
                      <span className="text-muted-foreground">Usuário não encontrado:</span>
                      <span className="font-medium">{summary.userNotFound}</span>
                    </div>
                    {summary.skippedTestMode > 0 && (
                      <div className="flex justify-between p-2 bg-background rounded">
                        <span className="text-muted-foreground">Puladas (teste):</span>
                        <span className="font-medium">{summary.skippedTestMode}</span>
                      </div>
                    )}
                  </div>

                  {/* Por usuário */}
                  {Object.keys(summary.byUser).length > 0 && (
                    <div className="space-y-2">
                      <span className="text-sm font-medium flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Por Usuário:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(summary.byUser)
                          .sort((a, b) => b[1] - a[1])
                          .map(([name, count]) => (
                            <Badge key={name} variant="secondary">
                              {name}: {count}
                            </Badge>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Timeout warning com botão de continuar */}
                  {summary.stoppedByTimeout && summary.canContinue && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                      <div className="flex items-center gap-2 text-sm">
                        <SkipForward className="h-4 w-4 text-yellow-500" />
                        <span>Restam ~{summary.totalInDatabase - summary.nextOffset} conversas para processar</span>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleAutoAssign(summary.nextOffset)}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Play className="h-4 w-4 mr-1" />
                        )}
                        Continuar
                      </Button>
                    </div>
                  )}
                </div>

                {/* Accordion com detalhes extras */}
                <Accordion type="single" collapsible className="w-full">
                  {/* Padrões não reconhecidos */}
                  {Object.keys(summary.unrecognizedPatterns).length > 0 && (
                    <AccordionItem value="unrecognized">
                      <AccordionTrigger className="text-sm">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          Padrões não reconhecidos ({Object.keys(summary.unrecognizedPatterns).length})
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="flex flex-wrap gap-2 p-2">
                          {Object.entries(summary.unrecognizedPatterns)
                            .sort((a, b) => b[1] - a[1])
                            .map(([pattern, count]) => (
                              <Badge key={pattern} variant="outline" className="text-xs">
                                "{pattern}": {count}x
                              </Badge>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 px-2">
                          Estes padrões foram encontrados nas mensagens mas não correspondem a nenhum usuário cadastrado.
                        </p>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Conversas sem padrão */}
                  {summary.conversationsWithoutPatternExamples.length > 0 && (
                    <AccordionItem value="no-pattern">
                      <AccordionTrigger className="text-sm">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                          Exemplos sem padrão *Nome*: ({summary.conversationsWithoutPatternExamples.length})
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="flex flex-wrap gap-2 p-2">
                          {summary.conversationsWithoutPatternExamples.map((example, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {example}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 px-2">
                          Essas conversas não têm mensagens com o padrão *Nome*: nas mensagens enviadas.
                        </p>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Detalhes das atribuições */}
                  {results && results.length > 0 && (
                    <AccordionItem value="results">
                      <AccordionTrigger className="text-sm">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          Detalhes das atribuições ({results.length})
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <ScrollArea className="h-[200px]">
                          <div className="space-y-1 p-2">
                            {results.map((result, i) => (
                              <div
                                key={i}
                                className={`p-2 rounded text-sm flex items-center justify-between ${
                                  result.success ? 'bg-green-500/10' : 'bg-red-500/10'
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate">
                                  {result.success ? (
                                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                                  ) : (
                                    <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                                  )}
                                  <span className="truncate">{result.contactName}</span>
                                </div>
                                <Badge variant={result.success ? 'default' : 'destructive'} className="shrink-0">
                                  {result.userName}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </AccordionContent>
                    </AccordionItem>
                  )}
                </Accordion>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Fechar
            </Button>
            <Button onClick={() => handleAutoAssign(0)} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  {mode === 'preview' ? 'Visualizar' : summary ? 'Executar Novamente' : 'Executar'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Importer */}
      <ContactImporter />

      {/* State Identification */}
      <StateIdentificationSettings />

      {/* Agent Tag Sync */}
      <AgentTagSyncSettings />
    </div>
  );
}
