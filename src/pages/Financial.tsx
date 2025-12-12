import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Search,
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertCircle,
  CheckCircle,
  Clock,
  CreditCard,
} from 'lucide-react';
import {
  useFinancialTransactions,
  useFinancialSummary,
  useFinancialAccounts,
  FinancialTransaction,
} from '@/hooks/useFinancial';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TransactionModal } from '@/components/financial/TransactionModal';
import { PaymentModal } from '@/components/financial/PaymentModal';
import { AccountsPanel } from '@/components/financial/AccountsPanel';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof Clock }> = {
  pending: { label: 'Pendente', variant: 'outline', icon: Clock },
  paid: { label: 'Pago', variant: 'default', icon: CheckCircle },
  overdue: { label: 'Vencido', variant: 'destructive', icon: AlertCircle },
  canceled: { label: 'Cancelado', variant: 'secondary', icon: AlertCircle },
};

export default function Financial() {
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'income' | 'expense'>('income');
  const [selectedTransaction, setSelectedTransaction] = useState<FinancialTransaction | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const currentMonth = new Date();
  const startDate = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

  const { data: transactions = [], isLoading } = useFinancialTransactions({
    type: typeFilter !== 'all' ? (typeFilter as 'income' | 'expense') : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    startDate,
    endDate,
  });
  const { data: summary } = useFinancialSummary(startDate, endDate);
  const { data: accounts = [] } = useFinancialAccounts();

  const filteredTransactions = transactions.filter(t => {
    if (!searchTerm) return true;
    return t.description.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const formatCurrency = (value: number | null | undefined) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0);
  };

  const totalBalance = accounts.reduce((sum, acc) => sum + (acc.current_balance || 0), 0);

  const openNewTransaction = (type: 'income' | 'expense') => {
    setModalType(type);
    setIsModalOpen(true);
  };

  const openPayment = (transaction: FinancialTransaction) => {
    setSelectedTransaction(transaction);
    setIsPaymentModalOpen(true);
  };

  return (
    <>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Financeiro</h1>
            <p className="text-muted-foreground">Controle de contas a pagar e receber</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => openNewTransaction('expense')}>
              <TrendingDown className="h-4 w-4 mr-2 text-red-500" />
              Nova Despesa
            </Button>
            <Button onClick={() => openNewTransaction('income')}>
              <TrendingUp className="h-4 w-4 mr-2" />
              Nova Receita
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Saldo Total</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalBalance)}</div>
              <p className="text-xs text-muted-foreground">
                {accounts.length} conta(s) ativa(s)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">A Receber</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(summary?.pendingIncome)}
              </div>
              <p className="text-xs text-muted-foreground">
                Recebido: {formatCurrency(summary?.paidIncome)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">A Pagar</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(summary?.pendingExpense)}
              </div>
              <p className="text-xs text-muted-foreground">
                Pago: {formatCurrency(summary?.paidExpense)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Vencidos</CardTitle>
              <AlertCircle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency((summary?.overdueIncome || 0) + (summary?.overdueExpense || 0))}
              </div>
              <p className="text-xs text-muted-foreground">
                Requer atenção
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="accounts">Contas Bancárias</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Transações do Mês</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar transações..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="income">Receitas</SelectItem>
                      <SelectItem value="expense">Despesas</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="paid">Pago</SelectItem>
                      <SelectItem value="overdue">Vencido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </div>
                ) : filteredTransactions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma transação encontrada
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="w-24"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransactions.map((transaction) => {
                        const StatusIcon = statusConfig[transaction.status]?.icon || Clock;
                        return (
                          <TableRow key={transaction.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {transaction.type === 'income' ? (
                                  <TrendingUp className="h-4 w-4 text-green-500" />
                                ) : (
                                  <TrendingDown className="h-4 w-4 text-red-500" />
                                )}
                                <span className="font-medium">{transaction.description}</span>
                              </div>
                              {transaction.contact && (
                                <span className="text-sm text-muted-foreground">
                                  {(transaction.contact as { full_name: string }).full_name}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {transaction.category && (
                                <Badge variant="outline" style={{ borderColor: (transaction.category as { color: string }).color }}>
                                  {(transaction.category as { name: string }).name}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {format(new Date(transaction.due_date), "dd/MM/yyyy", { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusConfig[transaction.status]?.variant || 'outline'}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {statusConfig[transaction.status]?.label || transaction.status}
                              </Badge>
                            </TableCell>
                            <TableCell className={`text-right font-medium ${
                              transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {transaction.type === 'income' ? '+' : '-'}
                              {formatCurrency(transaction.amount)}
                            </TableCell>
                            <TableCell>
                              {transaction.status === 'pending' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openPayment(transaction)}
                                >
                                  <CreditCard className="h-4 w-4 mr-1" />
                                  Pagar
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="accounts">
            <AccountsPanel />
          </TabsContent>
        </Tabs>
      </div>

      <TransactionModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        type={modalType}
      />

      <PaymentModal
        open={isPaymentModalOpen}
        onOpenChange={setIsPaymentModalOpen}
        transaction={selectedTransaction}
      />
    </>
  );
}
