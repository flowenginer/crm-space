import { useState } from 'react';
import { CrossDataRow } from '@/hooks/useMetaLeadsCrossData';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, ExternalLink, Play, Image } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CrossDataTableProps {
  data: CrossDataRow[];
  isLoading?: boolean;
  viewMode?: 'anuncio' | 'campanha';
}

export function CrossDataTable({ data, isLoading, viewMode = 'anuncio' }: CrossDataTableProps) {
  const [selectedAd, setSelectedAd] = useState<CrossDataRow | null>(null);

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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const columnLabel = viewMode === 'campanha' ? 'Campanha' : 'Anúncio';

  return (
    <>
      <ScrollArea className="h-[400px]">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="min-w-[250px]">{columnLabel}</TableHead>
              <TableHead className="text-center">Leads</TableHead>
              <TableHead className="text-center">Catálogo</TableHead>
              <TableHead className="text-center">Layout</TableHead>
              <TableHead className="text-center">Pedido Fechado</TableHead>
              <TableHead className="text-right">Valor Negociado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow 
                key={row.sourceId} 
                className={`hover:bg-muted/30 ${viewMode === 'anuncio' ? 'cursor-pointer' : ''}`}
                onClick={() => viewMode === 'anuncio' && setSelectedAd(row)}
              >
                <TableCell className={`font-medium ${viewMode === 'anuncio' ? 'text-primary hover:underline' : ''}`}>
                  {row.adName}
                </TableCell>
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

      {/* Dialog apenas para modo anúncio */}
      {viewMode === 'anuncio' && (
        <Dialog open={!!selectedAd} onOpenChange={() => setSelectedAd(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Detalhes do Anúncio</DialogTitle>
            </DialogHeader>
            {selectedAd && (
              <div className="space-y-4">
                {/* Thumbnail do Criativo */}
                {(selectedAd.thumbnailUrl || selectedAd.imageUrl) && (
                  <div 
                    className="relative group cursor-pointer rounded-lg overflow-hidden bg-muted"
                    onClick={() => selectedAd.sourceUrl && window.open(selectedAd.sourceUrl, '_blank')}
                  >
                    <img 
                      src={selectedAd.thumbnailUrl || selectedAd.imageUrl} 
                      alt={selectedAd.adName}
                      className="w-full h-48 object-cover transition-transform group-hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      {selectedAd.mediaType === 'video' ? (
                        <Play className="h-12 w-12 text-white" fill="white" />
                      ) : (
                        <ExternalLink className="h-8 w-8 text-white" />
                      )}
                    </div>
                    {selectedAd.sourceUrl && (
                      <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" />
                        Abrir no Instagram
                      </div>
                    )}
                  </div>
                )}

                {/* Placeholder se não tiver imagem */}
                {!selectedAd.thumbnailUrl && !selectedAd.imageUrl && (
                  <div 
                    className="relative group cursor-pointer rounded-lg overflow-hidden bg-muted flex items-center justify-center h-32"
                    onClick={() => selectedAd.sourceUrl && window.open(selectedAd.sourceUrl, '_blank')}
                  >
                    <Image className="h-12 w-12 text-muted-foreground" />
                    {selectedAd.sourceUrl && (
                      <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" />
                        Abrir no Instagram
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Nome do Anúncio</label>
                  <p className="text-foreground font-medium">{selectedAd.adName}</p>
                </div>
                
                {selectedAd.campaignName && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Campanha</label>
                    <p className="text-foreground font-semibold text-primary">{selectedAd.campaignName}</p>
                  </div>
                )}
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Source ID</label>
                  <p className="text-foreground font-mono text-sm">{selectedAd.sourceId}</p>
                </div>
                
                {selectedAd.headline && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Headline</label>
                    <p className="text-foreground">{selectedAd.headline}</p>
                  </div>
                )}

                <div className="border-t pt-4 grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Total Leads</label>
                    <p className="text-2xl font-bold">{selectedAd.totalLeads}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Conversões</label>
                    <p className="text-2xl font-bold text-green-600">{selectedAd.pedidoFechadoCount}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Em Catálogo</label>
                    <p className="text-lg font-semibold">{selectedAd.catalogoCount}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Em Layout</label>
                    <p className="text-lg font-semibold">{selectedAd.layoutCount}</p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <label className="text-sm font-medium text-muted-foreground">Valor Negociado Total</label>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(selectedAd.revenue)}</p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
