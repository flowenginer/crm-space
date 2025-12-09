import { AdBreakdownData } from '@/hooks/useMetaAdsAnalytics';
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
import { ExternalLink, Image as ImageIcon, Video, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AdsBreakdownTableProps {
  data: AdBreakdownData[];
  statuses: LeadStatus[];
  isLoading?: boolean;
}

export function AdsBreakdownTable({ data, statuses, isLoading }: AdsBreakdownTableProps) {
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
        <p>Nenhum anúncio encontrado</p>
      </div>
    );
  }

  // Pegar os top 5 status mais comuns para exibir como colunas
  const allStatuses = new Set<string>();
  data.forEach(ad => {
    Object.keys(ad.byStatus).forEach(s => allStatuses.add(s));
  });

  // Ordenar por order_position dos status configurados
  const orderedStatuses = Array.from(allStatuses).sort((a, b) => {
    const statusA = statuses.find(s => s.name === a);
    const statusB = statuses.find(s => s.name === b);
    const orderA = statusA?.order_position ?? 999;
    const orderB = statusB?.order_position ?? 999;
    return orderA - orderB;
  }).slice(0, 6);

  return (
    <ScrollArea className="h-[400px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">Preview</TableHead>
            <TableHead>Anúncio</TableHead>
            <TableHead className="text-center">Total</TableHead>
            {orderedStatuses.map(status => {
              const statusConfig = statuses.find(s => s.name === status);
              return (
                <TableHead key={status} className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: statusConfig?.color || '#8B5CF6' }}
                    />
                    <span className="text-xs truncate max-w-[60px]">
                      {status === 'new' ? 'Novo' : status.replace(/^\d+\s*-\s*/, '')}
                    </span>
                  </div>
                </TableHead>
              );
            })}
            <TableHead className="text-center">Conv.</TableHead>
            <TableHead className="text-center">Taxa</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.slice(0, 20).map((ad) => {
            const previewUrl = ad.thumbnailUrl || ad.imageUrl;
            const isVideo = ad.mediaType === 2;

            return (
              <TableRow key={ad.sourceId}>
                <TableCell>
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : isVideo ? (
                      <Video className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <p className="text-sm font-medium truncate max-w-[200px]">
                      {ad.campaignName || ad.headline || 'Sem nome'}
                    </p>
                    {ad.adName && ad.campaignName && (
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {ad.adName}
                      </p>
                    )}
                    {!ad.campaignName && (
                      <p className="text-xs text-muted-foreground">
                        ID: {ad.sourceId.slice(0, 12)}...
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary" className="font-semibold">
                    {ad.total}
                  </Badge>
                </TableCell>
                {orderedStatuses.map(status => (
                  <TableCell key={status} className="text-center">
                    <span className={ad.byStatus[status] ? 'font-medium' : 'text-muted-foreground'}>
                      {ad.byStatus[status] || 0}
                    </span>
                  </TableCell>
                ))}
                <TableCell className="text-center">
                  <Badge 
                    variant={ad.conversions > 0 ? 'default' : 'secondary'}
                    className={ad.conversions > 0 ? 'bg-green-500 hover:bg-green-600' : ''}
                  >
                    {ad.conversions}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <span className={`font-medium ${ad.conversionRate > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {ad.conversionRate.toFixed(1)}%
                  </span>
                </TableCell>
                <TableCell>
                  {ad.sourceUrl && (
                    <button
                      onClick={() => window.open(ad.sourceUrl!, '_blank')}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                    >
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
