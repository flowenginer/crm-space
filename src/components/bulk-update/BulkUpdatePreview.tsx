import { useState, useEffect, useCallback } from 'react';
import { Check, AlertTriangle, X, User, ChevronDown, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  const [currentPage, setCurrentPage] = useState(0); // Índice do lead atual na visualização paginada
  
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
  // Recalcular status checkbox baseado no DEFAULT_STATUS
  useEffect(() => {
    if (matchedRows.length > 0) {
      const newSettings = new Map<number, MatchedRow['updateFields']>();
      matchedRows.forEach((row, index) => {
        // Status: marcado apenas se diferente do DEFAULT_STATUS (laranja)
        const statusIsDifferent = row.currentLeadStatus !== DEFAULT_STATUS;
        newSettings.set(index, { 
          ...row.updateFields,
          status: statusIsDifferent, // Recalcular status aqui
        });
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
      nomeContato: columnMapping.nomeContato ? row[columnMapping.nomeContato] : undefined,
      valorNegociado: columnMapping.valorNegociado 
        ? parseBRLValue(row[columnMapping.valorNegociado]) 
        : undefined,
      qtdCamisas: columnMapping.qtdCamisas 
        ? parseQuantity(row[columnMapping.qtdCamisas]) 
        : undefined,
      vendedor: columnMapping.vendedor ? row[columnMapping.vendedor] : undefined,
      cpfCnpj: columnMapping.cpfCnpj ? row[columnMapping.cpfCnpj]?.trim() : undefined,
      email: columnMapping.email ? row[columnMapping.email]?.trim() : undefined,
      bairro: columnMapping.bairro ? row[columnMapping.bairro]?.trim() : undefined,
      cidade: columnMapping.cidade ? row[columnMapping.cidade]?.trim() : undefined,
      estado: columnMapping.estado ? row[columnMapping.estado]?.trim() : undefined,
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
    let name = 0, value = 0, quantity = 0, status = 0, assignee = 0, currentAgent = 0;
    let cpfCnpj = 0, email = 0, bairro = 0, cidade = 0, estado = 0;
    matchedRows.forEach((row, index) => {
      if (row.matchStatus !== 'found') return;
      const settings = rowFieldSettings.get(index) || row.updateFields;
      if (settings.name && row.nomeContato) name++;
      if (settings.value && row.valorNegociado !== undefined) value++;
      if (settings.quantity && row.qtdCamisas !== undefined) quantity++;
      if (settings.status) status++;
      if (settings.assignee && row.matchedAgentId) assignee++;
      if (settings.currentAgent && row.matchedAgentId) currentAgent++;
      if (settings.cpfCnpj && row.cpfCnpj) cpfCnpj++;
      if (settings.email && row.email) email++;
      if (settings.bairro && row.bairro) bairro++;
      if (settings.cidade && row.cidade) cidade++;
      if (settings.estado && row.estado) estado++;
    });
    return { name, value, quantity, status, assignee, currentAgent, cpfCnpj, email, bairro, cidade, estado };
  };
  const updateCounts = hasMatched ? getUpdateCounts() : { 
    name: 0, value: 0, quantity: 0, status: 0, assignee: 0, currentAgent: 0,
    cpfCnpj: 0, email: 0, bairro: 0, cidade: 0, estado: 0 
  };

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
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                  <Label>Nome do Contato</Label>
                  <Select 
                    value={columnMapping.nomeContato || 'none'} 
                    onValueChange={(v) => handleColumnChange('nomeContato', v)}
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

              {/* Campos Adicionais */}
              <div className="border-t pt-4 mt-4">
                <p className="text-sm font-medium mb-3 text-muted-foreground">Campos adicionais do contato</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <Label>CPF/CNPJ</Label>
                    <Select 
                      value={columnMapping.cpfCnpj || 'none'} 
                      onValueChange={(v) => handleColumnChange('cpfCnpj', v)}
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
                    <Label>E-mail</Label>
                    <Select 
                      value={columnMapping.email || 'none'} 
                      onValueChange={(v) => handleColumnChange('email', v)}
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
                    <Label>Bairro</Label>
                    <Select 
                      value={columnMapping.bairro || 'none'} 
                      onValueChange={(v) => handleColumnChange('bairro', v)}
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
                    <Label>Cidade</Label>
                    <Select 
                      value={columnMapping.cidade || 'none'} 
                      onValueChange={(v) => handleColumnChange('cidade', v)}
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
                    <Label>Estado/UF</Label>
                    <Select 
                      value={columnMapping.estado || 'none'} 
                      onValueChange={(v) => handleColumnChange('estado', v)}
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
              <Badge variant={updateCounts.name > 0 ? 'default' : 'secondary'}>
                Nome: {updateCounts.name} leads
              </Badge>
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
              <Badge variant={updateCounts.currentAgent > 0 ? 'default' : 'secondary'} className="border border-dashed">
                Atendente Atual: {updateCounts.currentAgent} leads (opcional)
              </Badge>
              <Badge variant={updateCounts.cpfCnpj > 0 ? 'default' : 'secondary'}>
                CPF/CNPJ: {updateCounts.cpfCnpj} leads
              </Badge>
              <Badge variant={updateCounts.email > 0 ? 'default' : 'secondary'}>
                E-mail: {updateCounts.email} leads
              </Badge>
              <Badge variant={updateCounts.bairro > 0 ? 'default' : 'secondary'}>
                Bairro: {updateCounts.bairro} leads
              </Badge>
              <Badge variant={updateCounts.cidade > 0 ? 'default' : 'secondary'}>
                Cidade: {updateCounts.cidade} leads
              </Badge>
              <Badge variant={updateCounts.estado > 0 ? 'default' : 'secondary'}>
                Estado: {updateCounts.estado} leads
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
            {/* Navegação paginada */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {currentPage + 1} de {matchedRows.length}
                </span>
                <Badge variant="outline" className="text-xs">
                  {foundCount} encontrados
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(matchedRows.length - 1, currentPage + 1))}
                disabled={currentPage >= matchedRows.length - 1}
              >
                Próximo
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>

            {/* Item atual */}
            {matchedRows[currentPage] && (() => {
              const row = matchedRows[currentPage];
              const index = currentPage;
              const settings = rowFieldSettings.get(index) || row.updateFields;
              const isFound = row.matchStatus === 'found';
              
              return (
                <div className={`border rounded-lg overflow-hidden ${!isFound ? 'opacity-50' : ''}`}>
                  {/* Linha 1: Dados da Planilha */}
                  <div className="bg-muted/30 p-4 border-b">
                    <div className="flex items-center gap-2 mb-3">
                      {isFound ? (
                        <Check className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      )}
                      <span className="font-mono text-sm">{row.telefone}</span>
                      {isFound && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          Encontrado no sistema
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-5 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground text-xs">Nome (planilha):</span>
                        <div className="font-medium">{row.nomeContato || '-'}</div>
                      </div>
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
                    {/* Campos adicionais da planilha */}
                    {(row.cpfCnpj || row.email || row.bairro || row.cidade || row.estado) && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <div className="grid grid-cols-5 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground text-xs">CPF/CNPJ:</span>
                            <div className="font-medium">{row.cpfCnpj || '-'}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">E-mail:</span>
                            <div className="font-medium truncate">{row.email || '-'}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">Bairro:</span>
                            <div className="font-medium">{row.bairro || '-'}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">Cidade:</span>
                            <div className="font-medium">{row.cidade || '-'}</div>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">Estado:</span>
                            <div className="font-medium">{row.estado || '-'}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Linha 2: Dados Atuais do Sistema */}
                  {isFound && (
                    <div className="p-4 border-b bg-background">
                      <div className="flex items-center gap-2 mb-3">
                        <ArrowDown className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground font-medium">Dados atuais no sistema:</span>
                      </div>
                      <div className="grid grid-cols-5 gap-4 text-sm">
                        <div className={row.nomeContato && row.contactName && row.nomeContato.toLowerCase() !== row.contactName.toLowerCase() ? 'text-amber-600' : 'text-green-600'}>
                          <span className="text-xs">Nome atual:</span>
                          <div className="font-medium">{row.contactName || '-'}</div>
                        </div>
                        <div className={row.valorNegociado !== undefined && row.valorNegociado !== row.currentValue ? 'text-amber-600' : 'text-green-600'}>
                          <span className="text-xs">Valor atual:</span>
                          <div className="font-medium">{formatCurrency(row.currentValue)}</div>
                        </div>
                        <div className={row.qtdCamisas !== undefined && row.qtdCamisas !== row.currentQuantity ? 'text-amber-600' : 'text-green-600'}>
                          <span className="text-xs">Qtd atual:</span>
                          <div className="font-medium">{row.currentQuantity ?? '-'}</div>
                        </div>
                        <div className="space-y-1">
                          <div className={row.matchedAgentId && row.matchedAgentId !== row.currentAssignee ? 'text-amber-600' : 'text-green-600'}>
                            <span className="text-xs">Agente Responsável:</span>
                            <div className="font-medium flex items-center gap-1">
                              {row.currentAssigneeName ? (
                                <>
                                  <User className="h-3 w-3" />
                                  {row.currentAssigneeName}
                                </>
                              ) : '-'}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className={row.matchedAgentId && row.matchedAgentId !== row.currentAgentId ? 'text-amber-600' : 'text-green-600'}>
                            <span className="text-xs">Atendente Atual:</span>
                            <div className="font-medium flex items-center gap-1">
                              {row.currentAgentName ? (
                                <>
                                  <User className="h-3 w-3" />
                                  {row.currentAgentName}
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
                      {/* Campos adicionais atuais */}
                      {(row.cpfCnpj || row.email || row.bairro || row.cidade || row.estado) && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <div className="grid grid-cols-5 gap-4 text-sm">
                            <div className={row.cpfCnpj && row.cpfCnpj !== row.currentCpfCnpj ? 'text-amber-600' : 'text-green-600'}>
                              <span className="text-xs">CPF/CNPJ atual:</span>
                              <div className="font-medium">{row.currentCpfCnpj || '-'}</div>
                            </div>
                            <div className={row.email && row.email !== row.currentEmail ? 'text-amber-600' : 'text-green-600'}>
                              <span className="text-xs">E-mail atual:</span>
                              <div className="font-medium truncate">{row.currentEmail || '-'}</div>
                            </div>
                            <div className={row.bairro && row.bairro !== row.currentBairro ? 'text-amber-600' : 'text-green-600'}>
                              <span className="text-xs">Bairro atual:</span>
                              <div className="font-medium">{row.currentBairro || '-'}</div>
                            </div>
                            <div className={row.cidade && row.cidade !== row.currentCidade ? 'text-amber-600' : 'text-green-600'}>
                              <span className="text-xs">Cidade atual:</span>
                              <div className="font-medium">{row.currentCidade || '-'}</div>
                            </div>
                            <div className={row.estado && row.estado !== row.currentEstado ? 'text-amber-600' : 'text-green-600'}>
                              <span className="text-xs">Estado atual:</span>
                              <div className="font-medium">{row.currentEstado || '-'}</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Linha 3: Checkboxes para atualização */}
                  {isFound && (
                    <div className="p-4 bg-muted/20">
                      <div className="text-xs font-medium text-muted-foreground mb-3">Atualizar campos principais:</div>
                      <div className="flex flex-wrap gap-4 mb-4">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`name-${index}`}
                            checked={settings.name}
                            disabled={!row.nomeContato}
                            onCheckedChange={() => toggleRowField(index, 'name')}
                          />
                          <Label 
                            htmlFor={`name-${index}`} 
                            className={`text-xs cursor-pointer ${!row.nomeContato ? 'text-muted-foreground' : ''}`}
                          >
                            Nome
                          </Label>
                          {row.nomeContato && row.contactName && row.nomeContato.toLowerCase() !== row.contactName.toLowerCase() && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-amber-500/50 text-amber-600 dark:text-amber-400">
                              diferente
                            </Badge>
                          )}
                        </div>
                        
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
                          {row.valorNegociado !== undefined && row.valorNegociado !== row.currentValue && (
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
                            Qtd
                          </Label>
                          {row.qtdCamisas !== undefined && row.qtdCamisas !== row.currentQuantity && (
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
                            Ag. Responsável
                          </Label>
                          {row.matchedAgentId && row.matchedAgentId !== row.currentAssignee && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-amber-500/50 text-amber-600 dark:text-amber-400">
                              diferente
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`currentAgent-${index}`}
                            checked={settings.currentAgent}
                            disabled={!row.matchedAgentId}
                            onCheckedChange={() => toggleRowField(index, 'currentAgent')}
                          />
                          <Label 
                            htmlFor={`currentAgent-${index}`} 
                            className={`text-xs cursor-pointer ${!row.matchedAgentId ? 'text-muted-foreground' : ''}`}
                          >
                            Atend. Atual
                          </Label>
                          {row.matchedAgentId && row.matchedAgentId !== row.currentAgentId && (
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
                          <Label 
                            htmlFor={`status-${index}`} 
                            className="text-xs cursor-pointer"
                          >
                            Status
                          </Label>
                          {row.currentLeadStatus !== DEFAULT_STATUS && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-amber-500/50 text-amber-600 dark:text-amber-400">
                              diferente
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      {/* Campos adicionais */}
                      <div className="text-xs font-medium text-muted-foreground mb-3">Campos adicionais:</div>
                      <div className="flex flex-wrap gap-4">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`cpfCnpj-${index}`}
                            checked={settings.cpfCnpj}
                            disabled={!row.cpfCnpj}
                            onCheckedChange={() => toggleRowField(index, 'cpfCnpj')}
                          />
                          <Label 
                            htmlFor={`cpfCnpj-${index}`} 
                            className={`text-xs cursor-pointer ${!row.cpfCnpj ? 'text-muted-foreground' : ''}`}
                          >
                            CPF/CNPJ
                          </Label>
                          {row.cpfCnpj && row.cpfCnpj !== row.currentCpfCnpj && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-amber-500/50 text-amber-600 dark:text-amber-400">
                              diferente
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`email-${index}`}
                            checked={settings.email}
                            disabled={!row.email}
                            onCheckedChange={() => toggleRowField(index, 'email')}
                          />
                          <Label 
                            htmlFor={`email-${index}`} 
                            className={`text-xs cursor-pointer ${!row.email ? 'text-muted-foreground' : ''}`}
                          >
                            E-mail
                          </Label>
                          {row.email && row.email !== row.currentEmail && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-amber-500/50 text-amber-600 dark:text-amber-400">
                              diferente
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`bairro-${index}`}
                            checked={settings.bairro}
                            disabled={!row.bairro}
                            onCheckedChange={() => toggleRowField(index, 'bairro')}
                          />
                          <Label 
                            htmlFor={`bairro-${index}`} 
                            className={`text-xs cursor-pointer ${!row.bairro ? 'text-muted-foreground' : ''}`}
                          >
                            Bairro
                          </Label>
                          {row.bairro && row.bairro !== row.currentBairro && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-amber-500/50 text-amber-600 dark:text-amber-400">
                              diferente
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`cidade-${index}`}
                            checked={settings.cidade}
                            disabled={!row.cidade}
                            onCheckedChange={() => toggleRowField(index, 'cidade')}
                          />
                          <Label 
                            htmlFor={`cidade-${index}`} 
                            className={`text-xs cursor-pointer ${!row.cidade ? 'text-muted-foreground' : ''}`}
                          >
                            Cidade
                          </Label>
                          {row.cidade && row.cidade !== row.currentCidade && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-amber-500/50 text-amber-600 dark:text-amber-400">
                              diferente
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`estado-${index}`}
                            checked={settings.estado}
                            disabled={!row.estado}
                            onCheckedChange={() => toggleRowField(index, 'estado')}
                          />
                          <Label 
                            htmlFor={`estado-${index}`} 
                            className={`text-xs cursor-pointer ${!row.estado ? 'text-muted-foreground' : ''}`}
                          >
                            Estado
                          </Label>
                          {row.estado && row.estado !== row.currentEstado && (
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
            })()}
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
