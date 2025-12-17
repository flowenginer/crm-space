import { CampaignROIData } from '@/hooks/useMetaCampaignROI';
import { SegmentROIData } from '@/hooks/useMetaSegmentROI';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ROITableProps {
  data: CampaignROIData[] | SegmentROIData[];
  isLoading?: boolean;
  viewMode?: 'campanha' | 'segmento';
}

export function ROITable({ data, isLoading, viewMode = 'campanha' }: ROITableProps) {
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
        <p>Nenhum dado de ROI disponível</p>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const getRoiIcon = (roi: number) => {
    if (roi > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (roi < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getRoiColor = (roi: number) => {
    if (roi > 0) return 'text-green-600';
    if (roi < 0) return 'text-red-600';
    return 'text-muted-foreground';
  };

  const columnLabel = viewMode === 'segmento' ? 'Segmento' : 'Campanha';

  const getName = (row: CampaignROIData | SegmentROIData): string => {
    if ('campaignName' in row) return row.campaignName;
    if ('segmentName' in row) return row.segmentName;
    return 'Desconhecido';
  };

  const getId = (row: CampaignROIData | SegmentROIData, index: number): string => {
    if ('campaignId' in row) return row.campaignId;
    if ('segmentName' in row) return row.segmentName;
    return `row-${index}`;
  };

  return (
    <ScrollArea className="h-[400px]">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>{columnLabel}</TableHead>
            <TableHead className="text-right">Gastos</TableHead>
            <TableHead className="text-center">Leads</TableHead>
            <TableHead className="text-right">CPL</TableHead>
            <TableHead className="text-center">Conv.</TableHead>
            <TableHead className="text-right">CAC</TableHead>
            <TableHead className="text-right">Receita</TableHead>
            <TableHead className="text-center">ROI</TableHead>
            <TableHead className="text-center">ROAS</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, index) => (
            <TableRow key={getId(row, index)} className="hover:bg-muted/30">
              <TableCell>
                <p className="text-sm font-medium truncate max-w-[250px]">
                  {getName(row)}
                </p>
              </TableCell>
              
              <TableCell className="text-right">
                <span className="font-medium text-red-600">
                  {formatCurrency(row.spend)}
                </span>
              </TableCell>

              <TableCell className="text-center">
                <Badge variant="secondary">
                  {row.leads}
                </Badge>
              </TableCell>

              <TableCell className="text-right">
                <span className="text-sm">
                  {row.leads > 0 ? formatCurrency(row.cpl) : '-'}
                </span>
              </TableCell>

              <TableCell className="text-center">
                <Badge 
                  variant={row.conversions > 0 ? 'default' : 'secondary'}
                  className={row.conversions > 0 ? 'bg-green-500 hover:bg-green-600' : ''}
                >
                  {row.conversions}
                </Badge>
              </TableCell>

              <TableCell className="text-right">
                <span className="text-sm">
                  {row.conversions > 0 ? formatCurrency(row.cac) : '-'}
                </span>
              </TableCell>

              <TableCell className="text-right">
                <span className={`font-medium ${row.revenue > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {row.revenue > 0 ? formatCurrency(row.revenue) : '-'}
                </span>
              </TableCell>

              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-1">
                  {getRoiIcon(row.roi)}
                  <span className={`font-semibold ${getRoiColor(row.roi)}`}>
                    {row.roi.toFixed(1)}%
                  </span>
                </div>
              </TableCell>

              <TableCell className="text-center">
                <span className={`font-medium ${row.roas >= 1 ? 'text-green-600' : 'text-orange-600'}`}>
                  {row.roas.toFixed(2)}x
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
