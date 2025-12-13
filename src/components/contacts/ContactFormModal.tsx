import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { useCreateContact, useUpdateContact, type Contact } from '@/hooks/useContacts';
import { useDepartments } from '@/hooks/useDepartments';
import { useTeam } from '@/hooks/useTeam';
import { useLeadStatuses } from '@/hooks/useLeadKanban';
import { useContactHistory } from '@/hooks/useContactHistory';
import { useERPEnabled } from '@/hooks/useERPEnabled';
import { fetchAddressByCEP } from '@/utils/cep';
import { Loader2, Search, FileText, Package, ShoppingCart, DollarSign, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
const brazilianStates = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

interface ContactFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (contact: Contact) => void;
  initialData?: Contact | null;
  mode?: 'create' | 'edit';
  simplified?: boolean; // Modo simplificado para criação rápida
}

export function ContactFormModal({
  open,
  onOpenChange,
  onSuccess,
  initialData = null,
  mode = 'create',
  simplified = false,
}: ContactFormModalProps) {
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const { data: team = [] } = useTeam();
  const { data: departments = [] } = useDepartments();
  const { data: leadStatuses = [] } = useLeadStatuses();
  const isERPEnabled = useERPEnabled();
  
  // Contact history (only for edit mode)
  const { 
    quotes, 
    orders, 
    quotesCount, 
    ordersCount, 
    totalPurchased,
    totalOrdered,
    isLoading: isLoadingHistory 
  } = useContactHistory(mode === 'edit' && initialData ? initialData.id : null);

  const [isLoadingCEP, setIsLoadingCEP] = useState(false);

  const handleCEPSearch = async (cep: string) => {
    const cleanCEP = cep.replace(/\D/g, '');
    if (cleanCEP.length !== 8) {
      toast.error('CEP deve ter 8 dígitos');
      return;
    }

    setIsLoadingCEP(true);
    try {
      const address = await fetchAddressByCEP(cleanCEP);
      if (address) {
        setFormData(prev => ({
          ...prev,
          street: address.street,
          neighborhood: address.neighborhood,
          city: address.city,
          state: address.state,
        }));
        toast.success('Endereço encontrado!');
      } else {
        toast.error('CEP não encontrado');
      }
    } catch (error) {
      toast.error('Erro ao buscar CEP');
    } finally {
      setIsLoadingCEP(false);
    }
  };

  // Auto-busca quando CEP tem 8 dígitos
  const handleCEPChange = (value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    // Formata o CEP
    let formattedCEP = cleanValue;
    if (cleanValue.length > 5) {
      formattedCEP = cleanValue.slice(0, 5) + '-' + cleanValue.slice(5, 8);
    }
    setFormData(prev => ({ ...prev, zip_code: formattedCEP }));
    
    // Auto-busca quando completar 8 dígitos
    if (cleanValue.length === 8) {
      handleCEPSearch(cleanValue);
    }
  };

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    birth_date: '',
    cpf_cnpj: '',
    person_type: 'individual',
    contact_type: 'customer' as 'customer' | 'supplier' | 'both',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    zip_code: '',
    country: 'Brasil',
    lead_status: 'new',
    assigned_to: '',
    department_id: '',
    origin: '',
    notes: '',
  });

  useEffect(() => {
    if (open) {
      if (initialData) {
        setFormData({
          full_name: initialData.full_name || '',
          phone: initialData.phone || '',
          email: initialData.email || '',
          birth_date: initialData.birth_date || '',
          cpf_cnpj: initialData.cpf_cnpj || '',
          person_type: initialData.person_type || 'individual',
          contact_type: ((initialData as any).contact_type || 'customer') as 'customer' | 'supplier' | 'both',
          street: initialData.street || '',
          number: initialData.number || '',
          complement: initialData.complement || '',
          neighborhood: initialData.neighborhood || '',
          city: initialData.city || '',
          state: initialData.state || '',
          zip_code: initialData.zip_code || '',
          country: initialData.country || 'Brasil',
          lead_status: initialData.lead_status || 'new',
          assigned_to: initialData.assigned_to || '',
          department_id: initialData.department_id || '',
          origin: initialData.origin || '',
          notes: initialData.notes || '',
        });
      } else {
        // Reset form for new contact
        setFormData({
          full_name: '',
          phone: '',
          email: '',
          birth_date: '',
          cpf_cnpj: '',
          person_type: 'individual',
          contact_type: 'customer',
          street: '',
          number: '',
          complement: '',
          neighborhood: '',
          city: '',
          state: '',
          zip_code: '',
          country: 'Brasil',
          lead_status: 'new',
          assigned_to: '',
          department_id: '',
          origin: '',
          notes: '',
        });
      }
    }
  }, [open, initialData]);

  const handleSave = async () => {
    if (!formData.full_name || !formData.phone) {
      toast.error('Nome e telefone são obrigatórios');
      return;
    }

    try {
      if (mode === 'edit' && initialData) {
        await updateContact.mutateAsync({
          id: initialData.id,
          ...formData,
          email: formData.email || null,
          birth_date: formData.birth_date || null,
          assigned_to: formData.assigned_to || null,
          department_id: formData.department_id || null,
          contact_type: formData.contact_type,
        } as any);
        toast.success('Contato atualizado com sucesso!');
        onOpenChange(false);
        // For edit, we pass back the initial data with updates
        onSuccess?.({ ...initialData, ...formData } as Contact);
      } else {
        const result = await createContact.mutateAsync({
          ...formData,
          email: formData.email || null,
          birth_date: formData.birth_date || null,
          assigned_to: formData.assigned_to || null,
          department_id: formData.department_id || null,
          contact_type: formData.contact_type,
        } as any);
        toast.success('Contato criado com sucesso!');
        onOpenChange(false);
        // The mutation returns the created contact
        if (result) {
          onSuccess?.(result as Contact);
        }
      }
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao salvar contato');
    }
  };

  const isLoading = createContact.isPending || updateContact.isPending;

  // Modo simplificado: apenas campos básicos
  if (simplified) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {mode === 'edit' ? 'Editar Contato' : 'Novo Contato'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>
                Nome completo <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Ex: Fernando Silva Santos"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>
                Telefone / WhatsApp <span className="text-destructive">*</span>
              </Label>
              <Input
                type="tel"
                placeholder="+55 (00) 00000-0000"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>CPF / CNPJ</Label>
              <Input
                placeholder="000.000.000-00"
                value={formData.cpf_cnpj}
                onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? 'Salvando...' : mode === 'edit' ? 'Atualizar' : 'Criar Contato'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Modo completo com todas as abas
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {mode === 'edit' ? 'Editar Contato' : 'Novo Contato'}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className={`grid w-full ${mode === 'edit' && isERPEnabled ? 'grid-cols-4' : 'grid-cols-3'}`}>
            <TabsTrigger value="basic">Informações</TabsTrigger>
            <TabsTrigger value="address">Endereço</TabsTrigger>
            <TabsTrigger value="crm">CRM</TabsTrigger>
            {mode === 'edit' && isERPEnabled && (
              <TabsTrigger value="history">Histórico</TabsTrigger>
            )}
          </TabsList>

          <ScrollArea className="h-[50vh] mt-4 pr-4">
            <TabsContent value="basic" className="space-y-4">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center text-primary-foreground text-2xl font-bold shadow-xl">
                  {formData.full_name?.charAt(0) || 'N'}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Foto do contato</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>
                    Nome completo <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="Ex: Fernando Silva Santos"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>
                    Telefone / WhatsApp <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="tel"
                    placeholder="+55 (00) 00000-0000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="email@exemplo.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Data de nascimento</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal mt-1",
                          !formData.birth_date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.birth_date 
                          ? format(new Date(formData.birth_date + 'T00:00:00'), "dd/MM/yyyy")
                          : "dd/mm/aaaa"
                        }
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        captionLayout="dropdown-buttons"
                        fromYear={1920}
                        toYear={new Date().getFullYear()}
                        selected={formData.birth_date ? new Date(formData.birth_date + 'T00:00:00') : undefined}
                        onSelect={(date) => setFormData({ 
                          ...formData, 
                          birth_date: date ? format(date, "yyyy-MM-dd") : "" 
                        })}
                        locale={ptBR}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label>CPF / CNPJ</Label>
                  <Input
                    placeholder="000.000.000-00"
                    value={formData.cpf_cnpj}
                    onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value })}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Tipo de pessoa</Label>
                  <div className="flex gap-4 mt-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        value="individual"
                        checked={formData.person_type === 'individual'}
                        onChange={(e) => setFormData({ ...formData, person_type: e.target.value })}
                      />
                      <span className="text-sm">Pessoa física</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        value="company"
                        checked={formData.person_type === 'company'}
                        onChange={(e) => setFormData({ ...formData, person_type: e.target.value })}
                      />
                      <span className="text-sm">Pessoa jurídica</span>
                    </label>
                  </div>
                </div>

                <div>
                  <Label>Tipo de contato</Label>
                  <div className="flex gap-4 mt-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        value="customer"
                        checked={formData.contact_type === 'customer'}
                        onChange={(e) => setFormData({ ...formData, contact_type: e.target.value as 'customer' | 'supplier' | 'both' })}
                      />
                      <span className="text-sm">Cliente</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        value="supplier"
                        checked={formData.contact_type === 'supplier'}
                        onChange={(e) => setFormData({ ...formData, contact_type: e.target.value as 'customer' | 'supplier' | 'both' })}
                      />
                      <span className="text-sm">Fornecedor</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        value="both"
                        checked={formData.contact_type === 'both'}
                        onChange={(e) => setFormData({ ...formData, contact_type: e.target.value as 'customer' | 'supplier' | 'both' })}
                      />
                      <span className="text-sm">Ambos</span>
                    </label>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="address" className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>CEP</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      placeholder="00000-000"
                      value={formData.zip_code}
                      onChange={(e) => handleCEPChange(e.target.value)}
                      maxLength={9}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleCEPSearch(formData.zip_code)}
                      disabled={isLoadingCEP}
                    >
                      {isLoadingCEP ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="col-span-2">
                  <Label>Logradouro</Label>
                  <Input
                    placeholder="Rua, Avenida..."
                    value={formData.street}
                    onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Número</Label>
                  <Input
                    placeholder="123"
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Complemento</Label>
                  <Input
                    placeholder="Apto, Sala, Bloco..."
                    value={formData.complement}
                    onChange={(e) => setFormData({ ...formData, complement: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Bairro</Label>
                  <Input
                    placeholder="Centro"
                    value={formData.neighborhood}
                    onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Cidade</Label>
                  <Input
                    placeholder="São Paulo"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Estado</Label>
                  <select
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="mt-1 w-full h-10 px-3 border border-input rounded-md bg-background text-sm"
                  >
                    <option value="">Selecione</option>
                    {brazilianStates.map((state) => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <Label>País</Label>
                <Input
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="mt-1"
                />
              </div>
            </TabsContent>

            <TabsContent value="crm" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Status do Lead</Label>
                  <select
                    value={formData.lead_status}
                    onChange={(e) => setFormData({ ...formData, lead_status: e.target.value })}
                    className="mt-1 w-full h-10 px-3 border border-input rounded-md bg-background text-sm"
                  >
                    <option value="">Selecione</option>
                    {leadStatuses.map((status) => (
                      <option key={status.id} value={status.name}>
                        {status.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label>Origem</Label>
                  <select
                    value={formData.origin}
                    onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                    className="mt-1 w-full h-10 px-3 border border-input rounded-md bg-background text-sm"
                  >
                    <option value="">Selecione</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="instagram">Instagram</option>
                    <option value="facebook">Facebook</option>
                    <option value="website">Website</option>
                    <option value="indicacao">Indicação</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>

                <div>
                  <Label>Atendente responsável</Label>
                  <select
                    value={formData.assigned_to}
                    onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                    className="mt-1 w-full h-10 px-3 border border-input rounded-md bg-background text-sm"
                  >
                    <option value="">Selecione</option>
                    {team.map((member) => (
                      <option key={member.id} value={member.id}>{member.full_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label>Departamento</Label>
                  <select
                    value={formData.department_id}
                    onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                    className="mt-1 w-full h-10 px-3 border border-input rounded-md bg-background text-sm"
                  >
                    <option value="">Selecione</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <Label>Observações</Label>
                  <textarea
                    rows={3}
                    placeholder="Anotações sobre o contato..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border border-input rounded-md bg-background text-sm resize-none"
                  />
                </div>
              </div>
            </TabsContent>

            {/* History Tab - Only visible in edit mode with ERP enabled */}
            {mode === 'edit' && isERPEnabled && (
              <TabsContent value="history" className="space-y-4">
                {isLoadingHistory ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-3 gap-3">
                      <Card>
                        <CardContent className="p-4 text-center">
                          <FileText className="w-5 h-5 mx-auto mb-1 text-amber-500" />
                          <div className="text-2xl font-bold">{quotesCount}</div>
                          <div className="text-xs text-muted-foreground">Orçamentos</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <Package className="w-5 h-5 mx-auto mb-1 text-green-500" />
                          <div className="text-2xl font-bold">{ordersCount}</div>
                          <div className="text-xs text-muted-foreground">Pedidos</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-4 text-center">
                          <DollarSign className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                          <div className="text-lg font-bold">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalOrdered)}
                          </div>
                          <div className="text-xs text-muted-foreground">Total em Pedidos</div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Quotes and Orders Lists */}
                    <Accordion type="multiple" defaultValue={['quotes', 'orders']} className="space-y-2">
                      <AccordionItem value="quotes" className="border rounded-lg">
                        <AccordionTrigger className="px-4 hover:no-underline">
                          <span className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-amber-500" />
                            Orçamentos ({quotesCount})
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4">
                          {quotes.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              Nenhum orçamento encontrado
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {quotes.map((quote) => (
                                <div key={quote.id} className="flex items-center justify-between py-2 border-b last:border-0">
                                  <div>
                                    <span className="font-medium text-sm">#{quote.quote_number}</span>
                                    <span className="text-xs text-muted-foreground ml-2">
                                      {format(new Date(quote.created_at), "dd/MM/yyyy", { locale: ptBR })}
                                    </span>
                                    <Badge variant="outline" className="ml-2 text-xs">
                                      {quote.status === 'pending' ? 'Pendente' :
                                       quote.status === 'approved' ? 'Aprovado' :
                                       quote.status === 'rejected' ? 'Rejeitado' :
                                       quote.status === 'converted' ? 'Convertido' : quote.status}
                                    </Badge>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-medium text-sm">
                                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(quote.total)}
                                    </div>
                                    {quote.seller_profile?.full_name && (
                                      <div className="text-xs text-muted-foreground">
                                        por {quote.seller_profile.full_name}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="orders" className="border rounded-lg">
                        <AccordionTrigger className="px-4 hover:no-underline">
                          <span className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-green-500" />
                            Pedidos ({ordersCount})
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4">
                          {orders.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              Nenhum pedido encontrado
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {orders.map((order) => (
                                <div key={order.id} className="flex items-center justify-between py-2 border-b last:border-0">
                                  <div>
                                    <span className="font-medium text-sm">#{order.order_number}</span>
                                    <span className="text-xs text-muted-foreground ml-2">
                                      {format(new Date(order.created_at), "dd/MM/yyyy", { locale: ptBR })}
                                    </span>
                                    <Badge 
                                      variant="outline" 
                                      className={`ml-2 text-xs ${
                                        order.status === 'delivered' || order.status === 'completed' 
                                          ? 'border-green-500 text-green-500' 
                                          : order.status === 'cancelled' 
                                          ? 'border-red-500 text-red-500' 
                                          : ''
                                      }`}
                                    >
                                      {order.status === 'pending' ? 'Pendente' :
                                       order.status === 'confirmed' ? 'Confirmado' :
                                       order.status === 'processing' ? 'Em Preparo' :
                                       order.status === 'shipped' ? 'Enviado' :
                                       order.status === 'delivered' ? 'Entregue' :
                                       order.status === 'completed' ? 'Concluído' :
                                       order.status === 'cancelled' ? 'Cancelado' : order.status}
                                    </Badge>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-medium text-sm">
                                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total)}
                                    </div>
                                    {order.seller_profile?.full_name && (
                                      <div className="text-xs text-muted-foreground">
                                        por {order.seller_profile.full_name}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </>
                )}
              </TabsContent>
            )}
          </ScrollArea>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? 'Salvando...' : mode === 'edit' ? 'Atualizar' : 'Criar Contato'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
