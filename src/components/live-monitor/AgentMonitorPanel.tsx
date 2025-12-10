import { useState } from 'react';
import { 
  Users, Clock, MessageSquare, ChevronDown, ChevronUp, 
  Settings, BarChart3, Power, PowerOff, Loader2, AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  useAgentMonitorStatus, 
  useToggleAgentAvailability,
  useResponseAlertSettings,
  useUpdateResponseAlertSettings,
  AgentStatus 
} from '@/hooks/useAgentMonitor';
import { ResponseTimeChart } from './ResponseTimeChart';

export function AgentMonitorPanel() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showChart, setShowChart] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  
  const { data: agents = [], isLoading } = useAgentMonitorStatus();
  const { data: alertMinutes = 5 } = useResponseAlertSettings();
  const toggleAvailability = useToggleAgentAvailability();
  const updateAlertSettings = useUpdateResponseAlertSettings();

  const handleToggleAvailability = async (agent: AgentStatus) => {
    try {
      await toggleAvailability.mutateAsync({
        agentId: agent.agent_id,
        isAvailable: !agent.is_available,
      });
      toast.success(`${agent.agent_name} agora está ${!agent.is_available ? 'disponível' : 'indisponível'} para receber leads`);
    } catch (error) {
      toast.error('Erro ao alterar disponibilidade');
    }
  };

  const handleUpdateAlertMinutes = async (value: string) => {
    try {
      await updateAlertSettings.mutateAsync(parseInt(value));
      toast.success('Tempo de alerta atualizado');
      setConfigOpen(false);
    } catch (error) {
      toast.error('Erro ao atualizar configuração');
    }
  };

  const getAlertLevel = (minutes: number): 'ok' | 'warning' | 'critical' => {
    if (minutes >= alertMinutes) return 'critical';
    if (minutes >= alertMinutes * 0.5) return 'warning';
    return 'ok';
  };

  const getAlertColor = (level: 'ok' | 'warning' | 'critical') => {
    switch (level) {
      case 'critical': return 'bg-destructive text-destructive-foreground';
      case 'warning': return 'bg-amber-500 text-white';
      case 'ok': return 'bg-green-500 text-white';
    }
  };

  const getCardBorderColor = (level: 'ok' | 'warning' | 'critical') => {
    switch (level) {
      case 'critical': return 'border-destructive/50 bg-destructive/5';
      case 'warning': return 'border-amber-500/50 bg-amber-500/5';
      case 'ok': return 'border-border';
    }
  };

  const formatTime = (minutes: number) => {
    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${Math.round(minutes)} min`;
    if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
    return `${Math.round(minutes / 1440)}d`;
  };

  // Sort agents: critical first, then warning, then ok
  const sortedAgents = [...agents].sort((a, b) => {
    const levelA = getAlertLevel(a.oldest_waiting_minutes);
    const levelB = getAlertLevel(b.oldest_waiting_minutes);
    const order = { critical: 0, warning: 1, ok: 2 };
    return order[levelA] - order[levelB];
  });

  const criticalCount = agents.filter(a => getAlertLevel(a.oldest_waiting_minutes) === 'critical').length;
  const warningCount = agents.filter(a => getAlertLevel(a.oldest_waiting_minutes) === 'warning').length;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className="mb-6 border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="p-0 h-auto">
                  {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </Button>
              </CollapsibleTrigger>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Monitoramento de Vendedores</CardTitle>
              </div>
              {criticalCount > 0 && (
                <Badge variant="destructive" className="animate-pulse">
                  <AlertTriangle size={12} className="mr-1" />
                  {criticalCount} crítico{criticalCount > 1 ? 's' : ''}
                </Badge>
              )}
              {warningCount > 0 && (
                <Badge className="bg-amber-500 text-white">
                  {warningCount} atenção
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowChart(!showChart)}
              >
                <BarChart3 size={16} className="mr-2" />
                {showChart ? 'Ocultar Histórico' : 'Ver Histórico'}
              </Button>
              
              <Dialog open={configOpen} onOpenChange={setConfigOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Settings size={18} />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Configurar Alerta de Tempo</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Tempo limite para alerta (minutos)</Label>
                      <Select 
                        defaultValue={String(alertMinutes)}
                        onValueChange={handleUpdateAlertMinutes}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2">2 minutos</SelectItem>
                          <SelectItem value="5">5 minutos</SelectItem>
                          <SelectItem value="10">10 minutos</SelectItem>
                          <SelectItem value="15">15 minutos</SelectItem>
                          <SelectItem value="20">20 minutos</SelectItem>
                          <SelectItem value="30">30 minutos</SelectItem>
                          <SelectItem value="60">1 hora</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">
                        Cards ficarão vermelhos quando o lead aguardar mais que esse tempo.
                        Alerta amarelo aparece em 50% do tempo.
                      </p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {/* Agent Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {sortedAgents.map((agent) => (
                    <AgentCard
                      key={agent.agent_id}
                      agent={agent}
                      alertLevel={getAlertLevel(agent.oldest_waiting_minutes)}
                      alertMinutes={alertMinutes}
                      onToggleAvailability={() => handleToggleAvailability(agent)}
                      isToggling={toggleAvailability.isPending}
                      formatTime={formatTime}
                      getAlertColor={getAlertColor}
                      getCardBorderColor={getCardBorderColor}
                    />
                  ))}
                </div>

                {/* Response Time Chart */}
                {showChart && (
                  <div className="mt-6">
                    <ResponseTimeChart alertMinutes={alertMinutes} />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

interface AgentCardProps {
  agent: AgentStatus;
  alertLevel: 'ok' | 'warning' | 'critical';
  alertMinutes: number;
  onToggleAvailability: () => void;
  isToggling: boolean;
  formatTime: (minutes: number) => string;
  getAlertColor: (level: 'ok' | 'warning' | 'critical') => string;
  getCardBorderColor: (level: 'ok' | 'warning' | 'critical') => string;
}

function AgentCard({ 
  agent, 
  alertLevel, 
  alertMinutes,
  onToggleAvailability, 
  isToggling,
  formatTime,
  getAlertColor,
  getCardBorderColor
}: AgentCardProps) {
  return (
    <TooltipProvider>
      <Card className={`relative transition-all ${getCardBorderColor(alertLevel)}`}>
        {/* Alert Indicator */}
        <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${
          alertLevel === 'critical' ? 'bg-destructive animate-pulse' :
          alertLevel === 'warning' ? 'bg-amber-500' : 'bg-green-500'
        }`} />

        <CardContent className="p-4">
          {/* Avatar and Name */}
          <div className="flex flex-col items-center text-center mb-3">
            <div className="relative mb-2">
              <Avatar className="h-12 w-12">
                <AvatarImage src={agent.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {agent.agent_name?.charAt(0)?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              {agent.is_online && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-card" />
              )}
            </div>
            <span className="font-semibold text-sm truncate w-full">
              {agent.agent_name?.split(' ')[0] || 'Sem nome'}
            </span>
            {agent.department_name && (
              <span className="text-xs text-muted-foreground truncate w-full">
                {agent.department_name}
              </span>
            )}
          </div>

          {/* Metrics */}
          <div className="space-y-2 text-xs">
            {/* Waiting Response */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock size={12} />
                Aguardando
              </span>
              <Badge 
                variant="secondary" 
                className={agent.waiting_response > 0 ? getAlertColor(alertLevel) : ''}
              >
                {agent.waiting_response}
              </Badge>
            </div>

            {/* Oldest Waiting */}
            {agent.waiting_response > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Mais antigo</span>
                <span className={`font-semibold ${
                  alertLevel === 'critical' ? 'text-destructive' :
                  alertLevel === 'warning' ? 'text-amber-500' : 'text-foreground'
                }`}>
                  {formatTime(agent.oldest_waiting_minutes)}
                </span>
              </div>
            )}

            {/* Open Conversations */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <MessageSquare size={12} />
                Abertas
              </span>
              <span className="font-semibold">{agent.open_conversations}</span>
            </div>
          </div>

          {/* Availability Toggle */}
          <div className="mt-3 pt-3 border-t border-border">
            <Tooltip>
              <TooltipTrigger asChild>
                <div 
                  className="flex items-center justify-between cursor-pointer"
                  onClick={onToggleAvailability}
                >
                  <span className="text-xs flex items-center gap-1">
                    {agent.is_available ? (
                      <>
                        <Power size={12} className="text-green-500" />
                        <span className="text-green-600">Recebendo</span>
                      </>
                    ) : (
                      <>
                        <PowerOff size={12} className="text-muted-foreground" />
                        <span className="text-muted-foreground">Parado</span>
                      </>
                    )}
                  </span>
                  <Switch
                    checked={agent.is_available}
                    disabled={isToggling}
                    className="scale-75"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {agent.is_available 
                    ? 'Clique para pausar recebimento de novos leads'
                    : 'Clique para ativar recebimento de novos leads'
                  }
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
