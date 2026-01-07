import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { MARKETING_ACTION_LABELS, type MarketingActionType } from '@/types/marketing';
import type { ActionMetrics } from '@/hooks/useMarketingDashboard';

interface ActionsExecutedTableProps {
  actions: ActionMetrics[] | undefined;
  isLoading: boolean;
}

export function ActionsExecutedTable({ actions, isLoading }: ActionsExecutedTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!actions || actions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
        <p>Nenhuma ação executada ainda</p>
        <p className="text-sm mt-1">As ações serão registradas conforme os contatos interagirem</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ação</TableHead>
          <TableHead className="text-right">Executadas</TableHead>
          <TableHead className="text-right">Sucesso</TableHead>
          <TableHead className="w-[150px]">% do Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {actions.map((action) => {
          const label = MARKETING_ACTION_LABELS[action.actionType as MarketingActionType] || action.actionType;
          const successRate = action.count > 0 ? (action.successCount / action.count) * 100 : 0;
          
          return (
            <TableRow key={action.actionType}>
              <TableCell className="font-medium">{label}</TableCell>
              <TableCell className="text-right">{action.count.toLocaleString('pt-BR')}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {successRate >= 90 ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : successRate < 50 ? (
                    <XCircle className="h-4 w-4 text-destructive" />
                  ) : null}
                  <span>{successRate.toFixed(0)}%</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Progress value={action.percentage} className="h-2" />
                  <span className="text-xs text-muted-foreground min-w-[35px]">
                    {action.percentage.toFixed(0)}%
                  </span>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
