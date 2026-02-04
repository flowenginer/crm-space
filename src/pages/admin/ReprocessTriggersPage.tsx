import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, AlertTriangle, CheckCircle2, Play, RefreshCw, Zap } from "lucide-react";
import { toast } from "sonner";

interface ProcessingResult {
  success: boolean;
  dry_run: boolean;
  summary: {
    tenants_processed: number;
    flows_checked: number;
    messages_scanned: number;
    already_executed: number;
    triggers_fired: number;
    errors: number;
  };
  details: Array<{
    tenant_id: string;
    flow_name: string;
    keyword: string;
    messages_found: number;
    already_executed: number;
    triggered: number;
  }>;
  continue_from?: string;
  has_more?: boolean;
  error?: string;
}

export default function ReprocessTriggersPage() {
  const [selectedTenant, setSelectedTenant] = useState<string>("all");
  const [triggerType, setTriggerType] = useState<string>("all");
  const [daysBack, setDaysBack] = useState<string>("7");
  const [batchSize, setBatchSize] = useState<string>("50");
  const [dryRun, setDryRun] = useState(true);
  const [results, setResults] = useState<ProcessingResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [continueFrom, setContinueFrom] = useState<string | undefined>();

  // Buscar tenants disponíveis
  const { data: tenants, isLoading: loadingTenants } = useQuery({
    queryKey: ["tenants-for-reprocess"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, name")
        .order("name");
      
      if (error) throw error;
      return data;
    },
  });

  // Mutation para executar o reprocessamento
  const reprocessMutation = useMutation({
    mutationFn: async (params: {
      tenant_id?: string;
      trigger_type: string;
      days_back: number;
      batch_size: number;
      dry_run: boolean;
      continue_from?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("reprocess-missed-triggers", {
        body: params,
      });

      if (error) throw error;
      return data as ProcessingResult;
    },
    onSuccess: (data) => {
      setResults(prev => [...prev, data]);
      
      if (data.has_more && data.continue_from) {
        setContinueFrom(data.continue_from);
      } else {
        setContinueFrom(undefined);
        setIsProcessing(false);
        
        if (data.dry_run) {
          toast.info("Simulação concluída", {
            description: `${data.summary.triggers_fired} triggers seriam disparados`,
          });
        } else {
          toast.success("Reprocessamento concluído", {
            description: `${data.summary.triggers_fired} triggers disparados`,
          });
        }
      }
    },
    onError: (error) => {
      setIsProcessing(false);
      toast.error("Erro ao reprocessar", {
        description: String(error),
      });
    },
  });

  const handleStart = () => {
    setResults([]);
    setContinueFrom(undefined);
    setIsProcessing(true);
    
    reprocessMutation.mutate({
      tenant_id: selectedTenant === "all" ? undefined : selectedTenant,
      trigger_type: triggerType as "message_key" | "keyword" | "all",
      days_back: parseInt(daysBack),
      batch_size: parseInt(batchSize),
      dry_run: dryRun,
    });
  };

  const handleContinue = () => {
    if (!continueFrom) return;
    
    reprocessMutation.mutate({
      tenant_id: selectedTenant === "all" ? undefined : selectedTenant,
      trigger_type: triggerType as "message_key" | "keyword" | "all",
      days_back: parseInt(daysBack),
      batch_size: parseInt(batchSize),
      dry_run: dryRun,
      continue_from: continueFrom,
    });
  };

  // Calcular totais agregados
  const aggregatedSummary = results.reduce(
    (acc, r) => ({
      tenants_processed: Math.max(acc.tenants_processed, r.summary.tenants_processed),
      flows_checked: Math.max(acc.flows_checked, r.summary.flows_checked),
      messages_scanned: acc.messages_scanned + r.summary.messages_scanned,
      already_executed: acc.already_executed + r.summary.already_executed,
      triggers_fired: acc.triggers_fired + r.summary.triggers_fired,
      errors: acc.errors + r.summary.errors,
    }),
    { tenants_processed: 0, flows_checked: 0, messages_scanned: 0, already_executed: 0, triggers_fired: 0, errors: 0 }
  );

  // Agregar detalhes
  const aggregatedDetails = results.flatMap(r => r.details);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Zap className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Reprocessar Triggers Perdidos</h1>
          <p className="text-muted-foreground">
            Dispara automações para mensagens que não foram processadas
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Configurações */}
        <Card>
          <CardHeader>
            <CardTitle>Configurações</CardTitle>
            <CardDescription>
              Defina os parâmetros do reprocessamento
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tenant</Label>
              <Select value={selectedTenant} onValueChange={setSelectedTenant} disabled={isProcessing}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um tenant" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tenants</SelectItem>
                  {tenants?.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Trigger</Label>
              <Select value={triggerType} onValueChange={setTriggerType} disabled={isProcessing}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="message_key">Message Key (enviadas)</SelectItem>
                  <SelectItem value="keyword">Keyword (recebidas)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Período (dias atrás)</Label>
              <Select value={daysBack} onValueChange={setDaysBack} disabled={isProcessing}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 dia</SelectItem>
                  <SelectItem value="3">3 dias</SelectItem>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="14">14 dias</SelectItem>
                  <SelectItem value="30">30 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tamanho do Lote</Label>
              <Select value={batchSize} onValueChange={setBatchSize} disabled={isProcessing}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 mensagens</SelectItem>
                  <SelectItem value="25">25 mensagens</SelectItem>
                  <SelectItem value="50">50 mensagens</SelectItem>
                  <SelectItem value="100">100 mensagens</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="space-y-0.5">
                <Label>Modo Simulação (Dry Run)</Label>
                <p className="text-xs text-muted-foreground">
                  Apenas mostra o que seria processado
                </p>
              </div>
              <Switch
                checked={dryRun}
                onCheckedChange={setDryRun}
                disabled={isProcessing}
              />
            </div>

            {!dryRun && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Atenção!</AlertTitle>
                <AlertDescription>
                  O modo de produção irá disparar automações reais. 
                  Recomendamos executar primeiro em modo simulação.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleStart}
                disabled={isProcessing || loadingTenants}
                className="flex-1"
              >
                {reprocessMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    {dryRun ? "Simular" : "Executar"}
                  </>
                )}
              </Button>
              
              {continueFrom && !reprocessMutation.isPending && (
                <Button onClick={handleContinue} variant="outline">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Continuar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Resumo */}
        <Card>
          <CardHeader>
            <CardTitle>Resumo</CardTitle>
            <CardDescription>
              Resultado do processamento
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {results.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Execute uma simulação ou reprocessamento para ver os resultados
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">{aggregatedSummary.flows_checked}</div>
                    <div className="text-xs text-muted-foreground">Fluxos verificados</div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">{aggregatedSummary.messages_scanned}</div>
                    <div className="text-xs text-muted-foreground">Mensagens analisadas</div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-amber-500">{aggregatedSummary.already_executed}</div>
                    <div className="text-xs text-muted-foreground">Já executados</div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-green-500">{aggregatedSummary.triggers_fired}</div>
                    <div className="text-xs text-muted-foreground">
                      {dryRun ? "Seriam disparados" : "Disparados"}
                    </div>
                  </div>
                </div>

                {aggregatedSummary.errors > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Erros encontrados</AlertTitle>
                    <AlertDescription>
                      {aggregatedSummary.errors} erros durante o processamento
                    </AlertDescription>
                  </Alert>
                )}

                {continueFrom && (
                  <Alert>
                    <RefreshCw className="h-4 w-4" />
                    <AlertTitle>Mais mensagens disponíveis</AlertTitle>
                    <AlertDescription>
                      Clique em "Continuar" para processar mais mensagens
                    </AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detalhes */}
      {aggregatedDetails.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Detalhes por Fluxo</CardTitle>
            <CardDescription>
              Breakdown das mensagens encontradas por fluxo e keyword
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {aggregatedDetails.map((detail, index) => (
                  <div
                    key={`${detail.flow_name}-${detail.keyword}-${index}`}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="space-y-1">
                      <div className="font-medium">{detail.flow_name}</div>
                      <div className="text-sm text-muted-foreground">
                        Keyword: <Badge variant="outline">{detail.keyword}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-center">
                        <div className="font-medium">{detail.messages_found}</div>
                        <div className="text-xs text-muted-foreground">Encontradas</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-amber-500">{detail.already_executed}</div>
                        <div className="text-xs text-muted-foreground">Já exec.</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-green-500">{detail.triggered}</div>
                        <div className="text-xs text-muted-foreground">
                          {dryRun ? "Seriam" : "Disparados"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
