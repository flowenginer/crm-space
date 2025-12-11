import { useState } from 'react';
import { Reply, Download, Play, Pause, File, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { InternalChatMessage, useDeleteInternalMessage } from '@/hooks/useInternalChat';

interface InternalChatMessageItemProps {
  message: InternalChatMessage;
  showAvatar: boolean;
  showDate: boolean;
  onReply: () => void;
  threadId: string;
}

export function InternalChatMessageItem({ 
  message, 
  showAvatar, 
  showDate,
  onReply,
  threadId
}: InternalChatMessageItemProps) {
  const { user } = useAuth();
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const deleteMessage = useDeleteInternalMessage();
  
  const isFromMe = message.sender_id === user?.id;

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatAudioTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayAudio = () => {
    if (!message.media_url) return;

    if (audioElement) {
      if (isPlaying) {
        audioElement.pause();
        setIsPlaying(false);
      } else {
        audioElement.play();
        setIsPlaying(true);
      }
    } else {
      const audio = new Audio(message.media_url);
      
      audio.onloadedmetadata = () => {
        setAudioDuration(audio.duration);
      };
      
      audio.ontimeupdate = () => {
        if (audio.duration > 0) {
          setAudioProgress((audio.currentTime / audio.duration) * 100);
          setCurrentTime(audio.currentTime);
        }
      };
      
      audio.onended = () => {
        setIsPlaying(false);
        setAudioProgress(0);
        setCurrentTime(0);
      };
      
      audio.play();
      setAudioElement(audio);
      setIsPlaying(true);
    }
  };

  const renderContent = () => {
    if (message.is_deleted) {
      return (
        <p className="text-sm italic text-muted-foreground">
          Mensagem apagada
        </p>
      );
    }

    switch (message.message_type) {
      case 'image':
        return (
          <div className="space-y-2">
            <img 
              src={message.media_url || ''} 
              alt={message.media_name || 'Imagem'}
              className="max-w-[300px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => window.open(message.media_url || '', '_blank')}
            />
            {message.content && (
              <p className="text-sm">{message.content}</p>
            )}
          </div>
        );

      case 'video':
        return (
          <div className="space-y-2">
            <video 
              src={message.media_url || ''} 
              controls
              className="max-w-[300px] rounded-lg"
            />
            {message.content && (
              <p className="text-sm">{message.content}</p>
            )}
          </div>
        );

      case 'audio':
        return (
          <div className="flex items-center gap-3 min-w-[200px]">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full shrink-0"
              onClick={handlePlayAudio}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
              )}
            </Button>
            <div className="flex-1">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-100"
                  style={{ width: `${audioProgress}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground mt-1">
                {audioDuration > 0 
                  ? formatAudioTime(currentTime) + ' / ' + formatAudioTime(audioDuration)
                  : 'Áudio'}
              </span>
            </div>
          </div>
        );

      case 'document':
        return (
          <a 
            href={message.media_url || '#'} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
          >
            <File className="h-8 w-8 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {message.media_name || 'Documento'}
              </p>
              <p className="text-xs text-muted-foreground">
                Clique para baixar
              </p>
            </div>
            <Download className="h-4 w-4 text-muted-foreground" />
          </a>
        );

      default:
        return <p className="text-sm whitespace-pre-wrap">{message.content}</p>;
    }
  };

  return (
    <>
      {/* Date separator */}
      {showDate && (
        <div className="flex items-center justify-center my-4">
          <span className="px-3 py-1 text-xs text-muted-foreground bg-muted rounded-full">
            {format(new Date(message.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </span>
        </div>
      )}

      <div className={cn(
        'flex gap-2 group',
        isFromMe ? 'justify-end pr-4' : 'justify-start pl-2'
      )}>
        {/* Avatar (apenas para mensagens de outros) */}
        {!isFromMe && showAvatar && (
          <Avatar className="h-8 w-8 mt-1">
            <AvatarImage src={message.sender?.avatar_url || ''} />
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {getInitials(message.sender?.full_name)}
            </AvatarFallback>
          </Avatar>
        )}
        {!isFromMe && !showAvatar && <div className="w-8" />}

        <div className={cn(
          'max-w-[70%] relative',
          isFromMe ? 'items-end' : 'items-start'
        )}>
          {/* Reply reference */}
          {message.reply_to_message && (
            <div className={cn(
              'text-xs px-3 py-1.5 rounded-t-lg border-l-2 mb-1',
              isFromMe 
                ? 'bg-primary/20 border-primary/50 text-right' 
                : 'bg-muted border-muted-foreground/30'
            )}>
              <span className="font-medium">
                {message.reply_to_message.sender?.full_name}
              </span>
              <p className="truncate opacity-70">
                {message.reply_to_message.content || 'Mídia'}
              </p>
            </div>
          )}

          {/* Message bubble */}
          <div className={cn(
            'px-4 py-2 rounded-2xl',
            isFromMe 
              ? 'bg-primary text-primary-foreground rounded-br-md' 
              : 'bg-muted rounded-bl-md'
          )}>
            {/* Sender name (apenas para mensagens de outros quando showAvatar) */}
            {!isFromMe && showAvatar && (
              <p className="text-xs font-medium text-primary mb-1">
                {message.sender?.full_name}
              </p>
            )}

            {renderContent()}

            {/* Time */}
            <p className={cn(
              'text-[10px] mt-1',
              isFromMe ? 'text-primary-foreground/70 text-right' : 'text-muted-foreground'
            )}>
              {format(new Date(message.created_at), 'HH:mm')}
            </p>
          </div>

          {/* Action buttons */}
          <div className={cn(
            'absolute top-0 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity',
            isFromMe ? '-left-16' : '-right-16'
          )}>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onReply}
              title="Responder"
            >
              <Reply className="h-3 w-3" />
            </Button>
            {isFromMe && !message.is_deleted && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={() => deleteMessage.mutate({ messageId: message.id, threadId })}
                title="Apagar"
                disabled={deleteMessage.isPending}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
