import { Loader2, Send, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface Dispatch {
  id: string;
  name: string;
  status: string;
  total_contacts: number;
  sent_count: number;
  responded_count: number;
  error_count: number;
  created_at: string;
}

interface DispatchesTableProps {
  dispatches: Dispatch[] | undefined;
  isLoading: boolean;
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  pending: { label: 'Pendente', icon: Clock, color: 'text-muted-foreground' },
  processing: { label: 'Processando', icon: Send, color: 'text-info' },
  paused: { label: 'Pausado', icon: Clock, color: 'text-warning' },
  completed: { label: 'Concluído', icon: CheckCircle2, color: 'text-success' },
  failed: { label: 'Falhou', icon: AlertCircle, color: 'text-destructive' },
};

export function DispatchesTable({ dispatches, isLoading }: DispatchesTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!dispatches || dispatches.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        Nenhum disparo realizado para esta campanha
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Disparo</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Progresso</TableHead>
          <TableHead className="text-right">Enviados</TableHead>
          <TableHead className="text-right">Respostas</TableHead>
          <TableHead className="text-right">Erros</TableHead>
          <TableHead>Data</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {dispatches.map((dispatch) => {
          const status = statusConfig[dispatch.status] || statusConfig.pending;
          const StatusIcon = status.icon;
          const progress = dispatch.total_contacts > 0
            ? (dispatch.sent_count / dispatch.total_contacts) * 100
            : 0;
          const responseRate = dispatch.sent_count > 0
            ? ((dispatch.responded_count / dispatch.sent_count) * 100).toFixed(1)
            : '0';

          return (
            <TableRow key={dispatch.id}>
              <TableCell className="font-medium">{dispatch.name}</TableCell>
              <TableCell>
                <Badge variant="outline" className={`gap-1 ${status.color}`}>
                  <StatusIcon className="h-3 w-3" />
                  {status.label}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2 min-w-[120px]">
                  <Progress value={progress} className="h-2" />
                  <span className="text-xs text-muted-foreground">{progress.toFixed(0)}%</span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                {dispatch.sent_count.toLocaleString('pt-BR')} / {dispatch.total_contacts.toLocaleString('pt-BR')}
              </TableCell>
              <TableCell className="text-right">
                <span className="text-success font-medium">
                  {dispatch.responded_count.toLocaleString('pt-BR')}
                </span>
                <span className="text-muted-foreground text-xs ml-1">({responseRate}%)</span>
              </TableCell>
              <TableCell className="text-right">
                <span className={dispatch.error_count > 0 ? 'text-destructive' : 'text-muted-foreground'}>
                  {dispatch.error_count.toLocaleString('pt-BR')}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {format(parseISO(dispatch.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
