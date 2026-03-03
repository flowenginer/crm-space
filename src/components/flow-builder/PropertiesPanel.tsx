import { useCallback, useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTags } from '@/hooks/useTags';
import { useTeam } from '@/hooks/useTeam';
import { useDepartments } from '@/hooks/useDepartments';
import { useRedirectCampaigns } from '@/hooks/useRedirectCampaigns';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import { useChannels } from '@/hooks/useChannels';
import { FlowNodeData } from '@/types/flow';
import { WebhookBodyFields, BodyField, bodyFieldsToObject, objectToBodyFields } from './WebhookBodyFields';
import { MetaTemplateSelector } from '@/components/meta-templates';
import { FlowAudioUploader } from './FlowAudioUploader';

// Interface para respostas esperadas
interface ExpectedResponse {
  id: string;
  label: string;
  keywords: string[];
}
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
  const { data: leadStatuses } = useLeadStatuses();
  const { data: channels } = useChannels();
  
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
        {renderNodeConfig(node, updateConfig, onUpdate, { tags, team, departments, campaigns, leadStatuses, channels })}
      </div>
    </div>
  );
}

interface DataProps {
  tags: Array<{ id: string; name: string; color: string }> | undefined;
  team: Array<{ id: string; full_name: string }> | undefined;
  departments: Array<{ id: string; name: string }> | undefined;
  campaigns: Array<{ id: string; name: string }> | undefined;
  leadStatuses: Array<{ id: string; name: string; color: string | null }> | undefined;
  channels: Array<{ id: string; name: string; phone: string }> | undefined;
}

