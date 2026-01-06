import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  Phone,
  Smartphone,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from '@/hooks/useTenant';
import type { MarketingStep } from '@/types/marketing';

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
  status: 'pending' | 'sending' | 'sent' | 'error';
  message?: string;
  timestamp?: string;
}

export function MarketingTestPanel({ campaignId, steps, campaignTitle }: MarketingTestPanelProps) {
  const [phone, setPhone] = useState('');
  const [channelOption, setChannelOption] = useState<'select' | 'existing'>('select');
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [testLogs, setTestLogs] = useState<TestLog[]>([]);
  const [progress, setProgress] = useState(0);
  
  const { data: tenantId } = useCurrentTenantId();

  // Fetch available channels
  useEffect(() => {
    const fetchChannels = async () => {
      if (!tenantId) return;

      const { data } = await supabase
        .from('whatsapp_channels')
        .select('id, name, phone, status')
        .eq('tenant_id', tenantId)
        .eq('is_deleted', false)
        .eq('status', 'connected');

      if (data) {
        setChannels(data);
        if (data.length > 0 && !selectedChannelId) {
          setSelectedChannelId(data[0].id);
        }
      }
    };

    fetchChannels();
  }, [tenantId]);

  const formatPhone = (value: string) => {
    // Remove non-digits
    const digits = value.replace(/\D/g, '');
    return digits;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  const validatePhone = () => {
    const digits = phone.replace(/\D/g, '');
    // Accept 10-13 digits (with or without country code)
    return digits.length >= 10 && digits.length <= 13;
  };

  const runTest = async () => {
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

    setIsTesting(true);
    setTestLogs([]);
    setProgress(0);

    // Initialize logs
    const initialLogs: TestLog[] = steps.map((_, index) => ({
      step: index,
      status: 'pending',
    }));
    setTestLogs(initialLogs);

    try {
      // Normalize phone
      let normalizedPhone = phone.replace(/\D/g, '');
      if (!normalizedPhone.startsWith('55') && normalizedPhone.length <= 11) {
        normalizedPhone = '55' + normalizedPhone;
      }

      // Call edge function
      const { data, error } = await supabase.functions.invoke('test-marketing-campaign', {
        body: {
          phone: normalizedPhone,
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

      // Process results
      if (data?.results) {
        const updatedLogs: TestLog[] = data.results.map((result: any) => ({
          step: result.step,
          status: result.success ? 'sent' : 'error',
          message: result.error || (result.success ? 'Enviado com sucesso' : 'Falha no envio'),
          timestamp: new Date().toLocaleTimeString('pt-BR'),
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
      
      // Mark all as error
      setTestLogs(prev => prev.map(log => ({
        ...log,
        status: 'error',
        message: error.message || 'Erro na execução',
      })));
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-4 p-4 border border-dashed border-primary/30 rounded-lg bg-primary/5">
      <div className="flex items-center gap-2">
        <Play size={16} className="text-primary" />
        <Label className="text-sm font-semibold">Testar Campanha (Acelerado)</Label>
      </div>

      <p className="text-xs text-muted-foreground">
        Envia todas as mensagens em sequência com 5-10 segundos de intervalo.
      </p>

      {/* Phone Input */}
      <div className="space-y-2">
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
      <div className="space-y-2">
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
        <div className="space-y-2">
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

      {/* Test Button */}
      <Button
        onClick={runTest}
        disabled={isTesting || !validatePhone() || (channelOption === 'select' && !selectedChannelId)}
        className="w-full"
        size="sm"
      >
        {isTesting ? (
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

      {/* Progress */}
      {(isTesting || testLogs.length > 0) && (
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
    </div>
  );
}
