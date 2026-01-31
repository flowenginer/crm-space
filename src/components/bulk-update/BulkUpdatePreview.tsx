import { useState, useEffect, useCallback } from 'react';
import { Check, AlertTriangle, X, User, ChevronDown, ArrowDown } from 'lucide-react';
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
  
  // Estado local para controle de campos por linha
  const [rowFieldSettings, setRowFieldSettings] = useState<Map<number, MatchedRow['updateFields']>>(new Map());
  
  // Opções globais de atualização
  const [options, setOptions] = useState<BulkUpdateOptions>({
    updateLeadStatus: true,
    updateNegotiatedValue: true,
    updateShirtQuantity: true,
    updateAssignee: true,
    targetLeadStatus: DEFAULT_STATUS,
  });

  // Inicializar settings das linhas quando matchedRows mudar
  useEffect(() => {
    if (matchedRows.length > 0) {
      const newSettings = new Map<number, MatchedRow['updateFields']>();
      matchedRows.forEach((row, index) => {
        newSettings.set(index, { ...row.updateFields });
      });
      setRowFieldSettings(newSettings);
    }
  }, [matchedRows]);

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

  const toggleRowField = useCallback((rowIndex: number, field: keyof MatchedRow['updateFields']) => {
    setRowFieldSettings(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(rowIndex);
      if (current) {
        newMap.set(rowIndex, { ...current, [field]: !current[field] });
      }
      return newMap;
    });
  }, []);

  const handleUpdate = () => {
    // Aplicar as configurações de campos individuais às rows
    const rowsWithFieldSettings = matchedRows
      .filter(r => r.contactId)
      .map((row, index) => {
        const fieldSettings = rowFieldSettings.get(index) || row.updateFields;
        return {
          ...row,
          updateFields: fieldSettings,
        };
      });
    
    onProcess(rowsWithFieldSettings, options);
  };

  const foundCount = matchedRows.filter(r => r.matchStatus === 'found').length;
  const notFoundCount = matchedRows.filter(r => r.matchStatus === 'not_found').length;
  
  // Contar quantos campos serão atualizados
  const getUpdateCounts = () => {
    let value = 0, quantity = 0, status = 0, assignee = 0;
    matchedRows.forEach((row, index) => {
      if (row.matchStatus !== 'found') return;
      const settings = rowFieldSettings.get(index) || row.updateFields;
      if (settings.value && row.valorNegociado !== undefined) value++;
      if (settings.quantity && row.qtdCamisas !== undefined) quantity++;
      if (settings.status) status++;
      if (settings.assignee && row.matchedAgentId) assignee++;
    });
    return { value, quantity, status, assignee };
  };
  const updateCounts = hasMatched ? getUpdateCounts() : { value: 0, quantity: 0, status: 0, assignee: 0 };

  const formatCurrency = (value?: number | null) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Verifica se um valor é diferente
  const isDifferent = (imported: any, current: any) => {
    if (imported === undefined || imported === null) return false;
    if (current === null || current === undefined) return true;
    return imported !== current;
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

      {/* Resumo de Atualizações */}
      {hasMatched && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resumo da Atualização</CardTitle>
            <CardDescription>
              Campos selecionados para atualização (ajuste individualmente na tabela abaixo)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Badge variant={updateCounts.status > 0 ? 'default' : 'secondary'}>
                Status: {updateCounts.status} leads
              </Badge>
              <Badge variant={updateCounts.value > 0 ? 'default' : 'secondary'}>
                Valor: {updateCounts.value} leads
              </Badge>
              <Badge variant={updateCounts.quantity > 0 ? 'default' : 'secondary'}>
                Quantidade: {updateCounts.quantity} leads
              </Badge>
              <Badge variant={updateCounts.assignee > 0 ? 'default' : 'secondary'}>
                Vendedor: {updateCounts.assignee} leads
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview dos Dados com Comparação */}
      {hasMatched && matchedRows.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Preview - Comparação com Sistema</CardTitle>
                <CardDescription>
                  {foundCount} leads encontrados de {matchedRows.length}. 
                  <span className="text-muted-foreground ml-1">
                    Clique nos checkboxes para ativar/desativar campos individualmente.
                  </span>
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
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {matchedRows.map((row, index) => {
                  const settings = rowFieldSettings.get(index) || row.updateFields;
                  const isFound = row.matchStatus === 'found';
                  
                  return (
                    <div 
                      key={index} 
                      className={`border rounded-lg overflow-hidden ${!isFound ? 'opacity-50' : ''}`}
                    >
                      {/* Linha 1: Dados da Planilha */}
                      <div className="bg-muted/30 p-3 border-b">
                        <div className="flex items-center gap-2 mb-2">
                          {isFound ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          )}
                          <span className="font-mono text-xs text-muted-foreground">{row.telefone}</span>
                          <span className="font-medium">{row.contactName || 'Não encontrado'}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground text-xs">Valor (planilha):</span>
                            <div className="font-medium">{formatCurrency(row.valorNegociado)}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">Qtd (planilha):</span>
                            <div className="font-medium">{row.qtdCamisas ?? '-'}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">Vendedor (planilha):</span>
                            <div className="font-medium flex items-center gap-1">
                              {row.matchedAgentName ? (
                                <>
                                  <User className="h-3 w-3" />
                                  {row.matchedAgentName}
                                </>
                              ) : row.vendedor ? (
                                <span className="text-muted-foreground">{row.vendedor}</span>
                              ) : '-'}
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">Status:</span>
                            <div className="font-medium">{DEFAULT_STATUS}</div>
                          </div>
                        </div>
                      </div>

                      {/* Linha 2: Dados do Sistema (apenas se encontrado) */}
                      {isFound && (
                        <div className="p-3 border-b bg-background">
                          <div className="flex items-center gap-2 mb-2">
                            <ArrowDown className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Dados atuais no sistema:</span>
                          </div>
                          <div className="grid grid-cols-4 gap-4 text-sm">
                            <div className={isDifferent(row.valorNegociado, row.currentValue) ? 'text-amber-600' : 'text-green-600'}>
                              <span className="text-xs">Valor atual:</span>
                              <div className="font-medium">{formatCurrency(row.currentValue)}</div>
                            </div>
                            <div className={isDifferent(row.qtdCamisas, row.currentQuantity) ? 'text-amber-600' : 'text-green-600'}>
                              <span className="text-xs">Qtd atual:</span>
                              <div className="font-medium">{row.currentQuantity ?? '-'}</div>
                            </div>
                            <div className={row.matchedAgentId && row.matchedAgentId !== row.currentAssignee ? 'text-amber-600' : 'text-green-600'}>
                              <span className="text-xs">Vendedor atual:</span>
                              <div className="font-medium flex items-center gap-1">
                                {row.currentAssigneeName ? (
                                  <>
                                    <User className="h-3 w-3" />
                                    {row.currentAssigneeName}
                                  </>
                                ) : '-'}
                              </div>
                            </div>
                            <div className={row.currentLeadStatus !== DEFAULT_STATUS ? 'text-amber-600' : 'text-green-600'}>
                              <span className="text-xs">Status atual:</span>
                              <div className="font-medium">{row.currentLeadStatus || '-'}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Linha 3: Checkboxes de Atualização (apenas se encontrado) */}
                      {isFound && (
                        <div className="p-3 bg-muted/10">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-medium">Atualizar:</span>
                          </div>
                          <div className="grid grid-cols-4 gap-4">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`value-${index}`}
                                checked={settings.value}
                                disabled={row.valorNegociado === undefined}
                                onCheckedChange={() => toggleRowField(index, 'value')}
                              />
                              <Label 
                                htmlFor={`value-${index}`} 
                                className={`text-xs cursor-pointer ${row.valorNegociado === undefined ? 'text-muted-foreground' : ''}`}
                              >
                                Valor
                              </Label>
                            {isDifferent(row.valorNegociado, row.currentValue) && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-amber-500/50 text-amber-600 dark:text-amber-400">
                                  diferente
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`quantity-${index}`}
                                checked={settings.quantity}
                                disabled={row.qtdCamisas === undefined}
                                onCheckedChange={() => toggleRowField(index, 'quantity')}
                              />
                              <Label 
                                htmlFor={`quantity-${index}`} 
                                className={`text-xs cursor-pointer ${row.qtdCamisas === undefined ? 'text-muted-foreground' : ''}`}
                              >
                                Quantidade
                              </Label>
                            {isDifferent(row.qtdCamisas, row.currentQuantity) && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-amber-500/50 text-amber-600 dark:text-amber-400">
                                  diferente
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`assignee-${index}`}
                                checked={settings.assignee}
                                disabled={!row.matchedAgentId}
                                onCheckedChange={() => toggleRowField(index, 'assignee')}
                              />
                              <Label 
                                htmlFor={`assignee-${index}`} 
                                className={`text-xs cursor-pointer ${!row.matchedAgentId ? 'text-muted-foreground' : ''}`}
                              >
                                Vendedor
                              </Label>
                            {row.matchedAgentId && row.matchedAgentId !== row.currentAssignee && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-amber-500/50 text-amber-600 dark:text-amber-400">
                                  diferente
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`status-${index}`}
                                checked={settings.status}
                                onCheckedChange={() => toggleRowField(index, 'status')}
                              />
                              <Label htmlFor={`status-${index}`} className="text-xs cursor-pointer">
                                Status
                              </Label>
                              {row.currentLeadStatus !== DEFAULT_STATUS && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-amber-500/50 text-amber-600 dark:text-amber-400">
                                  diferente
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
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
