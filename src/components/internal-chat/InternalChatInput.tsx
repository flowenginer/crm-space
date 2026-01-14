import { useState, useRef, useCallback } from 'react';
import { 
  Send, 
  Paperclip, 
  Image, 
  Mic, 
  X, 
  Smile,
  FileText,
  Video,
  StopCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { 
  useSendInternalMessage, 
  useUploadInternalChatMedia,
  InternalChatMessage 
} from '@/hooks/useInternalChat';
import { toast } from 'sonner';

interface InternalChatInputProps {
  threadId: string | null;
  replyingTo: InternalChatMessage | null;
  onCancelReply: () => void;
  onStartChat: () => Promise<string | null>;
}

export function InternalChatInput({ 
  threadId, 
  replyingTo, 
  onCancelReply,
  onStartChat 
}: InternalChatInputProps) {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [emojiOpen, setEmojiOpen] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  
  // CRÍTICO: useRef para bloqueio instantâneo - previne race condition
  const isSendingRef = useRef(false);

  const { theme } = useTheme();
  const sendMessage = useSendInternalMessage();
  const uploadMedia = useUploadInternalChatMedia();

  const handleSend = async () => {
    if (!message.trim() && !replyingTo) return;
    
    // Verificação instantânea com ref - bloqueia ANTES de qualquer operação async
    if (isSendingRef.current) return;
    isSendingRef.current = true;

    const messageToSend = message.trim();
    setMessage('');
    onCancelReply();

    try {
      let currentThreadId = threadId;
      if (!currentThreadId) {
        currentThreadId = await onStartChat();
        if (!currentThreadId) {
          setMessage(messageToSend);
          return;
        }
      }

      await sendMessage.mutateAsync({
        threadId: currentThreadId,
        content: messageToSend,
        messageType: 'text',
        replyToMessageId: replyingTo?.id
      });
    } catch (error) {
      setMessage(messageToSend);
    } finally {
      isSendingRef.current = false;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = useCallback(async (file: File, type: 'image' | 'video' | 'document' | 'audio') => {
    // Verificação instantânea com ref
    if (isSendingRef.current) return;
    isSendingRef.current = true;

    try {
      let currentThreadId = threadId;
      if (!currentThreadId) {
        currentThreadId = await onStartChat();
        if (!currentThreadId) return;
      }

      const result = await uploadMedia.mutateAsync(file);

      await sendMessage.mutateAsync({
        threadId: currentThreadId,
        content: undefined,
        messageType: type,
        mediaUrl: result.url,
        mediaName: result.name,
        mediaMimeType: result.mimeType,
        replyToMessageId: replyingTo?.id
      });

      setMessage('');
      onCancelReply();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Erro ao enviar arquivo');
    } finally {
      isSendingRef.current = false;
    }
  }, [threadId, onStartChat, uploadMedia, sendMessage, replyingTo?.id, onCancelReply]);

  // Mp3Recorder for direct MP3 recording
  const mp3RecorderRef = useRef<any>(null);
  
  const startRecording = async () => {
    try {
      const { Mp3Recorder } = await import('@/lib/audio/mp3-recorder');
      mp3RecorderRef.current = new Mp3Recorder();
      await mp3RecorderRef.current.start();
      
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);

    } catch (error) {
      console.error('[InternalChat] Recording error:', error);
      toast.error('Erro ao acessar microfone');
    }
  };

  const stopRecording = async () => {
    if (!mp3RecorderRef.current) return;
    
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    try {
      const mp3Blob = mp3RecorderRef.current.stop();
      const audioFile = new File([mp3Blob], `audio_${Date.now()}.mp3`, { type: 'audio/mpeg' });
      console.log('[InternalChat] MP3 recorded, size:', mp3Blob.size);
      mp3RecorderRef.current = null;
      await handleFileUpload(audioFile, 'audio');
    } catch (error) {
      console.error('[InternalChat] Error sending audio:', error);
      toast.error('Erro ao enviar áudio');
    }
  };

  const cancelRecording = () => {
    if (mp3RecorderRef.current) {
      mp3RecorderRef.current.cancel();
      mp3RecorderRef.current = null;
    }
    setIsRecording(false);
    setRecordingTime(0);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    toast.info('Gravação cancelada');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEmojiClick = (emojiData: any) => {
    setMessage(prev => prev + emojiData.emoji);
    setEmojiOpen(false);
  };

  const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const clipboardData = e.clipboardData;
    if (!clipboardData || !clipboardData.items) return;

    for (let i = 0; i < clipboardData.items.length; i++) {
      const item = clipboardData.items[i];
      
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          
          const maxSize = 10 * 1024 * 1024;
          if (file.size > maxSize) {
            toast.error('Imagem muito grande. Máximo: 10MB');
            return;
          }
          
          const extension = item.type.split('/')[1] || 'png';
          const fileName = `screenshot_${Date.now()}.${extension}`;
          const renamedFile = new File([file], fileName, { type: file.type });
          
          toast.info('Enviando imagem...');
          await handleFileUpload(renamedFile, 'image');
          return;
        }
      }
    }
  }, [handleFileUpload]);

  return (
    <div className="border-t border-border bg-card p-4">
      {/* Reply preview */}
      {replyingTo && (
        <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-muted rounded-lg">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-primary">
              Respondendo a {replyingTo.sender?.full_name}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {replyingTo.content || 'Mídia'}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCancelReply}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <div className="flex items-center gap-3 mb-2 px-3 py-2 bg-destructive/10 rounded-lg">
          <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
          <span className="text-sm font-medium">Gravando... {formatTime(recordingTime)}</span>
          <div className="flex items-center gap-1 ml-auto">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={cancelRecording}
              title="Cancelar"
            >
              <X className="h-5 w-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-primary"
              onClick={stopRecording}
              title="Enviar"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2">
        {/* Attachment menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
              <Paperclip className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => imageInputRef.current?.click()}>
              <Image className="h-4 w-4 mr-2" />
              Imagem
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => videoInputRef.current?.click()}>
              <Video className="h-4 w-4 mr-2" />
              Vídeo
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
              <FileText className="h-4 w-4 mr-2" />
              Documento
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Hidden file inputs */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'image')}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'video')}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], 'document')}
        />

        {/* Emoji picker */}
        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
              <Smile className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <EmojiPicker 
              onEmojiClick={handleEmojiClick}
              theme={theme === 'dark' ? Theme.DARK : Theme.LIGHT}
              width={320}
              height={400}
            />
          </PopoverContent>
        </Popover>

        {/* Text input */}
        <Textarea
          placeholder="Digite sua mensagem... (Ctrl+V para colar imagens)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          className="min-h-[44px] max-h-[120px] resize-none"
          rows={1}
        />

        {/* Audio or Send button */}
        {message.trim() ? (
          <Button 
            size="icon" 
            className="h-10 w-10 shrink-0"
            onClick={handleSend}
            disabled={sendMessage.isPending}
          >
            <Send className="h-5 w-5" />
          </Button>
        ) : (
          <Button 
            variant="ghost"
            size="icon" 
            className={cn(
              "h-10 w-10 shrink-0",
              isRecording && "text-destructive"
            )}
            onClick={isRecording ? stopRecording : startRecording}
          >
            {isRecording ? <StopCircle className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
        )}
      </div>
    </div>
  );
}
