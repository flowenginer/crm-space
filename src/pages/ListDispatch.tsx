import { useState, useMemo, useCallback } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  Users, 
  Send, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  ArrowRight,
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  Eye,
  Clock,
  Phone,
  User,
  CreditCard,
  Settings2,
  Columns,
  Hash,
  Type,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';

import {
  parseSpreadsheet,
  useSmartMatchContacts,
  useMetaTemplates,
  useCloudApiChannels,
  useApiKeys,
  useExecuteListDispatch,
  extractFirstName,
  type SpreadsheetData,
  type SpreadsheetColumn,
  type MatchedListContact,
  type UnmatchedListRow,
} from '@/hooks/useListDispatch';

type Step = 'upload' | 'configure' | 'matching' | 'dispatch';
const steps: Step[] = ['upload', 'configure', 'matching', 'dispatch'];

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) return `${hours}h ${mins}min`;
  if (mins > 0) return `${mins}min ${secs}s`;
  return `${secs}s`;
}

function getColumnIcon(type: SpreadsheetColumn['type']) {
  switch (type) {
    case 'phone': return <Phone className="h-3 w-3" />;
    case 'number': return <Hash className="h-3 w-3" />;
    case 'date': return <Calendar className="h-3 w-3" />;
    default: return <Type className="h-3 w-3" />;
  }
}