function renderNodeConfig(
  node: FlowNodeData, 
  updateConfig: (key: string, value: unknown) => void,
  onUpdate: (nodeId: string, config: Record<string, unknown>) => void,
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
              O fluxo inicia quando o <strong>CLIENTE</strong> envia uma mensagem contendo estas palavras
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
      
    case 'message_key':
      return (
        <>
          <div className="space-y-2">
            <Label>Mensagens-chave</Label>
            <Textarea
              value={(config?.keywords as string[])?.join('\n') || ''}
              onChange={(e) => updateConfig('keywords', e.target.value.split('\n').filter(Boolean))}
              placeholder="Uma frase por linha..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              O fluxo inicia quando <strong>VOCÊ/SISTEMA</strong> envia uma mensagem contendo estas palavras.
              Ideal para confirmações de pedido, avisos automáticos, etc.
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
      
    case 'send_audio':
      return (
        <>
          <div className="space-y-2">
            <Label>Áudio</Label>
            <FlowAudioUploader
              value={(config?.audio_url as string) || null}
              onChange={(url) => updateConfig('audio_url', url)}
            />
            <p className="text-xs text-muted-foreground">
              O arquivo será enviado como mensagem de voz no WhatsApp.
            </p>
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
      
    case 'send_video':
      return (
        <>
          <div className="space-y-2">
            <Label>URL do Vídeo</Label>
            <Input
              value={(config?.video_url as string) || ''}
              onChange={(e) => updateConfig('video_url', e.target.value)}
              placeholder="https://exemplo.com/video.mp4"
            />
            <p className="text-xs text-muted-foreground">
              Cole a URL direta para um arquivo de vídeo (MP4).
            </p>
          </div>
          <div className="space-y-2">
            <Label>Legenda (opcional)</Label>
            <Textarea
              value={(config?.caption as string) || ''}
              onChange={(e) => updateConfig('caption', e.target.value)}
              rows={2}
            />
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
      
    case 'send_document':
      return (
        <>
          <div className="space-y-2">
            <Label>URL do Documento</Label>
            <Input
              value={(config?.document_url as string) || ''}
              onChange={(e) => updateConfig('document_url', e.target.value)}
              placeholder="https://exemplo.com/documento.pdf"
            />
            <p className="text-xs text-muted-foreground">
              Cole a URL direta para o arquivo (PDF, DOC, XLS, etc).
            </p>
          </div>
          <div className="space-y-2">
            <Label>Nome do arquivo</Label>
            <Input
              value={(config?.filename as string) || ''}
              onChange={(e) => updateConfig('filename', e.target.value)}
              placeholder="documento.pdf"
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
      
    case 'transfer_user':
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Departamento (opcional)</Label>
            <Select 
              value={(config?.department_id as string) || 'same'}
              onValueChange={(v) => updateConfig('department_id', v === 'same' ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Manter departamento atual" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="same">Manter departamento atual</SelectItem>
                {data.departments?.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Opcionalmente, mude o departamento ao transferir
            </p>
          </div>
          
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
          
          <div className="space-y-2">
            <Label>Nota de transferência (opcional)</Label>
            <Textarea
              value={(config?.note as string) || ''}
              onChange={(e) => updateConfig('note', e.target.value)}
              placeholder="Motivo da transferência..."
              rows={2}
            />
          </div>
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
              {data.leadStatuses?.map((status) => (
                <SelectItem key={status.id} value={status.name}>
                  <span className="flex items-center gap-2">
                    <span 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: status.color || '#6B7280' }}
                    />
                    {status.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
      
    case 'http_request': {
      // Retrocompatibilidade: converter body existente para body_fields
      const bodyFields: BodyField[] = (config?.body_fields as BodyField[]) || 
        (config?.body && typeof config.body === 'object' && !Array.isArray(config.body)
          ? objectToBodyFields(config.body as Record<string, unknown>)
          : []);
      
      const handleFieldsChange = (newFields: BodyField[]) => {
        onUpdate(node.id, { 
          ...node.config, 
          body_fields: newFields,
          body: bodyFieldsToObject(newFields)
        });
      };
      
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
          
          <WebhookBodyFields 
            fields={bodyFields} 
            onChange={handleFieldsChange} 
          />
          
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
      
    case 'send_text_wait_reply': {
      const expectedResponses = (config?.expected_responses as ExpectedResponse[]) || [];
      
      const addResponse = () => {
        const newResponse: ExpectedResponse = {
          id: crypto.randomUUID().slice(0, 8),
          label: `Resposta ${expectedResponses.length + 1}`,
          keywords: []
        };
        onUpdate(node.id, {
          ...node.config,
          expected_responses: [...expectedResponses, newResponse]
        });
      };
      
      const removeResponse = (id: string) => {
        onUpdate(node.id, {
          ...node.config,
          expected_responses: expectedResponses.filter(r => r.id !== id)
        });
      };
      
      const updateResponse = (id: string, field: 'label' | 'keywords', value: string | string[]) => {
        onUpdate(node.id, {
          ...node.config,
          expected_responses: expectedResponses.map(r => 
            r.id === id ? { ...r, [field]: value } : r
          )
        });
      };
      
      return (
        <div className="space-y-4">
          {/* Mensagem */}
          <div className="space-y-2">
            <Label>Mensagem</Label>
          <Textarea
              value={(config?.message as string) || ''}
              onChange={(e) => updateConfig('message', e.target.value)}
              placeholder="Digite a mensagem com as opções para o cliente..."
              rows={4}
              onKeyDown={(e) => e.stopPropagation()}
            />
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium">Variáveis disponíveis:</p>
              <p>{'{{nome}}'}, {'{{primeiro_nome}}'}, {'{{telefone}}'}</p>
            </div>
          </div>
          
          {/* Timeout */}
          <div className="space-y-2">
            <Label>Timeout (minutos)</Label>
            <Input
              type="number"
              value={(config?.timeout_minutes as number) || 60}
              onChange={(e) => updateConfig('timeout_minutes', parseInt(e.target.value))}
            />
          </div>
          
          {/* Respostas Esperadas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Respostas Esperadas</Label>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={addResponse}
              >
                <Plus size={14} className="mr-1" />
                Adicionar
              </Button>
            </div>
            
            {expectedResponses.length === 0 && (
              <p className="text-xs text-muted-foreground italic">
                Nenhuma resposta configurada. Adicione respostas para criar saídas no bloco.
              </p>
            )}
            
            {expectedResponses.map((response, index) => (
              <div 
                key={response.id} 
                className="p-3 border border-border rounded-lg space-y-2 bg-muted/30"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Saída {index + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeResponse(response.id)}
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <Input
                    value={response.label}
                    onChange={(e) => updateResponse(response.id, 'label', e.target.value)}
                    placeholder="Nome da saída (ex: Opção 1)"
                    className="text-sm"
                  />
                  <Textarea
                    value={response.keywords.join('\n')}
                    onChange={(e) => updateResponse(response.id, 'keywords', e.target.value.split('\n').filter(Boolean))}
                    placeholder="Palavras que ativam esta saída (uma por linha)&#10;Ex:&#10;1&#10;sim&#10;quero"
                    rows={3}
                    className="text-sm"
                    onKeyDownCapture={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            ))}
          </div>
          
          {/* Explicação das saídas */}
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <p className="text-xs font-medium text-foreground">Saídas do bloco:</p>
            {expectedResponses.map((response, index) => (
              <div key={response.id} className="flex items-center gap-2 text-xs">
                <span 
                  className="w-2 h-2 rounded-full"
                  style={{ 
                    backgroundColor: ['#22c55e', '#3b82f6', '#a855f7', '#06b6d4', '#ec4899'][index % 5] 
                  }}
                />
                <span className="text-muted-foreground">
                  {response.label} - {response.keywords.length > 0 ? response.keywords.slice(0, 3).join(', ') : 'Nenhuma palavra'}
                  {response.keywords.length > 3 && '...'}
                </span>
              </div>
            ))}
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-gray-500" />
              <span className="text-muted-foreground">Outra - Quando responde algo diferente</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="text-muted-foreground">Timeout - Quando não responde a tempo</span>
            </div>
          </div>
        </div>
      );
    }
      
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
      
    case 'send_meta_template':
      return (
        <div className="space-y-4">
          <MetaTemplateSelector
            selectedTemplateId={(config?.template_id as string) || undefined}
            onTemplateSelect={(template) => {
              onUpdate(node.id, { 
                ...config, 
                template_id: template?.id || null,
                template_name: template?.name || null,
                variables: {}
              });
            }}
            variableValues={(config?.variables as Record<string, string>) || {}}
            onVariableChange={(variables) => {
              onUpdate(node.id, { 
                ...config, 
                variables 
              });
            }}
            showPreview={true}
          />
          <p className="text-xs text-muted-foreground">
            Selecione um template aprovado pela Meta para enviar.
            O template será enviado via API Oficial do WhatsApp.
          </p>
        </div>
      );
      
    case 'time_condition': {
      // Configurações de faixas de horário
      const timeRanges = (config?.time_ranges as Array<{ id: string; label: string; start: string; end: string }>) || [];
      
      const addTimeRange = () => {
        const newRange = {
          id: crypto.randomUUID().slice(0, 8),
          label: `Horário ${timeRanges.length + 1}`,
          start: '00:00',
          end: '11:59'
        };
        onUpdate(node.id, {
          ...node.config,
          time_ranges: [...timeRanges, newRange]
        });
      };
      
      const removeTimeRange = (id: string) => {
        onUpdate(node.id, {
          ...node.config,
          time_ranges: timeRanges.filter(r => r.id !== id)
        });
      };
      
      const updateTimeRange = (id: string, field: 'label' | 'start' | 'end', value: string) => {
        onUpdate(node.id, {
          ...node.config,
          time_ranges: timeRanges.map(r => 
            r.id === id ? { ...r, [field]: value } : r
          )
        });
      };
      
      return (
        <div className="space-y-4">
          {/* Faixas de Horário */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Faixas de Horário</Label>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={addTimeRange}
              >
                <Plus size={14} className="mr-1" />
                Adicionar
              </Button>
            </div>
            
            {timeRanges.length === 0 && (
              <p className="text-xs text-muted-foreground italic">
                Nenhuma faixa configurada. Adicione faixas para criar saídas baseadas em horários.
              </p>
            )}
            
            {timeRanges.map((range, index) => (
              <div 
                key={range.id} 
                className="p-3 border border-border rounded-lg space-y-2 bg-muted/30"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Saída {index + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeTimeRange(range.id)}
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <Input
                    value={range.label}
                    onChange={(e) => updateTimeRange(range.id, 'label', e.target.value)}
                    placeholder="Nome da saída (ex: Bom dia)"
                    className="text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Início</Label>
                      <Input
                        type="time"
                        value={range.start}
                        onChange={(e) => updateTimeRange(range.id, 'start', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Fim</Label>
                      <Input
                        type="time"
                        value={range.end}
                        onChange={(e) => updateTimeRange(range.id, 'end', e.target.value)}
                        className="text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Explicação das saídas */}
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <p className="text-xs font-medium text-foreground">Saídas do bloco:</p>
            {timeRanges.map((range, index) => (
              <div key={range.id} className="flex items-center gap-2 text-xs">
                <span 
                  className="w-2 h-2 rounded-full"
                  style={{ 
                    backgroundColor: ['#22c55e', '#3b82f6', '#a855f7', '#06b6d4', '#ec4899'][index % 5] 
                  }}
                />
                <span className="text-muted-foreground">
                  {range.label} - {range.start} até {range.end}
                </span>
              </div>
            ))}
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-gray-500" />
              <span className="text-muted-foreground">Outro - Quando não corresponder a nenhum horário</span>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground">
            O fluxo segue pela saída correspondente ao horário atual. Use para enviar mensagens personalizadas como "Bom dia", "Boa tarde" e "Boa noite".
          </p>
        </div>
      );
    }
      
    case 'set_variable':
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Campo do contato</Label>
            <Select 
              value={(config?.variable as string) || ''}
              onValueChange={(v) => updateConfig('variable', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o campo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full_name">Nome completo</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="origin">Origem</SelectItem>
                <SelectItem value="lead_status">Status do Lead</SelectItem>
                <SelectItem value="notes">Observações</SelectItem>
                <SelectItem value="city">Cidade</SelectItem>
                <SelectItem value="state">Estado</SelectItem>
                <SelectItem value="neighborhood">Bairro</SelectItem>
                <SelectItem value="street">Rua</SelectItem>
                <SelectItem value="number">Número</SelectItem>
                <SelectItem value="complement">Complemento</SelectItem>
                <SelectItem value="zip_code">CEP</SelectItem>
                <SelectItem value="country">País</SelectItem>
                <SelectItem value="cpf_cnpj">CPF/CNPJ</SelectItem>
                <SelectItem value="person_type">Tipo de Pessoa</SelectItem>
                <SelectItem value="contact_type">Tipo de Contato</SelectItem>
                <SelectItem value="negotiated_value">Valor Negociado</SelectItem>
                <SelectItem value="origin_campaign">Campanha de Origem</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Valor</Label>
            <Input
              value={(config?.value as string) || ''}
              onChange={(e) => updateConfig('value', e.target.value)}
              placeholder="Ex: WhatsApp, {{nome}}, etc."
            />
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium">Variáveis disponíveis:</p>
            <p>{'{{nome}}'} - Nome completo</p>
            <p>{'{{primeiro_nome}}'} - Primeiro nome</p>
            <p>{'{{telefone}}'} - Telefone</p>
            <p>{'{{email}}'} - Email</p>
            <p>{'{{data}}'} - Data atual (DD/MM/YYYY)</p>
            <p>{'{{hora}}'} - Hora atual (HH:MM)</p>
            <p>{'{{dia_semana}}'} - Dia da semana</p>
          </div>
        </div>
      );

    case 'first_message':
    case 'new_contact':
      return (
        <div className="space-y-2">
          <Label>Canal (opcional)</Label>
          <Select 
            value={(config?.channel_id as string) || 'any'}
            onValueChange={(v) => updateConfig('channel_id', v === 'any' ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Qualquer canal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Qualquer canal</SelectItem>
              {data.channels?.map((channel) => (
                <SelectItem key={channel.id} value={channel.id}>
                  {channel.name} ({channel.phone})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {node.nodeSubtype === 'first_message' 
              ? 'Filtra o disparo apenas para mensagens vindas deste canal'
              : 'Filtra o disparo apenas para novos contatos deste canal'}
          </p>
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
