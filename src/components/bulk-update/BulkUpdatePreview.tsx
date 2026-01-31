import { useState, useEffect } from 'react';
import { Check, AlertTriangle, X, User, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  MatchedRow, 
  BulkUpdateOptions, 
  autoMapBlingColumns, 
  parseBRLValue, 
  parseQuantity,
  BulkUpdateRow 
} from '@/hooks/useBulkLeadUpdate';

interface BulkUpdatePreviewProps {
  headers: string[];
  rows: Record<string, string>[];
  matchedRows: MatchedRow[];
  onProcess: (rows: MatchedRow[], options: BulkUpdateOptions) => void;
  onBack: () => void;
  onMatch: (rows: BulkUpdateRow[]) => Promise<MatchedRow[]>;
  isMatching: boolean;
  isUpdating: boolean;
}

const DEFAULT_STATUS = '07 - Pedido Fechado';

export function BulkUpdatePreview({
  headers,
  rows,
  matchedRows,
  onProcess,
  onBack,
  onMatch,
  isMatching,
  isUpdating,
}: BulkUpdatePreviewProps) {
  // Mapeamento de colunas
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [hasMatched, setHasMatched] = useState(false);
  const [isMappingOpen, setIsMappingOpen] = useState(true);
  
  // Opções de atualização
  const [options, setOptions] = useState<BulkUpdateOptions>({
    updateLeadStatus: true,
    updateNegotiatedValue: true,
    updateShirtQuantity: true,
    updateAssignee: true,
    targetLeadStatus: DEFAULT_STATUS,
  });

  // Auto-mapear colunas ao carregar
  useEffect(() => {
    const autoMapping = autoMapBlingColumns(headers);
    setColumnMapping(autoMapping);
    console.log('[BulkUpdate] Auto-mapped columns:', autoMapping);
  }, [headers]);

  const handleColumnChange = (field: string, value: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [field]: value === 'none' ? '' : value,
    }));
    setHasMatched(false);
  };

  const handleMatchContacts = async () => {
    // Converter dados usando o mapeamento
    const processedRows: BulkUpdateRow[] = rows.map(row => ({
      telefone: columnMapping.telefone ? row[columnMapping.telefone] : '',
      valorNegociado: columnMapping.valorNegociado 
        ? parseBRLValue(row[columnMapping.valorNegociado]) 
        : undefined,
      qtdCamisas: columnMapping.qtdCamisas 
        ? parseQuantity(row[columnMapping.qtdCamisas]) 
        : undefined,
      vendedor: columnMapping.vendedor ? row[columnMapping.vendedor] : undefined,
      raw: row,
    })).filter(r => r.telefone);

    await onMatch(processedRows);
    setHasMatched(true);
    setIsMappingOpen(false);
  };

  const handleUpdate = () => {
    const validRows = matchedRows.filter(r => r.contactId);
    onProcess(validRows, options);
  };

  const foundCount = matchedRows.filter(r => r.matchStatus === 'found').length;
  const notFoundCount = matchedRows.filter(r => r.matchStatus === 'not_found').length;

  const formatCurrency = (value?: number) => {
    if (!value) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-4">
      {/* Mapeamento de Colunas */}
      <Collapsible open={isMappingOpen} onOpenChange={setIsMappingOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Mapeamento de Colunas</CardTitle>
                  <CardDescription>
                    Relacione as colunas do arquivo com os campos do sistema
                  </CardDescription>
                </div>
                <ChevronDown className={`h-5 w-5 transition-transform ${isMappingOpen ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Telefone *</Label>
                  <Select 
                    value={columnMapping.telefone || 'none'} 
                    onValueChange={(v) => handleColumnChange('telefone', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não mapear</SelectItem>
                      {headers.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Valor Negociado</Label>
                  <Select 
                    value={columnMapping.valorNegociado || 'none'} 
                    onValueChange={(v) => handleColumnChange('valorNegociado', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não mapear</SelectItem>
                      {headers.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Qtd. Camisas</Label>
                  <Select 
                    value={columnMapping.qtdCamisas || 'none'} 
                    onValueChange={(v) => handleColumnChange('qtdCamisas', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não mapear</SelectItem>
                      {headers.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Vendedor</Label>
                  <Select 
                    value={columnMapping.vendedor || 'none'} 
                    onValueChange={(v) => handleColumnChange('vendedor', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não mapear</SelectItem>
                      {headers.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button 
                  onClick={handleMatchContacts}
                  disabled={!columnMapping.telefone || isMatching}
                >
                  {isMatching ? 'Buscando...' : 'Buscar Contatos'}
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Opções de Atualização */}
      {hasMatched && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Opções de Atualização</CardTitle>
            <CardDescription>
              Selecione quais campos deseja atualizar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="updateStatus" 
                  checked={options.updateLeadStatus}
                  onCheckedChange={(checked) => 
                    setOptions(prev => ({ ...prev, updateLeadStatus: !!checked }))
                  }
                />
                <Label htmlFor="updateStatus">
                  Status: {DEFAULT_STATUS}
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="updateValue" 
                  checked={options.updateNegotiatedValue}
                  disabled={!columnMapping.valorNegociado}
                  onCheckedChange={(checked) => 
                    setOptions(prev => ({ ...prev, updateNegotiatedValue: !!checked }))
                  }
                />
                <Label htmlFor="updateValue" className={!columnMapping.valorNegociado ? 'text-muted-foreground' : ''}>
                  Valor Negociado
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="updateQty" 
                  checked={options.updateShirtQuantity}
                  disabled={!columnMapping.qtdCamisas}
                  onCheckedChange={(checked) => 
                    setOptions(prev => ({ ...prev, updateShirtQuantity: !!checked }))
                  }
                />
                <Label htmlFor="updateQty" className={!columnMapping.qtdCamisas ? 'text-muted-foreground' : ''}>
                  Qtd. Camisas
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="updateAssignee" 
                  checked={options.updateAssignee}
                  disabled={!columnMapping.vendedor}
                  onCheckedChange={(checked) => 
                    setOptions(prev => ({ ...prev, updateAssignee: !!checked }))
                  }
                />
                <Label htmlFor="updateAssignee" className={!columnMapping.vendedor ? 'text-muted-foreground' : ''}>
                  Vendedor
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview dos Dados */}
      {hasMatched && matchedRows.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Preview</CardTitle>
                <CardDescription>
                  {foundCount} leads encontrados de {matchedRows.length}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant="default" className="bg-green-500">
                  <Check className="h-3 w-3 mr-1" />
                  {foundCount} encontrados
                </Badge>
                {notFoundCount > 0 && (
                  <Badge variant="destructive">
                    <X className="h-3 w-3 mr-1" />
                    {notFoundCount} não encontrados
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background border-b">
                  <tr>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Telefone</th>
                    <th className="text-left p-2">Contato</th>
                    <th className="text-left p-2">Valor</th>
                    <th className="text-left p-2">Qtd</th>
                    <th className="text-left p-2">Vendedor</th>
                  </tr>
                </thead>
                <tbody>
                  {matchedRows.map((row, index) => (
                    <tr key={index} className={`border-b ${row.matchStatus === 'not_found' ? 'opacity-50' : ''}`}>
                      <td className="p-2">
                        {row.matchStatus === 'found' ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        )}
                      </td>
                      <td className="p-2 font-mono text-xs">{row.telefone}</td>
                      <td className="p-2">{row.contactName || '-'}</td>
                      <td className="p-2">{formatCurrency(row.valorNegociado)}</td>
                      <td className="p-2">{row.qtdCamisas || '-'}</td>
                      <td className="p-2">
                        {row.matchedAgentName ? (
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {row.matchedAgentName}
                          </div>
                        ) : row.vendedor ? (
                          <span className="text-muted-foreground">{row.vendedor}</span>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Ações */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Voltar
        </Button>
        {hasMatched && foundCount > 0 && (
          <Button 
            onClick={handleUpdate}
            disabled={isUpdating}
          >
            {isUpdating ? 'Atualizando...' : `Atualizar ${foundCount} Leads`}
          </Button>
        )}
      </div>
    </div>
  );
}