export default function ListDispatch() {
  const [step, setStep] = useState<Step>('upload');
  const [spreadsheetData, setSpreadsheetData] = useState<SpreadsheetData | null>(null);
  const [matchedContacts, setMatchedContacts] = useState<MatchedListContact[]>([]);
  const [unmatchedRows, setUnmatchedRows] = useState<UnmatchedListRow[]>([]);
  
  // Configuration state
  const [identifierColumn, setIdentifierColumn] = useState('');
  const [identifierType, setIdentifierType] = useState<'phone' | 'name' | 'cpf'>('phone');
  const [templateId, setTemplateId] = useState('');
  const [channelId, setChannelId] = useState('');
  const [apiKeyId, setApiKeyId] = useState('');
  const [intervalSeconds, setIntervalSeconds] = useState(15);
  const [variableMapping, setVariableMapping] = useState<Record<string, string>>({});
  
  const { data: templates = [] } = useMetaTemplates();
  const { data: channels = [] } = useCloudApiChannels();
  const { data: apiKeys = [] } = useApiKeys();
  const smartMatch = useSmartMatchContacts();
  const { progress, execute, cancel, reset } = useExecuteListDispatch();
  
  const selectedTemplate = useMemo(() => 
    templates.find(t => t.id === templateId), 
    [templates, templateId]
  );
  
  const selectedApiKey = useMemo(() => 
    apiKeys.find(k => k.id === apiKeyId) as { id: string; name: string; api_key: string; permissions: Record<string, boolean> | null } | undefined,
    [apiKeys, apiKeyId]
  );
  
  // Extract template variables from body component
  const templateVariables = useMemo(() => {
    if (!selectedTemplate?.components) return [];
    const components = selectedTemplate.components as Array<{ type: string; text?: string }>;
    const bodyComponent = components.find((c) => c.type === 'BODY');
    if (!bodyComponent?.text) return [];
    
    const matches = bodyComponent.text.match(/\{\{(\d+)\}\}/g) || [];
    return matches.map((m: string) => m.replace(/[{}]/g, ''));
  }, [selectedTemplate]);
  
  // Estimated time
  const estimatedTime = useMemo(() => 
    formatDuration(matchedContacts.length * intervalSeconds), 
    [matchedContacts.length, intervalSeconds]
  );
  
  // Available columns for mapping (spreadsheet + special fields)
  const availableColumns = useMemo(() => {
    const cols = spreadsheetData?.columns || [];
    return [
      { value: '__first_name__', label: '📇 Primeiro Nome (CRM)' },
      { value: '__full_name__', label: '📇 Nome Completo (CRM)' },
      { value: '__phone__', label: '📱 Telefone (CRM)' },
      ...cols.map(c => ({ value: c.name, label: `📊 ${c.name}` })),
    ];
  }, [spreadsheetData]);
  
  // Handle file upload
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const parsed = await parseSpreadsheet(file);
      
      if (parsed.totalRows === 0) {
        toast.error('Nenhum registro encontrado no arquivo');
        return;
      }
      
      setSpreadsheetData(parsed);
      
      // Auto-detect phone column
      const phoneCol = parsed.columns.find(c => c.type === 'phone');
      if (phoneCol) {
        setIdentifierColumn(phoneCol.name);
        setIdentifierType('phone');
      }
      
      toast.success(`${parsed.totalRows} registros encontrados!`);
      setStep('configure');
    } catch (error) {
      console.error('Error parsing file:', error);
      toast.error('Erro ao processar arquivo');
    }
  }, []);
  
  // Handle contact matching
  const handleMatchContacts = useCallback(async () => {
    if (!spreadsheetData || !identifierColumn) {
      toast.error('Selecione a coluna de identificação');
      return;
    }
    
    try {
      const result = await smartMatch.mutateAsync({
        rows: spreadsheetData.rows,
        identifierColumn,
        identifierType,
      });
      
      setMatchedContacts(result.matched);
      setUnmatchedRows(result.unmatched);
      setStep('matching');
      
      toast.success(`${result.matched.length} contatos encontrados!`);
    } catch (error) {
      console.error('Error matching contacts:', error);
      toast.error('Erro ao cruzar contatos');
    }
  }, [spreadsheetData, identifierColumn, identifierType, smartMatch]);
  
  // Handle dispatch start
  const handleStartDispatch = useCallback(async () => {
    if (!selectedTemplate || !channelId || !selectedApiKey) {
      toast.error('Configure todos os campos antes de iniciar');
      return;
    }
    
    setStep('dispatch');
    
    await execute({
      contacts: matchedContacts,
      templateName: selectedTemplate.name,
      templateLanguage: selectedTemplate.language || 'pt_BR',
      channelId,
      apiKey: selectedApiKey.api_key,
      intervalSeconds,
      variableMapping,
    });
  }, [selectedTemplate, channelId, selectedApiKey, matchedContacts, intervalSeconds, variableMapping, execute]);
  
  // Reset everything
  const handleReset = useCallback(() => {
    setStep('upload');
    setSpreadsheetData(null);
    setMatchedContacts([]);
    setUnmatchedRows([]);
    setIdentifierColumn('');
    setIdentifierType('phone');
    setTemplateId('');
    setChannelId('');
    setApiKeyId('');
    setIntervalSeconds(15);
    setVariableMapping({});
    reset();
  }, [reset]);
  
  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="h-8 w-8 text-primary" />
            Disparo por Lista
          </h1>
          <p className="text-muted-foreground">
            Importe planilhas e envie templates via API Oficial
          </p>
        </div>
      </div>
      
      {/* Progress Steps */}
      <div className="flex items-center gap-2">
        {[
          { id: 'upload', label: 'Upload', icon: Upload },
          { id: 'configure', label: 'Configurar', icon: Settings2 },
          { id: 'matching', label: 'Cruzamento', icon: Users },
          { id: 'dispatch', label: 'Disparo', icon: Play },
        ].map((s, index) => (
          <div key={s.id} className="flex items-center">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
              step === s.id 
                ? 'bg-primary text-primary-foreground' 
                : steps.indexOf(step) > steps.indexOf(s.id as Step)
                  ? 'bg-green-500/20 text-green-500'
                  : 'bg-muted text-muted-foreground'
            }`}>
              <s.icon className="h-4 w-4" />
              <span className="text-sm font-medium">{s.label}</span>
            </div>
            {index < 3 && <ArrowRight className="h-4 w-4 mx-2 text-muted-foreground" />}
          </div>
        ))}
      </div>
      
      {/* Step: Upload */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload de Planilha
            </CardTitle>
            <CardDescription>
              Faça upload de uma planilha com os dados para disparo (HTML, CSV ou XLSX)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors">
              <Input
                type="file"
                accept=".html,.htm,.csv,.xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">Clique para selecionar arquivo</p>
                <p className="text-sm text-muted-foreground">ou arraste e solte aqui</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Formatos aceitos: HTML, CSV, XLSX
                </p>
              </label>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Step: Configure */}
      {step === 'configure' && spreadsheetData && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Column Detection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Columns className="h-5 w-5" />
                Colunas Detectadas ({spreadsheetData.columns.length})
              </CardTitle>
              <CardDescription>
                Campos identificados na sua planilha
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {spreadsheetData.columns.map((col) => (
                    <div 
                      key={col.name}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        {getColumnIcon(col.type)}
                        <span className="font-medium">{col.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {col.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                          {col.sample}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              
              <Separator />
              
              {/* Preview */}
              <div>
                <Label className="text-sm">Preview (primeiras 3 linhas)</Label>
                <ScrollArea className="h-[150px] mt-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {spreadsheetData.headers.slice(0, 5).map((h) => (
                          <TableHead key={h} className="text-xs">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {spreadsheetData.rows.slice(0, 3).map((row, i) => (
                        <TableRow key={i}>
                          {spreadsheetData.headers.slice(0, 5).map((h) => (
                            <TableCell key={h} className="text-xs truncate max-w-[100px]">
                              {row[h]}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
          
          {/* Identification & Mapping */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Configuração
              </CardTitle>
              <CardDescription>
                Configure como identificar os contatos e mapear variáveis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Identifier Type */}
              <div className="space-y-2">
                <Label>Identificar contatos por:</Label>
                <RadioGroup 
                  value={identifierType} 
                  onValueChange={(v) => setIdentifierType(v as 'phone' | 'name' | 'cpf')}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="phone" id="phone" />
                    <Label htmlFor="phone" className="flex items-center gap-1 cursor-pointer">
                      <Phone className="h-4 w-4" /> Telefone
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="name" id="name" />
                    <Label htmlFor="name" className="flex items-center gap-1 cursor-pointer">
                      <User className="h-4 w-4" /> Nome
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cpf" id="cpf" />
                    <Label htmlFor="cpf" className="flex items-center gap-1 cursor-pointer">
                      <CreditCard className="h-4 w-4" /> CPF/CNPJ
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              
              {/* Identifier Column */}
              <div className="space-y-2">
                <Label>Coluna de identificação *</Label>
                <Select value={identifierColumn} onValueChange={setIdentifierColumn}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    {spreadsheetData.columns.map(col => (
                      <SelectItem key={col.name} value={col.name}>
                        <span className="flex items-center gap-2">
                          {getColumnIcon(col.type)}
                          {col.name}
                          {col.type === 'phone' && identifierType === 'phone' && (
                            <Badge variant="secondary" className="text-xs ml-2">Recomendado</Badge>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Separator />
              
              {/* Template Selection */}
              <div className="space-y-2">
                <Label>Template Meta (API Oficial) *</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um template aprovado" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Variable Mapping */}
              {templateVariables.length > 0 && (
                <div className="space-y-2">
                  <Label>Mapeamento de Variáveis</Label>
                  <div className="space-y-2">
                    {templateVariables.map((varNum: string) => (
                      <div key={varNum} className="flex items-center gap-2">
                        <Badge variant="outline" className="w-14 justify-center shrink-0">
                          {`{{${varNum}}}`}
                        </Badge>
                        <Select 
                          value={variableMapping[varNum] || ''} 
                          onValueChange={(v) => setVariableMapping(prev => ({ ...prev, [varNum]: v }))}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Selecione o campo" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableColumns.map(col => (
                              <SelectItem key={col.value} value={col.value}>
                                {col.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <Separator />
              
              {/* Channel & API Key */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Canal Cloud API *</Label>
                  <Select value={channelId} onValueChange={setChannelId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {channels.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Chave de API *</Label>
                  <Select value={apiKeyId} onValueChange={setApiKeyId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {apiKeys.filter(k => (k.permissions as Record<string, boolean> | null)?.send_message).map(k => (
                        <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Interval */}
              <div className="space-y-2">
                <Label>Intervalo entre mensagens: {intervalSeconds}s</Label>
                <Slider 
                  value={[intervalSeconds]} 
                  onValueChange={([v]) => setIntervalSeconds(v)} 
                  min={5} 
                  max={60} 
                  step={5} 
                />
              </div>
            </CardContent>
          </Card>
          
          <div className="lg:col-span-2 flex justify-between">
            <Button variant="outline" onClick={handleReset}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <Button 
              onClick={handleMatchContacts} 
              disabled={!identifierColumn || smartMatch.isPending}
            >
              {smartMatch.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cruzando...
                </>
              ) : (
                <>
                  Cruzar com CRM
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}
      
      {/* Step: Matching */}
      {step === 'matching' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Contatos Encontrados ({matchedContacts.length})
              </CardTitle>
              <CardDescription>
                Estes contatos serão incluídos no disparo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contato (CRM)</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Match</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matchedContacts.map((c) => (
                      <TableRow key={c.rowIndex}>
                        <TableCell>{c.contactName}</TableCell>
                        <TableCell className="font-mono">{c.phone}</TableCell>
                        <TableCell>
                          <Badge variant={c.matchedBy === 'phone' ? 'default' : 'secondary'}>
                            {c.matchedBy === 'phone' && <Phone className="h-3 w-3 mr-1" />}
                            {c.matchedBy === 'name' && <User className="h-3 w-3 mr-1" />}
                            {c.matchedBy === 'cpf' && <CreditCard className="h-3 w-3 mr-1" />}
                            {c.matchScore}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                Não Encontrados ({unmatchedRows.length})
              </CardTitle>
              <CardDescription>
                Estes registros não foram identificados no CRM
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Identificador</TableHead>
                      <TableHead>Busca</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unmatchedRows.map((u) => (
                      <TableRow key={u.rowIndex}>
                        <TableCell>{u.identifier}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {u.searchedBy === 'phone' && <Phone className="h-3 w-3 mr-1" />}
                            {u.searchedBy === 'name' && <User className="h-3 w-3 mr-1" />}
                            {u.searchedBy === 'cpf' && <CreditCard className="h-3 w-3 mr-1" />}
                            {u.searchedBy}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
          
          {/* Summary */}
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">{matchedContacts.length} contatos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <span className="text-muted-foreground">Tempo estimado: {estimatedTime}</span>
                    </div>
                    {selectedTemplate && (
                      <div className="flex items-center gap-2">
                        <Send className="h-5 w-5 text-muted-foreground" />
                        <span className="text-muted-foreground">{selectedTemplate.name}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep('configure')}>
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Voltar
                    </Button>
                    <Button 
                      onClick={handleStartDispatch}
                      disabled={matchedContacts.length === 0 || !templateId || !channelId || !apiKeyId}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Iniciar Disparo
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
      
      {/* Step: Dispatch */}
      {step === 'dispatch' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {progress.status === 'running' && <Loader2 className="h-5 w-5 animate-spin" />}
              {progress.status === 'completed' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
              {progress.status === 'cancelled' && <XCircle className="h-5 w-5 text-yellow-500" />}
              {progress.status === 'error' && <XCircle className="h-5 w-5 text-red-500" />}
              Progresso do Disparo
            </CardTitle>
            <CardDescription>
              {progress.status === 'running' && `Enviando para: ${progress.current || '...'}`}
              {progress.status === 'completed' && 'Disparo finalizado!'}
              {progress.status === 'cancelled' && 'Disparo cancelado'}
              {progress.status === 'error' && 'Erro no disparo'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Progress 
              value={progress.total > 0 ? ((progress.sent + progress.errors) / progress.total) * 100 : 0} 
            />
            
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold text-green-500">{progress.sent}</p>
                <p className="text-sm text-muted-foreground">Enviados</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold text-red-500">{progress.errors}</p>
                <p className="text-sm text-muted-foreground">Erros</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{progress.total - progress.sent - progress.errors}</p>
                <p className="text-sm text-muted-foreground">Pendentes</p>
              </div>
            </div>
            
            <div className="flex justify-center gap-4">
              {progress.status === 'running' && (
                <Button variant="outline" onClick={cancel}>
                  <Pause className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              )}
              {(progress.status === 'completed' || progress.status === 'cancelled' || progress.status === 'error') && (
                <Button onClick={handleReset}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Novo Disparo
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
