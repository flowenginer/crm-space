import { useState } from "react";
import { Search, Filter, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Conversation {
  id: string;
  contact: {
    id: string;
    full_name: string;
    phone: string;
    avatar_url?: string;
  };
  last_message_preview?: string;
  last_message_at?: string;
  unread_count?: number;
  status?: string;
}

interface MobileContactsListProps {
  conversations: Conversation[];
  selectedId?: string;
  onSelect: (conversation: Conversation) => void;
  isLoading?: boolean;
}

export function MobileContactsList({
  conversations,
  selectedId,
  onSelect,
  isLoading,
}: MobileContactsListProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "mine">("all");

  const filtered = conversations.filter((conv) => {
    const matchesSearch =
      conv.contact.full_name.toLowerCase().includes(search.toLowerCase()) ||
      conv.contact.phone.includes(search);

    if (filter === "unread") {
      return matchesSearch && (conv.unread_count || 0) > 0;
    }
    return matchesSearch;
  });

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border space-y-3 safe-area-inset-top">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">Conversas</h1>
          <Badge variant="secondary" className="font-mono">
            {filtered.length}
          </Badge>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar contato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {(["all", "unread", "mine"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
              className="flex-1"
            >
              {f === "all" ? "Todos" : f === "unread" ? "Não lidos" : "Meus"}
            </Button>
          ))}
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="h-12 w-12 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/2" />
                  <div className="h-3 bg-muted rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-3 opacity-50" />
            <p className="text-sm">Nenhuma conversa encontrada</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((conv) => {
              const initials = conv.contact.full_name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();

              return (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv)}
                  className={cn(
                    "w-full flex items-center gap-3 p-4 text-left transition-colors",
                    "hover:bg-muted/50 active:bg-muted",
                    selectedId === conv.id && "bg-primary/5"
                  )}
                >
                  <div className="relative">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={conv.contact.avatar_url} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    {(conv.unread_count || 0) > 0 && (
                      <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-[10px] font-bold bg-primary text-primary-foreground rounded-full">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground truncate">
                        {conv.contact.full_name}
                      </span>
                      {conv.last_message_at && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatDistanceToNow(new Date(conv.last_message_at), {
                            addSuffix: false,
                            locale: ptBR,
                          })}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {conv.last_message_preview || conv.contact.phone}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
