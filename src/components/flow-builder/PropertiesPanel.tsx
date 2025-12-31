import { useCallback } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTags } from '@/hooks/useTags';
import { useTeam } from '@/hooks/useTeam';
import { useDepartments } from '@/hooks/useDepartments';
import { useRedirectCampaigns } from '@/hooks/useRedirectCampaigns';
import { FlowNodeData } from '@/types/flow';

interface PropertiesPanelProps {
  node: FlowNodeData | null;
  onUpdate: (nodeId: string, config: Record<string, unknown>) => void;
  onClose: () => void;
}

export function PropertiesPanel({ node, onUpdate, onClose }: PropertiesPanelProps) {
  const { data: tags } = useTags();
  const { data: team } = useTeam();
  const { data: departments } = useDepartments();
  const { data: campaigns } = useRedirectCampaigns();
  
  const updateConfig = useCallback((key: string, value: unknown) => {
    if (!node) return;
    onUpdate(node.id, { ...node.config, [key]: value });
  }, [node, onUpdate]);
  
  if (!node) {
    return (
      <div className="w-80 h-full bg-card border-l border-border p-4 flex items-center justify-center">
        <p className="text-muted-foreground text-center text-sm">
          Selecione um bloco para editar suas propriedades
        </p>
      </div>
    );
  }
  
  return (
    <div className="w-80 h-full bg-card border-l border-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
        <h3 className="font-semibold text-foreground">{node.name || node.nodeSubtype}</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X size={16} />
        </Button>
      </div>
      
      {/* Form - stopPropagation prevents React Flow from capturing keyboard events */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-4"
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Nome do nó */}
        <div className="space-y-2">
          <Label>Nome do bloco</Label>
          <Input
            value={node.name || ''}
            onChange={(e) => onUpdate(node.id, { ...node.config, _name: e.target.value })}
            placeholder="Nome personalizado..."
          />
        </div>
        
        {/* Campos específicos por tipo */}
        {renderNodeConfig(node, updateConfig, { tags, team, departments, campaigns })}
      </div>
    </div>
  );
}

interface DataProps {
  tags: Array<{ id: string; name: string; color: string }> | undefined;
  team: Array<{ id: string; full_name: string }> | undefined;
  departments: Array<{ id: string; name: string }> | undefined;
  campaigns: Array<{ id: string; name: string }> | undefined;
}

