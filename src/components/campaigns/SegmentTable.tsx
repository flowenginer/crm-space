import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { SegmentCrossData } from "@/hooks/useMetaLeadsBySegment";

interface SegmentTableProps {
  data: SegmentCrossData[];
  isLoading?: boolean;
}

export function SegmentTable({ data, isLoading }: SegmentTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        Nenhum dado de segmento disponível
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <ScrollArea className="h-[400px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[200px]">Segmento</TableHead>
            <TableHead className="text-center">Leads</TableHead>
            <TableHead className="text-center">Catálogo</TableHead>
            <TableHead className="text-center">Layout</TableHead>
            <TableHead className="text-center">Pedido Fechado</TableHead>
            <TableHead className="text-right">Valor Negociado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.segmentId || 'sem_segmento'}>
              <TableCell className="font-medium">{row.segmentName}</TableCell>
              <TableCell className="text-center font-semibold">{row.totalLeads}</TableCell>
              <TableCell className="text-center">{row.catalogoCount}</TableCell>
              <TableCell className="text-center">{row.layoutCount}</TableCell>
              <TableCell className="text-center">
                <span className="text-green-600 font-semibold">{row.pedidoFechadoCount}</span>
              </TableCell>
              <TableCell className="text-right font-semibold text-green-600">
                {formatCurrency(row.revenue)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
