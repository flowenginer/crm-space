import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calendar, Clock, Mic, MicOff, Paperclip, Smile, FileText,
  Send, X, Loader2, Trash2, MessageSquare, ImageIcon, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import EmojiPicker from 'emoji-picker-react';
import {
  useApprovedMetaTemplates,
  type MetaMessageTemplate,
  getTemplateBody,
  getTemplateHeader,
  getTemplateFooter,
  extractDetailedVariables,
} from '@/hooks/useMetaTemplates';
import {
  buildTemplateComponentsPayload,
  countTotalTemplateVariables,
  renderTemplatePreview,
} from '@/lib/scheduled-template-utils';

type ScheduleMode = 'free' | 'template';

interface ScheduleMessageModalProps {
  open: boolean;
  onClose: () => void;
  contactId: string;
  conversationId: string;
  channelId?: string | null;
  contactName?: string;
}

export function ScheduleMessageModal({ 
  open, 
  onClose, 
  contactId, 
  conversationId,
  channelId,
  contactName 
}: ScheduleMessageModalProps) {
  // Form state
  const [message, setMessage] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // File attachment state - multiple files
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Emoji picker state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  // Tab state
  const [activeTab, setActiveTab] = useState('new');

  // Template mode state
  const [mode, setMode] = useState<ScheduleMode>('free');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [templateVars, setTemplateVars] = useState<Record<string, string>>({});
  const [templateHeaderMediaUrl, setTemplateHeaderMediaUrl] = useState('');

  const queryClient = useQueryClient();

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setMessage('');
      setScheduledDate('');
      setScheduledTime('');
      setAudioBlob(null);
      setAudioUrl(null);
      setAttachedFiles([]);
      setActiveTab('new');
      setMode('free');
      setSelectedTemplateId('');
      setTemplateVars({});
      setTemplateHeaderMediaUrl('');
    }
  }, [open]);

  // Fetch quick message templates
  const { data: templates = [] } = useQuery({
    queryKey: ['message-templates-scheduler'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('is_active', true)
        .order('usage_count', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    }
  });

  // Fetch scheduled messages for this contact
  const { data: scheduledMessages = [] } = useQuery({
    queryKey: ['scheduled-messages', contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduled_messages')
        .select('*')
        .eq('contact_id', contactId)
        .eq('status', 'scheduled')
        .order('scheduled_for', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!contactId && open
  });

  // Approved Meta templates for template mode
  const { data: approvedTemplates = [], isLoading: isLoadingTemplates } = useApprovedMetaTemplates();

  const selectedTemplate = useMemo<MetaMessageTemplate | null>(() => {
    if (!selectedTemplateId) return null;
    return approvedTemplates.find((t) => t.id === selectedTemplateId) || null;
  }, [selectedTemplateId, approvedTemplates]);

  const templateVarCount = useMemo(() => {
    if (!selectedTemplate) return 0;
    return countTotalTemplateVariables(selectedTemplate.components);
  }, [selectedTemplate]);

  const templateDetails = useMemo(() => {
    if (!selectedTemplate) return null;
    return extractDetailedVariables(selectedTemplate.components, selectedTemplate.header_media_url);
  }, [selectedTemplate]);

  const needsTemplateMediaUrl =
    !!templateDetails?.hasMediaHeader &&
    templateDetails.headerVarCount === 0 &&
    !templateDetails.headerMediaUrl;

  const templatePreview = useMemo(() => {
    if (!selectedTemplate) return '';
    return renderTemplatePreview(selectedTemplate, templateVars);
  }, [selectedTemplate, templateVars]);

  // ============================================
  // AUDIO RECORDING with Mp3Recorder (direct MP3)
  // ============================================
  const mp3RecorderRef = useRef<any>(null);
  
  const startRecording = async () => {
    try {
      const { Mp3Recorder } = await import('@/lib/audio/mp3-recorder');
      mp3RecorderRef.current = new Mp3Recorder();
      await mp3RecorderRef.current.start();
      
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('[ScheduleModal] Recording error:', error);
      toast.error('Não foi possível acessar o microfone');
    }
  };

  const stopRecording = () => {
    if (!mp3RecorderRef.current || !isRecording) return;
    
    setIsRecording(false);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
    
    try {
      const mp3Blob = mp3RecorderRef.current.stop();
      console.log('[ScheduleModal] MP3 recorded, size:', mp3Blob.size);
      setAudioBlob(mp3Blob);
      setAudioUrl(URL.createObjectURL(mp3Blob));
      mp3RecorderRef.current = null;
    } catch (error) {
      console.error('[ScheduleModal] Error stopping recording:', error);
      toast.error('Erro ao finalizar gravação');
    }
  };

  const deleteRecording = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ============================================
  // FILE ATTACHMENT - Multiple files
  // ============================================
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validFiles: File[] = [];
    let hasError = false;

    for (const file of files) {
      if (file.size > 30 * 1024 * 1024) {
        toast.error(`Arquivo "${file.name}" muito grande. Máximo 30MB.`);
        hasError = true;
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      setAttachedFiles(prev => [...prev, ...validFiles]);
    }
    
    // Reset input para permitir selecionar o mesmo arquivo novamente
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setAttachedFiles([]);
  };

  // ============================================
  // EMOJI
  // ============================================
  const handleEmojiSelect = (emoji: any) => {
    setMessage(prev => prev + emoji.emoji);
    setShowEmojiPicker(false);
  };

  // ============================================
  // TEMPLATE SELECT
  // ============================================
  const handleTemplateSelect = (template: any) => {
    setMessage(template.content);
  };

  // ============================================
  // TEMPLATE VAR CHANGE
  // ============================================
  const handleTemplateVarChange = (key: string, value: string) => {
    setTemplateVars((prev) => ({ ...prev, [key]: value }));
  };

  // ============================================
  // SCHEDULE TEMPLATE
  // ============================================
  const handleScheduleTemplate = async () => {
    if (!selectedTemplate) {
      toast.error('Selecione um template');
      return;
    }
    if (!scheduledDate || !scheduledTime) {
      toast.error('Selecione data e hora');
      return;
    }
    const scheduledFor = new Date(`${scheduledDate}T${scheduledTime}`);
    if (scheduledFor <= new Date()) {
      toast.error('A data deve ser no futuro');
      return;
    }
    for (let i = 1; i <= templateVarCount; i++) {
      if (!templateVars[String(i)]?.trim()) {
        toast.error(`Preencha a variável {{${i}}}`);
        return;
      }
    }
    if (needsTemplateMediaUrl && !templateHeaderMediaUrl.trim()) {
      toast.error('Informe a URL da mídia do cabeçalho');
      return;
    }

    // Validate payload will build correctly before insert
    try {
      buildTemplateComponentsPayload(
        selectedTemplate,
        templateVars,
        needsTemplateMediaUrl ? templateHeaderMediaUrl.trim() : null,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao montar template');
      return;
    }

    // Resolve channel
    let finalChannelId = channelId;
    if (!finalChannelId) {
      const { data: conversation } = await supabase
        .from('conversations')
        .select('channel_id')
        .eq('id', conversationId)
        .single();
      finalChannelId = conversation?.channel_id;
    }
    if (!finalChannelId) {
      toast.error('Nenhum canal disponível');
      return;
    }

    // Warn if channel is not CloudAPI (templates Meta only work on official channels)
    const { data: channelRow } = await supabase
      .from('whatsapp_channels')
      .select('type')
      .eq('id', finalChannelId)
      .single();
    const channelType = channelRow?.type;
    if (channelType !== 'cloudapi' && channelType !== 'official') {
      toast.error('Templates Meta só podem ser enviados em canais Cloud API oficial');
      return;
    }

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const effectiveMediaUrl = needsTemplateMediaUrl
        ? templateHeaderMediaUrl.trim()
        : (selectedTemplate.header_media_url || null);

      const { error } = await supabase.from('scheduled_messages').insert({
        contact_id: contactId,
        conversation_id: conversationId,
        channel_id: finalChannelId,
        content: templatePreview,
        message_type: 'template',
        meta_template_id: selectedTemplate.id,
        template_name: selectedTemplate.name,
        template_language: selectedTemplate.language,
        template_components: selectedTemplate.components,
        template_header_media_url: effectiveMediaUrl,
        variables: templateVars,
        scheduled_for: scheduledFor.toISOString(),
        status: 'scheduled',
        created_by: user?.id,
      });
      if (error) throw error;

      toast.success('Template agendado!');
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages', contactId] });

      // Reset template form
      setSelectedTemplateId('');
      setTemplateVars({});
      setTemplateHeaderMediaUrl('');
      setScheduledDate('');
      setScheduledTime('');
      setActiveTab('scheduled');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao agendar template');
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================
  // SCHEDULE MESSAGE
  // ============================================
  const handleSchedule = async () => {
    if (!scheduledDate || !scheduledTime) {
      toast.error('Selecione data e hora');
      return;
    }

    if (!message && !audioBlob && attachedFiles.length === 0) {
      toast.error('Adicione uma mensagem, áudio ou arquivo');
      return;
    }

    const scheduledFor = new Date(`${scheduledDate}T${scheduledTime}`);
    if (scheduledFor <= new Date()) {
      toast.error('A data deve ser no futuro');
      return;
    }

    // Get channel_id from conversation if not provided
    let finalChannelId = channelId;
    if (!finalChannelId) {
      const { data: conversation } = await supabase
        .from('conversations')
        .select('channel_id')
        .eq('id', conversationId)
        .single();
      finalChannelId = conversation?.channel_id;
    }

    if (!finalChannelId) {
      // Get first available channel
      const { data: channels } = await supabase
        .from('whatsapp_channels')
        .select('id')
        .eq('is_deleted', false)
        .limit(1);
      finalChannelId = channels?.[0]?.id;
    }

    if (!finalChannelId) {
      toast.error('Nenhum canal disponível');
      return;
    }

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      let mediaUrl: string | null = null;
      let messageType = 'text';

      // Upload audio if present (already converted to MP3)
      if (audioBlob) {
        messageType = 'audio';
        const audioFileName = `scheduled_audio_${Date.now()}.mp3`;
        const { data: audioData, error: audioError } = await supabase.storage
          .from('conversation-attachments')
          .upload(`scheduled/${audioFileName}`, audioBlob, {
            contentType: 'audio/mpeg',
            cacheControl: '3600'
          });
        
        if (audioError) {
          console.error('Audio upload error:', audioError);
          toast.error('Erro ao fazer upload do áudio');
          setIsLoading(false);
          return;
        }
        
        const { data: { publicUrl } } = supabase.storage
          .from('conversation-attachments')
          .getPublicUrl(`scheduled/${audioFileName}`);
        mediaUrl = publicUrl;
        console.log('Audio uploaded:', publicUrl);
      }

      // Upload first file if present (for now, we send one file per scheduled message)
      if (attachedFiles.length > 0 && !audioBlob) {
        const file = attachedFiles[0];
        messageType = file.type.startsWith('image/') ? 'image' : 
                      file.type.startsWith('audio/') ? 'audio' : 
                      file.type.startsWith('video/') ? 'video' : 'document';
        
        const fileExt = file.name.split('.').pop() || 'bin';
        const fileName = `scheduled_file_${Date.now()}.${fileExt}`;
        
        const { data: fileData, error: fileError } = await supabase.storage
          .from('conversation-attachments')
          .upload(`scheduled/${fileName}`, file, {
            contentType: file.type,
            cacheControl: '3600'
          });
        
        if (fileError) {
          console.error('File upload error:', fileError);
          toast.error('Erro ao fazer upload do arquivo');
          setIsLoading(false);
          return;
        }
        
        const { data: { publicUrl } } = supabase.storage
          .from('conversation-attachments')
          .getPublicUrl(`scheduled/${fileName}`);
        mediaUrl = publicUrl;
        console.log('File uploaded:', publicUrl);
      }

      // Add signature if enabled in profile
      let finalMessage = message;
      if (message) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, signature_name, signature_enabled')
          .eq('id', user?.id)
          .single();
        
        const signatureName = profile?.signature_name || profile?.full_name;
        const signatureEnabled = profile?.signature_enabled !== false;
        if (signatureEnabled && signatureName) {
          finalMessage = `*${signatureName}*:\n${message}`;
        }
      }

      // Create scheduled message
      const { error } = await supabase
        .from('scheduled_messages')
        .insert({
          contact_id: contactId,
          conversation_id: conversationId,
          channel_id: finalChannelId,
          content: finalMessage || '',
          media_url: mediaUrl,
          message_type: messageType,
          scheduled_for: scheduledFor.toISOString(),
          status: 'scheduled',
          created_by: user?.id
        });

      if (error) throw error;

      toast.success('Mensagem agendada!');
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages', contactId] });
      
      // Reset form
      setMessage('');
      setScheduledDate('');
      setScheduledTime('');
      deleteRecording();
      clearAllFiles();
      setActiveTab('scheduled');
      
    } catch (error) {
      console.error(error);
      toast.error('Erro ao agendar mensagem');
    } finally {
      setIsLoading(false);
    }
  };

  // Cancel scheduled message
  const cancelScheduledMessage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('scheduled_messages')
        .update({ status: 'cancelled' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages', contactId] });
      toast.success('Agendamento cancelado');
    }
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full bg-background border-border max-h-[90vh] overflow-hidden flex flex-col p-6">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Calendar size={20} className="text-primary" />
            Agendamento de Mensagem
            {contactName && (
              <span className="text-muted-foreground text-sm font-normal">
                para {contactName}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="bg-muted mb-4 w-full grid grid-cols-2">
            <TabsTrigger value="new" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Nova Mensagem
            </TabsTrigger>
            <TabsTrigger value="scheduled" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Agendadas ({scheduledMessages.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="flex-1 overflow-y-auto space-y-4 mt-0">
            {/* Mode toggle */}
            <ToggleGroup
              type="single"
              value={mode}
              onValueChange={(v) => v && setMode(v as ScheduleMode)}
              className="justify-start"
            >
              <ToggleGroupItem value="free" aria-label="Mensagem livre" className="gap-2">
                <MessageSquare size={14} /> Mensagem Livre
              </ToggleGroupItem>
              <ToggleGroupItem value="template" aria-label="Template Meta" className="gap-2">
                <Sparkles size={14} /> Template Meta
              </ToggleGroupItem>
            </ToggleGroup>

            {/* Date and Time */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  <Calendar size={14} className="inline mr-1" />
                  Data
                </label>
                <Input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="bg-muted border-border"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  <Clock size={14} className="inline mr-1" />
                  Hora
                </label>
                <Input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="bg-muted border-border"
                />
              </div>
            </div>

            {mode === 'free' && (
            <>
            {/* Message Input with Toolbar */}
            <div className="bg-muted rounded-xl border border-border overflow-hidden">
              {/* Toolbar */}
              <div className="flex items-center gap-1 p-2 border-b border-border">
                {/* Attach File */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 hover:bg-accent rounded-lg transition-colors"
                  title="Anexar arquivo"
                >
                  <Paperclip size={18} className="text-muted-foreground" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
                />

                {/* Emoji */}
                <div className="relative">
                  <button
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="p-2 hover:bg-accent rounded-lg transition-colors"
                    title="Emoji"
                  >
                    <Smile size={18} className="text-muted-foreground" />
                  </button>
                  {showEmojiPicker && (
                    <>
                      {/* Overlay to close emoji picker */}
                      <div 
                        className="fixed inset-0 z-[100] bg-black/20" 
                        onClick={() => setShowEmojiPicker(false)}
                      />
                      {/* Emoji picker centered on screen */}
                      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] shadow-2xl rounded-lg overflow-hidden">
                        <EmojiPicker
                          onEmojiClick={handleEmojiSelect}
                          width={400}
                          height={500}
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Templates */}
                <div className="relative group">
                  <button
                    className="p-2 hover:bg-accent rounded-lg transition-colors"
                    title="Mensagens rápidas"
                  >
                    <FileText size={18} className="text-muted-foreground" />
                  </button>
                  {/* Templates Dropdown */}
                  <div className="absolute left-0 top-full mt-1 w-64 bg-popover border border-border rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                    <div className="p-2 border-b border-border">
                      <span className="text-xs text-muted-foreground">Mensagens Rápidas</span>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {templates.length === 0 ? (
                        <p className="p-3 text-sm text-muted-foreground text-center">
                          Nenhum template disponível
                        </p>
                      ) : (
                        templates.map((template) => (
                          <button
                            key={template.id}
                            onClick={() => handleTemplateSelect(template)}
                            className="w-full text-left p-2 hover:bg-accent text-sm text-foreground truncate"
                          >
                            {template.title}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Audio Record */}
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`p-2 rounded-lg transition-colors ${
                    isRecording 
                      ? 'bg-destructive hover:bg-destructive/90' 
                      : 'hover:bg-accent'
                  }`}
                  title={isRecording ? 'Parar gravação' : 'Gravar áudio'}
                >
                  {isRecording ? (
                    <MicOff size={18} className="text-destructive-foreground" />
                  ) : (
                    <Mic size={18} className="text-muted-foreground" />
                  )}
                </button>

                {isRecording && (
                  <span className="text-destructive text-sm animate-pulse">
                    ● {formatTime(recordingTime)}
                  </span>
                )}

                {/* Spacer */}
                <div className="flex-1" />
              </div>

              {/* Audio Preview */}
              {audioUrl && (
                <div className="flex items-center gap-3 p-3 bg-accent/50 border-b border-border">
                  <audio src={audioUrl} controls className="flex-1 h-8" />
                  <button
                    onClick={deleteRecording}
                    className="p-1 hover:bg-destructive/20 rounded"
                  >
                    <Trash2 size={16} className="text-destructive" />
                  </button>
                </div>
              )}

              {/* Files Preview */}
              {attachedFiles.length > 0 && (
                <div className="p-3 bg-accent/50 border-b border-border space-y-2">
                  {attachedFiles.map((file, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <Paperclip size={16} className="text-primary flex-shrink-0" />
                      <span className="flex-1 text-sm text-foreground truncate">
                        {file.name}
                      </span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                      <button
                        onClick={() => removeFile(index)}
                        className="p-1 hover:bg-destructive/20 rounded flex-shrink-0"
                      >
                        <X size={16} className="text-destructive" />
                      </button>
                    </div>
                  ))}
                  {attachedFiles.length > 1 && (
                    <button
                      onClick={clearAllFiles}
                      className="text-xs text-destructive hover:underline"
                    >
                      Remover todos
                    </button>
                  )}
                </div>
              )}

              {/* Text Input */}
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Digite sua mensagem..."
                className="border-0 bg-transparent min-h-[200px] flex-1 resize-none focus-visible:ring-0"
              />
            </div>

            {/* Schedule Button */}
            <Button
              onClick={handleSchedule}
              disabled={isLoading || (!message && !audioBlob && attachedFiles.length === 0) || !scheduledDate || !scheduledTime}
              className="w-full gap-2"
            >
              {isLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
              Agendar Mensagem
            </Button>
            </>
            )}

            {mode === 'template' && (
            <>
              {/* Template selector */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Template aprovado</Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger className="bg-muted border-border">
                    <SelectValue placeholder={isLoadingTemplates ? 'Carregando...' : 'Selecione um template'} />
                  </SelectTrigger>
                  <SelectContent>
                    {approvedTemplates.length === 0 && !isLoadingTemplates && (
                      <div className="p-3 text-sm text-muted-foreground text-center">
                        Nenhum template aprovado. Sincronize em Configurações &gt; Meta Templates.
                      </div>
                    )}
                    {approvedTemplates.map((tpl) => (
                      <SelectItem key={tpl.id} value={tpl.id}>
                        <span className="font-medium">{tpl.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {tpl.language} · {tpl.category}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Media URL (when required) */}
              {needsTemplateMediaUrl && (
                <div className="space-y-2 rounded-lg border border-border bg-muted p-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <ImageIcon size={14} />
                    URL da {templateDetails?.headerFormat === 'IMAGE' ? 'imagem' : templateDetails?.headerFormat === 'VIDEO' ? 'vídeo' : 'documento'} do cabeçalho
                    <span className="text-xs text-destructive">*obrigatório</span>
                  </Label>
                  <Input
                    placeholder="https://exemplo.com/imagem.jpg"
                    value={templateHeaderMediaUrl}
                    onChange={(e) => setTemplateHeaderMediaUrl(e.target.value)}
                    className="bg-background border-border"
                  />
                </div>
              )}

              {/* Variables */}
              {selectedTemplate && templateVarCount > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Preencha as variáveis</Label>
                  <div className="grid gap-2">
                    {Array.from({ length: templateVarCount }, (_, i) => i + 1).map((num) => (
                      <div key={num} className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground w-12">{`{{${num}}}`}</span>
                        <Input
                          placeholder={num === 1 && contactName ? contactName : `Valor para {{${num}}}`}
                          value={templateVars[String(num)] || ''}
                          onChange={(e) => handleTemplateVarChange(String(num), e.target.value)}
                          className="flex-1 bg-muted border-border"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview */}
              {selectedTemplate && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Preview</Label>
                  <div className="bg-muted/50 rounded-lg p-4 border border-border">
                    <div className="bg-[#dcf8c6] dark:bg-green-800/30 rounded-lg p-3 max-w-sm ml-auto shadow-sm">
                      {(templateDetails?.hasMediaHeader) && (
                        <div className="mb-2 text-xs text-muted-foreground italic flex items-center gap-1">
                          <ImageIcon size={12} />
                          Mídia do cabeçalho
                        </div>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{templatePreview}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Info */}
              <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-2 border border-border">
                Templates Meta podem ser enviados mesmo fora da janela de 24 horas.
                Requerem canal WhatsApp Cloud API oficial.
              </div>

              <Button
                onClick={handleScheduleTemplate}
                disabled={
                  isLoading ||
                  !selectedTemplate ||
                  !scheduledDate ||
                  !scheduledTime
                }
                className="w-full gap-2"
              >
                {isLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Send size={18} />
                )}
                Agendar Template
              </Button>
            </>
            )}
          </TabsContent>

          <TabsContent value="scheduled" className="flex-1 overflow-y-auto mt-0">
            {/* Scheduled Messages List */}
            {scheduledMessages.length === 0 ? (
              <div className="text-center py-8">
                <Calendar size={40} className="mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">Nenhuma mensagem agendada</p>
              </div>
            ) : (
              <div className="space-y-3">
                {scheduledMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className="p-4 bg-muted rounded-xl border border-border"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 text-sm text-primary">
                        <Calendar size={14} />
                        {new Date(msg.scheduled_for).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                        {msg.message_type === 'template' && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] uppercase tracking-wide">
                            <Sparkles size={10} /> Template
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => cancelScheduledMessage.mutate(msg.id)}
                        className="p-1 hover:bg-destructive/20 rounded"
                        title="Cancelar agendamento"
                      >
                        <X size={16} className="text-destructive" />
                      </button>
                    </div>
                    {msg.content && (
                      <p className="text-foreground text-sm line-clamp-3">{msg.content}</p>
                    )}
                    {msg.media_url && (
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Paperclip size={12} />
                        <span>Mídia anexada</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
