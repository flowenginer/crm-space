import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
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
import {
  Plus,
  Search,
  FileText,
  Eye,
  List,
  LayoutGrid,
  Clock,
  CheckCircle,
  ArrowRightCircle,
} from 'lucide-react';
import { useQuotesAdvanced, Quote, QuoteFilters } from '@/hooks/useQuotes';
import { QuoteModal } from '@/components/quotes/QuoteModal';
import { QuoteDetailsModal } from '@/components/quotes/QuoteDetailsModal';
import { QuoteKanban } from '@/components/quotes/QuoteKanban';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'secondary' },
  sent: { label: 'Enviado', variant: 'default' },
  approved: { label: 'Aprovado', variant: 'default' },
  rejected: { label: 'Rejeitado', variant: 'destructive' },
  expired: { label: 'Expirado', variant: 'outline' },
  converted: { label: 'Convertido', variant: 'default' },
};

export default function Quotes() {
  const [activeTab, setActiveTab] = useState('quotes');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [showNewQuoteModal, setShowNewQuoteModal] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filters: QuoteFilters = useMemo(() => ({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  }), [statusFilter, dateFrom, dateTo]);

  const { data: quotes = [], isLoading } = useQuotesAdvanced(filters);

  // Filter by search term
  const filteredQuotes = useMemo(() => {
    if (!searchTerm) return quotes;
    const term = searchTerm.toLowerCase();
    return quotes.filter(q => 
      q.quote_number.toLowerCase().includes(term) ||
      q.contact?.full_name?.toLowerCase().includes(term) ||
      q.contact?.phone?.includes(term)
    );
  }, [quotes, searchTerm]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = quotes.length;
    const pending = quotes.filter(q => ['draft', 'sent'].includes(q.status)).length;
    const approved = quotes.filter(q => q.status === 'approved').length;
    const converted = quotes.filter(q => q.status === 'converted').length;
    const totalValue = quotes.reduce((sum, q) => sum + (q.total || 0), 0);
    const approvedValue = quotes
      .filter(q => ['approved', 'converted'].includes(q.status))
      .reduce((sum, q) => sum + (q.total || 0), 0);

    return { total, pending, approved, converted, totalValue, approvedValue };
  }, [quotes]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleViewQuote = (quote: Quote) => {
    setSelectedQuote(quote);
    setShowDetailsModal(true);
  };

  const getContactName = (quote: Quote) => {
    return quote.contact?.full_name || 'Sem cliente';
  };

  return (
    <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Orçamentos</h1>
            <p className="text-muted-foreground">
              Gerencie orçamentos e converta-os em pedidos
            </p>
          </div>
          <Button onClick={() => setShowNewQuoteModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Orçamento
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="quotes">Orçamentos</TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total de Orçamentos</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(stats.totalValue)} em valor total
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
                  <Clock className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.pending}</div>
                  <p className="text-xs text-muted-foreground">
                    Aguardando resposta
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Aprovados</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.approved}</div>
                  <p className="text-xs text-muted-foreground">
                    Prontos para conversão
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Convertidos</CardTitle>
                  <ArrowRightCircle className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.converted}</div>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(stats.approvedValue)} convertido
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Quotes List Tab */}
          <TabsContent value="quotes" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por número, cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="sent">Enviado</SelectItem>
                  <SelectItem value="approved">Aprovado</SelectItem>
                  <SelectItem value="rejected">Rejeitado</SelectItem>
                  <SelectItem value="converted">Convertido</SelectItem>
                </SelectContent>
              </Select>

              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[150px]"
                placeholder="Data inicial"
              />

              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[150px]"
                placeholder="Data final"
              />

              <div className="flex gap-1 ml-auto">
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'kanban' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setViewMode('kanban')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Content */}
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando orçamentos...
              </div>
            ) : viewMode === 'kanban' ? (
              <QuoteKanban quotes={filteredQuotes} onViewQuote={handleViewQuote} />
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredQuotes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Nenhum orçamento encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredQuotes.map((quote) => {
                        const isExpired = quote.valid_until && new Date(quote.valid_until) < new Date();
                        
                        return (
                          <TableRow key={quote.id}>
                            <TableCell className="font-medium">
                              {quote.quote_number}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{getContactName(quote)}</p>
                                {quote.contact?.phone && (
                                  <p className="text-xs text-muted-foreground">
                                    {quote.contact.phone}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusConfig[quote.status]?.variant || 'secondary'}>
                                {statusConfig[quote.status]?.label || quote.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {quote.valid_until ? (
                                <span className={isExpired ? 'text-destructive' : ''}>
                                  {format(new Date(quote.valid_until), 'dd/MM/yyyy')}
                                  {isExpired && ' (Expirado)'}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(quote.total || 0)}
                            </TableCell>
                            <TableCell>
                              {quote.created_at && format(new Date(quote.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewQuote(quote)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Ver
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Modals */}
        <QuoteModal
          open={showNewQuoteModal}
          onOpenChange={setShowNewQuoteModal}
        />

        <QuoteDetailsModal
          quote={selectedQuote}
          open={showDetailsModal}
          onOpenChange={setShowDetailsModal}
        />
      </div>
  );
}
