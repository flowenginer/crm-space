import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Phone,
  Smartphone,
  MessageCircle,
  Reply,
  Clock,
  ChevronRight,
  Tag,
  Users,
  Building,
  UserCheck,
  X,
  Zap,
  PlayCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from '@/hooks/useTenant';
import type { MarketingStep, MarketingAction, MarketingActionType } from '@/types/marketing';
import { MARKETING_ACTION_LABELS } from '@/types/marketing';

interface MarketingTestPanelProps {
  campaignId?: string;
  steps: MarketingStep[];
  campaignTitle: string;
}

interface Channel {
  id: string;
  name: string;
  phone: string;
  status: string;
}

interface TestLog {
  step: number;
  status: 'pending' | 'sending' | 'sent' | 'error' | 'action';
  message?: string;
  timestamp?: string;
  type?: 'message' | 'action';
}

interface ReferenceData {
  tags: { id: string; name: string; color: string }[];
  departments: { id: string; name: string }[];
  agents: { id: string; full_name: string }[];
  leadStatuses: { id: string; name: string; color: string }[];
  segments: { id: string; name: string }[];
  closeReasons: { id: string; name: string }[];
}

const ACTION_ICONS: Partial<Record<MarketingActionType, React.ReactNode>> = {
  add_tag: <Tag size={12} />,
  transfer_agent: <UserCheck size={12} />,
  transfer_department: <Building size={12} />,
  transfer_owner: <Users size={12} />,
  change_lead_status: <Zap size={12} />,
  close: <X size={12} />,
  start_followup: <PlayCircle size={12} />,
  start_marketing: <PlayCircle size={12} />,
  start_automation: <PlayCircle size={12} />,
};

