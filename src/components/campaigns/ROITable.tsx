import { CampaignROIData } from '@/hooks/useMetaCampaignROI';
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
  data: CampaignROIData[];
  isLoading?: boolean;
}

export function ROITable({ data, isLoading }: ROITableProps) {
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

  return (
    <ScrollArea className="h-[400px]">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Campanha</TableHead>
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
          {data.map((campaign) => (
            <TableRow key={campaign.campaignId} className="hover:bg-muted/30">
              <TableCell>
                <p className="text-sm font-medium truncate max-w-[250px]">
                  {campaign.campaignName}
                </p>
              </TableCell>
              
              <TableCell className="text-right">
                <span className="font-medium text-red-600">
                  {formatCurrency(campaign.spend)}
                </span>
              </TableCell>

              <TableCell className="text-center">
                <Badge variant="secondary">
                  {campaign.leads}
                </Badge>
              </TableCell>

              <TableCell className="text-right">
                <span className="text-sm">
                  {campaign.leads > 0 ? formatCurrency(campaign.cpl) : '-'}
                </span>
              </TableCell>

              <TableCell className="text-center">
                <Badge 
                  variant={campaign.conversions > 0 ? 'default' : 'secondary'}
                  className={campaign.conversions > 0 ? 'bg-green-500 hover:bg-green-600' : ''}
                >
                  {campaign.conversions}
                </Badge>
              </TableCell>

              <TableCell className="text-right">
                <span className="text-sm">
                  {campaign.conversions > 0 ? formatCurrency(campaign.cac) : '-'}
                </span>
              </TableCell>

              <TableCell className="text-right">
                <span className={`font-medium ${campaign.revenue > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {campaign.revenue > 0 ? formatCurrency(campaign.revenue) : '-'}
                </span>
              </TableCell>

              <TableCell className="text-center">
                <div className="flex items-center justify-center gap-1">
                  {getRoiIcon(campaign.roi)}
                  <span className={`font-semibold ${getRoiColor(campaign.roi)}`}>
                    {campaign.roi.toFixed(1)}%
                  </span>
                </div>
              </TableCell>

              <TableCell className="text-center">
                <span className={`font-medium ${campaign.roas >= 1 ? 'text-green-600' : 'text-orange-600'}`}>
                  {campaign.roas.toFixed(2)}x
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
