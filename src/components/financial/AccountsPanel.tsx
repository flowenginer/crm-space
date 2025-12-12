import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Building2, Wallet, PiggyBank, CreditCard } from 'lucide-react';
import { useFinancialAccounts, useCreateFinancialAccount } from '@/hooks/useFinancial';

const accountTypeConfig: Record<string, { label: string; icon: typeof Wallet }> = {
  checking: { label: 'Conta Corrente', icon: Building2 },
  savings: { label: 'Poupança', icon: PiggyBank },
  cash: { label: 'Caixa', icon: Wallet },
  credit: { label: 'Cartão de Crédito', icon: CreditCard },
};

export function AccountsPanel() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('checking');
  const [bankName, setBankName] = useState('');
  const [initialBalance, setInitialBalance] = useState('');

  const { data: accounts = [], isLoading } = useFinancialAccounts();
  const createAccount = useCreateFinancialAccount();

  const formatCurrency = (value: number | null | undefined) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0);
  };

  const handleSubmit = async () => {
    if (!name) return;

    await createAccount.mutateAsync({
      name,
      type,
      bank_name: bankName || undefined,
      initial_balance: parseFloat(initialBalance) || 0,
    });

    setIsModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setName('');
    setType('checking');
    setBankName('');
    setInitialBalance('');
  };

  const totalBalance = accounts.reduce((sum, acc) => sum + (acc.current_balance || 0), 0);

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold">Contas Bancárias</h3>
            <p className="text-sm text-muted-foreground">
              Saldo total: {formatCurrency(totalBalance)}
            </p>
          </div>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Conta
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Carregando...
          </div>
        ) : accounts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Nenhuma conta cadastrada. Clique em "Nova Conta" para adicionar.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((account) => {
              const config = accountTypeConfig[account.type] || accountTypeConfig.checking;
              const Icon = config.icon;
              const isNegative = (account.current_balance || 0) < 0;

              return (
                <Card key={account.id}>
                  <CardHeader className="flex flex-row items-center gap-3 pb-2">
                    <div
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: `${account.color}20` }}
                    >
                      <Icon className="h-5 w-5" style={{ color: account.color || '#3B82F6' }} />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-base">{account.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {config.label}
                        {account.bank_name && ` • ${account.bank_name}`}
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${isNegative ? 'text-red-600' : ''}`}>
                      {formatCurrency(account.current_balance)}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Conta</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Conta *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Conta Bradesco"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(accountTypeConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Banco</Label>
              <Input
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Ex: Bradesco"
              />
            </div>

            <div className="space-y-2">
              <Label>Saldo Inicial</Label>
              <Input
                type="number"
                step="0.01"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createAccount.isPending || !name}
            >
              {createAccount.isPending ? 'Salvando...' : 'Criar Conta'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
