import { useState, useRef, useEffect } from "react";
import { Send, Paperclip, Smile, Mic, Image, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { MobileHeader } from "./MobileHeader";

interface Message {
  id: string;
  content: string;
  is_from_me: boolean;
  created_at: string;
  status?: string;
  message_type?: string;
}

interface Contact {
  id: string;
  full_name: string;
  phone: string;
  avatar_url?: string;
}

interface MobileChatAreaProps {
  contact?: Contact;
  messages: Message[];
  onSend: (content: string) => void;
  onBack?: () => void;
  isLoading?: boolean;
}

export function MobileChatArea({
  contact,
  messages,
  onSend,
  onBack,
  isLoading,
}: MobileChatAreaProps) {
  const [message, setMessage] = useState("");
  const [showActions, setShowActions] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (message.trim()) {
      onSend(message.trim());
      setMessage("");
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-muted/20 text-muted-foreground">
        <div className="text-center p-8">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Send className="h-8 w-8" />
          </div>
          <h3 className="font-medium text-foreground mb-1">
            Selecione uma conversa
          </h3>
          <p className="text-sm">
            Deslize para a esquerda para ver suas conversas
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <MobileHeader
        title={contact.full_name}
        subtitle={contact.phone}
        avatarUrl={contact.avatar_url}
        showBack={!!onBack}
        onBack={onBack}
        onMore={() => {}}
      />

      {/* Messages */}
      <ScrollArea className="flex-1 px-4" ref={scrollRef}>
        <div className="py-4 space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "max-w-[75%] p-3 rounded-2xl animate-pulse",
                    i % 2 === 0
                      ? "bg-muted ml-auto rounded-br-sm"
                      : "bg-muted rounded-bl-sm"
                  )}
                >
                  <div className="h-4 bg-muted-foreground/20 rounded w-full" />
                </div>
              ))}
            </div>
          ) : (
            messages.map((msg, index) => {
              const showTime =
                index === 0 ||
                new Date(msg.created_at).getTime() -
                  new Date(messages[index - 1].created_at).getTime() >
                  300000;

              return (
                <div key={msg.id}>
                  {showTime && (
                    <div className="text-center my-4">
                      <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                        {format(new Date(msg.created_at), "HH:mm")}
                      </span>
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[75%] p-3 rounded-2xl",
                      msg.is_from_me
                        ? "bg-primary text-primary-foreground ml-auto rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                    <div
                      className={cn(
                        "flex items-center justify-end gap-1 mt-1",
                        msg.is_from_me
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground"
                      )}
                    >
                      <span className="text-[10px]">
                        {format(new Date(msg.created_at), "HH:mm")}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="border-t border-border p-3 safe-area-inset-bottom bg-background">
        {showActions && (
          <div className="flex gap-2 mb-3 pb-3 border-b border-border">
            <Button variant="ghost" size="sm" className="flex-1">
              <Image className="h-4 w-4 mr-2" />
              Foto
            </Button>
            <Button variant="ghost" size="sm" className="flex-1">
              <Paperclip className="h-4 w-4 mr-2" />
              Arquivo
            </Button>
            <Button variant="ghost" size="sm" className="flex-1">
              <Mic className="h-4 w-4 mr-2" />
              Áudio
            </Button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => setShowActions(!showActions)}
          >
            <Paperclip className="h-5 w-5" />
          </Button>

          <div className="flex-1 relative">
            <Textarea
              ref={inputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Digite uma mensagem..."
              className="min-h-[44px] max-h-32 resize-none pr-10"
              rows={1}
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 bottom-1 h-8 w-8"
            >
              <Smile className="h-5 w-5 text-muted-foreground" />
            </Button>
          </div>

          <Button
            size="icon"
            className="shrink-0 h-11 w-11 rounded-full"
            onClick={handleSend}
            disabled={!message.trim()}
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
