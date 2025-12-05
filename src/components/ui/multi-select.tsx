import * as React from "react";
import { ChevronDown, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
  maxDisplay?: number;
  searchable?: boolean;
  searchPlaceholder?: string;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Selecione...",
  className,
  maxDisplay = 2,
  searchable = false,
  searchPlaceholder = "Pesquisar..."
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const filteredOptions = React.useMemo(() => {
    if (!search.trim()) return options;
    return options.filter(opt => 
      opt.label.toLowerCase().includes(search.toLowerCase())
    );
  }, [options, search]);

  const selectedLabels = value
    .map(v => options.find(opt => opt.value === v)?.label)
    .filter(Boolean);

  const handleToggle = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter(v => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const handleSelectAll = () => {
    if (value.length === options.length) {
      onChange([]);
    } else {
      onChange(options.map(opt => opt.value));
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const displayText = () => {
    if (value.length === 0) return placeholder;
    if (value.length === options.length) return "Todos";
    if (selectedLabels.length <= maxDisplay) {
      return selectedLabels.join(", ");
    }
    return `${selectedLabels.slice(0, maxDisplay).join(", ")} +${selectedLabels.length - maxDisplay}`;
  };

  return (
    <Popover open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) setSearch("");
    }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal h-10",
            value.length === 0 && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{displayText()}</span>
          <div className="flex items-center gap-1 ml-2">
            {value.length > 0 && (
              <X
                size={14}
                className="shrink-0 opacity-50 hover:opacity-100 cursor-pointer"
                onClick={handleClear}
              />
            )}
            <ChevronDown size={16} className="shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-popover border border-border z-50" align="start">
        {searchable && (
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8"
              />
            </div>
          </div>
        )}
        <div className="p-2 border-b border-border">
          <div
            className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-accent"
            onClick={handleSelectAll}
          >
            <Checkbox
              checked={value.length === options.length && options.length > 0}
              className="pointer-events-none"
            />
            <span className="text-sm font-medium">
              {value.length === options.length ? "Desmarcar todos" : "Selecionar todos"}
            </span>
          </div>
        </div>
        <div className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
          <div className="p-2 space-y-1">
            {filteredOptions.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-2">
                Nenhum resultado encontrado
              </div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-accent"
                  onClick={() => handleToggle(option.value)}
                >
                  <Checkbox
                    checked={value.includes(option.value)}
                    className="pointer-events-none"
                  />
                  <span className="text-sm">{option.label}</span>
                </div>
              ))
            )}
          </div>
        </div>
        {value.length > 0 && (
          <div className="p-2 border-t border-border flex flex-wrap gap-1">
            {selectedLabels.slice(0, 3).map((label, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {label}
              </Badge>
            ))}
            {selectedLabels.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{selectedLabels.length - 3}
              </Badge>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
