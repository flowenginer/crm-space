import { useState, useMemo } from 'react';
import { Eye, EyeOff, Users, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Agent {
  id: string;
  full_name: string | null;
  conversationCount: number;
}

interface UserVisibilityFilterProps {
  agents: Agent[];
  hiddenAgentIds: Set<string>;
  onToggleAgent: (agentId: string) => void;
  onShowAll: () => void;
  onHideWithoutConversations: () => void;
}

export function UserVisibilityFilter({
  agents,
  hiddenAgentIds,
  onToggleAgent,
  onShowAll,
  onHideWithoutConversations,
}: UserVisibilityFilterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredAgents = useMemo(() => {
    if (!search) return agents;
    const searchLower = search.toLowerCase();
    return agents.filter(a => 
      a.full_name?.toLowerCase().includes(searchLower)
    );
  }, [agents, search]);

  const hiddenCount = hiddenAgentIds.size;
  const agentsWithoutConversations = agents.filter(a => a.conversationCount === 0);

  // Sort: visible first, then hidden; within each group, sort by name
  const sortedAgents = useMemo(() => {
    return [...filteredAgents].sort((a, b) => {
      const aHidden = hiddenAgentIds.has(a.id);
      const bHidden = hiddenAgentIds.has(b.id);
      if (aHidden !== bHidden) return aHidden ? 1 : -1;
      return (a.full_name || '').localeCompare(b.full_name || '');
    });
  }, [filteredAgents, hiddenAgentIds]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="gap-2"
        >
          {hiddenCount > 0 ? (
            <>
              <EyeOff size={16} />
              <span>{hiddenCount} oculto{hiddenCount > 1 ? 's' : ''}</span>
            </>
          ) : (
            <>
              <Eye size={16} />
              <span>Visibilidade</span>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-72 p-0 bg-popover border border-border shadow-lg z-50" 
        align="end"
      >
        {/* Search */}
        <div className="p-3 border-b border-border">
          <Input
            placeholder="Buscar usuário..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        {/* Quick Actions */}
        <div className="p-2 border-b border-border flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-8 text-xs"
            onClick={onShowAll}
          >
            <Check size={14} className="mr-1" />
            Mostrar todos
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-8 text-xs"
            onClick={onHideWithoutConversations}
            disabled={agentsWithoutConversations.length === 0}
          >
            <X size={14} className="mr-1" />
            Ocultar inativos ({agentsWithoutConversations.length})
          </Button>
        </div>

        {/* Agent List */}
        <ScrollArea className="h-64">
          <div className="p-2 space-y-1">
            {sortedAgents.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-4">
                Nenhum usuário encontrado
              </div>
            ) : (
              sortedAgents.map((agent) => {
                const isHidden = hiddenAgentIds.has(agent.id);
                return (
                  <div
                    key={agent.id}
                    className={`flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-muted transition-colors ${
                      isHidden ? 'opacity-50' : ''
                    }`}
                    onClick={() => onToggleAgent(agent.id)}
                  >
                    <Checkbox
                      checked={!isHidden}
                      className="pointer-events-none"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm truncate block">
                        {agent.full_name || 'Sem nome'}
                      </span>
                    </div>
                    <Badge 
                      variant={agent.conversationCount > 0 ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {agent.conversationCount}
                    </Badge>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        {hiddenCount > 0 && (
          <div className="p-2 border-t border-border bg-muted/50">
            <p className="text-xs text-muted-foreground text-center">
              {hiddenCount} usuário{hiddenCount > 1 ? 's' : ''} oculto{hiddenCount > 1 ? 's' : ''} do monitoramento
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
