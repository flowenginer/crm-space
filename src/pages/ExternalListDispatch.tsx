import { useState, useMemo, useCallback } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  Users, 
  Send, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  Eye,
  Clock,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

import {
  parseBlingHtml,
  useMatchContacts,
  useMetaTemplates,
  useCloudApiChannels,
  useApiKeys,
  useExecuteDispatch,
  extractFirstName,
  type ExternalListOrder,
  type MatchedContact,
  type UnmatchedOrder,
} from '@/hooks/useExternalListDispatch';

type Step = 'upload' | 'matching' | 'configure' | 'dispatch';

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) return `${hours}h ${mins}min`;
  if (mins > 0) return `${mins}min ${secs}s`;
  return `${secs}s`;
}

export default function ExternalListDispatch() {
  const [step, setStep] = useState<Step>('upload');
  const [orders, setOrders] = useState<ExternalListOrder[]>([]);
  const [matchedContacts, setMatchedContacts] = useState<MatchedContact[]>([]);
  const [unmatchedOrders, setUnmatchedOrders] = useState<UnmatchedOrder[]>([]);
  
  // Configuration state
  const [templateId, setTemplateId] = useState('');
  const [channelId, setChannelId] = useState('');
  const [apiKeyId, setApiKeyId] = useState('');
  const [intervalSeconds, setIntervalSeconds] = useState(15);
  const [variableMapping, setVariableMapping] = useState<Record<string, string>>({
    '1': 'firstName',
    '2': 'orderNumber',
  });
  
  const { data: templates = [] } = useMetaTemplates();
  const { data: channels = [] } = useCloudApiChannels();
  const { data: apiKeys = [] } = useApiKeys();
  const matchContacts = useMatchContacts();
  const { progress, execute, cancel, reset } = useExecuteDispatch();
  
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
  
  // Handle file upload
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const parsed = parseBlingHtml(text);
      
      if (parsed.length === 0) {
        toast.error('Nenhum pedido encontrado no arquivo');
        return;
      }
      
      setOrders(parsed);
      toast.success(`${parsed.length} pedidos encontrados!`);
      
      // Auto-match contacts
      const result = await matchContacts.mutateAsync(parsed);
      setMatchedContacts(result.matched);
      setUnmatchedOrders(result.unmatched);
      setStep('matching');
    } catch (error) {
      console.error('Error parsing file:', error);
      toast.error('Erro ao processar arquivo');
    }
  }, [matchContacts]);
  
  // Handle dispatch start
  const handleStartDispatch = useCallback(async () => {
    // Specific validation with clear error messages
    if (!selectedTemplate) {
      toast.error('Selecione um Template Meta');
      return;
    }
    if (!channelId) {
      toast.error('Selecione um Canal Cloud API');
      console.warn('[ListDispatch] channelId missing. Available channels:', channels);
      return;
    }
    if (!selectedApiKey) {
      toast.error('Selecione uma Chave de API');
      console.warn('[ListDispatch] apiKeyId missing. Available API keys:', apiKeys);
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
  }, [selectedTemplate, channelId, selectedApiKey, matchedContacts, intervalSeconds, variableMapping, execute, channels, apiKeys]);
  
  // Reset everything
  const handleReset = useCallback(() => {
    setStep('upload');
    setOrders([]);
    setMatchedContacts([]);
    setUnmatchedOrders([]);
    setTemplateId('');
    setChannelId('');
    setApiKeyId('');
    setIntervalSeconds(15);
    setVariableMapping({ '1': 'firstName', '2': 'orderNumber' });
    reset();
  }, [reset]);
  
  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="h-8 w-8 text-primary" />
            Disparo por Lista Externa
          </h1>
          <p className="text-muted-foreground">Importe listas do Bling e envie templates via API Oficial</p>
        </div>
      </div>
      
      {/* Progress Steps */}
      <div className="flex items-center gap-2">
        {[
          { id: 'upload', label: 'Upload', icon: Upload },
          { id: 'matching', label: 'Cruzamento', icon: Users },
          { id: 'configure', label: 'Configurar', icon: Send },
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
              Upload de Lista
            </CardTitle>
            <CardDescription>
              Faça upload do relatório de pedidos exportado do Bling (formato HTML)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors">
              <Input
                type="file"
                accept=".html,.htm"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">Clique para selecionar arquivo</p>
                <p className="text-sm text-muted-foreground">ou arraste e solte aqui</p>
                <p className="text-xs text-muted-foreground mt-2">Formatos aceitos: HTML (exportação Bling)</p>
              </label>
            </div>
            
            {matchContacts.isPending && (
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando e cruzando com CRM...
              </div>
            )}
          </CardContent>
        </Card>
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
                      <TableHead>Pedido</TableHead>
                      <TableHead>Cliente (Lista)</TableHead>
                      <TableHead>Contato (CRM)</TableHead>
                      <TableHead>Telefone</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matchedContacts.map((c) => (
                      <TableRow key={c.orderId}>
                        <TableCell className="font-mono">{c.orderNumber}</TableCell>
                        <TableCell>{c.customerName}</TableCell>
                        <TableCell>{c.contactName}</TableCell>
                        <TableCell className="font-mono">{c.phone}</TableCell>
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
                Não Encontrados ({unmatchedOrders.length})
              </CardTitle>
              <CardDescription>
                Estes clientes não foram identificados no CRM
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Cliente</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unmatchedOrders.map((o) => (
                      <TableRow key={o.orderNumber}>
                        <TableCell className="font-mono">{o.orderNumber}</TableCell>
                        <TableCell>{o.customerName}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
          
          <div className="lg:col-span-2 flex justify-between">
            <Button variant="outline" onClick={handleReset}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <Button onClick={() => setStep('configure')} disabled={matchedContacts.length === 0}>
              Continuar
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}
      
      {/* Step: Configure */}
      {step === 'configure' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Configuração do Disparo</CardTitle>
              <CardDescription>
                Configure o template e canal para envio
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
              
              <div className="space-y-2">
                <Label>Canal Cloud API *</Label>
                <Select value={channelId} onValueChange={setChannelId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um canal" />
                  </SelectTrigger>
              <SelectContent>
                    {channels.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name} ({c.phone})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Chave de API *</Label>
                <Select value={apiKeyId} onValueChange={setApiKeyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma chave de API" />
                  </SelectTrigger>
              <SelectContent>
                    {apiKeys.filter(k => (k.permissions as Record<string, boolean> | null)?.send_message).map(k => (
                      <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Separator />
              
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
          
          <Card>
            <CardHeader>
              <CardTitle>Mapeamento de Variáveis</CardTitle>
              <CardDescription>
                Defina qual dado será enviado em cada variável do template
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {templateVariables.length > 0 ? (
                templateVariables.map((varNum: string) => (
                  <div key={varNum} className="flex items-center gap-4">
                    <Badge variant="outline" className="w-16 justify-center">
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
                        <SelectItem value="firstName">Primeiro Nome</SelectItem>
                        <SelectItem value="fullName">Nome Completo</SelectItem>
                        <SelectItem value="orderNumber">Número do Pedido</SelectItem>
                        <SelectItem value="contactName">Nome no CRM</SelectItem>
                        <SelectItem value="phone">Telefone</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  {templateId ? 'Este template não possui variáveis' : 'Selecione um template para ver as variáveis'}
                </p>
              )}
              
              <Separator />
              
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Eye className="h-4 w-4" />
                  Preview
                </div>
                {selectedTemplate && matchedContacts[0] && (
                  <p className="text-sm">
                    Exemplo para <strong>{matchedContacts[0].customerName}</strong>:
                    <br />
                    <span className="text-muted-foreground">
                      {`{{1}}`} = {extractFirstName(matchedContacts[0].customerName)}
                      <br />
                      {`{{2}}`} = {matchedContacts[0].orderNumber}
                    </span>
                  </p>
                )}
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {matchedContacts.length} contatos
                </span>
                <span className="text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  ~{estimatedTime}
                </span>
              </div>
            </CardContent>
          </Card>
          
          <div className="lg:col-span-2 flex justify-between">
            <Button variant="outline" onClick={() => setStep('matching')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <Button 
              onClick={handleStartDispatch} 
              disabled={!templateId || !channelId || !apiKeyId}
            >
              Iniciar Disparo
              <Send className="h-4 w-4 ml-2" />
            </Button>
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
              {progress.status === 'cancelled' && <AlertCircle className="h-5 w-5 text-yellow-500" />}
              {progress.status === 'error' && <XCircle className="h-5 w-5 text-red-500" />}
              Progresso do Disparo
            </CardTitle>
            <CardDescription>
              {progress.status === 'running' && `Enviando para ${progress.current || '...'}...`}
              {progress.status === 'completed' && 'Disparo concluído!'}
              {progress.status === 'cancelled' && 'Disparo cancelado'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Progress 
              value={(progress.sent + progress.errors) / progress.total * 100} 
              className="h-3"
            />
            
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-green-500/10 p-4 rounded-lg">
                <div className="text-3xl font-bold text-green-500">{progress.sent}</div>
                <div className="text-sm text-muted-foreground">Enviados</div>
              </div>
              <div className="bg-red-500/10 p-4 rounded-lg">
                <div className="text-3xl font-bold text-red-500">{progress.errors}</div>
                <div className="text-sm text-muted-foreground">Erros</div>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <div className="text-3xl font-bold">{progress.total - progress.sent - progress.errors}</div>
                <div className="text-sm text-muted-foreground">Pendentes</div>
              </div>
            </div>
            
            <div className="flex justify-center gap-4">
              {progress.status === 'running' && (
                <Button variant="destructive" onClick={cancel}>
                  <Pause className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              )}
              {(progress.status === 'completed' || progress.status === 'cancelled') && (
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

const steps: Step[] = ['upload', 'matching', 'configure', 'dispatch'];
