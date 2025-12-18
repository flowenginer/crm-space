import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageSquare, Image, FileText, Mic, Video, File, Bot } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useConversationMessages, type ContactConversation } from '@/hooks/useContactConversationHistory';
import { cn } from '@/lib/utils';

interface ConversationHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: ContactConversation | null;
  contactName: string;
}

function MediaPreview({ type, url }: { type: string | null; url: string | null }) {
  if (!url) return null;

  if (type === 'image') {
    return (
      <div className="mt-2 max-w-[200px]">
        <img 
          src={url} 
          alt="Imagem" 
          className="rounded-lg w-full h-auto"
          loading="lazy"
        />
      </div>
    );
  }

  if (type === 'audio') {
    return (
      <div className="mt-2 flex items-center gap-2">
        <Mic className="w-4 h-4 text-muted-foreground" />
        <audio controls className="h-8 max-w-[200px]">
          <source src={url} />
        </audio>
      </div>
    );
  }

  if (type === 'video') {
    return (
      <div className="mt-2 max-w-[250px]">
        <video controls className="rounded-lg w-full">
          <source src={url} />
        </video>
      </div>
    );
  }

  if (type === 'document') {
    return (
      <a 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="mt-2 flex items-center gap-2 text-primary hover:underline text-sm"
      >
        <FileText className="w-4 h-4" />
        Ver documento
      </a>
    );
  }

  return (
    <a 
      href={url} 
      target="_blank" 
      rel="noopener noreferrer"
      className="mt-2 flex items-center gap-2 text-primary hover:underline text-sm"
    >
      <File className="w-4 h-4" />
      Ver arquivo
    </a>
  );
}

function getMediaIcon(type: string | null) {
  switch (type) {
    case 'image': return <Image className="w-3 h-3" />;
    case 'audio': return <Mic className="w-3 h-3" />;
    case 'video': return <Video className="w-3 h-3" />;
    case 'document': return <FileText className="w-3 h-3" />;
    default: return null;
  }
}

export function ConversationHistoryModal({
  open,
  onOpenChange,
  conversation,
  contactName,
}: ConversationHistoryModalProps) {
  const { data: messages = [], isLoading } = useConversationMessages(
    open && conversation ? conversation.id : null
  );

  if (!conversation) return null;

  const isAIAttended = !conversation.assigned_to_name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Conversa com {contactName}
          </DialogTitle>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground pt-2">
            {conversation.channel_name && (
              <Badge variant="outline" className="text-xs">
                📱 {conversation.channel_name}
              </Badge>
            )}
            <Badge 
              variant={conversation.status === 'closed' ? 'secondary' : 'default'}
              className="text-xs"
            >
              {conversation.status === 'closed' ? 'Fechada' : 
               conversation.status === 'pending' ? 'Aguardando' : 'Aberta'}
            </Badge>
            {isAIAttended ? (
              <span className="flex items-center gap-1">
                <Bot className="w-3 h-3" /> Atendido por IA
              </span>
            ) : (
              <span>Atendido por {conversation.assigned_to_name}</span>
            )}
            {conversation.close_reason && (
              <span className="text-xs">
                • Motivo: {conversation.close_reason}
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {format(new Date(conversation.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            {conversation.closed_at && (
              <> • Fechada em {format(new Date(conversation.closed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="h-[55vh] mt-4 pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mb-2 opacity-20" />
              <p>Nenhuma mensagem encontrada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg, index) => {
                const showDateSeparator = index === 0 || 
                  format(new Date(msg.created_at), 'yyyy-MM-dd') !== 
                  format(new Date(messages[index - 1].created_at), 'yyyy-MM-dd');

                return (
                  <div key={msg.id}>
                    {showDateSeparator && (
                      <div className="flex items-center justify-center my-4">
                        <div className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground">
                          {format(new Date(msg.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </div>
                      </div>
                    )}
                    <div className={cn(
                      "flex",
                      msg.is_from_me ? "justify-end" : "justify-start"
                    )}>
                      <div className={cn(
                        "max-w-[75%] rounded-lg px-3 py-2",
                        msg.is_from_me 
                          ? "bg-primary text-primary-foreground rounded-br-none" 
                          : "bg-muted rounded-bl-none"
                      )}>
                        {msg.is_from_me && msg.sender_name && (
                          <div className="text-xs opacity-70 mb-1">
                            {msg.sender_name}
                          </div>
                        )}
                        {msg.media_type && !msg.content && (
                          <div className="flex items-center gap-1 text-sm opacity-80">
                            {getMediaIcon(msg.media_type)}
                            <span>
                              {msg.media_type === 'image' ? 'Imagem' :
                               msg.media_type === 'audio' ? 'Áudio' :
                               msg.media_type === 'video' ? 'Vídeo' :
                               msg.media_type === 'document' ? 'Documento' : 'Arquivo'}
                            </span>
                          </div>
                        )}
                        {msg.content && (
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {msg.content}
                          </p>
                        )}
                        <MediaPreview type={msg.media_type} url={msg.media_url} />
                        <div className={cn(
                          "text-[10px] mt-1",
                          msg.is_from_me ? "text-primary-foreground/70" : "text-muted-foreground"
                        )}>
                          {format(new Date(msg.created_at), "HH:mm", { locale: ptBR })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
