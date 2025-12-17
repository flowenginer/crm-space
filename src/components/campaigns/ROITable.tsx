import { useState, useMemo } from 'react';
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
import { Loader2, TrendingUp, TrendingDown, Minus, ArrowUp, ArrowDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ROITableProps {
  data: CampaignROIData[] | SegmentROIData[];
  isLoading?: boolean;
  viewMode?: 'campanha' | 'segmento';
}

type SortColumn = 'name' | 'spend' | 'leads' | 'cpl' | 'conversions' | 'cac' | 'revenue' | 'roi' | 'roas';
type SortDirection = 'asc' | 'desc';

export function ROITable({ data, isLoading, viewMode = 'campanha' }: ROITableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

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

  const sortedData = useMemo(() => {
    if (!sortColumn || !data) return data;
    
    return [...data].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;
      
      switch (sortColumn) {
        case 'name': aVal = getName(a); bVal = getName(b); break;
        case 'spend': aVal = a.spend; bVal = b.spend; break;
        case 'leads': aVal = a.leads; bVal = b.leads; break;
        case 'cpl': aVal = a.cpl; bVal = b.cpl; break;
        case 'conversions': aVal = a.conversions; bVal = b.conversions; break;
        case 'cac': aVal = a.cac; bVal = b.cac; break;
        case 'revenue': aVal = a.revenue; bVal = b.revenue; break;
        case 'roi': aVal = a.roi; bVal = b.roi; break;
        case 'roas': aVal = a.roas; bVal = b.roas; break;
        default: return 0;
      }
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal, 'pt-BR') 
          : bVal.localeCompare(aVal, 'pt-BR');
      }
      
      return sortDirection === 'asc' 
        ? (aVal as number) - (bVal as number) 
        : (bVal as number) - (aVal as number);
    });
  }, [data, sortColumn, sortDirection]);

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

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return null;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1" /> 
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  return (
    <ScrollArea className="h-[400px]">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead 
              className="cursor-pointer hover:bg-muted/70 select-none transition-colors"
              onClick={() => handleSort('name')}
            >
              <div className="flex items-center">
                {columnLabel}
                <SortIcon column="name" />
              </div>
            </TableHead>
            <TableHead 
              className="text-right cursor-pointer hover:bg-muted/70 select-none transition-colors"
              onClick={() => handleSort('spend')}
            >
              <div className="flex items-center justify-end">
                Gastos
                <SortIcon column="spend" />
              </div>
            </TableHead>
            <TableHead 
              className="text-center cursor-pointer hover:bg-muted/70 select-none transition-colors"
              onClick={() => handleSort('leads')}
            >
              <div className="flex items-center justify-center">
                Leads
                <SortIcon column="leads" />
              </div>
            </TableHead>
            <TableHead 
              className="text-right cursor-pointer hover:bg-muted/70 select-none transition-colors"
              onClick={() => handleSort('cpl')}
            >
              <div className="flex items-center justify-end">
                CPL
                <SortIcon column="cpl" />
              </div>
            </TableHead>
            <TableHead 
              className="text-center cursor-pointer hover:bg-muted/70 select-none transition-colors"
              onClick={() => handleSort('conversions')}
            >
              <div className="flex items-center justify-center">
                Conv.
                <SortIcon column="conversions" />
              </div>
            </TableHead>
            <TableHead 
              className="text-right cursor-pointer hover:bg-muted/70 select-none transition-colors"
              onClick={() => handleSort('cac')}
            >
              <div className="flex items-center justify-end">
                CAC
                <SortIcon column="cac" />
              </div>
            </TableHead>
            <TableHead 
              className="text-right cursor-pointer hover:bg-muted/70 select-none transition-colors"
              onClick={() => handleSort('revenue')}
            >
              <div className="flex items-center justify-end">
                Receita
                <SortIcon column="revenue" />
              </div>
            </TableHead>
            <TableHead 
              className="text-center cursor-pointer hover:bg-muted/70 select-none transition-colors"
              onClick={() => handleSort('roi')}
            >
              <div className="flex items-center justify-center">
                ROI
                <SortIcon column="roi" />
              </div>
            </TableHead>
            <TableHead 
              className="text-center cursor-pointer hover:bg-muted/70 select-none transition-colors"
              onClick={() => handleSort('roas')}
            >
              <div className="flex items-center justify-center">
                ROAS
                <SortIcon column="roas" />
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.map((row, index) => (
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
