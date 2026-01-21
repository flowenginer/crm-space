import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { LucideIcon } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { FlowNodeData, NodeType } from '@/types/flow';
import { cn } from '@/lib/utils';
import { useTags } from '@/hooks/useTags';

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

// Verifica se o nó de delay tem duas saídas (wait_reply)
const isDelayWithTwoOutputs = (data: FlowNodeData) => {
  return data.nodeType === 'delay' && data.nodeSubtype === 'wait_reply';
};

// Verifica se é o novo bloco híbrido send_text_wait_reply
const isSendTextWaitReply = (data: FlowNodeData) => {
  return data.nodeSubtype === 'send_text_wait_reply';
};

// Cores para as saídas dinâmicas
const outputColors = [
  { bg: 'bg-green-500', border: 'border-green-300', text: 'text-green-500' },
  { bg: 'bg-blue-500', border: 'border-blue-300', text: 'text-blue-500' },
  { bg: 'bg-purple-500', border: 'border-purple-300', text: 'text-purple-500' },
  { bg: 'bg-cyan-500', border: 'border-cyan-300', text: 'text-cyan-500' },
  { bg: 'bg-pink-500', border: 'border-pink-300', text: 'text-pink-500' },
];

// Cores hex para style inline (Tailwind JIT não detecta classes dinâmicas)
const outputColorHex = [
  { bg: '#22c55e', border: '#86efac' }, // green
  { bg: '#3b82f6', border: '#93c5fd' }, // blue
  { bg: '#a855f7', border: '#d8b4fe' }, // purple
  { bg: '#06b6d4', border: '#67e8f9' }, // cyan
  { bg: '#ec4899', border: '#f9a8d4' }, // pink
];

