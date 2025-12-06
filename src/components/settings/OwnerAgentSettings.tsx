import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Save, UserCheck, Clock, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const CLOSE_REASONS = [
  { value: 'sold', label: 'Venda realizada' },
  { value: 'no_interest', label: 'Sem interesse' },
  { value: 'future_contact', label: 'Contato futuro' },
  { value: 'duplicate', label: 'Duplicado' },
  { value: 'spam', label: 'Spam' },
  { value: 'wrong_number', label: 'Número errado' },
  { value: 'other', label: 'Outro motivo' },
];

interface OwnerAgentSettingsData {
  owner_agent_enabled: boolean;
  owner_agent_inactivity_days: number;
  owner_agent_on_reopen: boolean;
  owner_agent_reopen_reasons: string[];
}

export function OwnerAgentSettings() {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<OwnerAgentSettingsData>({
    owner_agent_enabled: true,
    owner_agent_inactivity_days: 7,
    owner_agent_on_reopen: true,
    owner_agent_reopen_reasons: ['sold', 'no_interest', 'future_contact'],
  });

  // Fetch current settings
  const { data: companySettings, isLoading } = useQuery({
    queryKey: ['company-settings-owner-agent'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_settings')
        .select('owner_agent_enabled, owner_agent_inactivity_days, owner_agent_on_reopen, owner_agent_reopen_reasons')
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  // Update local state when data loads
  useEffect(() => {
    if (companySettings) {
      setSettings({
        owner_agent_enabled: companySettings.owner_agent_enabled ?? true,
        owner_agent_inactivity_days: companySettings.owner_agent_inactivity_days ?? 7,
        owner_agent_on_reopen: companySettings.owner_agent_on_reopen ?? true,
        owner_agent_reopen_reasons: companySettings.owner_agent_reopen_reasons ?? ['sold', 'no_interest', 'future_contact'],
      });
    }
  }, [companySettings]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (newSettings: OwnerAgentSettingsData) => {
      // Check if settings exist
      const { data: existing } = await supabase
        .from('company_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('company_settings')
          .update({
            owner_agent_enabled: newSettings.owner_agent_enabled,
            owner_agent_inactivity_days: newSettings.owner_agent_inactivity_days,
            owner_agent_on_reopen: newSettings.owner_agent_on_reopen,
            owner_agent_reopen_reasons: newSettings.owner_agent_reopen_reasons,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_settings')
          .insert({
            owner_agent_enabled: newSettings.owner_agent_enabled,
            owner_agent_inactivity_days: newSettings.owner_agent_inactivity_days,
            owner_agent_on_reopen: newSettings.owner_agent_on_reopen,
            owner_agent_reopen_reasons: newSettings.owner_agent_reopen_reasons,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-settings-owner-agent'] });
      toast.success('Configurações salvas com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao salvar configurações');
    },
  });

  const handleReasonToggle = (reason: string, checked: boolean) => {
    setSettings(prev => ({
      ...prev,
      owner_agent_reopen_reasons: checked
        ? [...prev.owner_agent_reopen_reasons, reason]
        : prev.owner_agent_reopen_reasons.filter(r => r !== reason),
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Atendente Responsável</h3>
          <p className="text-sm text-muted-foreground">
            Configure as regras de reatribuição automática para o atendente responsável do contato
          </p>
        </div>
        <Button 
          onClick={() => saveMutation.mutate(settings)}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Salvar
        </Button>
      </div>

      {/* Main Enable Toggle */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <UserCheck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Ativar regras de reatribuição</CardTitle>
                <CardDescription>
                  Quando ativado, conversas serão automaticamente reatribuídas ao atendente responsável do contato
                </CardDescription>
              </div>
            </div>
            <Switch
              checked={settings.owner_agent_enabled}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, owner_agent_enabled: checked }))}
            />
          </div>
        </CardHeader>
      </Card>

      {settings.owner_agent_enabled && (
        <>
          {/* Inactivity Rule */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <Clock className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <CardTitle className="text-base">Período de inatividade</CardTitle>
                  <CardDescription>
                    Se o cliente ficar inativo por este período e enviar uma mensagem, a conversa será reatribuída ao atendente responsável
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Label className="text-sm text-muted-foreground whitespace-nowrap">
                  Após
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={settings.owner_agent_inactivity_days}
                  onChange={(e) => setSettings(prev => ({ 
                    ...prev, 
                    owner_agent_inactivity_days: parseInt(e.target.value) || 7 
                  }))}
                  className="w-20"
                />
                <Label className="text-sm text-muted-foreground">
                  dias de inatividade, reatribuir ao responsável
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Reopen Rule */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <RefreshCw className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Reabertura de conversa</CardTitle>
                    <CardDescription>
                      Quando uma conversa fechada for reaberta pelo cliente, reatribuir ao atendente responsável
                    </CardDescription>
                  </div>
                </div>
                <Switch
                  checked={settings.owner_agent_on_reopen}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, owner_agent_on_reopen: checked }))}
                />
              </div>
            </CardHeader>
            
            {settings.owner_agent_on_reopen && (
              <CardContent className="pt-0">
                <div className="border-t pt-4">
                  <Label className="text-sm font-medium mb-3 block">
                    Motivos de fechamento que ativam a reatribuição:
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    {CLOSE_REASONS.map((reason) => (
                      <div key={reason.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`reason-${reason.value}`}
                          checked={settings.owner_agent_reopen_reasons.includes(reason.value)}
                          onCheckedChange={(checked) => handleReasonToggle(reason.value, checked === true)}
                        />
                        <Label 
                          htmlFor={`reason-${reason.value}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {reason.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        </>
      )}

      {/* Info Box */}
      <div className="bg-muted/50 rounded-lg p-4 border">
        <h4 className="font-medium text-sm mb-2">Como funciona?</h4>
        <ul className="text-sm text-muted-foreground space-y-1.5">
          <li>• O <strong>Atendente Responsável</strong> é o dono permanente do contato (definido no cadastro do contato)</li>
          <li>• O <strong>Atendente Atual</strong> é quem está atendendo a conversa no momento (pode mudar por transferências)</li>
          <li>• Quando as regras acima são ativadas, a conversa volta automaticamente para o responsável</li>
          <li>• Isso garante que o vendedor "dono" do cliente sempre seja notificado quando o cliente retorna</li>
        </ul>
      </div>
    </div>
  );
}
