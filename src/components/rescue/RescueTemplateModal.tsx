import { useState, useEffect, useRef } from 'react';
import { EmojiPickerButton } from '@/components/quick-messages/EmojiPickerButton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  Plus, 
  Trash2, 
  Clock, 
  Loader2, 
  AlertTriangle,
  Bold,
  Italic,
  Strikethrough,
  Mic,
  Square,
  Upload,
  Paperclip,
  X,
  Play,
  Pause,
  FileText,
  Image as ImageIcon,
  Video,
  File,
  MessageSquareReply,
  Timer,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useCreateRescueTemplate,
  useUpdateRescueTemplate,
  type RescueTemplate,
  type RescueStep,
  type RescueActionType,
  type RescueActionConfig,
} from '@/hooks/useRescueTemplates';
import { useCloseReasons } from '@/hooks/useCloseReasons';
import { useDepartments } from '@/hooks/useDepartments';
import { useTeam } from '@/hooks/useTeam';
import { useTags } from '@/hooks/useTags';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import { useSegments } from '@/hooks/useSegments';
import { supabase } from '@/integrations/supabase/client';

interface RescueTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: RescueTemplate | null;
}

// Extended step with attachments and individual actions
interface ExtendedRescueStep extends RescueStep {
  audio_url?: string;
  attachment_url?: string;
  attachment_type?: string;
  attachment_name?: string;
  on_reply_action?: RescueActionType;
  on_reply_config?: RescueActionConfig;
  on_no_reply_action?: RescueActionType;
  on_no_reply_config?: RescueActionConfig;
}

const VARIABLES = [
  { key: '{{nome}}', label: 'Nome' },
  { key: '{{telefone}}', label: 'Telefone' },
  { key: '{{email}}', label: 'Email' },
  { key: '{{data}}', label: 'Data' },
  { key: '{{saudacao}}', label: 'Saudação' },
  { key: '{{atendente}}', label: 'Atendente' },
];

const ACTION_OPTIONS: { value: RescueActionType; label: string; description?: string }[] = [
  { value: 'none', label: 'Nenhuma ação' },
  { value: 'transfer_agent', label: 'Transferir para vendedor' },
  { value: 'transfer_department', label: 'Transferir para setor' },
  { value: 'add_tag', label: 'Adicionar etiqueta' },
  { value: 'change_lead_status', label: 'Mudar status do lead' },
  { value: 'add_segment', label: 'Anexar segmento' },
];

const FINAL_ACTION_OPTIONS: { value: RescueActionType; label: string }[] = [
  { value: 'none', label: 'Nenhuma ação' },
  { value: 'close', label: 'Fechar conversa' },
  { value: 'transfer_agent', label: 'Transferir para vendedor' },
  { value: 'transfer_department', label: 'Transferir para setor' },
  { value: 'add_tag', label: 'Adicionar etiqueta' },
  { value: 'change_lead_status', label: 'Mudar status do lead' },
  { value: 'add_segment', label: 'Anexar segmento' },
];

