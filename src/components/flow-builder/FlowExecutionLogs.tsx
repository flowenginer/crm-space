import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger 
} from '@/components/ui/sheet';
import { 
  ClipboardList, CheckCircle2, XCircle, Clock, Loader2, 
  ChevronRight, User, Calendar, Hash 
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FlowExecutionLogsProps {
  flowId: string;
}

interface Execution {
  id: string;
  contact_id: string;
  conversation_id: string | null;
  channel_id: string | null;
  status: string;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  variables: Record<string, unknown> | null;
  contacts?: { full_name: string; phone: string } | null;
}

interface ExecutionLog {
  id: string;
  log_type: string;
  message: string;
  details: Record<string, unknown> | null;
  created_at: string;
  node_id: string | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  completed: { label: 'Concluído', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: CheckCircle2 },
  error: { label: 'Erro', color: 'bg-red-500/10 text-red-500 border-red-500/20', icon: XCircle },
  running: { label: 'Em execução', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', icon: Loader2 },
  waiting_delay: { label: 'Aguardando', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: Clock },
  waiting_input: { label: 'Aguardando resposta', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: Clock },
};

export function FlowExecutionLogs({ flowId }: FlowExecutionLogsProps) {
  const [selectedExecution, setSelectedExecution] = useState<string | null>(null);

  const { data: executions, isLoading } = useQuery({
    queryKey: ['flow-executions', flowId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flow_executions')
        .select('id, contact_id, conversation_id, channel_id, status, started_at, completed_at, error_message, variables, contacts(full_name, phone)')
        .eq('flow_id', flowId)
        .order('started_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as unknown as Execution[];
    },
  });

  const { data: logs } = useQuery({
    queryKey: ['flow-execution-logs', selectedExecution],
    queryFn: async () => {
      if (!selectedExecution) return [];
      const { data, error } = await supabase
        .from('flow_execution_logs')
        .select('id, log_type, message, details, created_at, node_id')
        .eq('execution_id', selectedExecution)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as ExecutionLog[];
    },
    enabled: !!selectedExecution,
  });

  const statusInfo = (status: string) => statusConfig[status] || statusConfig.running;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <ClipboardList size={16} className="mr-2" />
          Logs
          {executions && executions.length > 0 && (
            <Badge variant="secondary" className="ml-2 text-xs px-1.5">
              {executions.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[480px] sm:max-w-[480px] p-0 flex flex-col">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <ClipboardList size={20} />
            Histórico de Execuções
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-muted-foreground" size={24} />
            </div>
          ) : !executions || executions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ClipboardList className="mx-auto mb-3 opacity-40" size={40} />
              <p className="text-sm">Nenhuma execução registrada</p>
              <p className="text-xs mt-1">Quando leads passarem por esta automação, os registros aparecerão aqui.</p>
            </div>
          ) : selectedExecution ? (
            // Detail view
            <div className="p-4 space-y-3">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setSelectedExecution(null)}
                className="mb-2"
              >
                ← Voltar à lista
              </Button>
              
              {logs && logs.length > 0 ? (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div 
                      key={log.id} 
                      className={`p-3 rounded-lg border text-sm ${
                        log.log_type === 'error' 
                          ? 'border-red-500/20 bg-red-500/5' 
                          : 'border-border bg-muted/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className="text-[10px]">
                          {log.log_type}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(log.created_at), 'HH:mm:ss', { locale: ptBR })}
                        </span>
                      </div>
                      <p className="text-foreground">{log.message}</p>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <pre className="text-[10px] text-muted-foreground mt-1 overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum log detalhado disponível.
                </p>
              )}
            </div>
          ) : (
            // List view
            <div className="divide-y divide-border">
              {executions.map((exec) => {
                const info = statusInfo(exec.status);
                const Icon = info.icon;
                return (
                  <button
                    key={exec.id}
                    onClick={() => setSelectedExecution(exec.id)}
                    className="w-full p-3 hover:bg-muted/50 transition-colors text-left flex items-center gap-3"
                  >
                    <div className={`p-1.5 rounded-full border ${info.color}`}>
                      <Icon size={14} className={exec.status === 'running' ? 'animate-spin' : ''} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <User size={12} className="text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium text-foreground truncate">
                          {exec.contacts?.full_name || 'Contato removido'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Calendar size={10} />
                          {format(new Date(exec.started_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </span>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Hash size={10} />
                          {exec.contacts?.phone || '—'}
                        </span>
                      </div>
                      {exec.error_message && (
                        <p className="text-[11px] text-red-400 mt-0.5 truncate">
                          {exec.error_message}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${info.color}`}>
                      {info.label}
                    </Badge>
                    <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
