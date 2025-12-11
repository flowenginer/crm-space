import { useState } from 'react';
import { Search, Users, MessageCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useInternalChatThreads, useTeamMembers, useStartInternalChat } from '@/hooks/useInternalChat';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

interface InternalChatSidebarProps {
  selectedThreadId: string | null;
  onSelectThread: (threadId: string | null, userId: string | null) => void;
}

export function InternalChatSidebar({ selectedThreadId, onSelectThread }: InternalChatSidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('conversations');
  
  const { data: threads, isLoading: threadsLoading } = useInternalChatThreads();
  const { data: teamMembers, isLoading: membersLoading } = useTeamMembers();
  const startChat = useStartInternalChat();

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const filteredThreads = threads?.filter(thread => 
    thread.other_user.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredMembers = teamMembers?.filter(member =>
    member.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleStartChat = async (userId: string) => {
    try {
      const threadId = await startChat.mutateAsync(userId);
      onSelectThread(threadId, userId);
      setActiveTab('conversations');
    } catch (error) {
      console.error('Error starting chat:', error);
    }
  };

  return (
    <div className="w-80 border-r border-border flex flex-col bg-card">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold mb-3">Chat Interno</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 mx-4 mt-2" style={{ width: 'calc(100% - 2rem)' }}>
          <TabsTrigger value="conversations" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            Conversas
          </TabsTrigger>
          <TabsTrigger value="contacts" className="gap-2">
            <Users className="h-4 w-4" />
            Contatos
          </TabsTrigger>
        </TabsList>

        {/* Conversations Tab */}
        <TabsContent value="conversations" className="flex-1 m-0">
          <ScrollArea className="h-[calc(100vh-14rem)]">
            <div className="p-2 space-y-1">
              {threadsLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-24 mb-2" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                ))
              ) : filteredThreads?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma conversa ainda</p>
                  <p className="text-xs mt-1">Inicie uma conversa na aba Contatos</p>
                </div>
              ) : (
                filteredThreads?.map((thread) => (
                  <button
                    key={thread.id}
                    onClick={() => onSelectThread(thread.id, thread.other_user.id)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left',
                      selectedThreadId === thread.id 
                        ? 'bg-primary/10 border border-primary/20' 
                        : 'hover:bg-muted'
                    )}
                  >
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={thread.other_user.avatar_url || ''} />
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {getInitials(thread.other_user.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      {thread.other_user.is_online && (
                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-card" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate">
                          {thread.other_user.full_name || 'Usuário'}
                        </span>
                        {thread.last_message_at && (
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(thread.last_message_at), { 
                              addSuffix: false,
                              locale: ptBR 
                            })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className="text-xs text-muted-foreground truncate max-w-[160px]">
                          {thread.last_message_preview || 'Nova conversa'}
                        </p>
                        {thread.unread_count > 0 && (
                          <Badge variant="default" className="h-5 min-w-[20px] px-1.5 text-[10px]">
                            {thread.unread_count > 99 ? '99+' : thread.unread_count}
                          </Badge>
                        )}
                      </div>
                      {thread.other_user.department_name && (
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                          {thread.other_user.department_name}
                        </p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="flex-1 m-0">
          <ScrollArea className="h-[calc(100vh-14rem)]">
            <div className="p-2 space-y-1">
              {membersLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-24 mb-2" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                ))
              ) : filteredMembers?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhum contato encontrado</p>
                </div>
              ) : (
                filteredMembers?.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => handleStartChat(member.id)}
                    disabled={startChat.isPending}
                    className="w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left hover:bg-muted disabled:opacity-50"
                  >
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={member.avatar_url || ''} />
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {getInitials(member.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      {member.is_online && (
                        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-card" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm truncate block">
                        {member.full_name || 'Usuário'}
                      </span>
                      {member.department_name && (
                        <p className="text-xs text-muted-foreground truncate">
                          {member.department_name}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground/70">
                        {member.is_online ? 'Online' : 'Offline'}
                        {member.is_available && ' • Disponível'}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
