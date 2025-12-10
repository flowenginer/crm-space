import { useState } from 'react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeftRight,
  ArrowRight,
  RotateCcw,
  Eye,
  Search,
  Building2,
  User,
  Filter,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DateRangePicker } from '@/components/reports/DateRangePicker';
import { ConversationPreviewDialog } from '@/components/conversations/ConversationPreviewDialog';
import { useTransferHistory, useTransferHistoryKPIs } from '@/hooks/useTransferHistory';
import { useTeam } from '@/hooks/useTeam';
import { useDepartments } from '@/hooks/useDepartments';
import { useDebounce } from '@/hooks/useDebounce';

interface TransferHistoryPanelProps {
  initialStartDate?: string;
  initialEndDate?: string;
}

export function TransferHistoryPanel({
  initialStartDate,
  initialEndDate,
}: TransferHistoryPanelProps) {
  const today = new Date();
  
  const [startDate, setStartDate] = useState(
    initialStartDate || format(startOfDay(today), 'yyyy-MM-dd')
  );
  const [endDate, setEndDate] = useState(
    initialEndDate || format(endOfDay(today), 'yyyy-MM-dd')
  );
  const [fromUserId, setFromUserId] = useState<string | null>(null);
  const [toUserId, setToUserId] = useState<string | null>(null);
  const [fromDepartmentId, setFromDepartmentId] = useState<string | null>(null);
  const [toDepartmentId, setToDepartmentId] = useState<string | null>(null);
  const [transferType, setTransferType] = useState<'all' | 'transfer' | 'return'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Preview dialog state
  const [previewConversationId, setPreviewConversationId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const { data: team } = useTeam();
  const { data: departments } = useDepartments();

  const { data: transferData, isLoading } = useTransferHistory({
    startDate,
    endDate,
    fromUserId,
    toUserId,
    fromDepartmentId,
    toDepartmentId,
    transferType,
    searchQuery: debouncedSearchQuery,
    page,
    pageSize,
  });

  const { data: kpis, isLoading: isLoadingKPIs } = useTransferHistoryKPIs({
    startDate,
    endDate,
  });

  const handleViewConversation = (conversationId: string) => {
    setPreviewConversationId(conversationId);
    setIsPreviewOpen(true);
  };

  const clearFilters = () => {
    setFromUserId(null);
    setToUserId(null);
    setFromDepartmentId(null);
    setToDepartmentId(null);
    setTransferType('all');
    setSearchQuery('');
    setPage(1);
  };

  const hasFilters = fromUserId || toUserId || fromDepartmentId || toDepartmentId || transferType !== 'all' || searchQuery;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-sm space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-muted-foreground" />
          <span className="font-medium text-foreground">Filtros</span>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto">
              <RotateCcw size={14} className="mr-1" />
              Limpar
            </Button>
          )}
        </div>
        
        {/* Linha 1: Filtros de Data */}
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={(d) => { setStartDate(d); setPage(1); }}
          onEndDateChange={(d) => { setEndDate(d); setPage(1); }}
        />

        {/* Linha 2: Outros Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-1">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="pl-9 h-9"
              />
            </div>
          </div>

          <Select 
            value={fromUserId || 'all'} 
            onValueChange={(v) => { setFromUserId(v === 'all' ? null : v); setPage(1); }}
          >
            <SelectTrigger className="h-9">
              <User size={14} className="mr-2 text-muted-foreground" />
              <SelectValue placeholder="De (usuário)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os usuários</SelectItem>
              {team?.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select 
            value={toUserId || 'all'} 
            onValueChange={(v) => { setToUserId(v === 'all' ? null : v); setPage(1); }}
          >
            <SelectTrigger className="h-9">
              <User size={14} className="mr-2 text-muted-foreground" />
              <SelectValue placeholder="Para (usuário)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os usuários</SelectItem>
              {team?.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select 
            value={fromDepartmentId || 'all'} 
            onValueChange={(v) => { setFromDepartmentId(v === 'all' ? null : v); setPage(1); }}
          >
            <SelectTrigger className="h-9">
              <Building2 size={14} className="mr-2 text-muted-foreground" />
              <SelectValue placeholder="Depto origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os deptos</SelectItem>
              {departments?.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select 
            value={toDepartmentId || 'all'} 
            onValueChange={(v) => { setToDepartmentId(v === 'all' ? null : v); setPage(1); }}
          >
            <SelectTrigger className="h-9">
              <Building2 size={14} className="mr-2 text-muted-foreground" />
              <SelectValue placeholder="Depto destino" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os deptos</SelectItem>
              {departments?.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select 
            value={transferType} 
            onValueChange={(v: 'all' | 'transfer' | 'return') => { setTransferType(v); setPage(1); }}
          >
            <SelectTrigger className="h-9">
              <ArrowLeftRight size={14} className="mr-2 text-muted-foreground" />
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="transfer">Transferência</SelectItem>
              <SelectItem value="return">Devolução</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground font-medium">Total Transferências</span>
            <div className="p-2 bg-primary/10 rounded-lg">
              <ArrowLeftRight size={18} className="text-primary" />
            </div>
          </div>
          {isLoadingKPIs ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <div className="text-2xl font-bold text-foreground">{kpis?.totalTransfers || 0}</div>
          )}
        </div>

        <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground font-medium">Média por Dia</span>
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <TrendingUp size={18} className="text-blue-500" />
            </div>
          </div>
          {isLoadingKPIs ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <div className="text-2xl font-bold text-foreground">{kpis?.avgPerDay || 0}</div>
          )}
        </div>

        <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground font-medium">Mais Transfere</span>
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <Building2 size={18} className="text-orange-500" />
            </div>
          </div>
          {isLoadingKPIs ? (
            <Skeleton className="h-8 w-32" />
          ) : (
            <div className="text-lg font-bold text-foreground truncate">
              {kpis?.topFromDepartment?.name || '-'}
            </div>
          )}
          {kpis?.topFromDepartment && (
            <div className="text-xs text-muted-foreground mt-1">
              {kpis.topFromDepartment.count} transferências
            </div>
          )}
        </div>

        <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground font-medium">Mais Recebe</span>
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <Building2 size={18} className="text-emerald-500" />
            </div>
          </div>
          {isLoadingKPIs ? (
            <Skeleton className="h-8 w-32" />
          ) : (
            <div className="text-lg font-bold text-foreground truncate">
              {kpis?.topToDepartment?.name || '-'}
            </div>
          )}
          {kpis?.topToDepartment && (
            <div className="text-xs text-muted-foreground mt-1">
              {kpis.topToDepartment.count} recebidas
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Histórico de Transferências</h3>
          <span className="text-sm text-muted-foreground">
            {transferData?.totalCount || 0} registros
          </span>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Data/Hora</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>De (Usuário)</TableHead>
                <TableHead>Para (Usuário)</TableHead>
                <TableHead>Depto Origem</TableHead>
                <TableHead>Depto Destino</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="w-[80px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : transferData?.records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Search size={32} className="opacity-50" />
                      <p>Nenhuma transferência encontrada no período</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                transferData?.records.map((record) => (
                  <TableRow key={record.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      <div className="text-sm">
                        {format(new Date(record.transferred_at), 'dd/MM/yyyy', { locale: ptBR })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(record.transferred_at), 'HH:mm', { locale: ptBR })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{record.contact_name}</div>
                      <div className="text-xs text-muted-foreground">{record.contact_phone}</div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{record.from_user_name || '-'}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{record.to_user_name || '-'}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{record.from_department_name || '-'}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{record.to_department_name || '-'}</span>
                    </TableCell>
                    <TableCell>
                      {record.is_return ? (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                          <RotateCcw size={12} className="mr-1" />
                          Devolução
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
                          <ArrowRight size={12} className="mr-1" />
                          Transferência
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewConversation(record.conversation_id)}
                      >
                        <Eye size={16} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {transferData && transferData.totalPages > 1 && (
          <div className="p-4 border-t border-border flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Página {transferData.currentPage} de {transferData.totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft size={16} className="mr-1" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(transferData.totalPages, p + 1))}
                disabled={page === transferData.totalPages}
              >
                Próximo
                <ChevronRight size={16} className="ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <ConversationPreviewDialog
        conversationId={previewConversationId}
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setPreviewConversationId(null);
        }}
      />
    </div>
  );
}
