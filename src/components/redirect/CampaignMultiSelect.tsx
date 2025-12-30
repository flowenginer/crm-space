import { useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { cn } from '@/lib/utils';
import type { RedirectCampaign } from '@/hooks/useRedirectCampaigns';

interface CampaignMultiSelectProps {
  campaigns: RedirectCampaign[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function CampaignMultiSelect({
  campaigns,
  selectedIds,
  onSelectionChange,
  disabled = false,
}: CampaignMultiSelectProps) {
  const [open, setOpen] = useState(false);

  const activeCampaigns = campaigns.filter(c => c.is_active);
  const selectedCampaigns = activeCampaigns.filter(c => selectedIds.includes(c.id));

  const handleSelect = (campaignId: string) => {
    if (selectedIds.includes(campaignId)) {
      onSelectionChange(selectedIds.filter(id => id !== campaignId));
    } else {
      onSelectionChange([...selectedIds, campaignId]);
    }
  };

  const handleRemove = (campaignId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectionChange(selectedIds.filter(id => id !== campaignId));
  };

  return (
    <div className="space-y-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between h-auto min-h-10"
          >
            <span className="text-muted-foreground">
              {selectedIds.length === 0
                ? 'Selecione as campanhas...'
                : `${selectedIds.length} campanha(s) selecionada(s)`}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar campanha..." />
            <CommandList>
              <CommandEmpty>Nenhuma campanha encontrada.</CommandEmpty>
              <CommandGroup>
                {activeCampaigns.map((campaign) => (
                  <CommandItem
                    key={campaign.id}
                    value={campaign.name}
                    onSelect={() => handleSelect(campaign.id)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        selectedIds.includes(campaign.id) ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex-1">
                      <span className="font-medium">{campaign.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        /r/{campaign.slug}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected campaigns as badges */}
      {selectedCampaigns.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedCampaigns.map((campaign) => (
            <Badge
              key={campaign.id}
              variant="secondary"
              className="pl-2 pr-1 py-1 flex items-center gap-1"
            >
              <span>{campaign.name}</span>
              <button
                type="button"
                onClick={(e) => handleRemove(campaign.id, e)}
                className="ml-1 rounded-full hover:bg-muted p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
