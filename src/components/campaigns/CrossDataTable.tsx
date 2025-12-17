import { useState, useMemo } from 'react';
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
import { Loader2, ExternalLink, Play, Image, ArrowUp, ArrowDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CrossDataTableProps {
  data: CrossDataRow[];
  isLoading?: boolean;
  viewMode?: 'anuncio' | 'campanha' | 'segmento';
}

type SortColumn = 'name' | 'leads' | 'catalogo' | 'layout' | 'pedidoFechado' | 'revenue';
type SortDirection = 'asc' | 'desc';

export function CrossDataTable({ data, isLoading, viewMode = 'anuncio' }: CrossDataTableProps) {
  const [selectedAd, setSelectedAd] = useState<CrossDataRow | null>(null);
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

  const sortedData = useMemo(() => {
    if (!sortColumn || !data) return data;
    
    return [...data].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;
      
      switch (sortColumn) {
        case 'name': aVal = a.adName || ''; bVal = b.adName || ''; break;
        case 'leads': aVal = a.totalLeads; bVal = b.totalLeads; break;
        case 'catalogo': aVal = a.catalogoCount; bVal = b.catalogoCount; break;
        case 'layout': aVal = a.layoutCount; bVal = b.layoutCount; break;
        case 'pedidoFechado': aVal = a.pedidoFechadoCount; bVal = b.pedidoFechadoCount; break;
        case 'revenue': aVal = a.revenue; bVal = b.revenue; break;
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

  const columnLabel = viewMode === 'campanha' ? 'Campanha' : viewMode === 'segmento' ? 'Segmento' : 'Anúncio';

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return null;
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1" /> 
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        {/* Header fixo - fora do ScrollArea */}
        <Table className="table-fixed w-full">
          <TableHeader>
            <TableRow className="bg-card border-b border-border">
              <TableHead 
                className="w-[250px] cursor-pointer hover:bg-muted/70 select-none transition-colors"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center">
                  {columnLabel}
                  <SortIcon column="name" />
                </div>
              </TableHead>
              <TableHead 
                className="w-[80px] text-center cursor-pointer hover:bg-muted/70 select-none transition-colors"
                onClick={() => handleSort('leads')}
              >
                <div className="flex items-center justify-center">
                  Leads
                  <SortIcon column="leads" />
                </div>
              </TableHead>
              <TableHead 
                className="w-[90px] text-center cursor-pointer hover:bg-muted/70 select-none transition-colors"
                onClick={() => handleSort('catalogo')}
              >
                <div className="flex items-center justify-center">
                  Catálogo
                  <SortIcon column="catalogo" />
                </div>
              </TableHead>
              <TableHead 
                className="w-[80px] text-center cursor-pointer hover:bg-muted/70 select-none transition-colors"
                onClick={() => handleSort('layout')}
              >
                <div className="flex items-center justify-center">
                  Layout
                  <SortIcon column="layout" />
                </div>
              </TableHead>
              <TableHead 
                className="w-[120px] text-center cursor-pointer hover:bg-muted/70 select-none transition-colors"
                onClick={() => handleSort('pedidoFechado')}
              >
                <div className="flex items-center justify-center">
                  Pedido Fechado
                  <SortIcon column="pedidoFechado" />
                </div>
              </TableHead>
              <TableHead 
                className="w-[140px] text-right cursor-pointer hover:bg-muted/70 select-none transition-colors"
                onClick={() => handleSort('revenue')}
              >
                <div className="flex items-center justify-end">
                  Valor Negociado
                  <SortIcon column="revenue" />
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
        </Table>

        {/* Body scrollável - dentro do ScrollArea */}
        <ScrollArea className="h-[350px]">
          <Table className="table-fixed w-full">
            <TableBody>
              {sortedData.map((row) => (
                <TableRow 
                  key={row.sourceId} 
                  className={`hover:bg-muted/30 ${viewMode === 'anuncio' ? 'cursor-pointer' : ''}`}
                  onClick={() => viewMode === 'anuncio' && setSelectedAd(row)}
                >
                  <TableCell className={`w-[250px] font-medium ${viewMode === 'anuncio' ? 'text-primary hover:underline' : ''}`}>
                    {row.adName}
                  </TableCell>
                  <TableCell className="w-[80px] text-center font-semibold">{row.totalLeads}</TableCell>
                  <TableCell className="w-[90px] text-center">{row.catalogoCount}</TableCell>
                  <TableCell className="w-[80px] text-center">{row.layoutCount}</TableCell>
                  <TableCell className="w-[120px] text-center">
                    <span className="text-green-600 font-semibold">{row.pedidoFechadoCount}</span>
                  </TableCell>
                  <TableCell className="w-[140px] text-right font-semibold text-green-600">
                    {formatCurrency(row.revenue)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

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
