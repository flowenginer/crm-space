import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, CheckCircle2, XCircle, Clock } from "lucide-react";
import { WebhookConfig, useTestWebhook } from "@/hooks/useWebhooks";

interface WebhookTestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhook: WebhookConfig | null;
}

interface TestResult {
  success: boolean;
  statusCode?: number;
  responseTime?: number;
  response?: string;
  error?: string;
}

export function WebhookTestModal({ open, onOpenChange, webhook }: WebhookTestModalProps) {
  const [result, setResult] = useState<TestResult | null>(null);
  const testWebhook = useTestWebhook();

  const handleTest = async () => {
    if (!webhook) return;

    setResult(null);

    try {
      const response = await testWebhook.mutateAsync({
        url: webhook.url,
        auth_type: webhook.auth_type,
        auth_token: webhook.auth_token || undefined,
        auth_header_name: webhook.auth_header_name || undefined,
        auth_header_value: webhook.auth_header_value || undefined,
      });

      setResult(response);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  };

  const testPayload = {
    event: "test",
    timestamp: new Date().toISOString(),
    message: "Este é um teste de webhook do CRM",
    data: {
      test: true,
    },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Testar Webhook</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-1">URL</p>
            <p className="text-sm text-muted-foreground break-all bg-muted p-2 rounded">
              {webhook?.url}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium mb-1">Payload de Teste</p>
            <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-[150px]">
              {JSON.stringify(testPayload, null, 2)}
            </pre>
          </div>

          {result && (
            <div className={`p-4 rounded-lg border ${result.success ? 'bg-green-500/10 border-green-500/20' : 'bg-destructive/10 border-destructive/20'}`}>
              <div className="flex items-center gap-2 mb-2">
                {result.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                <span className="font-medium">
                  {result.success ? 'Sucesso!' : 'Falha'}
                </span>
                {result.statusCode && (
                  <Badge variant={result.success ? "outline" : "destructive"}>
                    {result.statusCode}
                  </Badge>
                )}
              </div>

              {result.responseTime && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                  <Clock className="h-4 w-4" />
                  <span>Tempo de resposta: {result.responseTime}ms</span>
                </div>
              )}

              {result.error && (
                <p className="text-sm text-destructive">{result.error}</p>
              )}

              {result.response && (
                <div>
                  <p className="text-xs font-medium mb-1">Resposta:</p>
                  <pre className="text-xs bg-background/50 p-2 rounded overflow-auto max-h-[100px]">
                    {result.response}
                  </pre>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button onClick={handleTest} disabled={testWebhook.isPending}>
              {testWebhook.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Enviar Teste
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
