import { useState, useRef, useCallback } from 'react';
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle, XCircle, Info, Loader2 } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { useImportContacts, ImportRow, ImportOptions, ImportLogEntry } from '@/hooks/useImportContacts';

interface ParsedData {
  headers: string[];
  rows: Record<string, string>[];
}

interface ColumnMapping {
  nome: string;
  telefone: string;
  vendedor: string;
  etiquetas: string;
  statusLead: string;
}

const defaultMapping: ColumnMapping = {
  nome: '',
  telefone: '',
  vendedor: '',
  etiquetas: '',
  statusLead: '',
};

const fieldLabels: Record<keyof ColumnMapping, string> = {
  nome: 'Nome do Cliente',
  telefone: 'Telefone',
  vendedor: 'Vendedor/Agente',
  etiquetas: 'Etiquetas',
  statusLead: 'Status de Lead',
};

export function ContactImporter() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>(defaultMapping);
  const [options, setOptions] = useState<ImportOptions>({
    createMissingContacts: false,
    createMissingTags: true,
    updateLeadStatus: true,
    updateAssignee: true,
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isImporting, progress, result, processImport, reset } = useImportContacts();

  const parseFile = useCallback((file: File) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as (string | number | undefined)[][];
        
        if (jsonData.length < 2) {
          toast.error('A planilha deve ter pelo menos um cabeçalho e uma linha de dados');
          return;
        }

        const headers = jsonData[0].map(h => String(h || '').trim());
        const rows = jsonData.slice(1).map((row) => {
          const obj: Record<string, string> = {};
          headers.forEach((header, index) => {
            obj[header] = String(row[index] || '').trim();
          });
          return obj;
        }).filter(row => Object.values(row).some(v => v)); // Remove empty rows

        setParsedData({ headers, rows });
        
        // Auto-map columns based on common patterns
        const autoMapping: ColumnMapping = { ...defaultMapping };
        headers.forEach(header => {
          const lowerHeader = header.toLowerCase();
          if (lowerHeader.includes('nome') || lowerHeader.includes('cliente')) {
            autoMapping.nome = header;
          } else if (lowerHeader.includes('telefone') || lowerHeader.includes('numero') || lowerHeader.includes('contato')) {
            autoMapping.telefone = header;
          } else if (lowerHeader.includes('agente') || lowerHeader.includes('vendedor') || lowerHeader.includes('atendente')) {
            autoMapping.vendedor = header;
          } else if (lowerHeader.includes('etiqueta') || lowerHeader.includes('tag')) {
            autoMapping.etiquetas = header;
          } else if (lowerHeader.includes('status') || lowerHeader.includes('lead')) {
            autoMapping.statusLead = header;
          }
        });
        
        setColumnMapping(autoMapping);
        toast.success(`${rows.length} linhas carregadas`);
      } catch (error) {
        console.error('Error parsing file:', error);
        toast.error('Erro ao ler o arquivo. Verifique o formato.');
      }
    };

    reader.readAsBinaryString(file);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      parseFile(file);
    }
  };

  const handleStartImport = async () => {
    if (!parsedData || !columnMapping.telefone) {
      toast.error('Selecione pelo menos a coluna de telefone');
      return;
    }

    const importRows: ImportRow[] = parsedData.rows.map(row => ({
      nome: columnMapping.nome ? row[columnMapping.nome] : '',
      telefone: row[columnMapping.telefone],
      vendedor: columnMapping.vendedor ? row[columnMapping.vendedor] : undefined,
      etiquetas: columnMapping.etiquetas ? row[columnMapping.etiquetas] : undefined,
      statusLead: columnMapping.statusLead ? row[columnMapping.statusLead] : undefined,
    }));

    const importResult = await processImport(importRows, options);
    
    if (importResult.errors === 0) {
      toast.success(`Importação concluída! ${importResult.updated} contatos atualizados, ${importResult.tagsAssigned} etiquetas atribuídas.`);
    } else {
      toast.warning(`Importação concluída com ${importResult.errors} erros. Verifique o log.`);
    }
  };

  const handleClose = () => {
    setIsDialogOpen(false);
    setParsedData(null);
    setColumnMapping(defaultMapping);
    reset();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getLogIcon = (type: ImportLogEntry['type']) => {
    switch (type) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'info': return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Importador de Contatos
          </CardTitle>
          <CardDescription>
            Atualize contatos em massa a partir de uma planilha CSV ou Excel
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border">
              <FileSpreadsheet className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Funcionalidades:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Busca contatos pelo número de telefone</li>
                  <li>Cria etiquetas automaticamente se não existirem</li>
                  <li>Atualiza status de lead e vendedor atribuído</li>
                  <li>Suporta arquivos CSV e Excel (.xlsx, .xls)</li>
                </ul>
              </div>
            </div>

            <Button onClick={() => setIsDialogOpen(true)} className="w-full sm:w-auto">
              <Upload className="h-4 w-4 mr-2" />
              Importar Planilha
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Importar Contatos
            </DialogTitle>
            <DialogDescription>
              Faça upload de uma planilha para atualizar contatos em massa
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* File Upload Zone */}
            {!parsedData && (
              <div
                className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-2">
                  Arraste um arquivo ou clique para selecionar
                </p>
                <p className="text-xs text-muted-foreground">
                  Formatos suportados: CSV, XLS, XLSX
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            )}

            {/* Preview */}
            {parsedData && !result && (
              <>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">
                      Preview ({parsedData.rows.length} linhas)
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setParsedData(null);
                        setColumnMapping(defaultMapping);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    >
                      Trocar arquivo
                    </Button>
                  </div>
                  
                  <ScrollArea className="h-48 border rounded-lg">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted sticky top-0">
                          <tr>
                            {parsedData.headers.map((h, i) => (
                              <th key={i} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {parsedData.rows.slice(0, 10).map((row, i) => (
                            <tr key={i} className="border-t">
                              {parsedData.headers.map((h, j) => (
                                <td key={j} className="px-3 py-2 whitespace-nowrap max-w-[200px] truncate">
                                  {row[h]}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </ScrollArea>
                </div>

                {/* Column Mapping */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Mapeamento de Colunas</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(Object.keys(fieldLabels) as (keyof ColumnMapping)[]).map((field) => (
                      <div key={field} className="space-y-2">
                        <Label className="text-xs">
                          {fieldLabels[field]}
                          {field === 'telefone' && <span className="text-red-500">*</span>}
                        </Label>
                        <Select
                          value={columnMapping[field]}
                          onValueChange={(v) => setColumnMapping(prev => ({ ...prev, [field]: v }))}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Selecionar coluna..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Não mapear</SelectItem>
                            {parsedData.headers.map((h) => (
                              <SelectItem key={h} value={h}>{h}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Import Options */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Opções de Importação</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="createContacts"
                        checked={options.createMissingContacts}
                        onCheckedChange={(c) => setOptions(prev => ({ ...prev, createMissingContacts: c === true }))}
                      />
                      <Label htmlFor="createContacts" className="text-sm cursor-pointer">
                        Criar contatos que não existem
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="createTags"
                        checked={options.createMissingTags}
                        onCheckedChange={(c) => setOptions(prev => ({ ...prev, createMissingTags: c === true }))}
                      />
                      <Label htmlFor="createTags" className="text-sm cursor-pointer">
                        Criar etiquetas que não existem
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="updateStatus"
                        checked={options.updateLeadStatus}
                        onCheckedChange={(c) => setOptions(prev => ({ ...prev, updateLeadStatus: c === true }))}
                      />
                      <Label htmlFor="updateStatus" className="text-sm cursor-pointer">
                        Atualizar status de lead
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="updateAssignee"
                        checked={options.updateAssignee}
                        onCheckedChange={(c) => setOptions(prev => ({ ...prev, updateAssignee: c === true }))}
                      />
                      <Label htmlFor="updateAssignee" className="text-sm cursor-pointer">
                        Atualizar vendedor atribuído
                      </Label>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Progress */}
            {isImporting && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Processando...</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            {/* Results */}
            {result && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-muted text-center">
                    <div className="text-xl font-bold">{result.total}</div>
                    <div className="text-xs text-muted-foreground">Total</div>
                  </div>
                  <div className="p-3 rounded-lg bg-green-500/10 text-center">
                    <div className="text-xl font-bold text-green-500">{result.updated}</div>
                    <div className="text-xs text-muted-foreground">Atualizados</div>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-500/10 text-center">
                    <div className="text-xl font-bold text-blue-500">{result.tagsAssigned}</div>
                    <div className="text-xs text-muted-foreground">Etiquetas</div>
                  </div>
                  <div className="p-3 rounded-lg bg-red-500/10 text-center">
                    <div className="text-xl font-bold text-red-500">{result.errors}</div>
                    <div className="text-xs text-muted-foreground">Erros</div>
                  </div>
                </div>

                {result.tagsCreated > 0 && (
                  <div className="p-3 rounded-lg bg-primary/10 text-sm">
                    <span className="font-medium">{result.tagsCreated}</span> novas etiquetas criadas
                  </div>
                )}

                {result.log.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Log de Importação</h3>
                    <ScrollArea className="h-48 border rounded-lg p-3">
                      <div className="space-y-1">
                        {result.log.map((entry, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs">
                            {getLogIcon(entry.type)}
                            <span className="text-muted-foreground">{entry.message}</span>
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
            <Button variant="outline" onClick={handleClose}>
              {result ? 'Fechar' : 'Cancelar'}
            </Button>
            {parsedData && !result && (
              <Button 
                onClick={handleStartImport} 
                disabled={isImporting || !columnMapping.telefone}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Iniciar Importação
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
