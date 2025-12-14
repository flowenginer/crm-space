import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Eye,
  List,
  LayoutGrid,
  Pencil,
  Trash2,
  ChevronDown,
  ShoppingCart,
  Truck,
  Gift,
  Clock,
  AlertTriangle,
  Bell,
  X,
} from 'lucide-react';
import { useQuotesAdvanced, Quote, QuoteFilters, useUpdateQuoteStatus, useDeleteQuote, useConvertQuoteToOrder } from '@/hooks/useQuotes';
import { usePermissions } from '@/hooks/usePermissions';
import { QuoteModal } from '@/components/quotes/QuoteModal';
import { QuoteDetailsModal } from '@/components/quotes/QuoteDetailsModal';
import { QuoteKanban } from '@/components/quotes/QuoteKanban';
import { QuoteConversionDashboard } from '@/components/quotes/QuoteConversionDashboard';
import { QuoteNotificationsPanel } from '@/components/quotes/QuoteNotificationsPanel';
import { format, differenceInDays, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
  draft: { label: 'Rascunho', variant: 'secondary' },
  sent: { label: 'Enviado', variant: 'default' },
  approved: { label: 'Aprovado', variant: 'default' },
  rejected: { label: 'Rejeitado', variant: 'destructive' },
  expired: { label: 'Expirado', variant: 'outline' },
  converted: { label: 'Pedido', variant: 'default', className: 'bg-green-600 hover:bg-green-700 text-white' },
};

const SHIPPING_METHODS: Record<string, string> = {
  sedex: 'Sedex',
  pac: 'PAC',
  motoboy: 'Motoboy',
  pickup: 'Retirada',
  other: 'Outro',
};

