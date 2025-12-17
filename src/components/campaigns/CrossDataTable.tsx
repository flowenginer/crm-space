import { CrossDataRow } from '@/hooks/useMetaLeadsCrossData';
import { LeadStatus } from '@/hooks/useLeadStatuses';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserCheck, UserX, MessageCircle, MessageCircleOff } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Segment {
  id: string;
  name: string;
  color: string;
}

interface CrossDataTableProps {
  data: CrossDataRow[];
  statuses: LeadStatus[];
  segments: Segment[];
  isLoading?: boolean;
}

export function CrossDataTable({ data, statuses, segments, isLoading }: CrossDataTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <p>Nenhum dado encontrado no período</p>
      </div>
    );
  }

  // Pegar os segmentos que existem nos dados
  const activeSegments = new Set<string>();
  data.forEach(row => {
    Object.keys(row.bySegment).forEach(s => activeSegments.add(s));
  });
  const segmentColumns = Array.from(activeSegments).filter(s => s !== 'Não definido').slice(0, 5);

  // Pegar os status mais comuns
  const statusCounts: Record<string, number> = {};
  data.forEach(row => {
    Object.entries(row.byStatus).forEach(([status, count]) => {
      statusCounts[status] = (statusCounts[status] || 0) + count;
    });
  });
  
  const topStatuses = Object.entries(statusCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([status]) => status);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <ScrollArea className="h-[500px]">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="sticky left-0 bg-muted/50 z-10">Anúncio</TableHead>
            <TableHead className="text-center">Leads</TableHead>
            <TableHead className="text-center">Hoje</TableHead>
            
            {/* Colunas de Segmento */}
            {segmentColumns.map(seg => {
              const segConfig = segments.find(s => s.name === seg);
              return (
                <TableHead key={seg} className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: segConfig?.color || '#6B7280' }}
                    />
                    <span className="text-xs truncate max-w-[60px]">{seg}</span>
                  </div>
                </TableHead>
              );
            })}

            {/* Colunas de Status */}
            {topStatuses.map(status => {
              const statusConfig = statuses.find(s => s.name === status);
              return (
                <TableHead key={status} className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: statusConfig?.color || '#8B5CF6' }}
                    />
                    <span className="text-xs truncate max-w-[70px]">
                      {status === 'new' ? 'Novo' : status.replace(/^\d+\s*-\s*/, '')}
                    </span>
                  </div>
                </TableHead>
              );
            })}

            <TableHead className="text-center">
              <div className="flex items-center justify-center gap-1">
                <UserCheck className="h-3 w-3 text-green-500" />
                <span className="text-xs">C/ Vend.</span>
              </div>
            </TableHead>
            <TableHead className="text-center">
              <div className="flex items-center justify-center gap-1">
                <MessageCircle className="h-3 w-3 text-blue-500" />
                <span className="text-xs">Respondeu</span>
              </div>
            </TableHead>
            <TableHead className="text-center">Conv.</TableHead>
            <TableHead className="text-center">Receita</TableHead>
            <TableHead className="text-center">% Conv</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.sourceId} className="hover:bg-muted/30">
              <TableCell className="sticky left-0 bg-card z-10">
                <div className="space-y-0.5 max-w-[200px]">
                  <p className="text-sm font-medium truncate">
                    {row.campaignName || 'Campanha desconhecida'}
                  </p>
                  {row.adName && (
                    <p className="text-xs text-muted-foreground truncate">
                      {row.adName}
                    </p>
                  )}
                </div>
              </TableCell>
              
              <TableCell className="text-center">
                <Badge variant="secondary" className="font-semibold">
                  {row.totalLeads}
                </Badge>
              </TableCell>
              
              <TableCell className="text-center">
                <span className={row.leadsToday > 0 ? 'font-medium text-green-600' : 'text-muted-foreground'}>
                  {row.leadsToday}
                </span>
              </TableCell>

              {/* Segmentos */}
              {segmentColumns.map(seg => (
                <TableCell key={seg} className="text-center">
                  <span className={row.bySegment[seg] ? 'font-medium' : 'text-muted-foreground'}>
                    {row.bySegment[seg] || 0}
                  </span>
                </TableCell>
              ))}

              {/* Status */}
              {topStatuses.map(status => (
                <TableCell key={status} className="text-center">
                  <span className={row.byStatus[status] ? 'font-medium' : 'text-muted-foreground'}>
                    {row.byStatus[status] || 0}
                  </span>
                </TableCell>
              ))}

              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <span className={row.withAgent > 0 ? 'font-medium text-green-600' : 'text-muted-foreground'}>
                    {row.withAgent}
                  </span>
                  {row.withoutAgent > 0 && (
                    <span className="text-xs text-orange-500">
                      ({row.withoutAgent})
                    </span>
                  )}
                </div>
              </TableCell>

              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <span className={row.responded > 0 ? 'font-medium text-blue-600' : 'text-muted-foreground'}>
                    {row.responded}
                  </span>
                  {row.notResponded > 0 && (
                    <span className="text-xs text-orange-500">
                      ({row.notResponded})
                    </span>
                  )}
                </div>
              </TableCell>

              <TableCell className="text-center">
                <Badge 
                  variant={row.conversions > 0 ? 'default' : 'secondary'}
                  className={row.conversions > 0 ? 'bg-green-500 hover:bg-green-600' : ''}
                >
                  {row.conversions}
                </Badge>
              </TableCell>

              <TableCell className="text-center">
                <span className={row.revenue > 0 ? 'font-medium text-green-600' : 'text-muted-foreground'}>
                  {row.revenue > 0 ? formatCurrency(row.revenue) : '-'}
                </span>
              </TableCell>

              <TableCell className="text-center">
                <span className={`font-medium ${row.conversionRate > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {row.conversionRate.toFixed(1)}%
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
