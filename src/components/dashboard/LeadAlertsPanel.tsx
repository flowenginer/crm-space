import { useState } from 'react';
import { Loader2, AlertTriangle, Clock, UserX, ChevronRight, Phone, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LeadAlert } from '@/hooks/useLeadJourneyDashboard';
import { useNavigate } from 'react-router-dom';

interface LeadAlertsPanelProps {
  data: LeadAlert[];
  isLoading?: boolean;
}

const alertTypeConfig = {
  unassigned: {
    icon: UserX,
    label: 'Sem atribuição',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
  },
  no_response: {
    icon: Clock,
    label: 'Aguardando resposta',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
  },
  stalled: {
    icon: AlertTriangle,
    label: 'Parado',
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
  },
  sla_critical: {
    icon: AlertTriangle,
    label: 'SLA Crítico',
    color: 'text-red-600',
    bgColor: 'bg-red-600/10',
  },
};

function formatWaitingTime(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  }
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
}

export function LeadAlertsPanel({ data, isLoading }: LeadAlertsPanelProps) {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            Alertas
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const criticalCount = data?.filter(a => a.severity === 'critical').length || 0;
  const warningCount = data?.filter(a => a.severity === 'warning').length || 0;
  const displayData = showAll ? data : data?.slice(0, 5);

  if (!data || data.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-green-500" />
            Alertas
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-64 gap-2">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <span className="text-3xl">✓</span>
          </div>
          <p className="text-green-600 font-medium">Tudo em dia!</p>
          <p className="text-muted-foreground text-sm text-center">
            Nenhum lead precisando de atenção urgente
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleOpenConversation = (conversationId: string) => {
    navigate(`/conversations?id=${conversationId}`);
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            Alertas
          </CardTitle>
          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {criticalCount} crítico{criticalCount > 1 ? 's' : ''}
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                {warningCount} atenção
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[320px]">
          <div className="space-y-1 p-4 pt-2">
            {displayData?.map((alert) => {
              const config = alertTypeConfig[alert.type];
              const Icon = config.icon;

              return (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border transition-colors cursor-pointer hover:bg-muted/50 ${
                    alert.severity === 'critical' 
                      ? 'border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20' 
                      : 'border-border'
                  }`}
                  onClick={() => handleOpenConversation(alert.conversationId)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-1.5 rounded-lg ${config.bgColor}`}>
                      <Icon className={`h-4 w-4 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm text-foreground truncate">
                          {alert.contactName}
                        </p>
                        <Badge 
                          variant="outline" 
                          className={`text-xs shrink-0 ${
                            alert.severity === 'critical' 
                              ? 'border-red-300 text-red-600' 
                              : 'border-yellow-300 text-yellow-600'
                          }`}
                        >
                          {formatWaitingTime(alert.waitingMinutes)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {alert.contactPhone}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className={`text-xs ${config.color}`}>
                          {config.label}
                        </span>
                        {alert.agentName && (
                          <span className="text-xs text-muted-foreground">
                            {alert.agentName}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {data.length > 5 && (
          <div className="p-3 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? 'Mostrar menos' : `Ver todos (${data.length})`}
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
