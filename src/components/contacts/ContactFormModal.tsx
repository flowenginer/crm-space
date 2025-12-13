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
import { toast } from 'sonner';
import { useCreateContact, useUpdateContact, type Contact } from '@/hooks/useContacts';
import { useDepartments } from '@/hooks/useDepartments';
import { useTeam } from '@/hooks/useTeam';
import { useLeadStatuses } from '@/hooks/useLeadKanban';

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
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Informações</TabsTrigger>
            <TabsTrigger value="address">Endereço</TabsTrigger>
            <TabsTrigger value="crm">CRM</TabsTrigger>
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
                  <Input
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                    className="mt-1"
                  />
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
                  <Input
                    placeholder="00000-000"
                    value={formData.zip_code}
                    onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                    className="mt-1"
                  />
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
