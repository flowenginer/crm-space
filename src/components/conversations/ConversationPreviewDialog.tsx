import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MessageCircle,
  ExternalLink,
  Phone,
  Loader2,
  Lock,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ImagePreviewDialog } from './ImagePreviewDialog';
import { DocumentPreview } from './DocumentPreview';
import { MediaDownloadButton } from './MediaDownloadButton';
import { useRealtimeMessages } from '@/hooks/useRealtimeChat';

interface ConversationPreviewDialogProps {
  conversationId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

interface MessageReaction {
  emoji: string;
  from_me: boolean;
}

interface PreviewMessage {
  id: string;
  content: string | null;
  is_from_me: boolean | null;
  message_type: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  created_at: string;
  reactions: MessageReaction[] | null;
}

interface ConversationData {
  id: string;
  status: string | null;
  contact: {
    id: string;
    full_name: string;
    phone: string;
    avatar_url: string | null;
  } | null;
}

// Function to make URLs clickable
const linkifyText = (text: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  
  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:opacity-80 break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

export function ConversationPreviewDialog({
  conversationId,
  isOpen,
  onClose,
}: ConversationPreviewDialogProps) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Ativar subscription realtime quando o diálogo estiver aberto
  useRealtimeMessages(isOpen ? conversationId : null);

  // Fetch conversation details
  const { data: conversation, isLoading: conversationLoading } = useQuery({
    queryKey: ['conversation-preview', conversationId],
    queryFn: async () => {
      if (!conversationId) return null;
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          status,
          contact:contacts(id, full_name, phone, avatar_url)
        `)
        .eq('id', conversationId)
        .single();
      if (error) throw error;
      return data as ConversationData;
    },
    enabled: !!conversationId && isOpen,
  });

  // Fetch messages (read-only, no marking as read)
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['messages-preview', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          is_from_me,
          message_type,
          media_url,
          media_mime_type,
          created_at,
          reactions
        `)
        .eq('conversation_id', conversationId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })
        .limit(100);
      if (error) throw error;
      return (data || []).map(m => ({
        ...m,
        reactions: (m.reactions as unknown as MessageReaction[]) || null,
      })) as PreviewMessage[];
    },
    enabled: !!conversationId && isOpen,
  });

  // Scroll to bottom when messages load
  useEffect(() => {
    if (messages.length > 0 && scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        // Immediate scroll
        scrollElement.scrollTop = scrollElement.scrollHeight;
        // Retry after short delays for content still loading
        setTimeout(() => {
          scrollElement.scrollTop = scrollElement.scrollHeight;
        }, 150);
        setTimeout(() => {
          scrollElement.scrollTop = scrollElement.scrollHeight;
        }, 400);
      }
    }
  }, [messages]);

  // Handle scroll to show "scroll to top/bottom" buttons
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    setShowScrollTop(target.scrollTop > 300);
    setShowScrollBottom(distanceFromBottom > 200);
  };

  const scrollToTop = () => {
    const scrollElement = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollElement) {
      scrollElement.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToBottom = () => {
    const scrollElement = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollElement) {
      scrollElement.scrollTo({ top: scrollElement.scrollHeight, behavior: 'smooth' });
    }
  };

  const handleGoToConversation = () => {
    if (conversationId) {
      onClose();
      navigate(`/conversations?id=${conversationId}`);
    }
  };

  const isLoading = conversationLoading || messagesLoading;

  const renderMessageContent = (message: PreviewMessage) => {
    // Image with click to expand
    if (message.message_type === 'image' && message.media_url) {
      return (
        <div className="space-y-1">
          <div className="relative group/media">
            <img 
              src={message.media_url} 
              alt="Imagem" 
              className="max-w-[200px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setPreviewImage(message.media_url)}
            />
            <MediaDownloadButton url={message.media_url} fileName="imagem" />
          </div>
          {message.content && (
            <p className="text-sm whitespace-pre-wrap break-words">{linkifyText(message.content)}</p>
          )}
        </div>
      );
    }

    // Audio player
    if ((message.message_type === 'audio' || message.message_type === 'ptt') && message.media_url) {
      return (
        <div className="relative group/media flex items-center gap-2 min-w-[200px]">
          <audio 
            src={message.media_url} 
            controls 
            className="flex-1 h-10"
            preload="metadata"
          />
          <MediaDownloadButton url={message.media_url} fileName="audio" />
        </div>
      );
    }

    // Video player
    if (message.message_type === 'video' && message.media_url) {
      return (
        <div className="space-y-1">
          <div className="relative group/media">
            <video 
              src={message.media_url} 
              controls 
              className="rounded-lg max-h-64 max-w-[280px] bg-black"
              preload="metadata"
            />
            <MediaDownloadButton url={message.media_url} fileName="video" />
          </div>
          {message.content && (
            <p className="text-sm whitespace-pre-wrap break-words">{linkifyText(message.content)}</p>
          )}
        </div>
      );
    }

    // Document/PDF
    if (message.message_type === 'document' && message.media_url) {
      return (
        <DocumentPreview 
          url={message.media_url} 
          fileName={message.content || 'Documento'} 
          isMe={!!message.is_from_me}
        />
      );
    }

    // Sticker
    if (message.message_type === 'sticker' && message.media_url) {
      return (
        <img 
          src={message.media_url} 
          alt="Sticker" 
          className="max-h-32 w-auto object-contain"
          loading="lazy"
        />
      );
    }

    // Text message with linkify
    if (message.content) {
      return <p className="text-sm whitespace-pre-wrap break-words">{linkifyText(message.content)}</p>;
    }

    return null;
  };

  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, 'HH:mm', { locale: ptBR });
  };

  const formatMessageDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Hoje';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ontem';
    }
    return format(date, "dd 'de' MMMM", { locale: ptBR });
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const dateKey = formatMessageDate(message.created_at);
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(message);
    return groups;
  }, {} as Record<string, PreviewMessage[]>);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-2xl w-[95vw] h-[80vh] p-0 overflow-hidden flex flex-col gap-0">
          {/* Header - removed duplicate X button, using DialogContent's native close */}
          <div className="flex items-center gap-3 p-4 border-b bg-card">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold">
              {conversation?.contact?.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground truncate">
                {conversation?.contact?.full_name || 'Carregando...'}
              </h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone size={12} />
                <span>{conversation?.contact?.phone || '-'}</span>
                {conversation?.status && (
                  <>
                    <span>•</span>
                    <span className={`capitalize ${
                      conversation.status === 'open' ? 'text-green-500' : 
                      conversation.status === 'pending' ? 'text-amber-500' : 
                      'text-muted-foreground'
                    }`}>
                      {conversation.status === 'open' ? 'Aberta' : 
                       conversation.status === 'pending' ? 'Pendente' : 
                       conversation.status === 'closed' ? 'Fechada' : 
                       conversation.status}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 relative overflow-hidden bg-muted/30">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <MessageCircle size={48} className="mb-4 opacity-50" />
                <p>Nenhuma mensagem encontrada</p>
              </div>
            ) : (
              <ScrollArea 
                ref={scrollRef} 
                className="h-full"
                onScrollCapture={handleScroll}
              >
                <div className="p-4 space-y-4">
                  {Object.entries(groupedMessages).map(([date, dateMessages]) => (
                    <div key={date}>
                      {/* Date separator */}
                      <div className="flex items-center justify-center my-4">
                        <span className="px-3 py-1 bg-muted text-muted-foreground text-xs rounded-full">
                          {date}
                        </span>
                      </div>

                      {/* Messages */}
                      <div className="space-y-2">
                        {dateMessages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex ${message.is_from_me ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[75%] px-3 py-2 rounded-2xl ${
                                message.is_from_me
                                  ? 'bg-primary text-primary-foreground rounded-br-md'
                                  : 'bg-card text-foreground rounded-bl-md border border-border'
                              }`}
                            >
                              {renderMessageContent(message)}
                              <div className={`flex items-center gap-1 mt-1 ${
                                message.is_from_me ? 'justify-end' : 'justify-start'
                              }`}>
                                <span className={`text-[10px] ${
                                  message.is_from_me ? 'text-primary-foreground/70' : 'text-muted-foreground'
                                }`}>
                                  {formatMessageTime(message.created_at)}
                                </span>
                              </div>
                              {message.reactions && message.reactions.length > 0 && (
                                <div className="flex gap-1 mt-1">
                                  {message.reactions.map((reaction, idx) => (
                                    <span key={idx} className="text-sm">{reaction.emoji}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {/* Scroll to top button */}
            {showScrollTop && (
              <button
                onClick={scrollToTop}
                className="absolute top-4 left-1/2 -translate-x-1/2 p-2 bg-card border border-border rounded-full shadow-lg hover:bg-muted transition-colors z-10"
                title="Ir para o início"
              >
                <ChevronUp size={16} />
              </button>
            )}

            {/* Scroll to bottom button */}
            {showScrollBottom && (
              <button
                onClick={scrollToBottom}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 p-2 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-colors z-10"
                title="Ir para o final"
              >
                <ChevronDown size={16} />
              </button>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t bg-card flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Lock size={14} />
              <span>Modo somente visualização</span>
            </div>
            <Button onClick={handleGoToConversation} className="gap-2">
              <ExternalLink size={16} />
              Ir para conversa
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Preview Dialog */}
      <ImagePreviewDialog
        open={!!previewImage}
        onOpenChange={() => setPreviewImage(null)}
        imageUrl={previewImage || ''}
        imageName="imagem"
      />
    </>
  );
}
