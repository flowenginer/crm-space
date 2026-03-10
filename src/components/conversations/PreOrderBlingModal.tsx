import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Search,
  ClipboardPaste,
  Package,
} from 'lucide-react';
import { parseWhatsAppResponse, ParsedWhatsAppData } from '@/lib/parseWhatsAppResponse';
import { fetchAddressByCep } from '@/lib/viaCep';
import { useCreatePreOrderBling } from '@/hooks/usePreOrderBling';
import { listBlingVendedores } from '@/lib/blingSync';
import { toast } from 'sonner';

interface ContactData {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  cpf_cnpj?: string | null;
  person_type?: string | null;
  birth_date?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  zip_code?: string | null;
  city?: string | null;
  state?: string | null;
  custom_fields?: Record<string, unknown> | null;
}

interface PreOrderBlingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: ContactData | null;
  conversationId: string;
  negotiatedValue?: number;
  shirtQuantity?: number;
}

const ESTADOS_BR = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
  'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
];

export function PreOrderBlingModal({ open, onOpenChange, contact, conversationId, negotiatedValue = 0, shirtQuantity = 0 }: PreOrderBlingModalProps) {
  const createPreOrder = useCreatePreOrderBling();

  // Vendedores from Bling
  const { data: vendedores = [], isLoading: vendedoresLoading, isError: vendedoresError } = useQuery({
    queryKey: ['bling-vendedores'],
    queryFn: listBlingVendedores,
    enabled: open,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  // WhatsApp paste
  const [whatsappText, setWhatsappText] = useState('');

  // Client fields
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [nascimento, setNascimento] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [personType, setPersonType] = useState<'individual' | 'company'>('individual');

  // Address fields
  const [cep, setCep] = useState('');
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');

  // Sizes
  const [genero, setGenero] = useState<'M' | 'F' | ''>('');
  const [tamanhos, setTamanhos] = useState({ PP: 0, P: 0, M: 0, G: 0, GG: 0, XG: 0 });

  // Vendedor / Valor / Quantidade
  const [vendedorId, setVendedorId] = useState<number | null>(null);
  const [valorTotal, setValorTotal] = useState<number>(0);
  const [quantidade, setQuantidade] = useState<number>(0);

  // Notes
  const [observacoes, setObservacoes] = useState('');

  // UI state
  const [cepLoading, setCepLoading] = useState(false);

  // Previous orders from custom_fields
  const pedidosAnteriores = ((contact?.custom_fields as Record<string, unknown>)?.pedidos_bling as Array<{ numero: string; data: string }>) || [];

  // Pre-fill from contact when modal opens
  useEffect(() => {
    if (open && contact) {
      setNome(contact.full_name || '');
      setCpf(contact.cpf_cnpj || '');
      setEmail(contact.email || '');
      setTelefone(contact.phone || '');
      setPersonType((contact.person_type as 'individual' | 'company') || 'individual');
      setNascimento(contact.birth_date || '');
      setCep(contact.zip_code || '');
      setRua(contact.street || '');
      setNumero(contact.number || '');
      setComplemento(contact.complement || '');
      setBairro(contact.neighborhood || '');
      setCidade(contact.city || '');
      setEstado(contact.state || '');
      setWhatsappText('');
      setGenero('');
      setTamanhos({ PP: 0, P: 0, M: 0, G: 0, GG: 0, XG: 0 });
      setObservacoes('');
      setVendedorId(null);
      setValorTotal(negotiatedValue || 0);
      setQuantidade(shirtQuantity || 0);
    }
  }, [open, contact, negotiatedValue, shirtQuantity]);

  const totalUnidades = Object.values(tamanhos).reduce((sum, v) => sum + v, 0);

  const handleParse = () => {
    if (!whatsappText.trim()) {
      toast.error('Cole a resposta do WhatsApp primeiro');
      return;
    }

    const parsed: ParsedWhatsAppData = parseWhatsAppResponse(whatsappText);

    if (parsed.nome) setNome(parsed.nome);
    if (parsed.cpf) setCpf(parsed.cpf);
    if (parsed.data_nascimento) setNascimento(parsed.data_nascimento);
    if (parsed.email) setEmail(parsed.email);
    if (parsed.telefone) setTelefone(parsed.telefone);
    if (parsed.cep) setCep(parsed.cep);
    if (parsed.endereco) setRua(parsed.endereco);
    if (parsed.numero) setNumero(parsed.numero);
    if (parsed.complemento) setComplemento(parsed.complemento);
    if (parsed.bairro) setBairro(parsed.bairro);
    if (parsed.cidade) setCidade(parsed.cidade);
    if (parsed.estado) setEstado(parsed.estado);
    if (parsed.genero) setGenero(parsed.genero);
    if (parsed.tamanhos) setTamanhos(parsed.tamanhos);

    toast.success('Campos preenchidos automaticamente!');
  };

  const handleCepSearch = async () => {
    if (!cep || cep.replace(/\D/g, '').length !== 8) {
      toast.error('CEP inválido');
      return;
    }

    setCepLoading(true);
    try {
      const address = await fetchAddressByCep(cep);
      if (address) {
        setRua(address.logradouro || rua);
        setBairro(address.bairro || bairro);
        setCidade(address.localidade || cidade);
        setEstado(address.uf || estado);
        if (address.complemento) setComplemento(address.complemento);
        toast.success('Endereço encontrado!');
      } else {
        toast.error('CEP não encontrado');
      }
    } finally {
      setCepLoading(false);
    }
  };

  const buildObservacoes = (): string => {
    const parts: string[] = [];

    if (totalUnidades > 0) {
      const sizeEntries = Object.entries(tamanhos)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${k}(${v})`)
        .join(' ');
      parts.push(`TAMANHOS: ${sizeEntries}`);
      if (genero) parts.push(genero === 'F' ? 'FEMININO' : 'MASCULINO');
      parts.push(`Total: ${totalUnidades} unidades`);
    }

    if (observacoes.trim()) {
      parts.push(observacoes.trim());
    }

    return parts.join('\n');
  };

  const handleSubmit = async () => {
    if (!nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    if (!contact?.id) {
      toast.error('Contato não encontrado');
      return;
    }
    const hasAddress = cep.replace(/\D/g, '') && rua.trim() && cidade.trim() && estado.trim();

    await createPreOrder.mutateAsync({
      contactId: contact.id,
      contactData: {
        full_name: nome,
        phone: telefone || contact.phone || '',
        email: email || null,
        cpf_cnpj: cpf || null,
        person_type: personType,
        birth_date: nascimento || null,
        street: rua || null,
        number: numero || null,
        complement: complemento || null,
        neighborhood: bairro || null,
        zip_code: cep || null,
        city: cidade || null,
        state: estado || null,
      },
      endereco: hasAddress ? {
        nome,
        endereco: rua,
        numero: numero || 'S/N',
        complemento,
        municipio: cidade,
        uf: estado,
        cep: cep.replace(/\D/g, ''),
        bairro,
      } : undefined,
      observacoes: buildObservacoes(),
      observacoesInternas: 'Pré-pedido criado via CRM',
      vendedorId: vendedorId || undefined,
      valorUnitario: quantidade > 0 ? valorTotal / quantidade : valorTotal || undefined,
      quantidade: quantidade || undefined,
      valorTotal: valorTotal || undefined,
    });

    onOpenChange(false);
  };

  const updateSize = (size: keyof typeof tamanhos, value: string) => {
    const num = parseInt(value, 10);
    setTamanhos(prev => ({ ...prev, [size]: isNaN(num) ? 0 : Math.max(0, num) }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Package size={20} className="text-green-600" />
            Pré-Pedido Bling
          </DialogTitle>
          <DialogDescription>
            Preencha os dados ou cole a resposta do WhatsApp para preenchimento automático.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-140px)] px-6">
          <div className="space-y-5 pb-4">
            {/* WhatsApp Paste Section */}
            <div className="space-y-2 bg-muted/50 rounded-lg p-3">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <ClipboardPaste size={14} />
                Colar resposta do WhatsApp
              </Label>
              <Textarea
                placeholder="Cole aqui a resposta completa do cliente..."
                value={whatsappText}
                onChange={(e) => setWhatsappText(e.target.value)}
                rows={4}
                className="text-xs"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleParse}
                disabled={!whatsappText.trim()}
              >
                Preencher campos
              </Button>
            </div>

            {/* Client Data */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Dados do Cliente</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Nome *</Label>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">CPF/CNPJ</Label>
                  <Input value={cpf} onChange={(e) => setCpf(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nascimento</Label>
                  <Input value={nascimento} onChange={(e) => setNascimento(e.target.value)} placeholder="DD/MM/AAAA" className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">E-mail</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Telefone</Label>
                  <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tipo</Label>
                  <div className="flex gap-2 h-8 items-center">
                    <label className="flex items-center gap-1 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="personType"
                        checked={personType === 'individual'}
                        onChange={() => setPersonType('individual')}
                        className="w-3 h-3"
                      />
                      Física
                    </label>
                    <label className="flex items-center gap-1 text-xs cursor-pointer">
                      <input
                        type="radio"
                        name="personType"
                        checked={personType === 'company'}
                        onChange={() => setPersonType('company')}
                        className="w-3 h-3"
                      />
                      Jurídica
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Endereço</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">CEP</Label>
                  <div className="flex gap-1">
                    <Input value={cep} onChange={(e) => setCep(e.target.value)} className="h-8 text-sm" placeholder="00000-000" />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 shrink-0"
                      onClick={handleCepSearch}
                      disabled={cepLoading}
                    >
                      {cepLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                    </Button>
                  </div>
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Rua</Label>
                  <Input value={rua} onChange={(e) => setRua(e.target.value)} className="h-8 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Numero</Label>
                  <Input value={numero} onChange={(e) => setNumero(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Complemento</Label>
                  <Input value={complemento} onChange={(e) => setComplemento(e.target.value)} className="h-8 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Bairro</Label>
                  <Input value={bairro} onChange={(e) => setBairro(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cidade</Label>
                  <Input value={cidade} onChange={(e) => setCidade(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Estado</Label>
                  <select
                    value={estado}
                    onChange={(e) => setEstado(e.target.value)}
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">UF</option>
                    {ESTADOS_BR.map(uf => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Vendedor / Valor / Quantidade */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Pedido</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Vendedor</Label>
                  <select
                    value={vendedorId || ''}
                    onChange={(e) => setVendedorId(e.target.value ? Number(e.target.value) : null)}
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    disabled={vendedoresLoading}
                  >
                    <option value="">
                      {vendedoresLoading ? 'Carregando vendedores...' : vendedoresError ? 'Erro ao carregar vendedores' : vendedores.length === 0 ? 'Nenhum vendedor encontrado' : 'Selecionar vendedor'}
                    </option>
                    {vendedores.map((v) => (
                      <option key={v.id} value={v.id}>{v.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Valor Total (R$)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={valorTotal || ''}
                    onChange={(e) => setValorTotal(parseFloat(e.target.value) || 0)}
                    className="h-8 text-sm"
                    placeholder="0,00"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Quantidade</Label>
                  <Input
                    type="number"
                    min={0}
                    value={quantidade || ''}
                    onChange={(e) => setQuantidade(parseInt(e.target.value) || 0)}
                    className="h-8 text-sm"
                    placeholder="0"
                  />
                </div>
              </div>
              {valorTotal > 0 && (
                <p className="text-xs text-muted-foreground">
                  Total: <span className="font-semibold text-foreground">R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  {quantidade > 1 && (
                    <span> (R$ {(valorTotal / quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} por unidade)</span>
                  )}
                </p>
              )}
            </div>

            {/* Sizes */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Tamanhos e Quantidades</h4>
              <div className="flex gap-3 items-center mb-2">
                <Label className="text-xs">Gênero:</Label>
                <label className="flex items-center gap-1 text-xs cursor-pointer">
                  <input type="radio" name="genero" checked={genero === 'M'} onChange={() => setGenero('M')} className="w-3 h-3" />
                  Masculino
                </label>
                <label className="flex items-center gap-1 text-xs cursor-pointer">
                  <input type="radio" name="genero" checked={genero === 'F'} onChange={() => setGenero('F')} className="w-3 h-3" />
                  Feminino
                </label>
              </div>
              <div className="grid grid-cols-6 gap-2">
                {(Object.keys(tamanhos) as (keyof typeof tamanhos)[]).map(size => (
                  <div key={size} className="space-y-1 text-center">
                    <Label className="text-xs font-medium">{size}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={tamanhos[size] || ''}
                      onChange={(e) => updateSize(size, e.target.value)}
                      className="h-8 text-sm text-center"
                    />
                  </div>
                ))}
              </div>
              {totalUnidades > 0 && (
                <p className="text-xs text-muted-foreground">
                  Total: <span className="font-semibold text-foreground">{totalUnidades} unidades</span>
                </p>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Observações</h4>
              <Textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Observações adicionais para o pedido..."
                rows={3}
                className="text-sm"
              />
            </div>

            {/* Previous orders */}
            {pedidosAnteriores.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Pedidos Anteriores</h4>
                <div className="flex flex-wrap gap-1.5">
                  {pedidosAnteriores.map((p, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      #{p.numero}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createPreOrder.isPending || !nome.trim()}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {createPreOrder.isPending ? (
              <>
                <Loader2 size={14} className="animate-spin mr-1.5" />
                Criando...
              </>
            ) : (
              <>
                <Package size={14} className="mr-1.5" />
                Criar no Bling
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
