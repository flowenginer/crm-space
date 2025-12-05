import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calendar, Clock, Mic, MicOff, Paperclip, Smile, FileText,
  Send, X, Loader2, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import EmojiPicker from 'emoji-picker-react';

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
  const [useSignature, setUseSignature] = useState(true);
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

  // ============================================
  // AUDIO RECORDING
  // ============================================
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      toast.error('Não foi possível acessar o microfone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
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
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`Arquivo "${file.name}" muito grande. Máximo 10MB.`);
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
      
      let mediaUrl = null;
      let messageType = 'text';

      // Note: File/audio upload would require storage bucket setup
      // For now, we'll just save the message content
      if (audioBlob) {
        messageType = 'audio';
        toast.info('Upload de áudio será implementado em breve');
      }

      if (attachedFiles.length > 0) {
        messageType = attachedFiles[0].type.startsWith('image/') ? 'image' : 'document';
        toast.info(`Upload de ${attachedFiles.length} arquivo(s) será implementado em breve`);
      }

      // Add signature if enabled
      let finalMessage = message;
      if (useSignature && message) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user?.id)
          .single();
        
        finalMessage = `${message}\n\n— ${profile?.full_name || 'Atendente'}`;
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
      <DialogContent className="max-w-2xl w-full bg-background border-border max-h-[90vh] overflow-hidden flex flex-col">
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
          <TabsList className="bg-muted mb-4">
            <TabsTrigger value="new" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Nova Mensagem
            </TabsTrigger>
            <TabsTrigger value="scheduled" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Agendadas ({scheduledMessages.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="flex-1 overflow-y-auto space-y-4 mt-0">
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
                  min={new Date().toISOString().split('T')[0]}
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
                        className="fixed inset-0 z-40" 
                        onClick={() => setShowEmojiPicker(false)}
                      />
                      <div className="absolute top-full left-0 mt-2 z-50">
                        <EmojiPicker
                          onEmojiClick={handleEmojiSelect}
                          width={380}
                          height={450}
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

                {/* Signature Toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Assinatura</span>
                  <Switch
                    checked={useSignature}
                    onCheckedChange={setUseSignature}
                  />
                </div>
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
                className="border-0 bg-transparent min-h-[100px] resize-none focus-visible:ring-0"
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
