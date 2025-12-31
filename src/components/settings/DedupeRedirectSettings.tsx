import { useState } from 'react';
import { Loader2, AlertTriangle, CheckCircle, Merge, Eye, Play, RefreshCw } from 'lucide-react';
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
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface MergeResult {
  keepPhone: string;
  dupPhone: string;
  keepId: string;
  dupId: string;
  success: boolean;
  error?: string;
}

interface DedupeSummary {
  mode: string;
  windowDays: number | string;
  redirectLogsScanned: number;
  uniqueContactsProcessed: number;
  duplicatesFound: number;
  mergesExecuted: number;
  mergesFailed: number;
  startOffset: number;
  nextOffset: number;
  totalInDatabase: number;
  canContinue: boolean;
  examples: MergeResult[];
}

export function DedupeRedirectSettings() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [mode, setMode] = useState<'preview' | 'execute'>('preview');
  const [windowDays, setWindowDays] = useState<string>('30');
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<DedupeSummary | null>(null);
  const [nextOffset, setNextOffset] = useState(0);

  const handleDedupe = async (continueFromOffset = 0) => {
    setIsLoading(true);
    if (continueFromOffset === 0) {
      setSummary(null);
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `https://lkxrmjqrzhaivviuuamp.supabase.co/functions/v1/dedupe-redirect-contacts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ 
            mode,
            windowDays: windowDays === 'all' ? 'all' : parseInt(windowDays),
            startOffset: continueFromOffset,
            batchSize: 100,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao executar deduplicação');
      }

      setSummary(data.summary);
      setNextOffset(data.summary.nextOffset);

      if (mode === 'preview') {
        if (data.summary.duplicatesFound > 0) {
          toast.info(`Preview: ${data.summary.duplicatesFound} duplicatas encontradas`);
        } else {
          toast.success('Nenhuma duplicata encontrada!');
        }
      } else {
        if (data.summary.mergesExecuted > 0) {
          toast.success(`${data.summary.mergesExecuted} contatos mesclados com sucesso!`);
        } else {
          toast.info('Nenhuma duplicata para mesclar');
        }
      }
    } catch (error: any) {
      console.error('Dedupe error:', error);
      toast.error(error.message || 'Erro ao executar deduplicação');
    } finally {
      setIsLoading(false);
    }
  };

  const resetDialog = () => {
    setSummary(null);
    setMode('preview');
    setWindowDays('30');
    setNextOffset(0);
  };

  const formatPhone = (phone: string) => {
    if (phone.length === 13 && phone.startsWith('55')) {
      return `(${phone.slice(2, 4)}) ${phone.slice(4, 9)}-${phone.slice(9)}`;
    }
    if (phone.length === 12 && phone.startsWith('55')) {
      return `(${phone.slice(2, 4)}) ${phone.slice(4, 8)}-${phone.slice(8)}`;
    }
    return phone;
  };

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5 text-primary" />
            Deduplicar Leads do Redirect
          </CardTitle>
          <CardDescription>
            Mescla contatos duplicados que vieram pela página de redirect (com/sem 9º dígito)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border">
              <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 shrink-0" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Como funciona:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Busca contatos que se cadastraram via página de redirect</li>
                  <li>Identifica duplicatas por variações do telefone (com/sem 9º dígito)</li>
                  <li>Mescla conversas, mensagens e tags no contato principal</li>
                  <li>Preserva o nome real do cliente quando disponível</li>
                </ul>
              </div>
            </div>

            <Button
              onClick={() => {
                resetDialog();
                setIsDialogOpen(true);
              }}
              className="w-full sm:w-auto"
            >
              <Merge className="h-4 w-4 mr-2" />
              Executar Deduplicação
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Merge className="h-5 w-5 text-primary" />
              Deduplicar Leads do Redirect
            </DialogTitle>
            <DialogDescription>
              Selecione o período e modo de execução
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Período</label>
                <Select value={windowDays} onValueChange={setWindowDays} disabled={isLoading}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Últimos 7 dias</SelectItem>
                    <SelectItem value="30">Últimos 30 dias</SelectItem>
                    <SelectItem value="90">Últimos 90 dias</SelectItem>
                    <SelectItem value="all">Todo o histórico</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Modo</label>
                <Select value={mode} onValueChange={(v) => setMode(v as any)} disabled={isLoading}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preview">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        <span>Preview</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="execute">
                      <div className="flex items-center gap-2">
                        <Play className="h-4 w-4" />
                        <span>Executar</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {summary && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {summary.mode === 'preview' ? (
                        <Eye className="h-5 w-5 text-blue-500" />
                      ) : summary.mergesFailed > 0 ? (
                        <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      ) : (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                      <span className="font-medium">
                        {summary.mode === 'preview' ? 'Preview' : 'Resultado'}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {summary.windowDays === 'all' ? 'Todo histórico' : `${summary.windowDays} dias`}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg bg-background text-center">
                      <div className="text-xl font-bold text-muted-foreground">{summary.uniqueContactsProcessed}</div>
                      <div className="text-xs text-muted-foreground">Contatos Analisados</div>
                    </div>
                    <div className="p-3 rounded-lg bg-background text-center">
                      <div className="text-xl font-bold text-primary">{summary.duplicatesFound}</div>
                      <div className="text-xs text-muted-foreground">Duplicatas</div>
                    </div>
                    <div className="p-3 rounded-lg bg-background text-center">
                      <div className="text-xl font-bold text-green-500">{summary.mergesExecuted}</div>
                      <div className="text-xs text-muted-foreground">Mesclados</div>
                    </div>
                    <div className="p-3 rounded-lg bg-background text-center">
                      <div className="text-xl font-bold text-red-500">{summary.mergesFailed}</div>
                      <div className="text-xs text-muted-foreground">Erros</div>
                    </div>
                  </div>

                  {summary.canContinue && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                      <div className="flex items-center gap-2 text-sm">
                        <RefreshCw className="h-4 w-4 text-yellow-500" />
                        <span>Restam mais registros para processar</span>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleDedupe(summary.nextOffset)}
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

                {summary.examples.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Merge className="h-4 w-4" />
                      {summary.mode === 'preview' ? 'Duplicatas encontradas:' : 'Contatos mesclados:'}
                    </span>
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-1">
                        {summary.examples.map((result, i) => (
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
                              <span className="font-mono text-xs">{formatPhone(result.keepPhone)}</span>
                              <span className="text-muted-foreground">←</span>
                              <span className="font-mono text-xs text-muted-foreground">{formatPhone(result.dupPhone)}</span>
                            </div>
                            {!result.success && result.error && (
                              <Badge variant="destructive" className="shrink-0 text-xs">
                                {result.error.substring(0, 30)}
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Fechar
            </Button>
            <Button onClick={() => handleDedupe(0)} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  {mode === 'preview' ? <Eye className="h-4 w-4 mr-2" /> : <Merge className="h-4 w-4 mr-2" />}
                  {mode === 'preview' ? 'Visualizar' : summary ? 'Executar Novamente' : 'Executar'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
