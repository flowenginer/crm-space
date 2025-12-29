import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useBlingImport, useBlingPreview, type BlingPreviewItem } from '@/hooks/useBlingIntegration';
import { Download, CheckCircle, XCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import type { BlingEntityType } from './BlingIntegrationBanner';

interface BlingImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: BlingEntityType;
}

const entityConfig: Record<BlingEntityType, { title: string; description: string }> = {
  products: {
    title: 'Importar Produtos do Bling',
    description: 'Importe produtos cadastrados no Bling para seu ERP',
  },
  contacts: {
    title: 'Importar Contatos do Bling',
    description: 'Importe clientes e fornecedores do Bling para seu ERP',
  },
  orders: {
    title: 'Importar Pedidos do Bling',
    description: 'Importe pedidos de venda do Bling para seu ERP',
  },
  financial: {
    title: 'Importar Dados Financeiros do Bling',
    description: 'Importe contas a pagar e receber do Bling',
  },
};

type ImportMode = 'all' | 'new_only' | 'update_existing';

export function BlingImportModal({ open, onOpenChange, entityType }: BlingImportModalProps) {
  const [step, setStep] = useState<'options' | 'preview' | 'importing' | 'complete'>('options');
  const [importMode, setImportMode] = useState<ImportMode>('new_only');
  
  const preview = useBlingPreview(entityType);
  const importMutation = useBlingImport();

  const config = entityConfig[entityType];

  const handleLoadPreview = () => {
    preview.mutate(undefined, {
      onSuccess: () => setStep('preview'),
    });
  };

  const handleStartImport = () => {
    setStep('importing');
    importMutation.mutate(
      { entityType, mode: importMode },
      {
        onSuccess: () => setStep('complete'),
        onError: () => setStep('preview'),
      }
    );
  };

  const handleClose = () => {
    setStep('options');
    setImportMode('new_only');
    onOpenChange(false);
  };

  const renderOptionsStep = () => (
    <>
      <div className="space-y-6 py-4">
        <RadioGroup value={importMode} onValueChange={(v) => setImportMode(v as ImportMode)}>
          <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
            <RadioGroupItem value="all" id="all" className="mt-1" />
            <Label htmlFor="all" className="cursor-pointer flex-1">
              <div className="font-medium">Importar todos</div>
              <div className="text-sm text-muted-foreground">
                Importa todos os registros do Bling, criando novos e atualizando existentes
              </div>
            </Label>
          </div>
          
          <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
            <RadioGroupItem value="new_only" id="new_only" className="mt-1" />
            <Label htmlFor="new_only" className="cursor-pointer flex-1">
              <div className="font-medium">Apenas novos</div>
              <div className="text-sm text-muted-foreground">
                Importa apenas registros que ainda não existem no ERP local
              </div>
            </Label>
          </div>
          
          <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
            <RadioGroupItem value="update_existing" id="update_existing" className="mt-1" />
            <Label htmlFor="update_existing" className="cursor-pointer flex-1">
              <div className="font-medium">Atualizar existentes + novos</div>
              <div className="text-sm text-muted-foreground">
                Atualiza registros já sincronizados e importa os novos
              </div>
            </Label>
          </div>
        </RadioGroup>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={handleClose}>
          Cancelar
        </Button>
        <Button onClick={handleLoadPreview} disabled={preview.isPending}>
          {preview.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Carregando...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Carregar Preview
            </>
          )}
        </Button>
      </DialogFooter>
    </>
  );

  const renderPreviewStep = () => {
    const data = preview.data;
    const items = data?.items || [];
    const summary = data?.summary || { total: 0, new: 0, existing: 0 };

    return (
      <>
        <div className="space-y-4 py-4">
          <div className="flex gap-3">
            <Badge variant="outline" className="text-sm">
              Total: {summary.total}
            </Badge>
            <Badge variant="default" className="text-sm bg-green-600">
              Novos: {summary.new}
            </Badge>
            <Badge variant="secondary" className="text-sm">
              Existentes: {summary.existing}
            </Badge>
          </div>

          <ScrollArea className="h-[300px] border rounded-lg">
            <div className="p-2 space-y-1">
              {items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum registro encontrado no Bling
                </div>
              ) : (
                items.map((item: BlingPreviewItem) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 rounded hover:bg-muted/50"
                  >
                    <div>
                      <span className="font-medium">{item.name}</span>
                      {item.code && (
                        <span className="text-sm text-muted-foreground ml-2">
                          ({item.code})
                        </span>
                      )}
                    </div>
                    <Badge variant={item.isNew ? 'default' : 'secondary'}>
                      {item.isNew ? 'Novo' : 'Já existe'}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setStep('options')}>
            Voltar
          </Button>
          <Button onClick={handleStartImport} disabled={items.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Importar {summary.total} Registros
          </Button>
        </DialogFooter>
      </>
    );
  };

  const renderImportingStep = () => (
    <div className="py-8 space-y-6">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 text-primary animate-spin" />
        <div className="text-center">
          <h3 className="font-medium text-lg">Importando dados...</h3>
          <p className="text-muted-foreground">
            Aguarde enquanto os dados são sincronizados
          </p>
        </div>
      </div>
      <Progress value={undefined} className="w-full" />
    </div>
  );

  const renderCompleteStep = () => {
    const result = importMutation.data;
    const hasErrors = (result?.errors || 0) > 0;

    return (
      <>
        <div className="py-8 space-y-6">
          <div className="flex flex-col items-center gap-4">
            {hasErrors ? (
              <AlertCircle className="h-12 w-12 text-amber-500" />
            ) : (
              <CheckCircle className="h-12 w-12 text-green-500" />
            )}
            <div className="text-center">
              <h3 className="font-medium text-lg">
                {hasErrors ? 'Importação concluída com avisos' : 'Importação concluída!'}
              </h3>
              <p className="text-muted-foreground">
                Os dados foram sincronizados com sucesso
              </p>
            </div>
          </div>

          <div className="flex justify-center gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{result?.created || 0}</div>
              <div className="text-sm text-muted-foreground">Criados</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{result?.updated || 0}</div>
              <div className="text-sm text-muted-foreground">Atualizados</div>
            </div>
            {(result?.errors || 0) > 0 && (
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{result?.errors || 0}</div>
                <div className="text-sm text-muted-foreground">Erros</div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleClose}>
            Fechar
          </Button>
        </DialogFooter>
      </>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {config.title}
          </DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>

        {step === 'options' && renderOptionsStep()}
        {step === 'preview' && renderPreviewStep()}
        {step === 'importing' && renderImportingStep()}
        {step === 'complete' && renderCompleteStep()}
      </DialogContent>
    </Dialog>
  );
}
