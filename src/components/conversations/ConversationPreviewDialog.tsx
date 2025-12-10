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
  X,
  ExternalLink,
  Phone,
  Loader2,
  Image as ImageIcon,
  FileText,
  Mic,
  Video,
  Lock,
  ChevronUp,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

export function ConversationPreviewDialog({
  conversationId,
  isOpen,
  onClose,
}: ConversationPreviewDialogProps) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

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
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);

  // Handle scroll to show "scroll to top" button
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    setShowScrollTop(target.scrollTop > 300);
  };

  const scrollToTop = () => {
    const scrollElement = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollElement) {
      scrollElement.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleGoToConversation = () => {
    if (conversationId) {
      onClose();
      navigate(`/conversations?id=${conversationId}`);
    }
  };

  const isLoading = conversationLoading || messagesLoading;

  const getMessageIcon = (type: string | null) => {
    switch (type) {
      case 'image':
        return <ImageIcon size={14} className="text-muted-foreground" />;
      case 'document':
        return <FileText size={14} className="text-muted-foreground" />;
      case 'audio':
      case 'ptt':
        return <Mic size={14} className="text-muted-foreground" />;
      case 'video':
        return <Video size={14} className="text-muted-foreground" />;
      default:
        return null;
    }
  };

  const renderMessageContent = (message: PreviewMessage) => {
    const icon = getMessageIcon(message.message_type);
    
    if (message.message_type === 'image' && message.media_url) {
      return (
        <div className="space-y-1">
          <img 
            src={message.media_url} 
            alt="Imagem" 
            className="max-w-[200px] rounded-lg"
          />
          {message.content && (
            <p className="text-sm">{message.content}</p>
          )}
        </div>
      );
    }

    if (message.message_type === 'audio' || message.message_type === 'ptt') {
      return (
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm italic">Mensagem de áudio</span>
        </div>
      );
    }

    if (message.message_type === 'video') {
      return (
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm italic">Vídeo</span>
        </div>
      );
    }

    if (message.message_type === 'document') {
      return (
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm">{message.content || 'Documento'}</span>
        </div>
      );
    }

    return <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>;
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl w-[95vw] h-[80vh] p-0 overflow-hidden flex flex-col gap-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold">
              {conversation?.contact?.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div>
              <h3 className="font-semibold text-foreground">
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
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X size={18} />
          </Button>
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
              className="absolute top-4 left-1/2 -translate-x-1/2 p-2 bg-card border border-border rounded-full shadow-lg hover:bg-muted transition-colors"
            >
              <ChevronUp size={16} />
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
  );
}