function renderNodeConfig(
  node: FlowNodeData, 
  updateConfig: (key: string, value: unknown) => void,
  data: DataProps
) {
  const config = node.config as Record<string, unknown>;
  
  switch (node.nodeSubtype) {
    case 'keyword':
      return (
        <>
          <div className="space-y-2">
            <Label>Palavras-chave</Label>
            <Textarea
              value={(config?.keywords as string[])?.join('\n') || ''}
              onChange={(e) => updateConfig('keywords', e.target.value.split('\n').filter(Boolean))}
              placeholder="Uma palavra por linha..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              O fluxo inicia quando a mensagem contém qualquer dessas palavras
            </p>
          </div>
          <div className="space-y-2">
            <Label>Tipo de correspondência</Label>
            <Select 
              value={(config?.match_type as string) || 'contains'}
              onValueChange={(v) => updateConfig('match_type', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contains">Contém</SelectItem>
                <SelectItem value="equals">Exatamente igual</SelectItem>
                <SelectItem value="starts_with">Começa com</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      );
      
    case 'redirect_lead':
      return (
        <div className="space-y-2">
          <Label>Campanha (opcional)</Label>
          <Select 
            value={(config?.campaign_id as string) || 'any'}
            onValueChange={(v) => updateConfig('campaign_id', v === 'any' ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Qualquer campanha" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Qualquer campanha</SelectItem>
              {data.campaigns?.map((campaign) => (
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Dispara quando um lead chega via página de captura/redirect
          </p>
        </div>
      );
      
    case 'inactivity':
      return (
        <div className="space-y-2">
          <Label>Minutos de inatividade</Label>
          <Input
            type="number"
            value={(config?.minutes as number) || 30}
            onChange={(e) => updateConfig('minutes', parseInt(e.target.value))}
          />
        </div>
      );
    
    case 'send_text':
      return (
        <>
          <div className="space-y-2">
            <Label>Mensagem</Label>
            <Textarea
              value={(config?.message as string) || ''}
              onChange={(e) => updateConfig('message', e.target.value)}
              placeholder="Digite a mensagem..."
              rows={5}
            />
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium">Variáveis disponíveis:</p>
              <p>{'{{nome}}'} - Nome completo</p>
              <p>{'{{primeiro_nome}}'} - Primeiro nome</p>
              <p>{'{{telefone}}'} - Telefone</p>
              <p>{'{{email}}'} - Email</p>
              <p>{'{{data}}'} - Data atual (DD/MM/YYYY)</p>
              <p>{'{{hora}}'} - Hora atual (HH:MM)</p>
              <p>{'{{dia_semana}}'} - Dia da semana</p>
              <p>{'{{ultima_resposta}}'} - Última resposta do cliente</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Delay de digitação (ms)</Label>
            <Input
              type="number"
              value={(config?.typing_delay as number) || 1000}
              onChange={(e) => updateConfig('typing_delay', parseInt(e.target.value))}
            />
          </div>
        </>
      );
      
    case 'send_image':
      return (
        <>
          <div className="space-y-2">
            <Label>URL da Imagem</Label>
            <Input
              value={(config?.image_url as string) || ''}
              onChange={(e) => updateConfig('image_url', e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-2">
            <Label>Legenda (opcional)</Label>
            <Textarea
              value={(config?.caption as string) || ''}
              onChange={(e) => updateConfig('caption', e.target.value)}
              rows={2}
            />
          </div>
        </>
      );
      
    case 'tag_added':
      return (
        <div className="space-y-2">
          <Label>Tag que dispara o fluxo</Label>
          <Select 
            value={(config?.tag_id as string) || ''}
            onValueChange={(v) => updateConfig('tag_id', v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a tag" />
            </SelectTrigger>
            <SelectContent>
              {data.tags?.map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  <span className="flex items-center gap-2">
                    <span 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            O fluxo será iniciado quando esta tag for adicionada a um contato
          </p>
        </div>
      );

    case 'add_tag':
    case 'remove_tag':
    case 'has_tag':
      return (
        <div className="space-y-2">
          <Label>Tag</Label>
          <Select 
            value={(config?.tag_id as string) || ''}
            onValueChange={(v) => updateConfig('tag_id', v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a tag" />
            </SelectTrigger>
            <SelectContent>
              {data.tags?.map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  <span className="flex items-center gap-2">
                    <span 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
      
    case 'assign_agent':
      return (
        <div className="space-y-2">
          <Label>Atendente</Label>
          <Select 
            value={(config?.user_id as string) || ''}
            onValueChange={(v) => updateConfig('user_id', v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o atendente" />
            </SelectTrigger>
            <SelectContent>
              {data.team?.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
      
    case 'transfer_department':
      return (
        <div className="space-y-2">
          <Label>Departamento</Label>
          <Select 
            value={(config?.department_id as string) || ''}
            onValueChange={(v) => updateConfig('department_id', v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o departamento" />
            </SelectTrigger>
            <SelectContent>
              {data.departments?.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
      
    case 'set_lead_status':
      return (
        <div className="space-y-2">
          <Label>Status do Lead</Label>
          <Select 
            value={(config?.status as string) || ''}
            onValueChange={(v) => updateConfig('status', v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">Novo</SelectItem>
              <SelectItem value="contacted">Contatado</SelectItem>
              <SelectItem value="qualified">Qualificado</SelectItem>
              <SelectItem value="negotiation">Em Negociação</SelectItem>
              <SelectItem value="won">Ganho</SelectItem>
              <SelectItem value="lost">Perdido</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
      
    case 'http_request': {
      const bodyValue = (config?.body_raw as string) ?? 
        (config?.body ? JSON.stringify(config.body, null, 2) : '{}');
      
      let isValidJson = true;
      try {
        JSON.parse(bodyValue);
      } catch {
        isValidJson = false;
      }
      
      return (
        <>
          <div className="space-y-2">
            <Label>URL</Label>
            <Input
              value={(config?.url as string) || ''}
              onChange={(e) => updateConfig('url', e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-2">
            <Label>Método</Label>
            <Select 
              value={(config?.method as string) || 'POST'}
              onValueChange={(v) => updateConfig('method', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="PATCH">PATCH</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Body (JSON)</Label>
            <Textarea
              value={bodyValue}
              onChange={(e) => {
                // Store raw string to allow free typing
                updateConfig('body_raw', e.target.value);
                // Try to parse and store valid JSON
                try {
                  updateConfig('body', JSON.parse(e.target.value));
                } catch {
                  // Keep raw value, body will be parsed on execution
                }
              }}
              className={`font-mono text-xs ${!isValidJson ? 'border-destructive' : ''}`}
              rows={5}
            />
            {!isValidJson && (
              <p className="text-xs text-destructive">JSON inválido</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Headers (opcional)</Label>
            <Textarea
              value={(config?.headers_raw as string) ?? 
                (config?.headers ? JSON.stringify(config.headers, null, 2) : '')}
              onChange={(e) => {
                updateConfig('headers_raw', e.target.value);
                try {
                  updateConfig('headers', JSON.parse(e.target.value));
                } catch {
                  // Keep raw value
                }
              }}
              className="font-mono text-xs"
              rows={3}
              placeholder='{"Authorization": "Bearer ..."}'
            />
          </div>
        </>
      );
    }
    
    case 'if_else':
    case 'contains':
      return (
        <>
          <div className="space-y-2">
            <Label>Variável</Label>
            <Select 
              value={(config?.variable as string) || ''}
              onValueChange={(v) => updateConfig('variable', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="{{mensagem}}">Mensagem</SelectItem>
                <SelectItem value="{{nome}}">Nome do contato</SelectItem>
                <SelectItem value="{{lead_status}}">Status do lead</SelectItem>
                <SelectItem value="{{ultima_resposta}}">Última resposta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Operador</Label>
            <Select 
              value={(config?.operator as string) || 'contains'}
              onValueChange={(v) => updateConfig('operator', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equals">É igual a</SelectItem>
                <SelectItem value="not_equals">É diferente de</SelectItem>
                <SelectItem value="contains">Contém</SelectItem>
                <SelectItem value="not_contains">Não contém</SelectItem>
                <SelectItem value="starts_with">Começa com</SelectItem>
                <SelectItem value="is_empty">Está vazio</SelectItem>
                <SelectItem value="is_not_empty">Não está vazio</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Valor</Label>
            <Input
              value={(config?.value as string) || ''}
              onChange={(e) => updateConfig('value', e.target.value)}
              placeholder="Valor para comparar..."
            />
          </div>
        </>
      );
      
    case 'business_hours':
      return (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Início</Label>
              <Input
                type="time"
                value={(config?.start as string) || '09:00'}
                onChange={(e) => updateConfig('start', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Fim</Label>
              <Input
                type="time"
                value={(config?.end as string) || '18:00'}
                onChange={(e) => updateConfig('end', e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Dias úteis: Seg-Sex
          </p>
        </>
      );
    
    case 'wait_time':
      return (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label>Quantidade</Label>
            <Input
              type="number"
              value={(config?.amount as number) || 5}
              onChange={(e) => updateConfig('amount', parseInt(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>Unidade</Label>
            <Select 
              value={(config?.unit as string) || 'seconds'}
              onValueChange={(v) => updateConfig('unit', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="seconds">Segundos</SelectItem>
                <SelectItem value="minutes">Minutos</SelectItem>
                <SelectItem value="hours">Horas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );
      
    case 'wait_reply':
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Timeout (minutos)</Label>
            <Input
              type="number"
              value={(config?.timeout_minutes as number) || 60}
              onChange={(e) => updateConfig('timeout_minutes', parseInt(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Tempo máximo para aguardar resposta do cliente
            </p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <p className="text-xs font-medium text-foreground">Este bloco tem 2 saídas:</p>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-muted-foreground">Respondeu - Cliente respondeu antes do timeout</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="text-muted-foreground">Timeout - Cliente não respondeu a tempo</span>
            </div>
          </div>
        </div>
      );
      
    case 'wait_until':
      return (
        <div className="space-y-2">
          <Label>Horário</Label>
          <Input
            type="time"
            value={(config?.time as string) || '09:00'}
            onChange={(e) => updateConfig('time', e.target.value)}
          />
        </div>
      );
      
    case 'add_note':
      return (
        <div className="space-y-2">
          <Label>Nota interna</Label>
          <Textarea
            value={(config?.note as string) || ''}
            onChange={(e) => updateConfig('note', e.target.value)}
            placeholder="Digite a nota..."
            rows={4}
          />
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium">Variáveis disponíveis:</p>
            <p>{'{{nome}}'}, {'{{primeiro_nome}}'}, {'{{data}}'}, {'{{hora}}'}</p>
          </div>
        </div>
      );
      
    default:
      return (
        <p className="text-muted-foreground text-sm">
          Nenhuma configuração disponível para este bloco.
        </p>
      );
  }
}
