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
import { Plus, Trash2 } from 'lucide-react';
import { useCreateOrder } from '@/hooks/useOrders';
import { useContacts } from '@/hooks/useContacts';
import { useAllVariations } from '@/hooks/useProductVariations';
import { ScrollArea } from '@/components/ui/scroll-area';

interface OrderItem {
  product_name: string;
  variation_name?: string;
  variation_id?: string;
  sku?: string;
  unit_price: number;
  quantity: number;
}

interface OrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId?: string;
  contactId?: string;
}

export function OrderModal({ open, onOpenChange, conversationId, contactId: initialContactId }: OrderModalProps) {
  const [contactId, setContactId] = useState(initialContactId || '');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<OrderItem[]>([
    { product_name: '', unit_price: 0, quantity: 1 }
  ]);
  const [contactSearch, setContactSearch] = useState('');
  const [variationSearch, setVariationSearch] = useState('');

  const { data: contacts = [] } = useContacts();
  const { data: variations = [] } = useAllVariations();
  const createOrder = useCreateOrder();

  const filteredContacts = contacts.filter(c => 
    c.full_name.toLowerCase().includes(contactSearch.toLowerCase()) ||
    c.phone.includes(contactSearch)
  );

  const filteredVariations = variations.filter(v =>
    v.variation_name?.toLowerCase().includes(variationSearch.toLowerCase()) ||
    v.sku?.toLowerCase().includes(variationSearch.toLowerCase())
  );

  const addItem = () => {
    setItems([...items, { product_name: '', unit_price: 0, quantity: 1 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof OrderItem, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const selectVariation = (index: number, variationId: string) => {
    const variation = variations.find(v => v.id === variationId);
    if (variation) {
      const newItems = [...items];
      newItems[index] = {
        ...newItems[index],
        variation_id: variation.id,
        product_name: variation.product?.name || variation.variation_name || '',
        variation_name: variation.variation_name || undefined,
        sku: variation.sku || '',
        unit_price: variation.price || variation.product?.base_price || 0,
      };
      setItems(newItems);
    }
  };

  const total = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);

  const handleSubmit = async () => {
    if (items.some(item => !item.product_name || item.unit_price <= 0)) {
      return;
    }

    await createOrder.mutateAsync({
      contact_id: contactId || undefined,
      conversation_id: conversationId,
      items: items.map(item => ({
        product_name: item.product_name,
        variation_name: item.variation_name,
        variation_id: item.variation_id,
        sku: item.sku,
        unit_price: item.unit_price,
        quantity: item.quantity,
      })),
      notes,
    });

    onOpenChange(false);
    resetForm();
  };

  const resetForm = () => {
    setContactId(initialContactId || '');
    setNotes('');
    setItems([{ product_name: '', unit_price: 0, quantity: 1 }]);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Novo Pedido</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Cliente */}
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={contactId} onValueChange={setContactId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <Input
                      placeholder="Buscar cliente..."
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                      className="mb-2"
                    />
                  </div>
                  {filteredContacts.slice(0, 10).map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.full_name} - {contact.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Itens */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Itens do Pedido</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Item
                </Button>
              </div>

              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end p-3 border rounded-lg">
                  <div className="col-span-5">
                    <Label className="text-xs">Produto</Label>
                    <Select
                      value={item.variation_id || ''}
                      onValueChange={(value) => selectVariation(index, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione ou digite" />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="p-2">
                          <Input
                            placeholder="Buscar produto..."
                            value={variationSearch}
                            onChange={(e) => setVariationSearch(e.target.value)}
                            className="mb-2"
                          />
                        </div>
                        {filteredVariations.slice(0, 10).map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.product?.name} {v.variation_name ? `- ${v.variation_name}` : ''} {v.sku ? `(${v.sku})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!item.variation_id && (
                      <Input
                        placeholder="Ou digite o nome"
                        value={item.product_name}
                        onChange={(e) => updateItem(index, 'product_name', e.target.value)}
                        className="mt-1"
                      />
                    )}
                  </div>
                  <div className="col-span-3">
                    <Label className="text-xs">Preço Unit.</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.unit_price}
                      onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Qtd</Label>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div className="col-span-2 flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {formatCurrency(item.unit_price * item.quantity)}
                    </span>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(index)}
                        className="h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              <div className="flex justify-end p-3 bg-muted rounded-lg">
                <div className="text-lg font-bold">
                  Total: {formatCurrency(total)}
                </div>
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações do pedido..."
                rows={3}
              />
            </div>
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={createOrder.isPending || items.some(i => !i.product_name)}
          >
            {createOrder.isPending ? 'Criando...' : 'Criar Pedido'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
