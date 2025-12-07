import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle, AlertTriangle, XCircle, FileSpreadsheet, Link2, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import type { ImportHistoryEntry } from '@/hooks/useImportHistory';

interface ImportHistoryTableProps {
  history: ImportHistoryEntry[];
  isLoading: boolean;
}

export function ImportHistoryTable({ history, isLoading }: ImportHistoryTableProps) {
  const getStatusBadge = (status: string, errors: number, total: number) => {
    if (status === 'failed' || errors === total) {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Falhou
        </Badge>
      );
    }
    if (errors > 0) {
      return (
        <Badge variant="outline" className="gap-1 border-yellow-500/50 text-yellow-600">
          <AlertTriangle className="h-3 w-3" />
          Parcial
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1 border-green-500/50 text-green-600">
        <CheckCircle className="h-3 w-3" />
        Completo
      </Badge>
    );
  };

  const getSourceIcon = (sourceType: string) => {
    return sourceType === 'google_sheets' ? (
      <Link2 className="h-4 w-4 text-muted-foreground" />
    ) : (
      <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
    );
  };

  const formatSourceName = (name: string) => {
    // Truncate long names
    if (name.length > 40) {
      return name.substring(0, 37) + '...';
    }
    return name;
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
        <Clock className="h-10 w-10 mb-3 opacity-50" />
        <p className="text-sm">Nenhuma importação realizada ainda</p>
        <p className="text-xs">O histórico aparecerá aqui após a primeira importação</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[140px]">Data/Hora</TableHead>
            <TableHead>Arquivo/Fonte</TableHead>
            <TableHead className="text-center w-[80px]">Total</TableHead>
            <TableHead className="text-center w-[80px]">✓ OK</TableHead>
            <TableHead className="text-center w-[80px]">✗ Erros</TableHead>
            <TableHead className="w-[100px]">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="text-xs text-muted-foreground">
                {format(new Date(entry.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {getSourceIcon(entry.source_type)}
                  <span className="text-sm truncate" title={entry.source_name}>
                    {formatSourceName(entry.source_name)}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-center font-medium">
                {entry.total_rows}
              </TableCell>
              <TableCell className="text-center text-green-600 font-medium">
                {entry.updated + entry.created}
              </TableCell>
              <TableCell className="text-center text-red-500 font-medium">
                {entry.errors}
              </TableCell>
              <TableCell>
                {getStatusBadge(entry.status, entry.errors, entry.total_rows)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
