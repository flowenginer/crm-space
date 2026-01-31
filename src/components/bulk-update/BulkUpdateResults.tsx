import { Check, X, AlertTriangle, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { BulkUpdateResult } from '@/hooks/useBulkLeadUpdate';

interface BulkUpdateResultsProps {
  result: BulkUpdateResult;
  onNewImport: () => void;
}

export function BulkUpdateResults({ result, onNewImport }: BulkUpdateResultsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const successRate = result.total > 0 
    ? Math.round((result.updated / result.total) * 100) 
    : 0;

  return (
    <div className="space-y-4">
      {/* Resumo Principal */}
      <Card className="border-green-500/50 bg-green-500/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center">
              <Check className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle>Atualização Concluída!</CardTitle>
              <CardDescription>
                {result.updated} de {result.total} leads atualizados ({successRate}%)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{result.updated}</div>
            <p className="text-sm text-muted-foreground">Atualizados</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{result.notFound}</div>
            <p className="text-sm text-muted-foreground">Não Encontrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{result.errors}</div>
            <p className="text-sm text-muted-foreground">Erros</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{result.total}</div>
            <p className="text-sm text-muted-foreground">Total</p>
          </CardContent>
        </Card>
      </div>

      {/* Resumo de Valores */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resumo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Valor Total Negociado</p>
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(result.summary.totalValue)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total de Camisas</p>
              <p className="text-2xl font-bold">
                {result.summary.totalQuantity}
              </p>
            </div>
          </div>

          {/* Por Vendedor */}
          {Object.keys(result.summary.byAgent).length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Por Vendedor</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(result.summary.byAgent).map(([agent, count]) => (
                  <Badge key={agent} variant="secondary">
                    {agent}: {count} leads
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Log Detalhado */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Log Detalhado</CardTitle>
          <CardDescription>
            Histórico de cada atualização
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {result.log.map((entry, index) => (
                <div 
                  key={index}
                  className={`
                    flex items-center justify-between p-3 rounded-lg border
                    ${entry.success ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}
                  `}
                >
                  <div className="flex items-center gap-3">
                    {entry.success ? (
                      <Check className="h-4 w-4 text-green-500 shrink-0" />
                    ) : (
                      <X className="h-4 w-4 text-red-500 shrink-0" />
                    )}
                    <div>
                      <p className="font-medium">
                        {entry.contactName || entry.phone}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {entry.phone}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {entry.success ? (
                      <div className="flex flex-wrap gap-1 justify-end">
                        {entry.updatedFields.map(field => (
                          <Badge key={field} variant="outline" className="text-xs">
                            {field}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-red-500">{entry.error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="flex justify-center">
        <Button onClick={onNewImport} className="gap-2">
          Nova Importação
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
