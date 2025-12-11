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

  // Função para renderizar badge de departamento com cor
  const DepartmentBadge = ({ name, color }: { name?: string | null; color?: string | null }) => {
    if (!name) return null;
    return (
      <span 
        className="px-2 py-0.5 rounded text-[10px] font-medium text-white truncate max-w-[80px]"
        style={{ backgroundColor: color || 'hsl(var(--muted-foreground))' }}
      >
        {name}
      </span>
    );
  };

  return (
    <div className="w-80 border-r border-border flex flex-col bg-card min-h-0">
      {/* Header */}
      <div className="p-4 border-b border-border shrink-0">
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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-2 mx-4 mt-2 shrink-0" style={{ width: 'calc(100% - 2rem)' }}>
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
        <TabsContent value="conversations" className="flex-1 m-0 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-2 space-y-0.5">
              {threadsLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-2">
                    <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                    <div className="flex-1 min-w-0">
                      <Skeleton className="h-4 w-24 mb-1" />
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
                      'w-full flex items-center gap-2.5 p-2 rounded-lg transition-colors text-left',
                      selectedThreadId === thread.id 
                        ? 'bg-primary/10 border border-primary/20' 
                        : 'hover:bg-muted'
                    )}
                  >
                    <div className="relative shrink-0">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={thread.other_user.avatar_url || ''} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {getInitials(thread.other_user.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      {thread.other_user.is_online && (
                        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-card" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">
                          {thread.other_user.full_name || 'Usuário'}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {thread.last_message_at && (
                            <span className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(thread.last_message_at), { 
                                addSuffix: false,
                                locale: ptBR 
                              })}
                            </span>
                          )}
                          {thread.unread_count > 0 && (
                            <Badge variant="default" className="h-4 min-w-[16px] px-1 text-[9px]">
                              {thread.unread_count > 99 ? '99+' : thread.unread_count}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground truncate">
                          {thread.last_message_preview || 'Nova conversa'}
                        </p>
                        <DepartmentBadge 
                          name={thread.other_user.department_name} 
                          color={thread.other_user.department_color}
                        />
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Contacts Tab - Cards compactos */}
        <TabsContent value="contacts" className="flex-1 m-0 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-2 space-y-0.5">
              {membersLoading ? (
                Array(8).fill(0).map((_, i) => (
                  <div key={i} className="flex items-center gap-2.5 p-2">
                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                    <Skeleton className="h-4 w-24 flex-1" />
                    <Skeleton className="h-4 w-16" />
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
                    className="w-full flex items-center gap-2.5 py-2 px-2 rounded-lg transition-colors text-left hover:bg-muted disabled:opacity-50"
                  >
                    {/* Avatar com indicador de online */}
                    <div className="relative shrink-0">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.avatar_url || ''} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {getInitials(member.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span 
                        className={cn(
                          "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card",
                          member.is_online ? "bg-green-500" : "bg-muted-foreground/40"
                        )}
                      />
                    </div>
                    
                    {/* Nome */}
                    <span className="font-medium text-sm truncate flex-1 min-w-0">
                      {member.full_name || 'Usuário'}
                    </span>

                    {/* Badge de departamento com cor */}
                    <DepartmentBadge 
                      name={member.department_name} 
                      color={member.department_color}
                    />
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
