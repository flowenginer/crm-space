import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Radio, Users, MessageSquare, Clock, Search,
  ExternalLink, AlertTriangle, ChevronDown, ChevronUp,
  RefreshCw, Building2, Loader2, Eye
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { ConversationPreviewDialog } from '@/components/conversations/ConversationPreviewDialog';
import { AgentMonitorPanel } from '@/components/live-monitor/AgentMonitorPanel';
import { UserVisibilityFilter } from '@/components/live-monitor/UserVisibilityFilter';

interface ConversationContact {
  id: string;
  full_name: string;
  phone: string;
  avatar_url?: string | null;
}

interface ConversationDepartment {
  id: string;
  name: string;
}

interface ConversationTag {
  tag: { id: string; name: string; color: string | null };
}

interface Conversation {
  id: string;
  status: string | null;
  is_unread: boolean | null;
  unread_count: number | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  assigned_to: string | null;
  contact: ConversationContact | null;
  department: ConversationDepartment | null;
  tags?: ConversationTag[];
}

interface Agent {
  id: string;
  full_name: string | null;
  avatar_url?: string | null;
  is_online: boolean | null;
  role: string | null;
  department?: ConversationDepartment | null;
  conversations: Conversation[];
  totalMessages: number;
}

const HIDDEN_AGENTS_KEY = 'liveMonitor_hiddenAgents';

