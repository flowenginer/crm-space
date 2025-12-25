import { useState, useMemo } from 'react';
import { Loader2, Users, TrendingUp, Clock, MessageSquare, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AgentDistribution, formatDuration } from '@/hooks/useLeadJourneyDashboard';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type SortableColumn = 'leadsReceived' | 'leadsResponded' | 'conversions' | 'conversionRate' | 'avgResponseTime';

interface SortConfig {
  key: SortableColumn;
  direction: 'asc' | 'desc';
}

interface SortableHeaderProps {
  column: SortableColumn;
  label: string;
  icon?: React.ReactNode;
  sortConfig: SortConfig;
  onSort: (column: SortableColumn) => void;
}

function SortableHeader({ column, label, icon, sortConfig, onSort }: SortableHeaderProps) {
  const isActive = sortConfig.key === column;
  
  return (
    <TableHead 
      className="text-center cursor-pointer hover:bg-muted/50 transition-colors select-none"
      onClick={() => onSort(column)}
    >
      <div className="flex items-center justify-center gap-1">
        {icon}
        <span>{label}</span>
        {isActive ? (
          sortConfig.direction === 'desc' ? (
            <ArrowDown className="h-3 w-3 text-primary" />
          ) : (
            <ArrowUp className="h-3 w-3 text-primary" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </div>
    </TableHead>
  );
}

interface AgentPerformanceTableAdvancedProps {
  data: AgentDistribution[];
  isLoading?: boolean;
}

export function AgentPerformanceTableAdvanced({ data, isLoading }: AgentPerformanceTableAdvancedProps) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'leadsReceived',
    direction: 'desc'
  });

  const handleSort = (column: SortableColumn) => {
    setSortConfig(current => ({
      key: column,
      direction: current.key === column && current.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const sortedData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    return [...data].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      
      // Para tempo de resposta, menor é melhor
      if (sortConfig.direction === 'asc') {
        return aVal - bVal;
      }
      return bVal - aVal;
    });
  }, [data, sortConfig]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Performance por Vendedor
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Performance por Vendedor
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-64 gap-2">
          <Users className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-muted-foreground">Nenhum vendedor com leads no período</p>
        </CardContent>
      </Card>
    );
  }

  const maxLeads = Math.max(...data.map(d => d.leadsReceived));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Performance por Vendedor
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Vendedor</TableHead>
                <SortableHeader
                  column="leadsReceived"
                  label="Leads"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <TableHead className="text-center">Origem</TableHead>
                <SortableHeader
                  column="leadsResponded"
                  label="Respondidos"
                  icon={<MessageSquare className="h-3 w-3" />}
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortableHeader
                  column="conversions"
                  label="Conversões"
                  icon={<TrendingUp className="h-3 w-3" />}
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortableHeader
                  column="conversionRate"
                  label="Taxa"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
                <SortableHeader
                  column="avgResponseTime"
                  label="Tempo Resp."
                  icon={<Clock className="h-3 w-3" />}
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map((agent) => (
                <TableRow key={agent.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={agent.avatar} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {agent.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{agent.name}</p>
                        <div className="w-24">
                          <Progress 
                            value={(agent.leadsReceived / maxLeads) * 100} 
                            className="h-1"
                          />
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-semibold text-lg">{agent.leadsReceived}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      {agent.byOrigin.meta_ads > 0 && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0 bg-[#1877F2]/10 text-[#1877F2] border-[#1877F2]/30">
                          {agent.byOrigin.meta_ads}
                        </Badge>
                      )}
                      {agent.byOrigin.organic > 0 && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0 bg-green-500/10 text-green-600 border-green-500/30">
                          {agent.byOrigin.organic}
                        </Badge>
                      )}
                      {agent.byOrigin.other > 0 && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0">
                          {agent.byOrigin.other}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <MessageSquare className="h-3 w-3 text-muted-foreground" />
                      <span>{agent.leadsResponded}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge 
                      variant="secondary" 
                      className={`${
                        agent.conversions > 0 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                          : ''
                      }`}
                    >
                      {agent.conversions}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`font-medium ${
                      agent.conversionRate >= 20 
                        ? 'text-green-600' 
                        : agent.conversionRate >= 10 
                          ? 'text-yellow-600' 
                          : 'text-muted-foreground'
                    }`}>
                      {agent.conversionRate.toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`text-sm ${
                      agent.avgResponseTime < 300 
                        ? 'text-green-600' 
                        : agent.avgResponseTime < 900 
                          ? 'text-yellow-600' 
                          : 'text-red-500'
                    }`}>
                      {agent.avgResponseTime > 0 ? formatDuration(agent.avgResponseTime) : '-'}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
