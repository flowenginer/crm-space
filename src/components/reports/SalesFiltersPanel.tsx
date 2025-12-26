import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface SalesFilters {
  sellerId?: string;
  origin?: string;
}

interface SalesFiltersPanelProps {
  filters: SalesFilters;
  onFiltersChange: (filters: SalesFilters) => void;
  availableSellers: { id: string; name: string }[];
  availableOrigins: string[];
}

export function SalesFiltersPanel({
  filters,
  onFiltersChange,
  availableSellers,
  availableOrigins,
}: SalesFiltersPanelProps) {
  const hasActiveFilters = filters.sellerId || filters.origin;

  const clearFilters = () => {
    onFiltersChange({});
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-sm font-medium text-muted-foreground">Filtros:</span>
      
      <Select
        value={filters.sellerId || 'all'}
        onValueChange={(value) => 
          onFiltersChange({ ...filters, sellerId: value === 'all' ? undefined : value })
        }
      >
        <SelectTrigger className="w-[180px] h-9">
          <SelectValue placeholder="Vendedor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os vendedores</SelectItem>
          {availableSellers.map((seller) => (
            <SelectItem key={seller.id} value={seller.id}>
              {seller.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.origin || 'all'}
        onValueChange={(value) => 
          onFiltersChange({ ...filters, origin: value === 'all' ? undefined : value })
        }
      >
        <SelectTrigger className="w-[160px] h-9">
          <SelectValue placeholder="Origem" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as origens</SelectItem>
          {availableOrigins.map((origin) => (
            <SelectItem key={origin} value={origin}>
              {formatOriginLabel(origin)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="h-9 px-3 text-muted-foreground hover:text-foreground"
        >
          <X size={16} className="mr-1" />
          Limpar
        </Button>
      )}
    </div>
  );
}

function formatOriginLabel(origin: string): string {
  const originMap: Record<string, string> = {
    'meta_ads': 'Meta Ads',
    'organic': 'Orgânico',
    'whatsapp': 'WhatsApp',
    'linktree': 'Linktree',
    'site': 'Site',
    'manual': 'Manual',
    'n8n': 'Automação',
  };
  return originMap[origin.toLowerCase()] || origin;
}
