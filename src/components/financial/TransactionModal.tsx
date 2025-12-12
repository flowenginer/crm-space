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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateTransaction, useFinancialCategories } from '@/hooks/useFinancial';
import { useContacts } from '@/hooks/useContacts';

interface TransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'income' | 'expense';
}

export function TransactionModal({ open, onOpenChange, type }: TransactionModalProps) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [categoryId, setCategoryId] = useState('');
  const [contactId, setContactId] = useState('');
  const [notes, setNotes] = useState('');
  const [installments, setInstallments] = useState('1');
  const [contactType, setContactType] = useState<'customer' | 'supplier'>(
    type === 'income' ? 'customer' : 'supplier'
  );

  const { data: categories = [] } = useFinancialCategories(type);
  const { data: contacts = [] } = useContacts();
  const createTransaction = useCreateTransaction();

  // Filtrar contatos por tipo
  const filteredContacts = contacts.filter((contact) => {
    const ct = (contact as any).contact_type || 'customer';
    return ct === contactType || ct === 'both';
  });

  const handleSubmit = async () => {
    if (!description || !amount || !dueDate) return;

    await createTransaction.mutateAsync({
      type,
      description,
      amount: parseFloat(amount),
      due_date: dueDate,
      category_id: categoryId || undefined,
      contact_id: contactId || undefined,
      notes: notes || undefined,
      installments: parseInt(installments) || 1,
    });

    onOpenChange(false);
    resetForm();
  };

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setDueDate(new Date().toISOString().split('T')[0]);
    setCategoryId('');
    setContactId('');
    setNotes('');
    setInstallments('1');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {type === 'income' ? 'Nova Receita' : 'Nova Despesa'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Venda de produto"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
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
              <Label>Vencimento *</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{type === 'income' ? 'Cliente' : 'Fornecedor'}</Label>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => { setContactType('customer'); setContactId(''); }}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  contactType === 'customer'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-foreground border-border hover:bg-muted'
                }`}
              >
                Cliente
              </button>
              <button
                type="button"
                onClick={() => { setContactType('supplier'); setContactId(''); }}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  contactType === 'supplier'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-foreground border-border hover:bg-muted'
                }`}
              >
                Fornecedor
              </button>
            </div>
            <Select value={contactId} onValueChange={setContactId}>
              <SelectTrigger>
                <SelectValue placeholder={`Selecione um ${contactType === 'customer' ? 'cliente' : 'fornecedor'}`} />
              </SelectTrigger>
              <SelectContent>
                {filteredContacts.slice(0, 50).map((contact) => (
                  <SelectItem key={contact.id} value={contact.id}>
                    {contact.full_name}
                  </SelectItem>
                ))}
                {filteredContacts.length === 0 && (
                  <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                    Nenhum {contactType === 'customer' ? 'cliente' : 'fornecedor'} cadastrado
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Parcelas</Label>
            <Select value={installments} onValueChange={setInstallments}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                  <SelectItem key={n} value={n.toString()}>
                    {n}x {n > 1 && `de R$ ${(parseFloat(amount || '0') / n).toFixed(2)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações opcionais..."
              rows={2}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createTransaction.isPending || !description || !amount}
          >
            {createTransaction.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
