import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Users, ArrowUpDown, Percent, RotateCcw, GripVertical, AlertCircle, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useDepartments } from '@/hooks/useDepartments';
import {
  useLeadDistribution,
  useUpdateLeadDistribution,
  useResetDistributionCounters,
  useDepartmentAgents,
  DistributionAgent,
} from '@/hooks/useLeadDistribution';

export function LeadDistributionSettings() {
  const { data: config, isLoading: loadingConfig } = useLeadDistribution();
  const { data: departments = [], isLoading: loadingDepts } = useDepartments();
  const updateConfig = useUpdateLeadDistribution();
  const resetCounters = useResetDistributionCounters();

  const [enabled, setEnabled] = useState(false);
  const [distributionType, setDistributionType] = useState<'sequential' | 'percentage'>('sequential');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [agents, setAgents] = useState<DistributionAgent[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: departmentAgents = [], isLoading: loadingAgents } = useDepartmentAgents(selectedDepartment || null);

  // Initialize state from config
  useEffect(() => {
    if (config) {
      setEnabled(config.lead_distribution_enabled);
      setDistributionType(config.lead_distribution_type);
      setSelectedDepartment(config.lead_distribution_department_id || '');
      setAgents(config.lead_distribution_agents || []);
    }
  }, [config]);

  // Track changes
  useEffect(() => {
    if (!config) return;
    
    const changed = 
      enabled !== config.lead_distribution_enabled ||
      distributionType !== config.lead_distribution_type ||
      selectedDepartment !== (config.lead_distribution_department_id || '') ||
      JSON.stringify(agents) !== JSON.stringify(config.lead_distribution_agents || []);
    
    setHasChanges(changed);
  }, [enabled, distributionType, selectedDepartment, agents, config]);

  // When department changes, update agent list
  useEffect(() => {
    if (departmentAgents.length > 0 && selectedDepartment) {
      // Merge existing agent configs with new department agents
      const updatedAgents = departmentAgents.map((da, index) => {
        const existingConfig = agents.find(a => a.user_id === da.id);
        if (existingConfig) {
          return existingConfig;
        }
        return {
          user_id: da.id,
          percentage: Math.floor(100 / departmentAgents.length),
          order_position: index,
          is_active: true,
          leads_received: 0,
        };
      });
      
      // Only update if there are new agents not in current list
      const hasNewAgents = departmentAgents.some(da => !agents.find(a => a.user_id === da.id));
      if (hasNewAgents || agents.length === 0) {
        setAgents(updatedAgents);
      }
    }
  }, [departmentAgents, selectedDepartment]);

  const handleSave = async () => {
    if (!selectedDepartment && enabled) {
      toast.error('Selecione um departamento para distribuição');
      return;
    }

    // Validate percentages if percentage mode
    if (distributionType === 'percentage') {
      const activeAgents = agents.filter(a => a.is_active);
      const totalPercentage = activeAgents.reduce((sum, a) => sum + a.percentage, 0);
      if (totalPercentage !== 100) {
        toast.error(`A soma das porcentagens deve ser 100% (atual: ${totalPercentage}%)`);
        return;
      }
    }

    try {
      await updateConfig.mutateAsync({
        lead_distribution_enabled: enabled,
        lead_distribution_type: distributionType,
        lead_distribution_department_id: selectedDepartment || null,
        lead_distribution_agents: agents,
      });
      toast.success('Configurações salvas com sucesso');
      setHasChanges(false);
    } catch (error) {
      toast.error('Erro ao salvar configurações');
    }
  };

  const handleAgentToggle = (userId: string, isActive: boolean) => {
    setAgents(prev => prev.map(a => 
      a.user_id === userId ? { ...a, is_active: isActive } : a
    ));
  };

  const handlePercentageChange = (userId: string, percentage: number) => {
    setAgents(prev => prev.map(a => 
      a.user_id === userId ? { ...a, percentage: Math.max(0, Math.min(100, percentage)) } : a
    ));
  };

  const handleOrderChange = (userId: string, direction: 'up' | 'down') => {
    const currentIndex = agents.findIndex(a => a.user_id === userId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= agents.length) return;

    const newAgents = [...agents];
    [newAgents[currentIndex], newAgents[newIndex]] = [newAgents[newIndex], newAgents[currentIndex]];
    
    // Update order_position
    newAgents.forEach((a, i) => {
      a.order_position = i;
    });

    setAgents(newAgents);
  };

  const distributeEqually = () => {
    const activeAgents = agents.filter(a => a.is_active);
    if (activeAgents.length === 0) return;

    const equalPercentage = Math.floor(100 / activeAgents.length);
    const remainder = 100 - (equalPercentage * activeAgents.length);

    setAgents(prev => {
      let remainderApplied = 0;
      return prev.map(a => {
        if (!a.is_active) return a;
        const extra = remainderApplied < remainder ? 1 : 0;
        remainderApplied++;
        return { ...a, percentage: equalPercentage + extra };
      });
    });
  };

  const getAgentInfo = (userId: string) => {
    return departmentAgents.find(a => a.id === userId);
  };

  const totalPercentage = agents.filter(a => a.is_active).reduce((sum, a) => sum + a.percentage, 0);
  const activeAgentsCount = agents.filter(a => a.is_active).length;
  const nextInQueue = enabled && distributionType === 'sequential' && agents.length > 0
    ? agents.filter(a => a.is_active).sort((a, b) => a.order_position - b.order_position)[config?.lead_distribution_position || 0]
    : null;

  if (loadingConfig || loadingDepts) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Distribuição Automática de Leads
          </CardTitle>
          <CardDescription>
            Configure como os leads são distribuídos automaticamente entre os vendedores
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Ativar Distribuição Automática</Label>
              <p className="text-sm text-muted-foreground">
                Quando ativado, leads podem ser distribuídos via API
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {enabled && (
            <>
              {/* Department Selection */}
              <div className="space-y-2">
                <Label>Departamento de Origem</Label>
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.filter(d => d.is_active).map(dept => (
                      <SelectItem key={dept.id} value={dept.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: dept.color || '#8B5CF6' }} 
                          />
                          {dept.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Os vendedores deste departamento receberão os leads
                </p>
              </div>

              {/* Distribution Type */}
              <div className="space-y-2">
                <Label>Tipo de Distribuição</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDistributionType('sequential')}
                    className={`p-4 border rounded-lg text-left transition-all ${
                      distributionType === 'sequential'
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <ArrowUpDown className="h-4 w-4" />
                      <span className="font-medium">Sequencial</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Round-robin: cada vendedor recebe um lead por vez
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDistributionType('percentage')}
                    className={`p-4 border rounded-lg text-left transition-all ${
                      distributionType === 'percentage'
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Percent className="h-4 w-4" />
                      <span className="font-medium">Percentual</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Cada vendedor recebe uma porcentagem dos leads
                    </p>
                  </button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Agent Configuration */}
      {enabled && selectedDepartment && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Configuração dos Vendedores</CardTitle>
                <CardDescription>
                  {distributionType === 'sequential' 
                    ? 'Ordene os vendedores na fila de distribuição'
                    : 'Configure a porcentagem de leads para cada vendedor'
                  }
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {distributionType === 'percentage' && (
                  <Button variant="outline" size="sm" onClick={distributeEqually}>
                    Distribuir Igualmente
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => resetCounters.mutate()}
                  disabled={resetCounters.isPending}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Resetar Contadores
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingAgents ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : departmentAgents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum vendedor encontrado neste departamento</p>
              </div>
            ) : (
              <>
                {/* Status Summary */}
                <div className="flex items-center gap-4 mb-4 p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Ativos:</span>
                    <Badge variant="secondary">{activeAgentsCount}</Badge>
                  </div>
                  {distributionType === 'percentage' && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Total:</span>
                      <Badge variant={totalPercentage === 100 ? 'default' : 'destructive'}>
                        {totalPercentage}%
                      </Badge>
                    </div>
                  )}
                  {nextInQueue && distributionType === 'sequential' && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Próximo:</span>
                      <Badge variant="outline">{getAgentInfo(nextInQueue.user_id)?.full_name}</Badge>
                    </div>
                  )}
                </div>

                {/* Percentage Warning */}
                {distributionType === 'percentage' && totalPercentage !== 100 && (
                  <div className="flex items-center gap-2 p-3 mb-4 bg-destructive/10 text-destructive rounded-lg">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">A soma das porcentagens deve ser exatamente 100%</span>
                  </div>
                )}

                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {agents
                      .sort((a, b) => a.order_position - b.order_position)
                      .map((agent, index) => {
                        const info = getAgentInfo(agent.user_id);
                        if (!info) return null;

                        const isNext = nextInQueue?.user_id === agent.user_id;

                        return (
                          <div
                            key={agent.user_id}
                            className={`flex items-center gap-3 p-3 border rounded-lg transition-all ${
                              !agent.is_active ? 'opacity-50 bg-muted/30' : ''
                            } ${isNext ? 'ring-2 ring-primary/30 border-primary' : ''}`}
                          >
                            {/* Order Controls (Sequential mode) */}
                            {distributionType === 'sequential' && (
                              <div className="flex flex-col gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOrderChange(agent.user_id, 'up')}
                                  disabled={index === 0}
                                  className="p-1 hover:bg-muted rounded disabled:opacity-30"
                                >
                                  <GripVertical className="h-3 w-3" />
                                </button>
                              </div>
                            )}

                            {/* Active Toggle */}
                            <Checkbox
                              checked={agent.is_active}
                              onCheckedChange={(checked) => handleAgentToggle(agent.user_id, !!checked)}
                            />

                            {/* Avatar */}
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={info.avatar_url || undefined} />
                              <AvatarFallback className="text-xs">
                                {info.full_name?.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>

                            {/* Name & Status */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate">{info.full_name}</span>
                                {isNext && (
                                  <Badge variant="default" className="text-[10px] px-1.5 py-0">
                                    Próximo
                                  </Badge>
                                )}
                                {!info.is_available && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                    Pausado
                                  </Badge>
                                )}
                              </div>
                              {agent.leads_received !== undefined && agent.leads_received > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  {agent.leads_received} leads recebidos
                                </span>
                              )}
                            </div>

                            {/* Percentage Input (Percentage mode) */}
                            {distributionType === 'percentage' && (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={agent.percentage}
                                  onChange={(e) => handlePercentageChange(agent.user_id, parseInt(e.target.value) || 0)}
                                  className="w-16 text-center"
                                  disabled={!agent.is_active}
                                />
                                <span className="text-sm text-muted-foreground">%</span>
                              </div>
                            )}

                            {/* Order Position (Sequential mode) */}
                            {distributionType === 'sequential' && (
                              <Badge variant="outline" className="w-8 justify-center">
                                {index + 1}
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </ScrollArea>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* API Documentation */}
      {enabled && (
        <Card>
          <CardHeader>
            <CardTitle>Endpoint da API</CardTitle>
            <CardDescription>
              Use este endpoint para distribuir leads automaticamente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg font-mono text-sm overflow-x-auto">
                <p className="text-muted-foreground mb-2"># Distribuir um lead</p>
                <p>POST https://lkxrmjqrzhaivviuuamp.supabase.co/functions/v1/distribute-lead</p>
                <p className="mt-2">Content-Type: application/json</p>
                <p className="mt-2 text-primary">{'{'}</p>
                <p className="ml-4">"contact_id": "uuid-do-contato"</p>
                <p className="text-primary">{'}'}</p>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• O endpoint é público e não requer autenticação</p>
                <p>• Retorna o vendedor selecionado e confirma a atribuição</p>
                <p>• Vendedores pausados (is_available=false) não recebem leads</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      {hasChanges && (
        <div className="sticky bottom-4 flex justify-end">
          <Button 
            onClick={handleSave} 
            disabled={updateConfig.isPending}
            size="lg"
            className="shadow-lg"
          >
            {updateConfig.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Salvar Configurações
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
