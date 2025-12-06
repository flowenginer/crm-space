import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { LucideIcon } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { FlowNodeData, NodeType } from '@/types/flow';
import { cn } from '@/lib/utils';

interface BaseNodeProps {
  data: FlowNodeData;
  selected: boolean;
}

const nodeColors: Record<NodeType, string> = {
  trigger: 'hsl(142, 71%, 45%)',
  action: 'hsl(262, 83%, 58%)',
  condition: 'hsl(38, 92%, 50%)',
  delay: 'hsl(330, 81%, 60%)',
  end: 'hsl(0, 84%, 60%)',
};

const iconMap: Record<string, LucideIcon> = LucideIcons as unknown as Record<string, LucideIcon>;

export const BaseNode = memo(({ data, selected }: BaseNodeProps) => {
  const IconComponent = iconMap[data.icon || 'Circle'] || LucideIcons.Circle;
  const color = data.color || nodeColors[data.nodeType];
  
  return (
    <div
      className={cn(
        'min-w-[180px] rounded-xl border-2 bg-card shadow-lg transition-all duration-200',
        selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
      )}
      style={{ borderColor: color }}
    >
      {/* Header */}
      <div 
        className="px-3 py-2 rounded-t-lg flex items-center gap-2"
        style={{ backgroundColor: `${color}20` }}
      >
        <div 
          className="w-6 h-6 rounded flex items-center justify-center"
          style={{ backgroundColor: color }}
        >
          <IconComponent size={14} className="text-white" />
        </div>
        <span className="text-sm font-medium text-foreground truncate">
          {data.name || data.nodeSubtype}
        </span>
      </div>
      
      {/* Body */}
      <div className="px-3 py-2">
        <p className="text-xs text-muted-foreground truncate">
          {getNodeDescription(data)}
        </p>
      </div>
      
      {/* Handles */}
      {data.nodeType !== 'trigger' && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-muted"
        />
      )}
      
      {data.nodeType === 'condition' ? (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="yes"
            className="!w-3 !h-3 !bg-green-500 !border-2 !border-green-300"
            style={{ left: '30%' }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="no"
            className="!w-3 !h-3 !bg-red-500 !border-2 !border-red-300"
            style={{ left: '70%' }}
          />
          <div className="absolute -bottom-5 left-[25%] text-[10px] text-green-500">Sim</div>
          <div className="absolute -bottom-5 left-[65%] text-[10px] text-red-500">Não</div>
        </>
      ) : data.nodeType !== 'end' && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !bg-muted-foreground !border-2 !border-muted"
        />
      )}
    </div>
  );
});

function getNodeDescription(data: FlowNodeData): string {
  const config = data.config as Record<string, unknown>;
  
  switch (data.nodeSubtype) {
    case 'keyword':
      const keywords = (config?.keywords as string[])?.join(', ') || 'Nenhuma palavra';
      return `Palavras: ${keywords}`;
    case 'send_text':
      const msg = (config?.message as string) || '';
      return msg.length > 30 ? msg.substring(0, 30) + '...' : msg || 'Configurar mensagem';
    case 'wait_time':
      return `Aguardar ${config?.amount || 0} ${config?.unit || 'segundos'}`;
    case 'wait_reply':
      return `Timeout: ${config?.timeout_minutes || 60} min`;
    case 'add_tag':
      return 'Adicionar tag';
    case 'assign_agent':
      return 'Atribuir atendente';
    case 'if_else':
      return `Se ${config?.variable || '...'} ${config?.operator || '='} ${config?.value || '...'}`;
    case 'inactivity':
      return `Após ${config?.minutes || 30} min sem resposta`;
    case 'new_contact':
      return 'Novo contato detectado';
    case 'first_message':
      return 'Primeira mensagem';
    case 'end':
      return 'Finaliza o fluxo';
    case 'go_to_flow':
      return 'Redireciona para outro fluxo';
    default:
      return data.nodeSubtype;
  }
}

BaseNode.displayName = 'BaseNode';
