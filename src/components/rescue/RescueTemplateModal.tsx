import { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useCreateRescueTemplate,
  useUpdateRescueTemplate,
  type RescueTemplate,
  type RescueStep,
} from '@/hooks/useRescueTemplates';
import { useCloseReasons } from '@/hooks/useCloseReasons';
import { useDepartments } from '@/hooks/useDepartments';
import { supabase } from '@/integrations/supabase/client';

interface RescueTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: RescueTemplate | null;
}

// Extended step with attachments
interface ExtendedRescueStep extends RescueStep {
  audio_url?: string;
  attachment_url?: string;
  attachment_type?: string;
  attachment_name?: string;
}

const VARIABLES = [
  { key: '{{nome}}', label: 'Nome' },
  { key: '{{telefone}}', label: 'Telefone' },
  { key: '{{email}}', label: 'Email' },
];

export function RescueTemplateModal({
  open,
  onOpenChange,
  template,
}: RescueTemplateModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<ExtendedRescueStep[]>([
    { message: '', timer_minutes: 10 },
  ]);
  const [finalAction, setFinalAction] = useState<'close' | 'transfer' | 'none'>('close');
  const [closeReasonId, setCloseReasonId] = useState<string>('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const { data: closeReasons = [] } = useCloseReasons();
  const { data: departments = [] } = useDepartments();
  const createTemplate = useCreateRescueTemplate();
  const updateTemplate = useUpdateRescueTemplate();

  const isEditing = !!template;
  const isSaving = createTemplate.isPending || updateTemplate.isPending;

  useEffect(() => {
    if (template) {
      setTitle(template.title);
      setDescription(template.description || '');
      setSteps(template.steps.length > 0 ? template.steps : [{ message: '', timer_minutes: 10 }]);
      setFinalAction(template.final_action);
      setCloseReasonId(template.final_action_config?.close_reason_id || '');
      setDepartmentId(template.final_action_config?.department_id || '');
    } else {
      setTitle('');
      setDescription('');
      setSteps([{ message: '', timer_minutes: 10 }]);
      setFinalAction('close');
      setCloseReasonId('');
      setDepartmentId('');
    }
    setActiveStepIndex(0);
  }, [template, open]);

  const handleAddStep = () => {
    setSteps([...steps, { message: '', timer_minutes: 60 }]);
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

  const insertVariable = (variable: string) => {
    const step = steps[activeStepIndex];
    handleStepChange(activeStepIndex, 'message', step.message + variable);
  };

  const applyFormatting = (format: 'bold' | 'italic' | 'strike') => {
    const step = steps[activeStepIndex];
    const formatChars = { bold: '*', italic: '_', strike: '~' };
    const char = formatChars[format];
    handleStepChange(activeStepIndex, 'message', step.message + `${char}texto${char}`);
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
      <div className="bg-[#0b141a] rounded-lg p-4 min-h-[300px]">
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

    const finalActionConfig: { close_reason_id?: string; department_id?: string } = {};
    if (finalAction === 'close' && closeReasonId) {
      finalActionConfig.close_reason_id = closeReasonId;
    } else if (finalAction === 'transfer' && departmentId) {
      finalActionConfig.department_id = departmentId;
    }

    try {
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

                  {/* Message Input */}
                  <Textarea
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
                </div>

                {/* Cancellation Info */}
                <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    O resgate será cancelado automaticamente se o lead responder.
                  </p>
                </div>
              </div>

              {/* Final Action */}
              <div className="space-y-4 pt-4 border-t border-border">
                <Label className="text-base font-semibold">
                  Ação Final (se não responder)
                </Label>

                <Select
                  value={finalAction}
                  onValueChange={(value: 'close' | 'transfer' | 'none') => setFinalAction(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma ação</SelectItem>
                    <SelectItem value="close">Fechar conversa</SelectItem>
                    <SelectItem value="transfer">Transferir para departamento</SelectItem>
                  </SelectContent>
                </Select>

                {finalAction === 'close' && (
                  <div>
                    <Label>Motivo de fechamento</Label>
                    <Select value={closeReasonId} onValueChange={setCloseReasonId}>
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
                )}

                {finalAction === 'transfer' && (
                  <div>
                    <Label>Departamento destino</Label>
                    <Select value={departmentId} onValueChange={setDepartmentId}>
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
                )}
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
      console.error('Error starting recording:', error);
      toast.error('Erro ao iniciar gravação. Verifique permissões do microfone.');
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
      const filePath = `rescue-audios/${Date.now()}_audio.webm`;

      const { error: uploadError } = await supabase.storage
        .from('template-attachments')
        .upload(filePath, blob, { contentType: 'audio/webm' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('template-attachments')
        .getPublicUrl(filePath);

      onAudioChange(publicUrl);
      toast.success('Áudio salvo!');
    } catch (error) {
      console.error('Error uploading audio:', error);
      toast.error('Erro ao salvar áudio');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadAudio(file);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (audioUrl) {
    return (
      <div className="flex items-center gap-2 bg-muted rounded-lg p-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => {
            if (!audioRef.current) {
              audioRef.current = new Audio(audioUrl);
              audioRef.current.onended = () => setIsPlaying(false);
            }
            if (isPlaying) {
              audioRef.current.pause();
            } else {
              audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
          }}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </Button>
        <div className="flex-1 h-1 bg-border rounded-full" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive"
          onClick={() => onAudioChange(undefined)}
        >
          <X size={16} />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant={isRecording ? 'destructive' : 'outline'}
        size="sm"
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isUploading}
        className="flex-1"
      >
        {isRecording ? (
          <>
            <Square size={14} className="mr-1" />
            Parar ({formatTime(recordingTime)})
          </>
        ) : (
          <>
            <Mic size={14} className="mr-1" />
            Gravar Áudio
          </>
        )}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={isRecording || isUploading}
      >
        {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileUpload}
        className="hidden"
      />
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

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    try {
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `rescue-files/${Date.now()}_${sanitizedName}`;

      const { error: uploadError } = await supabase.storage
        .from('template-attachments')
        .upload(filePath, file, { contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('template-attachments')
        .getPublicUrl(filePath);

      const mediaType = file.type.startsWith('image') ? 'image' : 
                       file.type.startsWith('video') ? 'video' : 'document';
      
      onFileChange(publicUrl, mediaType, file.name);
      toast.success('Arquivo enviado!');
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Erro ao enviar arquivo');
    } finally {
      setIsUploading(false);
    }
  };

  const getFileIcon = () => {
    if (attachmentType === 'image') return <ImageIcon size={16} />;
    if (attachmentType === 'video') return <Video size={16} />;
    return <FileText size={16} />;
  };

  if (attachmentUrl) {
    return (
      <div className="flex items-center gap-2 bg-muted rounded-lg p-2">
        {getFileIcon()}
        <span className="flex-1 text-sm truncate">{attachmentName || 'Arquivo'}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive"
          onClick={onRemove}
        >
          <X size={16} />
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="w-full"
      >
        {isUploading ? (
          <Loader2 size={14} className="mr-1 animate-spin" />
        ) : (
          <Paperclip size={14} className="mr-1" />
        )}
        Anexar Arquivo (PNG, PDF, JPG...)
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,.pdf,.doc,.docx"
        onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])}
        className="hidden"
      />
    </>
  );
}
