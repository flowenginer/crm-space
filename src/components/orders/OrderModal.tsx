import { useState, useEffect } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Package, Truck, CreditCard, FileText, Store, User, AlertTriangle, UserPlus } from 'lucide-react';
import { useCreateOrder } from '@/hooks/useOrders';
import { useContactsForERP, type ERPContact } from '@/hooks/useContactsForERP';
import { type Contact } from '@/hooks/useContacts';
import { useProductsForOrders, ProductForOrder } from '@/hooks/useProductsForOrders';
import { useActiveStores } from '@/hooks/useStores';
import { useTeam } from '@/hooks/useTeam';
import { useAuth } from '@/hooks/useAuth';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ContactFormModal } from '@/components/contacts/ContactFormModal';

interface OrderItem {
  product_name: string;
  variation_name?: string;
  display_name?: string;
  variation_id?: string;
  product_id?: string;
  sku?: string;
  unit_price: number;
  quantity: number;
  discount: number;
  discount_type: 'fixed' | 'percent';
}

interface OrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId?: string;
  contactId?: string;
}

const PAYMENT_METHODS = [
  { value: 'pix', label: 'PIX' },
  { value: 'credit_card', label: 'Cartão de Crédito' },
  { value: 'debit_card', label: 'Cartão de Débito' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'transfer', label: 'Transferência' },
];

const PAYMENT_CONDITIONS = [
  { value: 'full', label: 'À Vista / Integral' },
  { value: 'installments', label: 'Parcelado' },
  { value: 'down_payment', label: 'Entrada + Parcelas' },
];

const SHIPPING_METHODS = [
  { value: 'sedex', label: 'Sedex' },
  { value: 'pac', label: 'PAC' },
  { value: 'motoboy', label: 'Motoboy' },
  { value: 'pickup', label: 'Retirada' },
  { value: 'other', label: 'Outro' },
];

