import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useState } from 'react';

interface Campaign {
  id: string;
  title: string;
  description: string | null;
  is_active: boolean;
}

interface CampaignSelectorProps {
  campaigns: Campaign[] | undefined;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  isLoading?: boolean;
}

export function CampaignSelector({ campaigns, selectedId, onSelect, isLoading }: CampaignSelectorProps) {
  const [open, setOpen] = useState(false);

  const selectedCampaign = campaigns?.find(c => c.id === selectedId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[300px] justify-between rounded-xl border-border"
          disabled={isLoading}
        >
          {selectedCampaign ? (
            <span className="truncate">{selectedCampaign.title}</span>
          ) : (
            <span className="text-muted-foreground">Selecionar campanha...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar campanha..." />
          <CommandList>
            <CommandEmpty>Nenhuma campanha encontrada.</CommandEmpty>
            <CommandGroup>
              {campaigns?.map((campaign) => (
                <CommandItem
                  key={campaign.id}
                  value={campaign.title}
                  onSelect={() => {
                    onSelect(campaign.id === selectedId ? null : campaign.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedId === campaign.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{campaign.title}</span>
                    {campaign.description && (
                      <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {campaign.description}
                      </span>
                    )}
                  </div>
                  {!campaign.is_active && (
                    <span className="ml-auto text-xs text-muted-foreground">(inativa)</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
