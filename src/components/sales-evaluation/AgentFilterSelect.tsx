import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { Users } from 'lucide-react';

interface Agent {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

interface AgentFilterSelectProps {
  value: string | null;
  onChange: (agentId: string | null) => void;
}

export function AgentFilterSelect({ value, onChange }: AgentFilterSelectProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchAgents() {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('role', ['vendedor', 'admin', 'supervisor'])
        .eq('is_active', true)
        .order('full_name');

      if (!error && data) {
        setAgents(data.map(p => ({
          id: p.id,
          fullName: p.full_name,
          avatarUrl: p.avatar_url,
        })));
      }
      setIsLoading(false);
    }

    fetchAgents();
  }, []);

  return (
    <Select
      value={value || 'all'}
      onValueChange={(val) => onChange(val === 'all' ? null : val)}
    >
      <SelectTrigger className="w-[200px]">
        <Users className="mr-2 h-4 w-4" />
        <SelectValue placeholder="Todos os vendedores" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">
          <span className="flex items-center gap-2">
            Todos os vendedores
          </span>
        </SelectItem>
        {!isLoading && agents.map((agent) => (
          <SelectItem key={agent.id} value={agent.id}>
            <span className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={agent.avatarUrl || undefined} />
                <AvatarFallback className="text-xs">
                  {agent.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              {agent.fullName}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