export function OrderModal({ open, onOpenChange, conversationId, contactId: initialContactId }: OrderModalProps) {
  const { user } = useAuth();
  
  // Form state
  const [contactId, setContactId] = useState(initialContactId || '');
  const [storeId, setStoreId] = useState('');
  const [sellerId, setSellerId] = useState(user?.id || '');
  const [items, setItems] = useState<OrderItem[]>([
    { product_name: '', unit_price: 0, quantity: 1, discount: 0, discount_type: 'fixed' }
  ]);
  
  // Discount
  const [totalDiscount, setTotalDiscount] = useState(0);
  const [totalDiscountType, setTotalDiscountType] = useState<'fixed' | 'percent'>('fixed');
  
  // Shipping
  const [shippingMethod, setShippingMethod] = useState('');
  const [shippingCost, setShippingCost] = useState(0);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  
  // Payment
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentCondition, setPaymentCondition] = useState('full');
  const [installments, setInstallments] = useState(1);
  const [downPaymentType, setDownPaymentType] = useState<'percent' | 'fixed'>('percent');
  const [downPaymentValue, setDownPaymentValue] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  
  // Notes
  const [customerNotes, setCustomerNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  
  // Search states
  const [contactSearch, setContactSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  
  // New contact modal
  const [showNewContactModal, setShowNewContactModal] = useState(false);

  // Data hooks
  const { data: contacts = [], isLoading: isLoadingContacts } = useContactsForERP(contactSearch);
  const { data: products = [] } = useProductsForOrders(productSearch);
  const { data: stores = [] } = useActiveStores();
  const { data: teamMembers = [] } = useTeam();
  const createOrder = useCreateOrder();

  useEffect(() => {
    if (user?.id && !sellerId) {
      setSellerId(user.id);
    }
  }, [user?.id]);

  // Update contactId when initialContactId changes (e.g., when modal opens from conversation)
  useEffect(() => {
    if (open && initialContactId) {
      setContactId(initialContactId);
    }
  }, [open, initialContactId]);
  
  const handleNewContactSuccess = (contact: Contact) => {
    setContactId(contact.id);
    setShowNewContactModal(false);
  };

  const addItem = () => {
    setItems([...items, { product_name: '', unit_price: 0, quantity: 1, discount: 0, discount_type: 'fixed' }]);
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

  const selectProduct = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      const newItems = [...items];
      newItems[index] = {
        ...newItems[index],
        variation_id: product.type === 'variation' ? product.id : undefined,
        product_id: product.product_id,
        product_name: product.product_name,
        variation_name: product.variation_name,
        display_name: product.display_name,
        sku: product.sku || '',
        unit_price: product.price,
      };
      setItems(newItems);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Calculate item subtotal with discount
  const getItemSubtotal = (item: OrderItem) => {
    const baseTotal = item.unit_price * item.quantity;
    if (item.discount_type === 'percent') {
      return baseTotal * (1 - item.discount / 100);
    }
    return baseTotal - item.discount;
  };

  // Calculate totals
  const itemsSubtotal = items.reduce((sum, item) => sum + getItemSubtotal(item), 0);
  const totalDiscountValue = totalDiscountType === 'percent' 
    ? itemsSubtotal * (totalDiscount / 100)
    : totalDiscount;
  const subtotalAfterDiscount = itemsSubtotal - totalDiscountValue;
  const total = subtotalAfterDiscount + shippingCost;

  // Payment calculations
  const downPaymentAmount = paymentCondition === 'down_payment'
    ? (downPaymentType === 'percent' ? total * (downPaymentValue / 100) : downPaymentValue)
    : 0;
  const remainingAmount = total - downPaymentAmount;
  const installmentAmount = paymentCondition !== 'full' && installments > 0 
    ? remainingAmount / installments 
    : total;

  const handleSubmit = async () => {
    if (items.some(item => !item.product_name || item.unit_price <= 0)) {
      return;
    }

    await createOrder.mutateAsync({
      contact_id: contactId || undefined,
      conversation_id: conversationId,
      store_id: storeId || undefined,
      seller_id: sellerId || undefined,
      items: items.map(item => ({
        product_name: item.product_name,
        variation_name: item.variation_name,
        variation_id: item.variation_id,
        sku: item.sku,
        unit_price: item.unit_price,
        quantity: item.quantity,
        discount_amount: item.discount_type === 'fixed' ? item.discount : 0,
        discount_percent: item.discount_type === 'percent' ? item.discount : 0,
      })),
      notes: customerNotes,
      internal_notes: internalNotes,
      shipping_method: shippingMethod || undefined,
      shipping_cost: shippingCost,
      expected_delivery_date: expectedDeliveryDate || undefined,
      payment_method: paymentMethod || undefined,
      payment_condition: paymentCondition,
      installments: paymentCondition === 'full' ? 1 : installments,
      down_payment_type: downPaymentType,
      down_payment_value: downPaymentValue,
      paid_amount: paidAmount,
      discount_amount: totalDiscountType === 'fixed' ? totalDiscount : 0,
      discount_percent: totalDiscountType === 'percent' ? totalDiscount : 0,
    });

    onOpenChange(false);
    resetForm();
  };

  const resetForm = () => {
    setContactId(initialContactId || '');
    setStoreId('');
    setSellerId(user?.id || '');
    setItems([{ product_name: '', unit_price: 0, quantity: 1, discount: 0, discount_type: 'fixed' }]);
    setTotalDiscount(0);
    setTotalDiscountType('fixed');
    setShippingMethod('');
    setShippingCost(0);
    setExpectedDeliveryDate('');
    setPaymentMethod('');
    setPaymentCondition('full');
    setInstallments(1);
    setDownPaymentType('percent');
    setDownPaymentValue(0);
    setPaidAmount(0);
    setCustomerNotes('');
    setInternalNotes('');
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh]">
        <DialogHeader>
          <DialogTitle>Novo Pedido</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="items" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="items" className="gap-2">
              <Package size={16} />
              Itens
            </TabsTrigger>
            <TabsTrigger value="shipping" className="gap-2">
              <Truck size={16} />
              Entrega
            </TabsTrigger>
            <TabsTrigger value="payment" className="gap-2">
              <CreditCard size={16} />
              Pagamento
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-2">
              <FileText size={16} />
              Observações
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[55vh] mt-4">
            {/* ITEMS TAB */}
            <TabsContent value="items" className="space-y-4 pr-4">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <User size={14} />
                    Cliente
                  </Label>
                  <div className="flex gap-2">
                    <Select value={contactId} onValueChange={setContactId}>
                      <SelectTrigger className="flex-1">
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
                        {isLoadingContacts ? (
                          <div className="p-3 text-center text-sm text-muted-foreground">
                            Buscando...
                          </div>
                        ) : contacts.length === 0 && contactSearch.length > 0 ? (
                          <div className="p-3 text-center text-sm text-muted-foreground">
                            Nenhum cliente encontrado
                          </div>
                        ) : (
                          contacts.slice(0, 10).map((contact) => (
                            <SelectItem key={contact.id} value={contact.id}>
                              {contact.full_name} - {contact.phone}
                            </SelectItem>
                          ))
                        )}
                        <Separator className="my-1" />
                        <button
                          type="button"
                          onClick={() => setShowNewContactModal(true)}
                          className="w-full flex items-center gap-2 px-2 py-2 text-sm text-primary hover:bg-muted rounded-sm transition-colors"
                        >
                          <UserPlus size={14} />
                          Criar novo cliente
                        </button>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowNewContactModal(true)}
                      title="Novo cliente"
                    >
                      <UserPlus size={16} />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Store size={14} />
                    Loja
                  </Label>
                  <Select value={storeId} onValueChange={setStoreId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a loja" />
                    </SelectTrigger>
                    <SelectContent>
                      {stores.map((store) => (
                        <SelectItem key={store.id} value={store.id}>
                          {store.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <User size={14} />
                    Vendedor
                  </Label>
                  <Select value={sellerId} onValueChange={setSellerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o vendedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {teamMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Items */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Itens do Pedido</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar Item
                  </Button>
                </div>

                {items.map((item, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-3 bg-muted/30">
                    <div className="flex flex-wrap lg:flex-nowrap gap-2 items-end">
                      {/* Produto - flexível */}
                      <div className="flex-1 min-w-[200px]">
                        <Label className="text-xs">Produto</Label>
                        <Select
                          value={item.variation_id || item.product_id || ''}
                          onValueChange={(value) => selectProduct(index, value)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecione um produto">
                              {item.display_name || 'Selecione um produto'}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="max-w-[500px]">
                            <div className="p-2">
                              <Input
                                placeholder="Buscar produto..."
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                className="mb-2"
                              />
                            </div>
                            {products.length === 0 ? (
                              <div className="p-4 text-center text-muted-foreground text-sm">
                                Nenhum produto encontrado
                              </div>
                            ) : (
                              products.slice(0, 15).map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  <div className="flex items-center gap-2 w-full">
                                    <Avatar className="h-6 w-6 flex-shrink-0">
                                      <AvatarImage src={p.image_url} />
                                      <AvatarFallback className="text-[10px]">
                                        <Package className="h-3 w-3" />
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col flex-1 min-w-0">
                                      <span className="text-sm">{p.display_name}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {p.sku ? `SKU: ${p.sku}` : ''} 
                                        {p.stock_quantity !== undefined && ` • Est: ${p.stock_quantity}`}
                                      </span>
                                    </div>
                                    <span className="text-sm font-medium whitespace-nowrap">
                                      {formatCurrency(p.price)}
                                    </span>
                                    {p.is_low_stock && (
                                      <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0" />
                                    )}
                                  </div>
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {/* Preço Unit. - largura fixa */}
                      <div className="w-28 shrink-0">
                        <Label className="text-xs">Preço Unit.</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      
                      {/* Quantidade - adapta ao conteúdo */}
                      <div className="w-20 shrink-0">
                        <Label className="text-xs">Qtd</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                          className="text-center"
                        />
                      </div>
                      
                      {/* Desconto - largura fixa */}
                      <div className="w-32 shrink-0">
                        <Label className="text-xs">Desconto</Label>
                        <div className="flex gap-1">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.discount}
                            onChange={(e) => updateItem(index, 'discount', parseFloat(e.target.value) || 0)}
                            className="flex-1"
                          />
                          <Select
                            value={item.discount_type}
                            onValueChange={(value: 'fixed' | 'percent') => updateItem(index, 'discount_type', value)}
                          >
                            <SelectTrigger className="w-14 shrink-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fixed">R$</SelectItem>
                              <SelectItem value="percent">%</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      {/* Total - não quebra linha */}
                      <div className="min-w-[100px] shrink-0 flex items-center justify-end gap-2">
                        <span className="text-sm font-semibold text-primary whitespace-nowrap">
                          {formatCurrency(getItemSubtotal(item))}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(index)}
                          disabled={items.length === 1}
                          className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Total Discount */}
              <div className="flex items-center gap-4">
                <Label>Desconto Total:</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={totalDiscount}
                  onChange={(e) => setTotalDiscount(parseFloat(e.target.value) || 0)}
                  className="w-32"
                />
                <Select
                  value={totalDiscountType}
                  onValueChange={(value: 'fixed' | 'percent') => setTotalDiscountType(value)}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">R$</SelectItem>
                    <SelectItem value="percent">%</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Totals Summary */}
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal dos itens:</span>
                  <span>{formatCurrency(itemsSubtotal)}</span>
                </div>
                {totalDiscountValue > 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span>Desconto:</span>
                    <span>-{formatCurrency(totalDiscountValue)}</span>
                  </div>
                )}
                {shippingCost > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Frete:</span>
                    <span>{formatCurrency(shippingCost)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span className="text-primary">{formatCurrency(total)}</span>
                </div>
              </div>
            </TabsContent>

            {/* SHIPPING TAB */}
            <TabsContent value="shipping" className="space-y-4 pr-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Método de Entrega</Label>
                  <Select value={shippingMethod} onValueChange={setShippingMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o método" />
                    </SelectTrigger>
                    <SelectContent>
                      {SHIPPING_METHODS.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Valor do Frete</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={shippingCost}
                    onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                    placeholder="0,00"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Previsão de Entrega</Label>
                  <Input
                    type="date"
                    value={expectedDeliveryDate}
                    onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                  />
                </div>
              </div>
            </TabsContent>

            {/* PAYMENT TAB */}
            <TabsContent value="payment" className="space-y-4 pr-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Forma de Pagamento</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a forma" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Condição de Pagamento</Label>
                  <Select value={paymentCondition} onValueChange={setPaymentCondition}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_CONDITIONS.map((condition) => (
                        <SelectItem key={condition.value} value={condition.value}>
                          {condition.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {paymentCondition === 'down_payment' && (
                  <>
                    <div className="space-y-2">
                      <Label>Tipo de Entrada</Label>
                      <Select 
                        value={downPaymentType} 
                        onValueChange={(v) => setDownPaymentType(v as 'percent' | 'fixed')}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percent">Percentual (%)</SelectItem>
                          <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>
                        {downPaymentType === 'percent' ? 'Percentual da Entrada (%)' : 'Valor da Entrada (R$)'}
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        step={downPaymentType === 'percent' ? '1' : '0.01'}
                        max={downPaymentType === 'percent' ? '100' : undefined}
                        value={downPaymentValue}
                        onChange={(e) => setDownPaymentValue(parseFloat(e.target.value) || 0)}
                        placeholder={downPaymentType === 'percent' ? '50' : '0,00'}
                      />
                    </div>
                  </>
                )}

                {paymentCondition !== 'full' && (
                  <div className="space-y-2">
                    <Label>Número de Parcelas</Label>
                    <Select 
                      value={installments.toString()} 
                      onValueChange={(v) => setInstallments(parseInt(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                          <SelectItem key={n} value={n.toString()}>
                            {n}x de {formatCurrency(installmentAmount)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Valor Pago Inicialmente</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                    placeholder="0,00"
                  />
                </div>
              </div>

              {/* Payment Summary */}
              {total > 0 && (
                <div className="p-4 rounded-lg border bg-muted/30 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-medium">{formatCurrency(total)}</span>
                  </div>
                  
                  {paymentCondition === 'down_payment' && downPaymentAmount > 0 && (
                    <>
                      <Separator />
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Entrada ({downPaymentType === 'percent' ? `${downPaymentValue}%` : 'fixo'}):
                        </span>
                        <span className="font-medium text-primary">{formatCurrency(downPaymentAmount)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          + {installments}x de:
                        </span>
                        <span className="font-medium">{formatCurrency(installmentAmount)}</span>
                      </div>
                    </>
                  )}
                  
                  {paymentCondition === 'installments' && installments > 1 && (
                    <>
                      <Separator />
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{installments}x de:</span>
                        <span className="font-medium">{formatCurrency(installmentAmount)}</span>
                      </div>
                    </>
                  )}

                  {paidAmount > 0 && (
                    <>
                      <Separator />
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Valor Pago:</span>
                        <span className="font-medium text-green-600">{formatCurrency(paidAmount)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Restante:</span>
                        <span className="font-medium">{formatCurrency(Math.max(total - paidAmount, 0))}</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </TabsContent>

            {/* NOTES TAB */}
            <TabsContent value="notes" className="space-y-4 pr-4">
              <div className="space-y-2">
                <Label>Observações para o Cliente</Label>
                <Textarea
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="Observações que serão visíveis para o cliente..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Observações Internas</Label>
                <Textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder="Observações internas (visíveis apenas para a equipe)..."
                  rows={4}
                />
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-lg font-bold">
            Total: <span className="text-primary">{formatCurrency(total)}</span>
          </div>
          <div className="flex gap-2">
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
        </div>
      </DialogContent>
      
      <ContactFormModal
        open={showNewContactModal}
        onOpenChange={setShowNewContactModal}
        onSuccess={handleNewContactSuccess}
        simplified
      />
    </Dialog>
  );
}
