import { useState, useEffect } from 'react';
import { Wand2, Loader2, AlertTriangle, CheckCircle, Users, RefreshCw } from 'lucide-react';
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

interface AssignmentResult {
  conversationId: string;
  contactName: string;
  userName: string;
  userId: string;
  success: boolean;
  error?: string;
}

interface AssignmentSummary {
  totalProcessed: number;
  successful: number;
  failed: number;
  byUser: Record<string, number>;
  mode: string;
  availableUsers?: string[];
}

interface RecognizedUser {
  id: string;
  name: string;
  departmentId: string | null;
}

export function ToolsSettings() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [mode, setMode] = useState<'preview' | 'test' | 'full'>('preview');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [results, setResults] = useState<AssignmentResult[] | null>(null);
  const [summary, setSummary] = useState<AssignmentSummary | null>(null);
  const [recognizedUsers, setRecognizedUsers] = useState<RecognizedUser[]>([]);

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

  const handleAutoAssign = async () => {
    setIsLoading(true);
    setResults(null);
    setSummary(null);

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
            limit: mode === 'test' ? 50 : undefined,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao executar atribuição automática');
      }

      setResults(data.results);
      setSummary(data.summary);

      if (mode === 'preview') {
        toast.info(`Preview: ${data.summary.successful} conversas seriam atribuídas`);
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
                  <li>Busca a última mensagem enviada com o padrão <code className="bg-muted px-1 rounded">*Nome*:</code></li>
                  <li>Identifica o usuário pelo nome e atribui a conversa a ele</li>
                  <li>Qualquer usuário cadastrado no sistema pode receber atribuições</li>
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
        <DialogContent className="max-w-2xl max-h-[80vh]">
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
            <div className="space-y-2">
              <label className="text-sm font-medium">Modo de Execução</label>
              <Select value={mode} onValueChange={(v) => setMode(v as any)}>
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

            {summary && (
              <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-3">
                <div className="flex items-center gap-2">
                  {summary.mode === 'preview' ? (
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                  <span className="font-medium">
                    {summary.mode === 'preview' ? 'Preview' : 'Resultado'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-3 rounded-lg bg-background">
                    <div className="text-2xl font-bold text-primary">{summary.totalProcessed}</div>
                    <div className="text-xs text-muted-foreground">Total</div>
                  </div>
                  <div className="p-3 rounded-lg bg-background">
                    <div className="text-2xl font-bold text-green-500">{summary.successful}</div>
                    <div className="text-xs text-muted-foreground">Sucesso</div>
                  </div>
                  <div className="p-3 rounded-lg bg-background">
                    <div className="text-2xl font-bold text-red-500">{summary.failed}</div>
                    <div className="text-xs text-muted-foreground">Falhas</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Por Usuário:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(summary.byUser).map(([name, count]) => (
                      <Badge key={name} variant="secondary">
                        {name}: {count}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {results && results.length > 0 && (
              <div className="space-y-2">
                <span className="text-sm font-medium">Detalhes:</span>
                <ScrollArea className="h-[200px] rounded-lg border border-border">
                  <div className="p-2 space-y-1">
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
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Fechar
            </Button>
            <Button onClick={handleAutoAssign} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  {mode === 'preview' ? 'Visualizar' : 'Executar'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