export default function LiveMonitorPage() {
  const [viewMode, setViewMode] = useState<'users' | 'departments'>('users');
  const [search, setSearch] = useState('');
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const [previewConversationId, setPreviewConversationId] = useState<string | null>(null);
  const [hiddenAgentIds, setHiddenAgentIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem(HIDDEN_AGENTS_KEY);
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  
  const navigate = useNavigate();
  const { isAdmin, role } = usePermissions();

  // Persist hidden agents to localStorage
  useEffect(() => {
    localStorage.setItem(HIDDEN_AGENTS_KEY, JSON.stringify([...hiddenAgentIds]));
  }, [hiddenAgentIds]);

  // Check permission - only admin and supervisor
  const hasAccess = isAdmin || role === 'supervisor';

  // Fetch all active conversations with agents
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['live-monitor'],
    queryFn: async () => {
      // Fetch all agents
      const { data: agents, error: agentsError } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          avatar_url,
          is_online,
          role,
          department:departments(id, name)
        `)
        .eq('is_active', true)
        .order('full_name');

      if (agentsError) throw agentsError;

      // Fetch all open/pending conversations
      const { data: conversations, error: convsError } = await supabase
        .from('conversations')
        .select(`
          id,
          status,
          is_unread,
          unread_count,
          last_message_at,
          last_message_preview,
          assigned_to,
          contact:contacts(id, full_name, phone, avatar_url),
          department:departments(id, name),
          tags:conversation_tags(tag:tags(id, name, color))
        `)
        .in('status', ['open', 'pending'])
        .not('last_message_at', 'is', null)
        .order('last_message_at', { ascending: false });

      if (convsError) throw convsError;

      // Fetch unassigned conversations
      const unassignedConvs = (conversations?.filter(c => !c.assigned_to) || []) as Conversation[];

      // Group conversations by agent
      const agentMap = new Map<string, Agent>();

      // Add "Pendentes" (unassigned) as first column
      agentMap.set('unassigned', {
        id: 'unassigned',
        full_name: 'Pendentes',
        avatar_url: undefined,
        is_online: true,
        role: 'system',
        conversations: unassignedConvs,
        totalMessages: unassignedConvs.reduce((sum, c) => sum + (c.unread_count || 0), 0)
      });

      // Add agents
      agents?.forEach(agent => {
        const agentConvs = (conversations?.filter(c => c.assigned_to === agent.id) || []) as Conversation[];
        agentMap.set(agent.id, {
          ...agent,
          conversations: agentConvs,
          totalMessages: agentConvs.reduce((sum, c) => sum + (c.unread_count || 0), 0)
        });
      });

      return {
        agents: Array.from(agentMap.values()),
        totalOnline: agents?.filter(a => a.is_online).length || 0,
        totalConversations: conversations?.length || 0,
        unassignedCount: unassignedConvs.length
      };
    },
    // Sempre buscar dados atuais ao entrar na tela (evita "conversas vazias" por cache)
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
    enabled: hasAccess,
  });

  // Real-time subscription with debounce
  useEffect(() => {
    if (!hasAccess) return;

    let debounceTimer: NodeJS.Timeout | null = null;

    const debouncedRefetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => refetch(), 500);
    };

    const channel = supabase
      .channel('live-monitor')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        debouncedRefetch
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        debouncedRefetch
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        debouncedRefetch
      )
      .subscribe((status) => {
        // Garante primeira atualização assim que a subscription estiver pronta
        if (status === 'SUBSCRIBED') debouncedRefetch();
      });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [refetch, hasAccess]);

  // Toggle agent expansion
  const toggleAgent = (agentId: string) => {
    const newExpanded = new Set(expandedAgents);
    if (newExpanded.has(agentId)) {
      newExpanded.delete(agentId);
    } else {
      newExpanded.add(agentId);
    }
    setExpandedAgents(newExpanded);
  };

  // Filter agents by search and visibility
  const filteredAgents = useMemo(() => {
    return data?.agents.filter(agent => {
      // Never hide "Pendentes" column
      if (agent.id === 'unassigned') return true;
      
      // Apply visibility filter
      if (hiddenAgentIds.has(agent.id)) return false;
      
      // Apply search filter
      if (!search) return true;
      const searchLower = search.toLowerCase();
      
      if (agent.full_name?.toLowerCase().includes(searchLower)) return true;
      
      return agent.conversations.some(conv => 
        conv.contact?.full_name?.toLowerCase().includes(searchLower) ||
        conv.contact?.phone?.includes(search)
      );
    }) || [];
  }, [data?.agents, hiddenAgentIds, search]);

  // Agents for visibility filter (exclude "unassigned")
  const agentsForFilter = useMemo(() => {
    return (data?.agents || [])
      .filter(a => a.id !== 'unassigned')
      .map(a => ({
        id: a.id,
        full_name: a.full_name,
        conversationCount: a.conversations.length,
      }));
  }, [data?.agents]);

  // Visibility filter handlers
  const toggleAgentVisibility = useCallback((agentId: string) => {
    setHiddenAgentIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(agentId)) {
        newSet.delete(agentId);
      } else {
        newSet.add(agentId);
      }
      return newSet;
    });
  }, []);

  const showAllAgents = useCallback(() => {
    setHiddenAgentIds(new Set());
  }, []);

  const hideAgentsWithoutConversations = useCallback(() => {
    const toHide = (data?.agents || [])
      .filter(a => a.id !== 'unassigned' && a.conversations.length === 0)
      .map(a => a.id);
    setHiddenAgentIds(new Set(toHide));
  }, [data?.agents]);

  // Group by departments for department view
  const departmentGroups = useMemo(() => {
    if (!data?.agents) return [];
    
    const deptMap = new Map<string, {
      id: string;
      name: string;
      conversations: Conversation[];
      agents: Agent[];
      onlineCount: number;
    }>();
    
    // Add "Pendentes" column
    const unassignedAgent = data.agents.find(a => a.id === 'unassigned');
    if (unassignedAgent) {
      deptMap.set('unassigned', {
        id: 'unassigned',
        name: 'Pendentes',
        conversations: unassignedAgent.conversations,
        agents: [],
        onlineCount: 0
      });
    }
    
    // Group agents by department
    data.agents.forEach(agent => {
      if (agent.id === 'unassigned') return;
      
      const deptId = agent.department?.id || 'no-dept';
      const deptName = agent.department?.name || 'Sem Departamento';
      
      if (!deptMap.has(deptId)) {
        deptMap.set(deptId, {
          id: deptId,
          name: deptName,
          conversations: [],
          agents: [],
          onlineCount: 0
        });
      }
      
      const dept = deptMap.get(deptId)!;
      dept.agents.push(agent);
      dept.conversations.push(...agent.conversations);
      if (agent.is_online) dept.onlineCount++;
    });
    
    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      return Array.from(deptMap.values()).filter(dept => {
        if (dept.id === 'unassigned') return true;
        if (dept.name.toLowerCase().includes(searchLower)) return true;
        return dept.conversations.some(conv => 
          conv.contact?.full_name?.toLowerCase().includes(searchLower) ||
          conv.contact?.phone?.includes(search)
        );
      });
    }
    
    return Array.from(deptMap.values());
  }, [data?.agents, search]);

  // Open conversation preview
  const openConversationPreview = (conversationId: string) => {
    setPreviewConversationId(conversationId);
  };

  // Format time ago
  const formatTimeAgo = (date: string | null) => {
    if (!date) return '-';
    return formatDistanceToNow(new Date(date), { 
      addSuffix: false, 
      locale: ptBR 
    });
  };

  // Access denied
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle size={48} className="mx-auto text-amber-500 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Acesso Restrito</h1>
          <p className="text-muted-foreground">
            Esta página é exclusiva para administradores e supervisores.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Radio size={28} className="text-green-500" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Ao Vivo</h1>
              <p className="text-sm text-muted-foreground">
                Monitoramento em tempo real dos atendimentos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 rounded-xl">
                <Users size={18} className="text-green-500" />
                <span className="text-green-500 font-semibold">
                  {data?.totalOnline || 0} online
                </span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-primary/20 rounded-xl">
                <MessageSquare size={18} className="text-primary" />
                <span className="text-primary font-semibold">
                  {data?.totalConversations || 0} atendimentos
                </span>
              </div>
            </div>

            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw size={18} />
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative w-80">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar atendente ou conversa..."
                className="pl-10"
              />
            </div>

            {/* User Visibility Filter */}
            <UserVisibilityFilter
              agents={agentsForFilter}
              hiddenAgentIds={hiddenAgentIds}
              onToggleAgent={toggleAgentVisibility}
              onShowAll={showAllAgents}
              onHideWithoutConversations={hideAgentsWithoutConversations}
            />
          </div>

          <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
            <button
              onClick={() => setViewMode('users')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                viewMode === 'users' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users size={16} />
              Usuários
            </button>
            <button
              onClick={() => setViewMode('departments')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                viewMode === 'departments' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Building2 size={16} />
              Departamentos
            </button>
          </div>
        </div>
      </div>

      {/* Agent Monitor Panel */}
      <div className="px-6 pt-6">
        <AgentMonitorPanel hiddenAgentIds={hiddenAgentIds} />
      </div>

      {/* Kanban Board */}
      <div className="p-6 pt-0">
        <div className="flex flex-wrap gap-4">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="w-72 flex-shrink-0">
                <div className="bg-card rounded-xl p-4 animate-pulse">
                  <div className="h-6 bg-muted rounded w-32 mb-4" />
                  <div className="space-y-3">
                    <div className="h-20 bg-muted rounded" />
                    <div className="h-20 bg-muted rounded" />
                  </div>
                </div>
              </div>
            ))
          ) : viewMode === 'users' ? (
            filteredAgents.map((agent) => (
              <AgentColumn
                key={agent.id}
                agent={agent}
                isExpanded={expandedAgents.has(agent.id)}
                onToggle={() => toggleAgent(agent.id)}
                onOpenConversation={openConversationPreview}
                formatTimeAgo={formatTimeAgo}
              />
            ))
          ) : (
            departmentGroups.map((dept) => (
              <DepartmentColumn
                key={dept.id}
                department={dept}
                isExpanded={expandedAgents.has(dept.id)}
                onToggle={() => toggleAgent(dept.id)}
                onOpenConversation={openConversationPreview}
                formatTimeAgo={formatTimeAgo}
              />
            ))
          )}
        </div>
      </div>

      {/* Conversation Preview Dialog */}
      <ConversationPreviewDialog
        conversationId={previewConversationId}
        isOpen={!!previewConversationId}
        onClose={() => setPreviewConversationId(null)}
      />
    </div>
  );
}

// Agent Column Component
interface AgentColumnProps {
  agent: Agent;
  isExpanded: boolean;
  onToggle: () => void;
  onOpenConversation: (id: string) => void;
  formatTimeAgo: (date: string | null) => string;
}

function AgentColumn({ agent, isExpanded, onToggle, onOpenConversation, formatTimeAgo }: AgentColumnProps) {
  const isUnassigned = agent.id === 'unassigned';
  const visibleConversations = isExpanded ? agent.conversations : agent.conversations.slice(0, 5);
  const hasMore = agent.conversations.length > 5;

  const getHeaderColor = () => {
    if (isUnassigned) return 'bg-red-600';
    if (agent.is_online) return 'bg-blue-600';
    return 'bg-muted-foreground';
  };

  return (
    <div className="w-72 flex-shrink-0">
      {/* Column Header */}
      <div className={`${getHeaderColor()} rounded-t-xl p-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isUnassigned ? (
              <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
                <Clock size={16} className="text-white" />
              </div>
            ) : (
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold">
                  {agent.full_name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                {agent.is_online && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-blue-600" />
                )}
              </div>
            )}
            <div className="text-white">
              <div className="font-semibold text-sm truncate max-w-[140px]">
                {agent.full_name}
              </div>
              {agent.department && !isUnassigned && (
                <div className="text-xs text-white/70 truncate max-w-[140px]">
                  {agent.department.name}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-1 bg-white/20 rounded-lg px-2 py-1">
            <MessageSquare size={14} className="text-white" />
            <span className="text-white font-semibold text-sm">
              {agent.conversations.length}
            </span>
          </div>
        </div>
      </div>

      {/* Conversations List */}
      <div className="bg-card rounded-b-xl border border-border border-t-0 max-h-[calc(100vh-280px)] overflow-y-auto">
        {agent.conversations.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            {isUnassigned ? 'Nenhuma conversa pendente' : 'Nenhum atendimento ativo'}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {visibleConversations.map((conversation) => (
              <ConversationCard
                key={conversation.id}
                conversation={conversation}
                onOpen={() => onOpenConversation(conversation.id)}
                formatTimeAgo={formatTimeAgo}
              />
            ))}

            {hasMore && (
              <button
                onClick={onToggle}
                className="w-full p-3 text-center text-sm text-primary hover:bg-muted transition-colors flex items-center justify-center gap-1"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp size={16} />
                    Mostrar menos
                  </>
                ) : (
                  <>
                    <ChevronDown size={16} />
                    Ver mais {agent.conversations.length - 5} conversas
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Conversation Card Component
interface ConversationCardProps {
  conversation: Conversation;
  onOpen: () => void;
  formatTimeAgo: (date: string | null) => string;
}

function ConversationCard({ conversation, onOpen, formatTimeAgo }: ConversationCardProps) {
  const contact = conversation.contact;
  const hasUnread = (conversation.unread_count || 0) > 0;
  const tags = conversation.tags?.map(t => t.tag) || [];

  const lastMessageTime = conversation.last_message_at ? new Date(conversation.last_message_at) : null;
  const minutesAgo = lastMessageTime ? (Date.now() - lastMessageTime.getTime()) / 1000 / 60 : 0;
  const isWaitingLong = hasUnread && minutesAgo > 5;

  return (
    <div
      className={`p-3 hover:bg-muted/50 cursor-pointer transition-colors ${
        hasUnread ? 'bg-primary/5' : ''
      }`}
      onClick={onOpen}
    >
      <div className="flex items-start gap-3">
        <div className="relative flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-sm font-bold">
            {contact?.full_name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          {hasUnread && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-bold">
              {(conversation.unread_count || 0) > 9 ? '9+' : conversation.unread_count}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className={`font-medium text-sm truncate ${hasUnread ? 'text-foreground' : 'text-muted-foreground'}`}>
              {contact?.full_name || 'Desconhecido'}
            </span>
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {formatTimeAgo(conversation.last_message_at)}
            </span>
          </div>

          <p className={`text-xs truncate ${hasUnread ? 'text-muted-foreground' : 'text-muted-foreground/70'}`}>
            {conversation.last_message_preview || 'Nova conversa'}
          </p>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {tags.slice(0, 2).map((tag) => (
                <span
                  key={tag.id}
                  className="px-1.5 py-0.5 rounded text-xs font-medium"
                  style={{
                    backgroundColor: `${tag.color || '#8B5CF6'}30`,
                    color: tag.color || '#8B5CF6'
                  }}
                >
                  {tag.name}
                </span>
              ))}
              {tags.length > 2 && (
                <span className="text-xs text-muted-foreground">+{tags.length - 2}</span>
              )}
            </div>
          )}

          {isWaitingLong && (
            <div className="flex items-center gap-1 mt-2 text-amber-500">
              <AlertTriangle size={12} />
              <span className="text-xs">Esperando há {Math.floor(minutesAgo)} min</span>
            </div>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="p-1.5 hover:bg-primary/10 rounded transition-colors flex-shrink-0"
          title="Visualizar conversa"
        >
          <Eye size={14} className="text-primary" />
        </button>
      </div>
    </div>
  );
}

// Department Column Component
interface DepartmentGroup {
  id: string;
  name: string;
  conversations: Conversation[];
  agents: Agent[];
  onlineCount: number;
}

interface DepartmentColumnProps {
  department: DepartmentGroup;
  isExpanded: boolean;
  onToggle: () => void;
  onOpenConversation: (id: string) => void;
  formatTimeAgo: (date: string | null) => string;
}

function DepartmentColumn({ department, isExpanded, onToggle, onOpenConversation, formatTimeAgo }: DepartmentColumnProps) {
  const isUnassigned = department.id === 'unassigned';
  const visibleConversations = isExpanded ? department.conversations : department.conversations.slice(0, 5);
  const hasMore = department.conversations.length > 5;

  const getHeaderColor = () => {
    if (isUnassigned) return 'bg-red-600';
    return 'bg-purple-600';
  };

  return (
    <div className="w-72 flex-shrink-0">
      {/* Column Header */}
      <div className={`${getHeaderColor()} rounded-t-xl p-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isUnassigned ? (
              <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
                <Clock size={16} className="text-white" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Building2 size={16} className="text-white" />
              </div>
            )}
            <div className="text-white">
              <div className="font-semibold text-sm truncate max-w-[140px]">
                {department.name}
              </div>
              {!isUnassigned && (
                <div className="text-xs text-white/70 flex items-center gap-1">
                  <Users size={10} />
                  {department.onlineCount} online / {department.agents.length} total
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-1 bg-white/20 rounded-lg px-2 py-1">
            <MessageSquare size={14} className="text-white" />
            <span className="text-white font-semibold text-sm">
              {department.conversations.length}
            </span>
          </div>
        </div>
      </div>

      {/* Conversations List */}
      <div className="bg-card rounded-b-xl border border-border border-t-0 max-h-[calc(100vh-280px)] overflow-y-auto">
        {department.conversations.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            {isUnassigned ? 'Nenhuma conversa pendente' : 'Nenhum atendimento ativo'}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {visibleConversations.map((conversation) => (
              <ConversationCard
                key={conversation.id}
                conversation={conversation}
                onOpen={() => onOpenConversation(conversation.id)}
                formatTimeAgo={formatTimeAgo}
              />
            ))}

            {hasMore && (
              <button
                onClick={onToggle}
                className="w-full p-3 text-center text-sm text-primary hover:bg-muted transition-colors flex items-center justify-center gap-1"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp size={16} />
                    Mostrar menos
                  </>
                ) : (
                  <>
                    <ChevronDown size={16} />
                    Ver mais {department.conversations.length - 5} conversas
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
