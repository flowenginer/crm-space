import { useState, useEffect, useRef } from 'react';
import { MessageSquare } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { InternalChatHeader } from './InternalChatHeader';
import { InternalChatInput } from './InternalChatInput';
import { InternalChatMessageItem } from './InternalChatMessageItem';
import { 
  useInternalChatMessages, 
  useMarkThreadAsRead,
  useStartInternalChat,
  InternalChatMessage
} from '@/hooks/useInternalChat';
import { Skeleton } from '@/components/ui/skeleton';

interface InternalChatAreaProps {
  threadId: string | null;
  otherUserId: string | null;
  onThreadCreated: (threadId: string) => void;
}

export function InternalChatArea({ threadId, otherUserId, onThreadCreated }: InternalChatAreaProps) {
  const [replyingTo, setReplyingTo] = useState<InternalChatMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { data: messages, isLoading } = useInternalChatMessages(threadId);
  const markAsRead = useMarkThreadAsRead();
  const startChat = useStartInternalChat();

  // Scroll para o final quando novas mensagens chegam
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Marcar como lido quando selecionar thread
  useEffect(() => {
    if (threadId) {
      markAsRead.mutate(threadId);
    }
  }, [threadId]);

  const handleStartChatAndSend = async () => {
    if (otherUserId && !threadId) {
      const newThreadId = await startChat.mutateAsync(otherUserId);
      onThreadCreated(newThreadId);
      return newThreadId;
    }
    return threadId;
  };

  // Estado vazio - nenhuma conversa selecionada
  if (!threadId && !otherUserId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">Chat Interno</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Selecione uma conversa ou inicie uma nova conversa com um membro da equipe
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background min-h-0 overflow-hidden">
      {/* Header */}
      <InternalChatHeader otherUserId={otherUserId} />

      {/* Messages Area */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4">
          {isLoading ? (
            <div className="space-y-4">
              {Array(5).fill(0).map((_, i) => (
                <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                  <div className="flex gap-2 max-w-[70%]">
                    {i % 2 === 0 && <Skeleton className="h-8 w-8 rounded-full" />}
                    <Skeleton className="h-16 w-48 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          ) : messages?.length === 0 ? (
            <div className="h-full flex items-center justify-center py-20">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Nenhuma mensagem ainda. Inicie a conversa!
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages?.map((message, index) => {
                const prevMessage = messages[index - 1];
                const showAvatar = !prevMessage || prevMessage.sender_id !== message.sender_id;
                const showDate = !prevMessage || 
                  new Date(message.created_at).toDateString() !== new Date(prevMessage.created_at).toDateString();

                return (
                  <InternalChatMessageItem
                    key={message.id}
                    message={message}
                    showAvatar={showAvatar}
                    showDate={showDate}
                    onReply={() => setReplyingTo(message)}
                    threadId={threadId!}
                  />
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <InternalChatInput
        threadId={threadId}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        onStartChat={handleStartChatAndSend}
      />
    </div>
  );
}