export function MarketingTestPanel({ campaignId, steps, campaignTitle }: MarketingTestPanelProps) {
  const [phone, setPhone] = useState('');
  const [channelOption, setChannelOption] = useState<'select' | 'existing'>('select');
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [channels, setChannels] = useState<Channel[]>([]);
  
  // Test mode
  const [testMode, setTestMode] = useState<'rapid' | 'interactive'>('rapid');
  
  // Rapid mode state
  const [isTestingRapid, setIsTestingRapid] = useState(false);
  const [testLogs, setTestLogs] = useState<TestLog[]>([]);
  const [progress, setProgress] = useState(0);
  
  // Interactive mode state
  const [currentTestStep, setCurrentTestStep] = useState(0);
  const [stepStatus, setStepStatus] = useState<'idle' | 'sent' | 'awaiting'>('idle');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executeActionsInDb, setExecuteActionsInDb] = useState(false);
  const [interactiveLogs, setInteractiveLogs] = useState<TestLog[]>([]);
  
  // Reference data for action descriptions
  const [referenceData, setReferenceData] = useState<ReferenceData>({
    tags: [],
    departments: [],
    agents: [],
    leadStatuses: [],
    segments: [],
    closeReasons: [],
  });
  
  const { data: tenantId } = useCurrentTenantId();

  // Fetch available channels and reference data
  useEffect(() => {
    const fetchData = async () => {
      if (!tenantId) return;

      // Fetch channels
      const { data: channelData } = await supabase
        .from('whatsapp_channels')
        .select('id, name, phone, status')
        .eq('tenant_id', tenantId)
        .eq('is_deleted', false)
        .eq('status', 'connected');

      if (channelData) {
        setChannels(channelData);
        if (channelData.length > 0 && !selectedChannelId) {
          setSelectedChannelId(channelData[0].id);
        }
      }

      // Fetch reference data in parallel
      const [tagsRes, deptsRes, agentsRes, statusesRes, segmentsRes, closeReasonsRes] = await Promise.all([
        supabase.from('tags').select('id, name, color').eq('tenant_id', tenantId),
        supabase.from('departments').select('id, name').eq('tenant_id', tenantId).eq('is_active', true),
        supabase.from('profiles').select('id, full_name').eq('tenant_id', tenantId).eq('is_active', true),
        supabase.from('lead_statuses').select('id, name, color').eq('tenant_id', tenantId).eq('is_active', true),
        supabase.from('segments').select('id, name').eq('tenant_id', tenantId),
        supabase.from('close_reasons').select('id, name').eq('tenant_id', tenantId).eq('is_active', true),
      ]);

      setReferenceData({
        tags: tagsRes.data || [],
        departments: deptsRes.data || [],
        agents: agentsRes.data || [],
        leadStatuses: statusesRes.data || [],
        segments: segmentsRes.data || [],
        closeReasons: closeReasonsRes.data || [],
      });
    };

    fetchData();
  }, [tenantId]);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    return digits;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  const validatePhone = () => {
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 13;
  };

  const normalizePhone = () => {
    let normalizedPhone = phone.replace(/\D/g, '');
    if (!normalizedPhone.startsWith('55') && normalizedPhone.length <= 11) {
      normalizedPhone = '55' + normalizedPhone;
    }
    return normalizedPhone;
  };

  // Get action description with reference data
  const getActionDescription = (action: MarketingAction): string => {
    const baseLabel = MARKETING_ACTION_LABELS[action.type] || action.type;
    
    switch (action.type) {
      case 'add_tag': {
        const tag = referenceData.tags.find(t => t.id === action.config.tag_id);
        return tag ? `${baseLabel}: ${tag.name}` : baseLabel;
      }
      case 'transfer_agent': {
        const agent = referenceData.agents.find(a => a.id === action.config.agent_id);
        return agent ? `${baseLabel}: ${agent.full_name}` : baseLabel;
      }
      case 'transfer_department': {
        const dept = referenceData.departments.find(d => d.id === action.config.department_id);
        return dept ? `${baseLabel}: ${dept.name}` : baseLabel;
      }
      case 'change_lead_status': {
        const status = referenceData.leadStatuses.find(s => s.id === action.config.lead_status_id);
        return status ? `${baseLabel}: ${status.name}` : baseLabel;
      }
      case 'add_segment': {
        const segment = referenceData.segments.find(s => s.id === action.config.segment_id);
        return segment ? `${baseLabel}: ${segment.name}` : baseLabel;
      }
      case 'close': {
        const reason = referenceData.closeReasons.find(r => r.id === action.config.close_reason_id);
        return reason ? `${baseLabel}: ${reason.name}` : baseLabel;
      }
      default:
        return baseLabel;
    }
  };

  // RAPID TEST - Send all messages at once
  const runRapidTest = async () => {
    if (!validatePhone()) {
      toast.error('Informe um número de telefone válido');
      return;
    }

    if (channelOption === 'select' && !selectedChannelId) {
      toast.error('Selecione um canal');
      return;
    }

    if (steps.length === 0) {
      toast.error('A campanha não tem mensagens para testar');
      return;
    }

    setIsTestingRapid(true);
    setTestLogs([]);
    setProgress(0);

    const initialLogs: TestLog[] = steps.map((_, index) => ({
      step: index,
      status: 'pending',
      type: 'message',
    }));
    setTestLogs(initialLogs);

    try {
      const { data, error } = await supabase.functions.invoke('test-marketing-campaign', {
        body: {
          mode: 'rapid',
          phone: normalizePhone(),
          channelOption,
          channelId: channelOption === 'select' ? selectedChannelId : null,
          steps: steps.map((step, index) => ({
            index,
            message: step.message,
            audio_url: step.audio_url,
            attachment_url: step.attachment_url,
            attachment_type: step.attachment_type,
          })),
          tenantId,
          campaignTitle,
        },
      });

      if (error) throw error;

      if (data?.results) {
        const updatedLogs: TestLog[] = data.results.map((result: any) => ({
          step: result.step,
          status: result.success ? 'sent' : 'error',
          message: result.error || (result.success ? 'Enviado com sucesso' : 'Falha no envio'),
          timestamp: new Date().toLocaleTimeString('pt-BR'),
          type: 'message',
        }));
        setTestLogs(updatedLogs);
        setProgress(100);

        const successCount = data.results.filter((r: any) => r.success).length;
        if (successCount === steps.length) {
          toast.success(`Teste concluído! ${successCount}/${steps.length} mensagens enviadas`);
        } else {
          toast.warning(`Teste parcial: ${successCount}/${steps.length} mensagens enviadas`);
        }
      }
    } catch (error: any) {
      console.error('Test error:', error);
      toast.error(error.message || 'Erro ao executar teste');
      
      setTestLogs(prev => prev.map(log => ({
        ...log,
        status: 'error',
        message: error.message || 'Erro na execução',
      })));
    } finally {
      setIsTestingRapid(false);
    }
  };

  // INTERACTIVE TEST - Step by step
  const sendCurrentStep = async () => {
    if (!validatePhone()) {
      toast.error('Informe um número de telefone válido');
      return;
    }

    if (channelOption === 'select' && !selectedChannelId) {
      toast.error('Selecione um canal');
      return;
    }

    setIsExecuting(true);

    try {
      const step = steps[currentTestStep];
      
      const { data, error } = await supabase.functions.invoke('test-marketing-campaign', {
        body: {
          mode: 'interactive',
          action: 'send_step',
          phone: normalizePhone(),
          channelOption,
          channelId: channelOption === 'select' ? selectedChannelId : null,
          stepIndex: currentTestStep,
          step: {
            index: currentTestStep,
            message: step.message,
            audio_url: step.audio_url,
            attachment_url: step.attachment_url,
            attachment_type: step.attachment_type,
          },
          tenantId,
          campaignTitle,
        },
      });

      if (error) throw error;

      if (data?.success) {
        setStepStatus('awaiting');
        setInteractiveLogs(prev => [...prev, {
          step: currentTestStep,
          status: 'sent',
          message: `Mensagem ${currentTestStep + 1} enviada`,
          timestamp: new Date().toLocaleTimeString('pt-BR'),
          type: 'message',
        }]);
        toast.success(`Mensagem ${currentTestStep + 1} enviada!`);
      } else {
        throw new Error(data?.error || 'Erro ao enviar');
      }
    } catch (error: any) {
      console.error('Send step error:', error);
      toast.error(error.message || 'Erro ao enviar mensagem');
      setInteractiveLogs(prev => [...prev, {
        step: currentTestStep,
        status: 'error',
        message: `Erro: ${error.message}`,
        timestamp: new Date().toLocaleTimeString('pt-BR'),
        type: 'message',
      }]);
    } finally {
      setIsExecuting(false);
    }
  };

  const simulateAction = async (actionType: 'reply' | 'no_reply') => {
    setIsExecuting(true);

    try {
      const step = steps[currentTestStep];
      const actions = actionType === 'reply' ? step.on_reply_actions : step.on_no_reply_actions;
      
      if (!actions || actions.length === 0) {
        toast.info('Nenhuma ação configurada para este cenário');
        setIsExecuting(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('test-marketing-campaign', {
        body: {
          mode: 'interactive',
          action: actionType === 'reply' ? 'simulate_reply' : 'simulate_no_reply',
          phone: normalizePhone(),
          channelOption,
          channelId: channelOption === 'select' ? selectedChannelId : null,
          stepIndex: currentTestStep,
          actions,
          executeActions: executeActionsInDb,
          tenantId,
          campaignTitle,
        },
      });

      if (error) throw error;

      const actionLabel = actionType === 'reply' ? 'Cliente respondeu' : 'Cliente não respondeu';
      
      setInteractiveLogs(prev => [...prev, {
        step: currentTestStep,
        status: 'action',
        message: `${actionLabel} (simulado)`,
        timestamp: new Date().toLocaleTimeString('pt-BR'),
        type: 'action',
      }]);

      // Log each executed action
      if (data?.executedActions) {
        for (const action of data.executedActions) {
          setInteractiveLogs(prev => [...prev, {
            step: currentTestStep,
            status: action.success ? 'sent' : 'error',
            message: `${action.success ? '✓' : '✗'} ${action.description}`,
            timestamp: new Date().toLocaleTimeString('pt-BR'),
            type: 'action',
          }]);
        }
      }

      toast.success(`${actionLabel} - ${executeActionsInDb ? 'Ações executadas' : 'Ações simuladas'}`);
      
      // Move to next step or finish
      if (currentTestStep < steps.length - 1) {
        setCurrentTestStep(prev => prev + 1);
        setStepStatus('idle');
      } else {
        setStepStatus('idle');
        toast.success('Teste interativo concluído!');
      }
    } catch (error: any) {
      console.error('Simulate action error:', error);
      toast.error(error.message || 'Erro ao simular ação');
    } finally {
      setIsExecuting(false);
    }
  };

  const skipToNextStep = () => {
    setInteractiveLogs(prev => [...prev, {
      step: currentTestStep,
      status: 'sent',
      message: `Etapa ${currentTestStep + 1} pulada`,
      timestamp: new Date().toLocaleTimeString('pt-BR'),
      type: 'action',
    }]);
    
    if (currentTestStep < steps.length - 1) {
      setCurrentTestStep(prev => prev + 1);
      setStepStatus('idle');
    } else {
      toast.success('Teste interativo concluído!');
    }
  };

  const resetInteractiveTest = () => {
    setCurrentTestStep(0);
    setStepStatus('idle');
    setInteractiveLogs([]);
  };

  const currentStep = steps[currentTestStep];

  return (
    <div className="space-y-4 p-4 border border-dashed border-primary/30 rounded-lg bg-primary/5">
      <div className="flex items-center gap-2">
        <Play size={16} className="text-primary" />
        <Label className="text-sm font-semibold">Testar Campanha</Label>
      </div>

      {/* Test Mode Tabs */}
      <Tabs value={testMode} onValueChange={(v) => setTestMode(v as 'rapid' | 'interactive')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="rapid" className="text-xs">
            <Zap size={12} className="mr-1" />
            Teste Rápido
          </TabsTrigger>
          <TabsTrigger value="interactive" className="text-xs">
            <MessageCircle size={12} className="mr-1" />
            Interativo
          </TabsTrigger>
        </TabsList>

        {/* Common Inputs */}
        <div className="mt-4 space-y-3">
          {/* Phone Input */}
          <div className="space-y-1">
            <Label htmlFor="test-phone" className="text-xs flex items-center gap-1">
              <Phone size={12} />
              Número do WhatsApp
            </Label>
            <Input
              id="test-phone"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="5511999999999"
              className="text-sm"
            />
          </div>

          {/* Channel Option */}
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1">
              <Smartphone size={12} />
              Canal para envio
            </Label>
            <Select value={channelOption} onValueChange={(v: 'select' | 'existing') => setChannelOption(v)}>
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="select">Selecionar canal</SelectItem>
                <SelectItem value="existing">Usar canal de conversa existente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Channel Select */}
          {channelOption === 'select' && (
            <div className="space-y-1">
              <Label className="text-xs">Canal</Label>
              <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Selecione um canal" />
                </SelectTrigger>
                <SelectContent>
                  {channels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      {channel.name} ({channel.phone})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* RAPID TEST TAB */}
        <TabsContent value="rapid" className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Envia todas as mensagens em sequência com 5-10 segundos de intervalo.
          </p>

          <Button
            onClick={runRapidTest}
            disabled={isTestingRapid || !validatePhone() || (channelOption === 'select' && !selectedChannelId)}
            className="w-full"
            size="sm"
          >
            {isTestingRapid ? (
              <>
                <Loader2 size={14} className="mr-2 animate-spin" />
                Executando Teste...
              </>
            ) : (
              <>
                <Play size={14} className="mr-2" />
                Executar Teste ({steps.length} msg)
              </>
            )}
          </Button>

          {(isTestingRapid || testLogs.length > 0) && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              
              <ScrollArea className="h-32 border rounded p-2 bg-background">
                <div className="space-y-1">
                  {testLogs.map((log, index) => (
                    <div key={index} className="flex items-center gap-2 text-xs">
                      {log.status === 'pending' && (
                        <div className="w-4 h-4 rounded-full border border-muted-foreground" />
                      )}
                      {log.status === 'sending' && (
                        <Loader2 size={14} className="animate-spin text-primary" />
                      )}
                      {log.status === 'sent' && (
                        <CheckCircle2 size={14} className="text-green-500" />
                      )}
                      {log.status === 'error' && (
                        <XCircle size={14} className="text-destructive" />
                      )}
                      <span className="font-medium">Msg {log.step + 1}</span>
                      {log.timestamp && (
                        <span className="text-muted-foreground">{log.timestamp}</span>
                      )}
                      {log.message && (
                        <span className={log.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}>
                          - {log.message}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </TabsContent>

        {/* INTERACTIVE TEST TAB */}
        <TabsContent value="interactive" className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Teste passo a passo: envie mensagens e simule respostas do cliente.
          </p>

          {/* Current Step Info */}
          {currentStep && (
            <div className="p-3 border rounded-lg bg-background space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs">
                  Etapa {currentTestStep + 1} de {steps.length}
                </Badge>
                {stepStatus === 'awaiting' && (
                  <Badge variant="secondary" className="text-xs">
                    <Clock size={10} className="mr-1" />
                    Aguardando simulação
                  </Badge>
                )}
              </div>

              <p className="text-xs line-clamp-2 text-muted-foreground">
                {currentStep.message?.substring(0, 100)}
                {(currentStep.message?.length || 0) > 100 && '...'}
              </p>

              <Separator />

              {/* Actions Preview */}
              {stepStatus === 'awaiting' && (
                <div className="space-y-2">
                  {/* On Reply Actions */}
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1 text-green-600">
                      <Reply size={10} />
                      Se o cliente responder:
                    </Label>
                    {currentStep.on_reply_actions?.length > 0 ? (
                      <div className="space-y-1">
                        {currentStep.on_reply_actions.map((action, idx) => (
                          <div key={idx} className="flex items-center gap-1 text-xs text-muted-foreground ml-3">
                            {ACTION_ICONS[action.type] || <ChevronRight size={10} />}
                            <span>{getActionDescription(action)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground ml-3">Nenhuma ação configurada</p>
                    )}
                  </div>

                  {/* On No Reply Actions */}
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1 text-orange-600">
                      <Clock size={10} />
                      Se o cliente não responder:
                    </Label>
                    {currentStep.on_no_reply_actions?.length > 0 ? (
                      <div className="space-y-1">
                        {currentStep.on_no_reply_actions.map((action, idx) => (
                          <div key={idx} className="flex items-center gap-1 text-xs text-muted-foreground ml-3">
                            {ACTION_ICONS[action.type] || <ChevronRight size={10} />}
                            <span>{getActionDescription(action)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground ml-3">Nenhuma ação configurada</p>
                    )}
                  </div>

                  <Separator />

                  {/* Execute Actions Checkbox */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="execute-actions"
                      checked={executeActionsInDb}
                      onCheckedChange={(checked) => setExecuteActionsInDb(checked as boolean)}
                    />
                    <Label htmlFor="execute-actions" className="text-xs cursor-pointer">
                      Executar ações no banco de dados
                    </Label>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                {stepStatus === 'idle' && (
                  <Button
                    onClick={sendCurrentStep}
                    disabled={isExecuting || !validatePhone() || (channelOption === 'select' && !selectedChannelId)}
                    size="sm"
                    className="flex-1"
                  >
                    {isExecuting ? (
                      <Loader2 size={12} className="mr-1 animate-spin" />
                    ) : (
                      <MessageCircle size={12} className="mr-1" />
                    )}
                    Enviar Mensagem
                  </Button>
                )}

                {stepStatus === 'awaiting' && (
                  <>
                    <Button
                      onClick={() => simulateAction('reply')}
                      disabled={isExecuting}
                      size="sm"
                      variant="outline"
                      className="flex-1 border-green-500 text-green-600 hover:bg-green-50"
                    >
                      {isExecuting ? (
                        <Loader2 size={12} className="mr-1 animate-spin" />
                      ) : (
                        <Reply size={12} className="mr-1" />
                      )}
                      Cliente Respondeu
                    </Button>
                    <Button
                      onClick={() => simulateAction('no_reply')}
                      disabled={isExecuting}
                      size="sm"
                      variant="outline"
                      className="flex-1 border-orange-500 text-orange-600 hover:bg-orange-50"
                    >
                      {isExecuting ? (
                        <Loader2 size={12} className="mr-1 animate-spin" />
                      ) : (
                        <Clock size={12} className="mr-1" />
                      )}
                      Sem Resposta
                    </Button>
                  </>
                )}

                {stepStatus === 'awaiting' && (
                  <Button
                    onClick={skipToNextStep}
                    disabled={isExecuting}
                    size="sm"
                    variant="ghost"
                    className="w-full text-xs"
                  >
                    <ChevronRight size={12} className="mr-1" />
                    Pular para próxima etapa
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Interactive Logs */}
          {interactiveLogs.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Log do Teste</Label>
                <Button variant="ghost" size="sm" onClick={resetInteractiveTest} className="h-6 text-xs">
                  Reiniciar
                </Button>
              </div>
              
              <ScrollArea className="h-32 border rounded p-2 bg-background">
                <div className="space-y-1">
                  {interactiveLogs.map((log, index) => (
                    <div key={index} className="flex items-center gap-2 text-xs">
                      {log.status === 'sent' && (
                        <CheckCircle2 size={14} className="text-green-500" />
                      )}
                      {log.status === 'error' && (
                        <XCircle size={14} className="text-destructive" />
                      )}
                      {log.status === 'action' && (
                        <Zap size={14} className="text-primary" />
                      )}
                      {log.timestamp && (
                        <span className="text-muted-foreground">{log.timestamp}</span>
                      )}
                      <span className={log.status === 'error' ? 'text-destructive' : ''}>
                        {log.message}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
