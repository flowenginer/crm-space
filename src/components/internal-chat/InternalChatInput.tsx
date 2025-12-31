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
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const shouldSendAudioRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const { theme } = useTheme();
  const sendMessage = useSendInternalMessage();
  const uploadMedia = useUploadInternalChatMedia();

  const handleSend = async () => {
    if (!message.trim() && !replyingTo) return;
    if (sendMessage.isPending) return; // Prevenir envio duplicado

    const messageToSend = message.trim();
    setMessage(''); // Limpa imediatamente para feedback
    onCancelReply();

    let currentThreadId = threadId;
    if (!currentThreadId) {
      currentThreadId = await onStartChat();
      if (!currentThreadId) {
        setMessage(messageToSend); // Restaura se falhou
        return;
      }
    }

    try {
      await sendMessage.mutateAsync({
        threadId: currentThreadId,
        content: messageToSend,
        messageType: 'text',
        replyToMessageId: replyingTo?.id
      });
    } catch (error) {
      setMessage(messageToSend); // Restaura se falhou
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendMessage.isPending) {
        handleSend();
      }
    }
  };

  const handleFileUpload = useCallback(async (file: File, type: 'image' | 'video' | 'document' | 'audio') => {
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
    }
  }, [threadId, onStartChat, uploadMedia, sendMessage, replyingTo?.id, onCancelReply]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      shouldSendAudioRef.current = true;

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        
        // Só envia se não foi cancelado
        if (shouldSendAudioRef.current && audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const audioFile = new File([audioBlob], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
          await handleFileUpload(audioFile, 'audio');
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);

    } catch (error) {
      toast.error('Erro ao acessar microfone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      shouldSendAudioRef.current = true;
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      shouldSendAudioRef.current = false;
      mediaRecorderRef.current.stop();
    }
    audioChunksRef.current = [];
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
