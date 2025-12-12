import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowRight } from 'lucide-react';
import { useFinancialAccounts, useTransferBetweenAccounts } from '@/hooks/useFinancial';

interface TransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TransferModal({ open, onOpenChange }: TransferModalProps) {
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const { data: accounts = [] } = useFinancialAccounts();
  const transfer = useTransferBetweenAccounts();

  const formatCurrency = (value: number | null | undefined) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0);
  };

  const fromAccount = accounts.find(a => a.id === fromAccountId);
  const toAccount = accounts.find(a => a.id === toAccountId);

  const handleSubmit = async () => {
    if (!fromAccountId || !toAccountId || !amount || fromAccountId === toAccountId) return;

    await transfer.mutateAsync({
      fromAccountId,
      toAccountId,
      amount: parseFloat(amount),
      description: description || 'Transferência entre contas',
    });

    onOpenChange(false);
    resetForm();
  };

  const resetForm = () => {
    setFromAccountId('');
    setToAccountId('');
    setAmount('');
    setDescription('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Transferência entre Contas</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-5 gap-2 items-end">
            <div className="col-span-2 space-y-2">
              <Label>Conta de Origem</Label>
              <Select value={fromAccountId} onValueChange={setFromAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.filter(a => a.id !== toAccountId).map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fromAccount && (
                <p className="text-xs text-muted-foreground">
                  Saldo: {formatCurrency(fromAccount.current_balance)}
                </p>
              )}
            </div>

            <div className="flex justify-center pb-2">
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="col-span-2 space-y-2">
              <Label>Conta de Destino</Label>
              <Select value={toAccountId} onValueChange={setToAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.filter(a => a.id !== fromAccountId).map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {toAccount && (
                <p className="text-xs text-muted-foreground">
                  Saldo: {formatCurrency(toAccount.current_balance)}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Valor *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
            />
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Transferência entre contas"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              transfer.isPending ||
              !fromAccountId ||
              !toAccountId ||
              !amount ||
              fromAccountId === toAccountId
            }
          >
            {transfer.isPending ? 'Transferindo...' : 'Transferir'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
