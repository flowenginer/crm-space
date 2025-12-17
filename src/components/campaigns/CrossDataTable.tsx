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
import { Loader2, ExternalLink } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CrossDataTableProps {
  data: CrossDataRow[];
  isLoading?: boolean;
}

export function CrossDataTable({ data, isLoading }: CrossDataTableProps) {
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

  return (
    <>
      <ScrollArea className="h-[400px]">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="min-w-[250px]">Anúncio</TableHead>
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
                className="hover:bg-muted/30 cursor-pointer"
                onClick={() => setSelectedAd(row)}
              >
                <TableCell className="font-medium text-primary hover:underline">
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

      <Dialog open={!!selectedAd} onOpenChange={() => setSelectedAd(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes do Anúncio</DialogTitle>
          </DialogHeader>
          {selectedAd && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Nome do Anúncio</label>
                <p className="text-foreground font-medium">{selectedAd.adName}</p>
              </div>
              
              {selectedAd.campaignName && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Campanha</label>
                  <p className="text-foreground">{selectedAd.campaignName}</p>
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
              
              {selectedAd.sourceUrl && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">URL do Anúncio</label>
                  <a 
                    href={selectedAd.sourceUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    Abrir no Facebook
                    <ExternalLink className="h-4 w-4" />
                  </a>
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
    </>
  );
}
