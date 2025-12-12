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
import { useRegisterPayment, useFinancialAccounts, FinancialTransaction } from '@/hooks/useFinancial';

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: FinancialTransaction | null;
}

export function PaymentModal({ open, onOpenChange, transaction }: PaymentModalProps) {
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');

  const { data: accounts = [] } = useFinancialAccounts();
  const registerPayment = useRegisterPayment();

  const remainingAmount = transaction ? transaction.amount - (transaction.paid_amount || 0) : 0;

  const handleSubmit = async () => {
    if (!transaction || !accountId || !amount) return;

    await registerPayment.mutateAsync({
      transactionId: transaction.id,
      accountId,
      amount: parseFloat(amount),
    });

    onOpenChange(false);
    setAccountId('');
    setAmount('');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Pagamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <p className="font-medium">{transaction.description}</p>
            <div className="flex justify-between text-sm">
              <span>Valor total:</span>
              <span className="font-medium">{formatCurrency(transaction.amount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Já pago:</span>
              <span>{formatCurrency(transaction.paid_amount || 0)}</span>
            </div>
            <div className="flex justify-between text-sm font-medium">
              <span>Restante:</span>
              <span className={remainingAmount > 0 ? 'text-orange-600' : 'text-green-600'}>
                {formatCurrency(remainingAmount)}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Conta *</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a conta" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.name} ({formatCurrency(acc.current_balance || 0)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Valor do Pagamento *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max={remainingAmount}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={formatCurrency(remainingAmount)}
            />
            <Button
              type="button"
              variant="link"
              size="sm"
              className="p-0 h-auto"
              onClick={() => setAmount(remainingAmount.toString())}
            >
              Pagar valor total restante
            </Button>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={registerPayment.isPending || !accountId || !amount}
          >
            {registerPayment.isPending ? 'Processando...' : 'Confirmar Pagamento'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