export default function Quotes() {
  const { isAdmin } = usePermissions();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [showNewQuoteModal, setShowNewQuoteModal] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Bulk selection
  const [selectedQuotes, setSelectedQuotes] = useState<string[]>([]);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);

  const filters: QuoteFilters = useMemo(() => ({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  }), [statusFilter, dateFrom, dateTo]);

  const { data: quotes = [], isLoading } = useQuotesAdvanced(filters);
  const updateQuoteStatus = useUpdateQuoteStatus();
  const deleteQuote = useDeleteQuote();
  const convertToOrder = useConvertQuoteToOrder();

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

  const handleEditQuote = (quote: Quote) => {
    setEditingQuote(quote);
    setShowNewQuoteModal(true);
  };

  const handleStatusChange = async (quoteId: string, newStatus: string) => {
    await updateQuoteStatus.mutateAsync({ quoteId, status: newStatus });
  };

  const handleConvertToOrder = async (quoteId: string) => {
    await convertToOrder.mutateAsync(quoteId);
  };

  const handleDeleteQuote = async (quote: Quote) => {
    await deleteQuote.mutateAsync({ quoteId: quote.id, quoteData: quote });
  };

  // Bulk selection handlers
  const handleSelectAll = () => {
    if (selectedQuotes.length === filteredQuotes.length) {
      setSelectedQuotes([]);
    } else {
      setSelectedQuotes(filteredQuotes.map(q => q.id));
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedQuotes(prev => 
      prev.includes(id) 
        ? prev.filter(x => x !== id) 
        : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    let deleted = 0;
    for (const id of selectedQuotes) {
      try {
        const quote = filteredQuotes.find(q => q.id === id);
        await deleteQuote.mutateAsync({ quoteId: id, quoteData: quote });
        deleted++;
      } catch (e) {
        console.error('Error deleting quote', id, e);
      }
    }
    setSelectedQuotes([]);
    setShowBulkDeleteDialog(false);
    toast.success(`${deleted} orçamento(s) excluído(s)`);
  };

  const getContactName = (quote: Quote) => {
    return quote.contact?.full_name || 'Sem cliente';
  };

  const getExpirationStatus = (validUntil: string | null) => {
    if (!validUntil) return { label: '-', isExpired: false, isExpiring: false };
    
    const expirationDate = new Date(validUntil);
    const isExpired = isPast(expirationDate);
    const daysUntilExpiry = differenceInDays(expirationDate, new Date());
    const isExpiring = !isExpired && daysUntilExpiry <= 3;
    
    return {
      label: format(expirationDate, 'dd/MM/yyyy'),
      isExpired,
      isExpiring,
      daysUntilExpiry,
    };
  };

  const handleModalClose = (open: boolean) => {
    if (!open) {
      setEditingQuote(null);
    }
    setShowNewQuoteModal(open);
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
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notificações
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab - New Conversion Dashboard */}
        <TabsContent value="dashboard" className="space-y-6">
          <QuoteConversionDashboard />
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <QuoteNotificationsPanel />
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
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Lista de Orçamentos</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={filteredQuotes.length > 0 && selectedQuotes.length === filteredQuotes.length}
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                        <TableHead>Número</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Vendedor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Frete</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Validade</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredQuotes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                            Nenhum orçamento encontrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredQuotes.map((quote) => {
                          const expiration = getExpirationStatus(quote.valid_until);
                          const shippingCost = quote.shipping_cost;
                          const isFreeShipping = (quote as any).is_free_shipping === true;
                          
                          return (
                            <TableRow key={quote.id}>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  checked={selectedQuotes.includes(quote.id)}
                                  onCheckedChange={() => handleSelectOne(quote.id)}
                                  disabled={quote.status === 'converted'}
                                />
                              </TableCell>
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
                                <span className="text-sm">{quote.seller?.full_name || '—'}</span>
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={quote.status}
                                  onValueChange={(value) => handleStatusChange(quote.id, value)}
                                  disabled={quote.status === 'converted'}
                                >
                                  <SelectTrigger className="h-auto w-auto border-0 bg-transparent p-0 shadow-none focus:ring-0">
                                    <Badge 
                                      variant={statusConfig[quote.status]?.variant || 'secondary'}
                                      className={cn(
                                        "cursor-pointer flex items-center gap-1",
                                        statusConfig[quote.status]?.className
                                      )}
                                    >
                                      {statusConfig[quote.status]?.label || quote.status}
                                      {quote.status !== 'converted' && (
                                        <ChevronDown className="h-3 w-3" />
                                      )}
                                    </Badge>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="draft">Rascunho</SelectItem>
                                    <SelectItem value="sent">Enviado</SelectItem>
                                    <SelectItem value="approved">Aprovado</SelectItem>
                                    <SelectItem value="rejected">Rejeitado</SelectItem>
                                    <SelectItem value="expired">Expirado</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                {isFreeShipping ? (
                                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                    <Gift className="h-3 w-3 mr-1" />
                                    Grátis
                                  </Badge>
                                ) : shippingCost && shippingCost > 0 ? (
                                  <div className="space-y-1">
                                    <div className="text-sm font-medium">
                                      {formatCurrency(shippingCost)}
                                    </div>
                                    {quote.shipping_method && (
                                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Truck className="h-3 w-3" />
                                        {SHIPPING_METHODS[quote.shipping_method] || quote.shipping_method}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    A definir
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(quote.total || 0)}
                              </TableCell>
                              <TableCell>
                                {quote.created_at && format(new Date(quote.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                              </TableCell>
                              <TableCell>
                                {quote.valid_until ? (
                                  <div className="flex items-center gap-1">
                                    {expiration.isExpired ? (
                                      <Badge variant="destructive" className="flex items-center gap-1">
                                        <AlertTriangle className="h-3 w-3" />
                                        Expirado
                                      </Badge>
                                    ) : expiration.isExpiring ? (
                                      <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700 flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {expiration.label}
                                      </Badge>
                                    ) : (
                                      <span className="text-sm">{expiration.label}</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <TooltipProvider>
                                    {/* Convert to Order */}
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleConvertToOrder(quote.id)}
                                          disabled={quote.status === 'converted' || convertToOrder.isPending}
                                          className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                                        >
                                          <ShoppingCart className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Converter em Pedido</p>
                                      </TooltipContent>
                                    </Tooltip>

                                    {/* Edit */}
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleEditQuote(quote)}
                                          disabled={quote.status === 'converted' && !isAdmin}
                                          className="h-8 w-8"
                                        >
                                          <Pencil className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Editar Orçamento</p>
                                      </TooltipContent>
                                    </Tooltip>

                                    {/* View */}
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleViewQuote(quote)}
                                          className="h-8 w-8"
                                        >
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Visualizar Orçamento</p>
                                      </TooltipContent>
                                    </Tooltip>

                                    {/* Delete */}
                                    <AlertDialog>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <AlertDialogTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                              disabled={quote.status === 'converted' && !isAdmin}
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </AlertDialogTrigger>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Excluir Orçamento</p>
                                        </TooltipContent>
                                      </Tooltip>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Excluir Orçamento</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Tem certeza que deseja excluir o orçamento <strong>{quote.quote_number}</strong>?
                                            Esta ação não pode ser desfeita.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => handleDeleteQuote(quote)}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          >
                                            Excluir
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </TooltipProvider>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Bulk Selection Bar */}
      {selectedQuotes.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-background border shadow-lg rounded-lg px-4 py-3 flex items-center gap-4">
          <span className="text-sm font-medium">{selectedQuotes.length} selecionado(s)</span>
          <Button variant="ghost" size="sm" onClick={() => setSelectedQuotes([])}>
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
          <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-1" />
                Excluir
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir {selectedQuotes.length} orçamento(s)?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. Os orçamentos selecionados serão removidos permanentemente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleBulkDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Excluir Todos
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Modals */}
      <QuoteModal
        open={showNewQuoteModal}
        onOpenChange={handleModalClose}
        quote={editingQuote}
      />

      <QuoteDetailsModal
        quote={selectedQuote}
        open={showDetailsModal}
        onOpenChange={setShowDetailsModal}
      />
    </div>
  );
}
