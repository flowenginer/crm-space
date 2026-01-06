import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ActionItem } from './ActionItem';
import type { MarketingAction, MarketingActionType } from '@/types/marketing';
import { MARKETING_ACTION_CATEGORIES, MARKETING_ACTION_LABELS } from '@/types/marketing';

interface ActionBuilderProps {
  actions: MarketingAction[];
  onChange: (actions: MarketingAction[]) => void;
  label: string;
  // Data for selectors
  closeReasons: any[];
  departments: any[];
  agents: any[];
  tags: any[];
  leadStatuses: any[];
  segments: any[];
  rescueTemplates: any[];
  marketingCampaigns: any[];
  chatbotFlows: any[];
  // Context
  currentCampaignId?: string;
  hasMoreSteps?: boolean;
}

export function ActionBuilder({
  actions,
  onChange,
  label,
  closeReasons,
  departments,
  agents,
  tags,
  leadStatuses,
  segments,
  rescueTemplates,
  marketingCampaigns,
  chatbotFlows,
  currentCampaignId,
  hasMoreSteps,
}: ActionBuilderProps) {
  const handleAddAction = (type: MarketingActionType) => {
    onChange([...actions, { type, config: {} }]);
  };

  const handleUpdateAction = (index: number, action: MarketingAction) => {
    onChange(actions.map((a, i) => (i === index ? action : a)));
  };

  const handleRemoveAction = (index: number) => {
    onChange(actions.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      
      <div className="space-y-2 p-3 border border-border rounded-lg bg-card">
        {actions.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-2 text-center">
            Nenhuma ação configurada
          </p>
        ) : (
          actions.map((action, index) => (
            <ActionItem
              key={index}
              action={action}
              index={index}
              onChange={(updated) => handleUpdateAction(index, updated)}
              onRemove={() => handleRemoveAction(index)}
              closeReasons={closeReasons}
              departments={departments}
              agents={agents}
              tags={tags}
              leadStatuses={leadStatuses}
              segments={segments}
              rescueTemplates={rescueTemplates}
              marketingCampaigns={marketingCampaigns}
              chatbotFlows={chatbotFlows}
              currentCampaignId={currentCampaignId}
              hasMoreSteps={hasMoreSteps}
            />
          ))
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full mt-2"
            >
              <Plus size={14} className="mr-1" />
              Adicionar ação
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 max-h-[300px] overflow-y-auto">
            {MARKETING_ACTION_CATEGORIES.map((category, catIndex) => (
              <div key={category.label}>
                {catIndex > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  {category.label}
                </DropdownMenuLabel>
                <DropdownMenuGroup>
                  {category.actions.map((actionType) => (
                    <DropdownMenuItem
                      key={actionType}
                      onClick={() => handleAddAction(actionType)}
                    >
                      {MARKETING_ACTION_LABELS[actionType]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