export const BaseNode = memo(({ data, selected }: BaseNodeProps) => {
  const { data: tags } = useTags();
  const IconComponent = iconMap[data.icon || 'Circle'] || LucideIcons.Circle;
  const color = data.color || nodeColors[data.nodeType];
  const hasTwoOutputs = data.nodeType === 'condition' || isDelayWithTwoOutputs(data);
  
  // Para o bloco híbrido, obter respostas esperadas do config
  const config = data.config as Record<string, unknown>;
  const expectedResponses = (config?.expected_responses as Array<{ id: string; label: string; keywords: string[] }>) || [];
  const isSendWaitReply = isSendTextWaitReply(data);
  
  // Calcular largura do nó baseado no número de saídas
  const numOutputs = isSendWaitReply ? expectedResponses.length + 2 : 0; // +2 para "Outra" e "Timeout"
  const nodeWidth = isSendWaitReply && numOutputs > 2 ? Math.max(180, numOutputs * 50) : 180;
  
  return (
    <div
      className={cn(
        'rounded-xl border-2 bg-card shadow-lg transition-all duration-200',
        selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
      )}
      style={{ borderColor: color, minWidth: `${nodeWidth}px` }}
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
          {getNodeDescription(data, tags)}
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
      
      {/* Saídas para o bloco híbrido send_text_wait_reply */}
      {isSendWaitReply ? (
        <>
          {/* Handles para cada resposta esperada - usando style inline */}
          {expectedResponses.map((response, index) => {
            const colorHex = outputColorHex[index % outputColorHex.length];
            const totalOutputs = expectedResponses.length + 2;
            const leftPercent = ((index + 1) / (totalOutputs + 1)) * 100;
            
            return (
              <Handle
                key={`handle_${response.id}`}
                type="source"
                position={Position.Bottom}
                id={`response_${response.id}`}
                className="!w-3 !h-3"
                style={{ 
                  left: `${leftPercent}%`,
                  backgroundColor: colorHex.bg,
                  borderWidth: '2px',
                  borderColor: colorHex.border
                }}
              />
            );
          })}
          
          {/* Labels para cada resposta esperada - separadas dos handles */}
          {expectedResponses.map((response, index) => {
            const colorSet = outputColors[index % outputColors.length];
            const totalOutputs = expectedResponses.length + 2;
            const leftPercent = ((index + 1) / (totalOutputs + 1)) * 100;
            
            return (
              <div 
                key={`label_${response.id}`}
                className={cn('absolute -bottom-5 text-[9px] whitespace-nowrap', colorSet.text)}
                style={{ left: `${leftPercent}%`, transform: 'translateX(-50%)' }}
              >
                {response.label || `R${index + 1}`}
              </div>
            );
          })}
          
          {/* Saída "Outra resposta" */}
          <Handle
            type="source"
            position={Position.Bottom}
            id="other"
            className="!w-3 !h-3 !bg-gray-500 !border-2 !border-gray-300"
            style={{ left: `${((expectedResponses.length + 1) / (expectedResponses.length + 3)) * 100}%` }}
          />
          <div 
            className="absolute -bottom-5 text-[9px] text-gray-500 whitespace-nowrap"
            style={{ left: `${((expectedResponses.length + 1) / (expectedResponses.length + 3)) * 100}%`, transform: 'translateX(-50%)' }}
          >
            Outra
          </div>
          
          {/* Saída "Timeout" */}
          <Handle
            type="source"
            position={Position.Bottom}
            id="timeout"
            className="!w-3 !h-3 !bg-orange-500 !border-2 !border-orange-300"
            style={{ left: `${((expectedResponses.length + 2) / (expectedResponses.length + 3)) * 100}%` }}
          />
          <div 
            className="absolute -bottom-5 text-[9px] text-orange-500 whitespace-nowrap"
            style={{ left: `${((expectedResponses.length + 2) / (expectedResponses.length + 3)) * 100}%`, transform: 'translateX(-50%)' }}
          >
            Timeout
          </div>
        </>
      ) : data.nodeType === 'condition' ? (
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
      ) : isDelayWithTwoOutputs(data) ? (
        <>
          {/* Saída quando cliente responde */}
          <Handle
            type="source"
            position={Position.Bottom}
            id="replied"
            className="!w-3 !h-3 !bg-green-500 !border-2 !border-green-300"
            style={{ left: '30%' }}
          />
          {/* Saída quando dá timeout */}
          <Handle
            type="source"
            position={Position.Bottom}
            id="timeout"
            className="!w-3 !h-3 !bg-orange-500 !border-2 !border-orange-300"
            style={{ left: '70%' }}
          />
          <div className="absolute -bottom-5 left-[20%] text-[10px] text-green-500">Respondeu</div>
          <div className="absolute -bottom-5 left-[60%] text-[10px] text-orange-500">Timeout</div>
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

function getNodeDescription(
  data: FlowNodeData, 
  tags?: Array<{ id: string; name: string; color: string }>
): string {
  const config = data.config as Record<string, unknown>;
  
  switch (data.nodeSubtype) {
    case 'keyword': {
      const keywords = (config?.keywords as string[])?.join(', ') || 'Nenhuma palavra';
      return `Cliente envia: ${keywords}`;
    }
    case 'message_key': {
      const messageKeys = (config?.keywords as string[])?.join(', ') || 'Nenhuma mensagem';
      return `Você envia: ${messageKeys.length > 25 ? messageKeys.substring(0, 25) + '...' : messageKeys}`;
    }
    case 'send_text':
      const msg = (config?.message as string) || '';
      return msg.length > 30 ? msg.substring(0, 30) + '...' : msg || 'Configurar mensagem';
    case 'send_text_wait_reply': {
      const message = (config?.message as string) || '';
      const expectedResponses = (config?.expected_responses as Array<{ label: string }>) || [];
      if (expectedResponses.length > 0) {
        return `${expectedResponses.length} respostas esperadas`;
      }
      return message.length > 25 ? message.substring(0, 25) + '...' : message || 'Configurar...';
    }
    case 'wait_time':
      return `Aguardar ${config?.amount || 0} ${config?.unit || 'segundos'}`;
    case 'wait_reply':
      return `Timeout: ${config?.timeout_minutes || 60} min`;
    case 'add_tag': {
      const tagId = config?.tag_id as string;
      const tag = tags?.find(t => t.id === tagId);
      return tag ? `Adicionar: ${tag.name}` : 'Selecione uma tag';
    }
    case 'remove_tag': {
      const tagId = config?.tag_id as string;
      const tag = tags?.find(t => t.id === tagId);
      return tag ? `Remover: ${tag.name}` : 'Selecione uma tag';
    }
    case 'has_tag': {
      const tagId = config?.tag_id as string;
      const tag = tags?.find(t => t.id === tagId);
      return tag ? `Tem tag: ${tag.name}` : 'Selecione uma tag';
    }
    case 'assign_agent':
      return 'Atribuir atendente';
    case 'transfer_user':
      return config?.user_id ? 'Transferir para usuário' : 'Selecione o atendente';
    case 'if_else':
      return `Se ${config?.variable || '...'} ${config?.operator || '='} ${config?.value || '...'}`;
    case 'inactivity':
      return `Após ${config?.minutes || 30} min sem resposta`;
    case 'new_contact':
      return 'Novo contato detectado';
    case 'first_message':
      return 'Primeira mensagem';
    case 'redirect_lead':
      const campaignName = config?.campaign_name || 'qualquer campanha';
      return config?.campaign_id ? `Campanha: ${campaignName}` : 'Lead via redirect';
    case 'end':
      return 'Finaliza o fluxo';
    case 'go_to_flow':
      return 'Redireciona para outro fluxo';
    case 'set_lead_status':
      return `Status: ${config?.status || '...'}`;
    case 'add_note':
      return 'Adiciona nota interna';
    case 'close_conversation':
      return 'Fecha a conversa';
    default:
      return data.nodeSubtype;
  }
}

BaseNode.displayName = 'BaseNode';