// Component to render action config fields based on selected action
function ActionConfigFields({
  action,
  config,
  onChange,
  closeReasons,
  departments,
  agents,
  tags,
  leadStatuses,
  segments,
}: {
  action: RescueActionType;
  config: RescueActionConfig;
  onChange: (config: RescueActionConfig) => void;
  closeReasons: any[];
  departments: any[];
  agents: any[];
  tags: any[];
  leadStatuses: any[];
  segments: any[];
}) {
  if (action === 'none') return null;

  if (action === 'close') {
    return (
      <div>
        <Label className="text-sm">Motivo de fechamento</Label>
        <Select 
          value={config.close_reason_id || ''} 
          onValueChange={(value) => onChange({ ...config, close_reason_id: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione um motivo" />
          </SelectTrigger>
          <SelectContent>
            {closeReasons.filter(r => r.is_active).map((reason) => (
              <SelectItem key={reason.id} value={reason.id}>
                {reason.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (action === 'transfer_agent') {
    return (
      <div>
        <Label className="text-sm">Vendedor</Label>
        <Select 
          value={config.agent_id || ''} 
          onValueChange={(value) => onChange({ ...config, agent_id: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione um vendedor" />
          </SelectTrigger>
          <SelectContent>
            {agents.filter(a => a.is_active).map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (action === 'transfer_department') {
    return (
      <div>
        <Label className="text-sm">Departamento</Label>
        <Select 
          value={config.department_id || ''} 
          onValueChange={(value) => onChange({ ...config, department_id: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione um departamento" />
          </SelectTrigger>
          <SelectContent>
            {departments.filter(d => d.is_active).map((dept) => (
              <SelectItem key={dept.id} value={dept.id}>
                {dept.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (action === 'add_tag') {
    return (
      <div>
        <Label className="text-sm">Etiqueta</Label>
        <Select 
          value={config.tag_id || ''} 
          onValueChange={(value) => onChange({ ...config, tag_id: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma etiqueta" />
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
      </div>
    );
  }

  if (action === 'change_lead_status') {
    return (
      <div>
        <Label className="text-sm">Status do Lead</Label>
        <Select 
          value={config.lead_status || ''} 
          onValueChange={(value) => onChange({ ...config, lead_status: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione um status" />
          </SelectTrigger>
          <SelectContent>
            {leadStatuses.filter(s => s.is_active).map((status) => (
              <SelectItem key={status.id} value={status.name}>
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
      </div>
    );
  }

  if (action === 'add_segment') {
    return (
      <div>
        <Label className="text-sm">Segmento</Label>
        <Select 
          value={config.segment_id || ''} 
          onValueChange={(value) => onChange({ ...config, segment_id: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione um segmento" />
          </SelectTrigger>
          <SelectContent>
            {segments.filter(s => s.is_active).map((segment) => (
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
      </div>
    );
  }

  return null;
}

export function RescueTemplateModal({
  open,
  onOpenChange,
  template,
}: RescueTemplateModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<ExtendedRescueStep[]>([
    { message: '', timer_minutes: 10, on_reply_action: 'none', on_reply_config: {}, on_no_reply_action: 'none', on_no_reply_config: {} },
  ]);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: closeReasons = [] } = useCloseReasons();
  const { data: departments = [] } = useDepartments();
  const { data: team = [] } = useTeam();
  const { data: tags = [] } = useTags();
  const { data: leadStatuses = [] } = useLeadStatuses();
  const { data: segments = [] } = useSegments();
  const createTemplate = useCreateRescueTemplate();
  const updateTemplate = useUpdateRescueTemplate();

  const isEditing = !!template;
  const isSaving = createTemplate.isPending || updateTemplate.isPending;

  useEffect(() => {
    if (template) {
      setTitle(template.title);
      setDescription(template.description || '');
      // Map steps with default action values
      const mappedSteps = template.steps.length > 0 
        ? template.steps.map(step => ({
            ...step,
            on_reply_action: step.on_reply_action || 'none',
            on_reply_config: step.on_reply_config || {},
            on_no_reply_action: step.on_no_reply_action || 'none',
            on_no_reply_config: step.on_no_reply_config || {},
          }))
        : [{ message: '', timer_minutes: 10, on_reply_action: 'none' as RescueActionType, on_reply_config: {}, on_no_reply_action: 'none' as RescueActionType, on_no_reply_config: {} }];
      setSteps(mappedSteps);
    } else {
      setTitle('');
      setDescription('');
      setSteps([{ message: '', timer_minutes: 10, on_reply_action: 'none', on_reply_config: {}, on_no_reply_action: 'none', on_no_reply_config: {} }]);
    }
    setActiveStepIndex(0);
  }, [template, open]);

  const handleAddStep = () => {
    setSteps([...steps, { message: '', timer_minutes: 60, on_reply_action: 'none', on_reply_config: {}, on_no_reply_action: 'none', on_no_reply_config: {} }]);
    setActiveStepIndex(steps.length);
  };

  const handleRemoveStep = (index: number) => {
    if (steps.length <= 1) return;
    setSteps(steps.filter((_, i) => i !== index));
    if (activeStepIndex >= steps.length - 1) {
      setActiveStepIndex(Math.max(0, steps.length - 2));
    }
  };

  const handleStepChange = (index: number, field: keyof ExtendedRescueStep, value: any) => {
    setSteps(prevSteps => prevSteps.map((step, i) => 
      i === index ? { ...step, [field]: value } : step
    ));
  };

  const handleStepMultiChange = (index: number, updates: Partial<ExtendedRescueStep>) => {
    setSteps(prevSteps => prevSteps.map((step, i) => 
      i === index ? { ...step, ...updates } : step
    ));
  };

  const insertAtCursor = (textToInsert: string) => {
    const textarea = textareaRef.current;
    const step = steps[activeStepIndex];
    const currentMessage = step.message || '';
    
    if (textarea) {
      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      
      const newMessage = 
        currentMessage.substring(0, start) + 
        textToInsert + 
        currentMessage.substring(end);
      
      handleStepChange(activeStepIndex, 'message', newMessage);
      
      setTimeout(() => {
        if (textarea) {
          const newCursorPos = start + textToInsert.length;
          textarea.focus();
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    } else {
      handleStepChange(activeStepIndex, 'message', currentMessage + textToInsert);
    }
  };

  const insertVariable = (variable: string) => {
    insertAtCursor(variable);
  };

  const applyFormatting = (format: 'bold' | 'italic' | 'strike') => {
    const textarea = textareaRef.current;
    const step = steps[activeStepIndex];
    const currentMessage = step.message || '';
    const formatChars = { bold: '*', italic: '_', strike: '~' };
    const char = formatChars[format];
    
    if (textarea) {
      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      
      if (start !== end) {
        const selectedText = currentMessage.substring(start, end);
        const formattedText = `${char}${selectedText}${char}`;
        const newMessage = 
          currentMessage.substring(0, start) + 
          formattedText + 
          currentMessage.substring(end);
        
        handleStepChange(activeStepIndex, 'message', newMessage);
        
        setTimeout(() => {
          if (textarea) {
            textarea.focus();
            textarea.setSelectionRange(start, start + formattedText.length);
          }
        }, 0);
      } else {
        insertAtCursor(`${char}texto${char}`);
      }
    } else {
      handleStepChange(activeStepIndex, 'message', currentMessage + `${char}texto${char}`);
    }
  };

  const formatTimerLabel = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}min`;
  };

  const renderWhatsAppPreview = (step: ExtendedRescueStep) => {
    const formatMessage = (text: string) => {
      return text
        .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
        .replace(/_([^_]+)_/g, '<em>$1</em>')
        .replace(/~([^~]+)~/g, '<del>$1</del>')
        .replace(/\n/g, '<br/>');
    };

    return (
      <div className="bg-[#0b141a] rounded-lg p-4 min-h-[200px]">
        <div className="flex flex-col gap-2">
          {/* Audio preview */}
          {step.audio_url && (
            <div className="self-end max-w-[85%] bg-[#005c4b] text-white rounded-lg p-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <Play size={14} />
                </div>
                <div className="flex-1 h-1 bg-white/30 rounded-full">
                  <div className="h-full w-0 bg-white rounded-full" />
                </div>
                <span className="text-xs opacity-70">0:00</span>
              </div>
            </div>
          )}
          
          {/* Attachment preview */}
          {step.attachment_url && (
            <div className="self-end max-w-[85%] bg-[#005c4b] text-white rounded-lg overflow-hidden">
              {step.attachment_type === 'image' ? (
                <img 
                  src={step.attachment_url} 
                  alt="Preview" 
                  className="max-w-full max-h-40 object-cover"
                />
              ) : step.attachment_type === 'video' ? (
                <div className="w-full h-32 bg-black/50 flex items-center justify-center">
                  <Video size={32} className="opacity-70" />
                </div>
              ) : (
                <div className="p-3 flex items-center gap-2">
                  <FileText size={20} />
                  <span className="text-sm truncate">{step.attachment_name || 'Documento'}</span>
                </div>
              )}
            </div>
          )}

          {/* Text message */}
          {step.message && (
            <div className="self-end max-w-[85%] bg-[#005c4b] text-white rounded-lg px-3 py-2">
              <p 
                className="text-sm whitespace-pre-wrap break-words"
                dangerouslySetInnerHTML={{ __html: formatMessage(step.message) }}
              />
              <div className="flex justify-end mt-1">
                <span className="text-[10px] opacity-60">12:00</span>
              </div>
            </div>
          )}

          {!step.message && !step.audio_url && !step.attachment_url && (
            <div className="text-center text-muted-foreground py-8">
              <p className="text-sm">Preview aparecerá aqui</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Informe o título do template');
      return;
    }

    const validSteps = steps.filter(s => s.message.trim() || s.audio_url || s.attachment_url);
    if (validSteps.length === 0) {
      toast.error('Adicione pelo menos uma mensagem');
      return;
    }

    try {
      // Get final action from last step (for backwards compatibility)
      const lastStep = validSteps[validSteps.length - 1];
      const finalAction = lastStep?.on_no_reply_action || 'none';
      const finalActionConfig = lastStep?.on_no_reply_config || {};
      
      if (isEditing && template) {
        await updateTemplate.mutateAsync({
          id: template.id,
          title,
          description,
          steps: validSteps,
          final_action: finalAction,
          final_action_config: finalActionConfig,
        });
        toast.success('Template atualizado!');
      } else {
        await createTemplate.mutateAsync({
          title,
          description,
          steps: validSteps,
          final_action: finalAction,
          final_action_config: finalActionConfig,
        });
        toast.success('Template criado!');
      }
      onOpenChange(false);
    } catch (error) {
      toast.error('Erro ao salvar template');
    }
  };

  const currentStep = steps[activeStepIndex];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Template de Resgate' : 'Novo Template de Resgate'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Form */}
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Título do Template</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Resgate Padrão"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Descrição (opcional)</Label>
                  <Input
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ex: Sequência de 3 mensagens para leads inativos"
                  />
                </div>
              </div>

              {/* Steps Tabs */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Mensagens</Label>
                  <Button variant="outline" size="sm" onClick={handleAddStep}>
                    <Plus size={14} className="mr-1" />
                    Adicionar
                  </Button>
                </div>

                {/* Step Tabs */}
                <div className="flex flex-wrap gap-2">
                  {steps.map((_, index) => (
                    <Button
                      key={index}
                      variant={activeStepIndex === index ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setActiveStepIndex(index)}
                      className="relative"
                    >
                      Msg {index + 1}
                      {steps.length > 1 && activeStepIndex === index && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveStep(index);
                          }}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-xs"
                        >
                          <X size={10} />
                        </button>
                      )}
                    </Button>
                  ))}
                </div>

                {/* Active Step Editor */}
                <div className="p-4 border border-border rounded-lg bg-muted/30 space-y-4">
                  {/* Variables */}
                  <div className="flex flex-wrap gap-2">
                    {VARIABLES.map((v) => (
                      <Button
                        key={v.key}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => insertVariable(v.key)}
                        className="text-xs"
                      >
                        {v.label}
                      </Button>
                    ))}
                  </div>

                  {/* Formatting */}
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => applyFormatting('bold')}
                      title="Negrito *texto*"
                    >
                      <Bold size={14} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => applyFormatting('italic')}
                      title="Itálico _texto_"
                    >
                      <Italic size={14} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => applyFormatting('strike')}
                      title="Riscado ~texto~"
                    >
                      <Strikethrough size={14} />
                    </Button>
                  </div>

                  {/* Emoji Picker */}
                  <EmojiPickerButton
                    onEmojiSelect={(emoji) => insertAtCursor(emoji)}
                  />

                  {/* Message Input */}
                  <Textarea
                    ref={textareaRef}
                    value={currentStep?.message || ''}
                    onChange={(e) => handleStepChange(activeStepIndex, 'message', e.target.value)}
                    placeholder="Digite a mensagem..."
                    rows={4}
                    className="resize-none"
                  />

                  {/* Audio Recorder */}
                  <AudioRecorderInline
                    audioUrl={currentStep?.audio_url}
                    onAudioChange={(url) => handleStepChange(activeStepIndex, 'audio_url', url)}
                  />

                  {/* File Uploader */}
                  <FileUploaderInline
                    attachmentUrl={currentStep?.attachment_url}
                    attachmentType={currentStep?.attachment_type}
                    attachmentName={currentStep?.attachment_name}
                    onFileChange={(url, type, name) => {
                      handleStepMultiChange(activeStepIndex, {
                        attachment_url: url,
                        attachment_type: type,
                        attachment_name: name,
                      });
                    }}
                    onRemove={() => {
                      handleStepMultiChange(activeStepIndex, {
                        attachment_url: undefined,
                        attachment_type: undefined,
                        attachment_name: undefined,
                      });
                    }}
                  />

                  {/* Timer */}
                  <div className="flex items-center gap-3 pt-2 border-t border-border">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock size={14} />
                      <span>Timer:</span>
                    </div>
                    <Select
                      value={currentStep?.timer_minutes?.toString() || '10'}
                      onValueChange={(value) => handleStepChange(activeStepIndex, 'timer_minutes', parseInt(value))}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 min</SelectItem>
                        <SelectItem value="10">10 min</SelectItem>
                        <SelectItem value="15">15 min</SelectItem>
                        <SelectItem value="30">30 min</SelectItem>
                        <SelectItem value="60">1 hora</SelectItem>
                        <SelectItem value="120">2 horas</SelectItem>
                        <SelectItem value="240">4 horas</SelectItem>
                        <SelectItem value="480">8 horas</SelectItem>
                        <SelectItem value="720">12 horas</SelectItem>
                        <SelectItem value="1440">24 horas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Individual Actions for this Message */}
                  <div className="space-y-4 pt-4 border-t border-border">
                    {/* On Reply Action */}
                    <div className="space-y-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                      <div className="flex items-center gap-2">
                        <MessageSquareReply size={16} className="text-green-600" />
                        <Label className="text-sm font-semibold text-green-700 dark:text-green-400">
                          Se o cliente RESPONDER nesta mensagem
                        </Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info size={14} className="text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs text-sm">
                              <p className="font-semibold mb-1">Quando o cliente responder:</p>
                              <ul className="list-disc list-inside space-y-1 text-xs">
                                <li>A ação selecionada será executada automaticamente</li>
                                <li>Todas as próximas mensagens pendentes serão <strong>canceladas</strong></li>
                                <li>O resgate será marcado como "respondido"</li>
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      
                      <Select
                        value={currentStep?.on_reply_action || 'none'}
                        onValueChange={(value: RescueActionType) => {
                          handleStepMultiChange(activeStepIndex, { 
                            on_reply_action: value, 
                            on_reply_config: {} 
                          });
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACTION_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <ActionConfigFields
                        action={currentStep?.on_reply_action || 'none'}
                        config={currentStep?.on_reply_config || {}}
                        onChange={(config) => handleStepChange(activeStepIndex, 'on_reply_config', config)}
                        closeReasons={closeReasons}
                        departments={departments}
                        agents={team}
                        tags={tags}
                        leadStatuses={leadStatuses}
                        segments={segments}
                      />
                    </div>

                    {/* On No Reply Action */}
                    <div className="space-y-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <div className="flex items-center gap-2">
                        <Timer size={16} className="text-amber-600" />
                        <Label className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                          Se o cliente NÃO responder
                        </Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info size={14} className="text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs text-sm">
                              <p className="font-semibold mb-1">Se "Nenhuma ação":</p>
                              <ul className="list-disc list-inside space-y-1 text-xs mb-2">
                                <li>O sistema <strong>segue automaticamente para a próxima mensagem</strong></li>
                              </ul>
                              <p className="font-semibold mb-1">Outras ações:</p>
                              <ul className="list-disc list-inside space-y-1 text-xs">
                                <li>A ação será executada <strong>antes de seguir</strong> para a próxima mensagem</li>
                                <li>Na última mensagem, a ação configurada aqui será a <strong>ação final</strong> do resgate</li>
                              </ul>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>

                      <Select
                        value={currentStep?.on_no_reply_action || 'none'}
                        onValueChange={(value: RescueActionType) => {
                          handleStepMultiChange(activeStepIndex, { 
                            on_no_reply_action: value, 
                            on_no_reply_config: {} 
                          });
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FINAL_ACTION_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <ActionConfigFields
                        action={currentStep?.on_no_reply_action || 'none'}
                        config={currentStep?.on_no_reply_config || {}}
                        onChange={(config) => handleStepChange(activeStepIndex, 'on_no_reply_config', config)}
                        closeReasons={closeReasons}
                        departments={departments}
                        agents={team}
                        tags={tags}
                        leadStatuses={leadStatuses}
                        segments={segments}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          {/* Right Column - WhatsApp Preview */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Preview WhatsApp</Label>
            {renderWhatsAppPreview(currentStep || { message: '', timer_minutes: 10 })}
            
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Dicas de formatação:</strong></p>
              <p>*negrito* → <strong>negrito</strong></p>
              <p>_itálico_ → <em>itálico</em></p>
              <p>~riscado~ → <del>riscado</del></p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 size={14} className="mr-2 animate-spin" />}
            {isEditing ? 'Salvar' : 'Criar Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Inline Audio Recorder Component
function AudioRecorderInline({ 
  audioUrl, 
  onAudioChange 
}: { 
  audioUrl?: string; 
  onAudioChange: (url: string | undefined) => void;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await uploadAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      toast.error('Erro ao acessar microfone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const uploadAudio = async (blob: Blob) => {
    setIsUploading(true);
    try {
      const fileName = `rescue_audio_${Date.now()}.webm`;
      const { data, error } = await supabase.storage
        .from('conversation-attachments')
        .upload(fileName, blob, { contentType: 'audio/webm' });
      
      if (error) throw error;
      
      const { data: urlData } = supabase.storage
        .from('conversation-attachments')
        .getPublicUrl(fileName);
      
      onAudioChange(urlData.publicUrl);
      toast.success('Áudio salvo!');
    } catch (error) {
      toast.error('Erro ao salvar áudio');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('audio/')) {
      toast.error('Selecione um arquivo de áudio');
      return;
    }
    
    await uploadAudio(file);
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (audioUrl) {
    return (
      <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
        <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={togglePlay}
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
        </Button>
        <div className="flex-1 h-1 bg-primary/20 rounded-full">
          <div className="h-full w-0 bg-primary rounded-full" />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive"
          onClick={() => onAudioChange(undefined)}
        >
          <X size={14} />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {isRecording ? (
        <>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={stopRecording}
          >
            <Square size={14} className="mr-1" />
            Parar ({formatTime(recordingTime)})
          </Button>
        </>
      ) : isUploading ? (
        <Button type="button" variant="outline" size="sm" disabled>
          <Loader2 size={14} className="mr-1 animate-spin" />
          Salvando...
        </Button>
      ) : (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={startRecording}
          >
            <Mic size={14} className="mr-1" />
            Gravar
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={14} className="mr-1" />
            Upload
          </Button>
        </>
      )}
    </div>
  );
}

// Inline File Uploader Component
function FileUploaderInline({
  attachmentUrl,
  attachmentType,
  attachmentName,
  onFileChange,
  onRemove,
}: {
  attachmentUrl?: string;
  attachmentType?: string;
  attachmentName?: string;
  onFileChange: (url: string, type: string, name: string) => void;
  onRemove: () => void;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `rescue_${Date.now()}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('conversation-attachments')
        .upload(fileName, file);
      
      if (error) throw error;
      
      const { data: urlData } = supabase.storage
        .from('conversation-attachments')
        .getPublicUrl(fileName);
      
      let type = 'document';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      
      onFileChange(urlData.publicUrl, type, file.name);
      toast.success('Arquivo anexado!');
    } catch (error) {
      toast.error('Erro ao anexar arquivo');
    } finally {
      setIsUploading(false);
    }
  };

  const getFileIcon = () => {
    if (attachmentType === 'image') return <ImageIcon size={14} />;
    if (attachmentType === 'video') return <Video size={14} />;
    return <FileText size={14} />;
  };

  if (attachmentUrl) {
    return (
      <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
        {getFileIcon()}
        <span className="text-sm truncate flex-1">{attachmentName || 'Arquivo'}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive"
          onClick={onRemove}
        >
          <X size={14} />
        </Button>
      </div>
    );
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileUpload}
        accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
      >
        {isUploading ? (
          <Loader2 size={14} className="mr-1 animate-spin" />
        ) : (
          <Paperclip size={14} className="mr-1" />
        )}
        {isUploading ? 'Enviando...' : 'Anexar arquivo'}
      </Button>
    </div>
  );
}
