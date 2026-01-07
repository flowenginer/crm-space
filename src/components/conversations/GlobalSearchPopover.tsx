import { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useGlobalSearch, type SearchFilters } from '@/hooks/useGlobalSearch';
import { cn } from '@/lib/utils';

interface GlobalSearchPopoverProps {
  onSearchChange?: (query: string) => void;
  className?: string;
}

export function GlobalSearchPopover({
  onSearchChange,
  className,
}: GlobalSearchPopoverProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Notify parent of search changes
  useEffect(() => {
    onSearchChange?.(searchQuery);
  }, [searchQuery, onSearchChange]);

  const handleClear = () => {
    setSearchQuery('');
    inputRef.current?.focus();
  };

  return (
    <div className={cn('relative', className)}>
      {/* Search Input */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Buscar contatos e mensagens..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={cn(
            "pl-9 pr-8 h-9 rounded-xl bg-muted/50 border-border/50 text-sm transition-all",
            searchQuery && "ring-2 ring-primary/20 border-primary/30"
          )}
        />
        {searchQuery && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full transition-colors"
          >
            <X size={14} className="text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}

// Re-export types and hook for convenience
export { useGlobalSearch, type SearchFilters } from '@/hooks/useGlobalSearch';
export type { ContactSearchResult, MessageSearchResult } from '@/hooks/useGlobalSearch';
