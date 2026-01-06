import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { 
  MarketingAction, 
  MarketingActionType, 
  MarketingActionConfig 
} from '@/types/marketing';
import { MARKETING_ACTION_LABELS } from '@/types/marketing';

interface ActionItemProps {
  action: MarketingAction;
  index: number;
  onChange: (action: MarketingAction) => void;
  onRemove: () => void;
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

export function ActionItem({
  action,
  index,
  onChange,
  onRemove,
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
}: ActionItemProps) {
  const updateConfig = (updates: Partial<MarketingActionConfig>) => {
    onChange({
      ...action,
      config: { ...action.config, ...updates },
    });
  };

  const renderConfigFields = () => {
    switch (action.type) {
      case 'close':
        return (
          <Select 
            value={action.config.close_reason_id || ''} 
            onValueChange={(value) => updateConfig({ close_reason_id: value })}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Motivo..." />
            </SelectTrigger>
            <SelectContent>
              {closeReasons.filter(r => r.is_active !== false).map((reason) => (
                <SelectItem key={reason.id} value={reason.id}>
                  {reason.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'transfer_agent':
        return (
          <Select 
            value={action.config.agent_id || ''} 
            onValueChange={(value) => updateConfig({ agent_id: value })}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Vendedor..." />
            </SelectTrigger>
            <SelectContent>
              {agents.filter(a => a.is_active !== false).map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'transfer_department':
        return (
          <Select 
            value={action.config.department_id || ''} 
            onValueChange={(value) => updateConfig({ department_id: value })}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Departamento..." />
            </SelectTrigger>
            <SelectContent>
              {departments.filter(d => d.is_active !== false).map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'add_tag':
        return (
          <Select 
            value={action.config.tag_id || ''} 
            onValueChange={(value) => updateConfig({ tag_id: value })}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Etiqueta..." />
            </SelectTrigger>
            <SelectContent>
              {tags.map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: tag.color }} 
                    />
                    {tag.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'change_lead_status':
        return (
          <Select 
            value={action.config.lead_status_id || ''} 
            onValueChange={(value) => updateConfig({ lead_status_id: value })}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Status..." />
            </SelectTrigger>
            <SelectContent>
              {leadStatuses.filter(s => s.is_active !== false).map((status) => (
                <SelectItem key={status.id} value={status.id}>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: status.color }} 
                    />
                    {status.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'add_segment':
        return (
          <Select 
            value={action.config.segment_id || ''} 
            onValueChange={(value) => updateConfig({ segment_id: value })}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Segmento..." />
            </SelectTrigger>
            <SelectContent>
              {segments.filter(s => s.is_active !== false).map((segment) => (
                <SelectItem key={segment.id} value={segment.id}>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: segment.color }} 
                    />
                    {segment.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'start_followup':
        return (
          <Select 
            value={action.config.followup_template_id || ''} 
            onValueChange={(value) => updateConfig({ followup_template_id: value })}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Template..." />
            </SelectTrigger>
            <SelectContent>
              {rescueTemplates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'start_marketing':
        return (
          <Select 
            value={action.config.marketing_campaign_id || ''} 
            onValueChange={(value) => updateConfig({ marketing_campaign_id: value })}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Campanha..." />
            </SelectTrigger>
            <SelectContent>
              {marketingCampaigns
                .filter(c => c.id !== currentCampaignId)
                .map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.title}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        );

      case 'start_automation':
        return (
          <Select 
            value={action.config.automation_id || ''} 
            onValueChange={(value) => updateConfig({ automation_id: value })}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Automação..." />
            </SelectTrigger>
            <SelectContent>
              {chatbotFlows.map((flow) => (
                <SelectItem key={flow.id} value={flow.id}>
                  {flow.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'send_next_message':
        if (!hasMoreSteps) {
          return (
            <span className="text-xs text-muted-foreground italic">
              (última mensagem)
            </span>
          );
        }
        return (
          <span className="text-xs text-muted-foreground">
            (imediato)
          </span>
        );

      case 'transfer_owner':
        return (
          <span className="text-xs text-muted-foreground">
            (dono do contato)
          </span>
        );

      default:
        return null;
    }
  };

  const needsConfig = !['none', 'send_next_message', 'transfer_owner'].includes(action.type);

  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
      <span className="text-xs text-muted-foreground font-medium w-4">
        {index + 1}.
      </span>
      
      <div className="flex-1 flex items-center gap-2">
        <span className="text-sm font-medium">
          {MARKETING_ACTION_LABELS[action.type]}
        </span>
        
        {needsConfig && (
          <div className="flex-1 max-w-[200px]">
            {renderConfigFields()}
          </div>
        )}
        
        {!needsConfig && renderConfigFields()}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-destructive"
        onClick={onRemove}
      >
        <Trash2 size={14} />
      </Button>
    </div>
  );
}
