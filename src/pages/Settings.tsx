import { useState } from 'react';
import {
  Settings as SettingsIcon,
  Users,
  Building2,
  MessageSquare,
  Database,
  Bell,
  Shield,
  Palette,
  Plus,
  Edit3,
  Trash2,
  Search,
  MoreVertical,
  Check,
  X,
  Mail,
  Phone,
  ChevronRight,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';

// Mock data
const mockTeamMembers = [
  { id: '1', name: 'Diego Silva', email: 'diego@spacesports.com', phone: '+55 21 99999-0001', role: 'admin', department: 'Vendas', status: 'active', avatar: null },
  { id: '2', name: 'Ian Santos', email: 'ian@spacesports.com', phone: '+55 21 99999-0002', role: 'seller', department: 'Vendas', status: 'active', avatar: null },
  { id: '3', name: 'Lara Oliveira', email: 'lara@spacesports.com', phone: '+55 21 99999-0003', role: 'seller', department: 'Pós-vendas', status: 'active', avatar: null },
  { id: '4', name: 'Michel Costa', email: 'michel@spacesports.com', phone: '+55 21 99999-0004', role: 'supervisor', department: 'Suporte', status: 'inactive', avatar: null },
  { id: '5', name: 'Ricardo Pereira', email: 'ricardo@spacesports.com', phone: '+55 21 99999-0005', role: 'seller', department: 'Vendas', status: 'active', avatar: null },
];

const mockDepartments = [
  { id: '1', name: 'Vendas', description: 'Equipe de vendas e atendimento comercial', membersCount: 3, color: '#8B5CF6' },
  { id: '2', name: 'Pós-vendas', description: 'Acompanhamento de pedidos e suporte', membersCount: 1, color: '#EC4899' },
  { id: '3', name: 'Suporte', description: 'Atendimento técnico e dúvidas', membersCount: 1, color: '#3B82F6' },
  { id: '4', name: 'Financeiro', description: 'Cobranças e pagamentos', membersCount: 0, color: '#10B981' },
  { id: '5', name: 'Expedição', description: 'Logística e entregas', membersCount: 0, color: '#F59E0B' },
];

const mockChannels = [
  { id: '1', name: 'Vendas 01', phone: '+55 21 98765-0001', status: 'connected', type: 'whatsapp', department: 'Vendas' },
  { id: '2', name: 'Vendas 02', phone: '+55 21 98765-0002', status: 'connected', type: 'whatsapp', department: 'Vendas' },
  { id: '3', name: 'Suporte', phone: '+55 21 98765-0003', status: 'disconnected', type: 'whatsapp', department: 'Suporte' },
  { id: '4', name: 'Pós-vendas', phone: '+55 21 98765-0004', status: 'connected', type: 'whatsapp', department: 'Pós-vendas' },
];

const mockCustomFields = [
  { id: '1', name: 'Tamanho de camisa', type: 'select', options: ['P', 'M', 'G', 'GG', 'G1', 'G2', 'G3', 'G4'], entity: 'contact', required: false },
  { id: '2', name: 'Esporte preferido', type: 'text', options: [], entity: 'contact', required: false },
  { id: '3', name: 'Time/Equipe', type: 'text', options: [], entity: 'contact', required: false },
  { id: '4', name: 'Quantidade usual', type: 'number', options: [], entity: 'contact', required: false },
  { id: '5', name: 'Prazo de entrega', type: 'date', options: [], entity: 'deal', required: true },
];

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  supervisor: 'Supervisor',
  seller: 'Vendedor',
  user: 'Usuário',
};

const fieldTypeLabels: Record<string, string> = {
  text: 'Texto',
  number: 'Número',
  select: 'Seleção',
  date: 'Data',
  checkbox: 'Checkbox',
  email: 'Email',
  phone: 'Telefone',
};

export default function Settings() {
  const [teamMembers, setTeamMembers] = useState(mockTeamMembers);
  const [departments, setDepartments] = useState(mockDepartments);
  const [channels] = useState(mockChannels);
  const [customFields, setCustomFields] = useState(mockCustomFields);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  
  // Member form state
  const [memberForm, setMemberForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'seller',
    department: '',
  });
  
  // Department form state
  const [departmentForm, setDepartmentForm] = useState({
    name: '',
    description: '',
    color: '#8B5CF6',
  });
  
  // Custom field form state
  const [fieldForm, setFieldForm] = useState({
    name: '',
    type: 'text',
    options: '',
    entity: 'contact',
    required: false,
  });

  const filteredMembers = teamMembers.filter(member =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSaveMember = () => {
    if (!memberForm.name || !memberForm.email) {
      toast({ title: 'Erro', description: 'Preencha os campos obrigatórios', variant: 'destructive' });
      return;
    }
    
    if (editingItem) {
      setTeamMembers(prev => prev.map(m => m.id === editingItem.id ? { ...m, ...memberForm } : m));
      toast({ title: 'Membro atualizado', description: 'Dados salvos com sucesso' });
    } else {
      const newMember = { id: Date.now().toString(), ...memberForm, status: 'active', avatar: null };
      setTeamMembers(prev => [...prev, newMember]);
      toast({ title: 'Membro adicionado', description: 'Novo membro criado com sucesso' });
    }
    
    setShowMemberModal(false);
    setEditingItem(null);
    setMemberForm({ name: '', email: '', phone: '', role: 'seller', department: '' });
  };

  const handleSaveDepartment = () => {
    if (!departmentForm.name) {
      toast({ title: 'Erro', description: 'Nome do departamento é obrigatório', variant: 'destructive' });
      return;
    }
    
    if (editingItem) {
      setDepartments(prev => prev.map(d => d.id === editingItem.id ? { ...d, ...departmentForm } : d));
      toast({ title: 'Departamento atualizado', description: 'Dados salvos com sucesso' });
    } else {
      const newDept = { id: Date.now().toString(), ...departmentForm, membersCount: 0 };
      setDepartments(prev => [...prev, newDept]);
      toast({ title: 'Departamento criado', description: 'Novo departamento adicionado' });
    }
    
    setShowDepartmentModal(false);
    setEditingItem(null);
    setDepartmentForm({ name: '', description: '', color: '#8B5CF6' });
  };

  const handleSaveField = () => {
    if (!fieldForm.name) {
      toast({ title: 'Erro', description: 'Nome do campo é obrigatório', variant: 'destructive' });
      return;
    }
    
    const options = fieldForm.type === 'select' ? fieldForm.options.split(',').map(o => o.trim()).filter(Boolean) : [];
    
    if (editingItem) {
      setCustomFields(prev => prev.map(f => f.id === editingItem.id ? { ...f, ...fieldForm, options } : f));
      toast({ title: 'Campo atualizado', description: 'Dados salvos com sucesso' });
    } else {
      const newField = { id: Date.now().toString(), ...fieldForm, options };
      setCustomFields(prev => [...prev, newField]);
      toast({ title: 'Campo criado', description: 'Novo campo customizado adicionado' });
    }
    
    setShowFieldModal(false);
    setEditingItem(null);
    setFieldForm({ name: '', type: 'text', options: '', entity: 'contact', required: false });
  };

  const handleEditMember = (member: typeof mockTeamMembers[0]) => {
    setEditingItem(member);
    setMemberForm({
      name: member.name,
      email: member.email,
      phone: member.phone,
      role: member.role,
      department: member.department,
    });
    setShowMemberModal(true);
  };

  const handleEditDepartment = (dept: typeof mockDepartments[0]) => {
    setEditingItem(dept);
    setDepartmentForm({
      name: dept.name,
      description: dept.description,
      color: dept.color,
    });
    setShowDepartmentModal(true);
  };

  const handleEditField = (field: typeof mockCustomFields[0]) => {
    setEditingItem(field);
    setFieldForm({
      name: field.name,
      type: field.type,
      options: field.options.join(', '),
      entity: field.entity,
      required: field.required,
    });
    setShowFieldModal(true);
  };

  const handleDeleteMember = (id: string) => {
    setTeamMembers(prev => prev.filter(m => m.id !== id));
    toast({ title: 'Membro removido', description: 'Membro excluído com sucesso' });
  };

  const handleDeleteDepartment = (id: string) => {
    setDepartments(prev => prev.filter(d => d.id !== id));
    toast({ title: 'Departamento removido', description: 'Departamento excluído com sucesso' });
  };

  const handleDeleteField = (id: string) => {
    setCustomFields(prev => prev.filter(f => f.id !== id));
    toast({ title: 'Campo removido', description: 'Campo customizado excluído com sucesso' });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Configurações</h1>
          <p className="text-muted-foreground">
            Gerencie sua equipe, departamentos e personalize o sistema
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="team" className="w-full">
        <TabsList className="bg-card border border-border rounded-xl p-1 shadow-sm w-full flex mb-6">
          <TabsTrigger
            value="team"
            className="flex-1 flex items-center justify-center gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white rounded-lg"
          >
            <Users size={18} />
            Equipe
          </TabsTrigger>
          <TabsTrigger
            value="departments"
            className="flex-1 flex items-center justify-center gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white rounded-lg"
          >
            <Building2 size={18} />
            Departamentos
          </TabsTrigger>
          <TabsTrigger
            value="channels"
            className="flex-1 flex items-center justify-center gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white rounded-lg"
          >
            <MessageSquare size={18} />
            Canais
          </TabsTrigger>
          <TabsTrigger
            value="fields"
            className="flex-1 flex items-center justify-center gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white rounded-lg"
          >
            <Database size={18} />
            Campos
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className="flex-1 flex items-center justify-center gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white rounded-lg"
          >
            <Bell size={18} />
            Notificações
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Team Management */}
        <TabsContent value="team" className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar membro..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-xl text-sm focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <button
              onClick={() => {
                setEditingItem(null);
                setMemberForm({ name: '', email: '', phone: '', role: 'seller', department: '' });
                setShowMemberModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 btn-gradient text-white rounded-xl font-medium hover:shadow-lg transition-all"
            >
              <Plus size={18} />
              Novo Membro
            </button>
          </div>

          {/* Team Table */}
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Membro</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contato</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Função</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Departamento</th>
                  <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-muted/30">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-semibold">
                          {member.name.charAt(0)}
                        </div>
                        <span className="font-medium text-foreground">{member.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-foreground">
                          <Mail size={14} className="text-muted-foreground" />
                          {member.email}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone size={14} />
                          {member.phone}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        member.role === 'admin' ? 'bg-status-error/10 text-status-error' :
                        member.role === 'supervisor' ? 'bg-status-warning/10 text-status-warning' :
                        'bg-primary/10 text-primary'
                      }`}>
                        {roleLabels[member.role]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground">{member.department}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        member.status === 'active' ? 'bg-status-success/10 text-status-success' : 'bg-muted text-muted-foreground'
                      }`}>
                        {member.status === 'active' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleEditMember(member)}
                          className="p-2 hover:bg-muted rounded-lg transition-colors"
                        >
                          <Edit3 size={16} className="text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => handleDeleteMember(member.id)}
                          className="p-2 hover:bg-status-error/10 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} className="text-status-error" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* TAB 2: Departments */}
        <TabsContent value="departments" className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground">Organize sua equipe em departamentos</p>
            <button
              onClick={() => {
                setEditingItem(null);
                setDepartmentForm({ name: '', description: '', color: '#8B5CF6' });
                setShowDepartmentModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 btn-gradient text-white rounded-xl font-medium hover:shadow-lg transition-all"
            >
              <Plus size={18} />
              Novo Departamento
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {departments.map((dept) => (
              <div key={dept.id} className="bg-card rounded-2xl border border-border p-6 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${dept.color}20` }}
                  >
                    <Building2 size={24} style={{ color: dept.color }} />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                        <MoreVertical size={16} className="text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditDepartment(dept)}>
                        <Edit3 size={14} className="mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDeleteDepartment(dept.id)} className="text-status-error">
                        <Trash2 size={14} className="mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1">{dept.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">{dept.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {dept.membersCount} {dept.membersCount === 1 ? 'membro' : 'membros'}
                  </span>
                  <ChevronRight size={16} className="text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* TAB 3: Channels */}
        <TabsContent value="channels" className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground">Gerencie seus canais de atendimento WhatsApp</p>
            <button className="flex items-center gap-2 px-4 py-2.5 btn-gradient text-white rounded-xl font-medium hover:shadow-lg transition-all">
              <Plus size={18} />
              Conectar Canal
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {channels.map((channel) => (
              <div key={channel.id} className="bg-card rounded-2xl border border-border p-6 shadow-sm">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      channel.status === 'connected' ? 'bg-status-success/10' : 'bg-status-error/10'
                    }`}>
                      <MessageSquare size={24} className={
                        channel.status === 'connected' ? 'text-status-success' : 'text-status-error'
                      } />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{channel.name}</h3>
                      <p className="text-sm text-muted-foreground">{channel.phone}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    channel.status === 'connected' 
                      ? 'bg-status-success/10 text-status-success' 
                      : 'bg-status-error/10 text-status-error'
                  }`}>
                    {channel.status === 'connected' ? 'Conectado' : 'Desconectado'}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <span className="text-sm text-muted-foreground">Departamento: {channel.department}</span>
                  <button className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    channel.status === 'connected'
                      ? 'bg-status-error/10 text-status-error hover:bg-status-error/20'
                      : 'bg-status-success/10 text-status-success hover:bg-status-success/20'
                  }`}>
                    {channel.status === 'connected' ? 'Desconectar' : 'Reconectar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* TAB 4: Custom Fields */}
        <TabsContent value="fields" className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground">Crie campos personalizados para contatos e negócios</p>
            <button
              onClick={() => {
                setEditingItem(null);
                setFieldForm({ name: '', type: 'text', options: '', entity: 'contact', required: false });
                setShowFieldModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 btn-gradient text-white rounded-xl font-medium hover:shadow-lg transition-all"
            >
              <Plus size={18} />
              Novo Campo
            </button>
          </div>

          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome do Campo</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Entidade</th>
                  <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Obrigatório</th>
                  <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {customFields.map((field) => (
                  <tr key={field.id} className="hover:bg-muted/30">
                    <td className="px-6 py-4">
                      <div>
                        <span className="font-medium text-foreground">{field.name}</span>
                        {field.options.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Opções: {field.options.join(', ')}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-muted rounded-lg text-xs font-medium text-foreground">
                        {fieldTypeLabels[field.type]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-foreground capitalize">{field.entity === 'contact' ? 'Contato' : 'Negócio'}</td>
                    <td className="px-6 py-4 text-center">
                      {field.required ? (
                        <Check size={18} className="text-status-success mx-auto" />
                      ) : (
                        <X size={18} className="text-muted-foreground mx-auto" />
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleEditField(field)}
                          className="p-2 hover:bg-muted rounded-lg transition-colors"
                        >
                          <Edit3 size={16} className="text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => handleDeleteField(field.id)}
                          className="p-2 hover:bg-status-error/10 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} className="text-status-error" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* TAB 5: Notifications */}
        <TabsContent value="notifications" className="space-y-6">
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-foreground mb-6">Preferências de Notificação</h3>
            
            <div className="space-y-6">
              {[
                { id: 'new_message', title: 'Novas mensagens', description: 'Receba notificação quando uma nova mensagem chegar', defaultChecked: true },
                { id: 'new_deal', title: 'Novos negócios', description: 'Seja notificado quando um novo negócio for criado', defaultChecked: true },
                { id: 'deal_stage', title: 'Mudança de etapa', description: 'Notifique quando um negócio mudar de etapa no funil', defaultChecked: false },
                { id: 'sla_warning', title: 'Alerta de SLA', description: 'Avise quando um atendimento estiver perto do limite', defaultChecked: true },
                { id: 'daily_summary', title: 'Resumo diário', description: 'Receba um resumo diário das atividades', defaultChecked: false },
              ].map((setting) => (
                <div key={setting.id} className="flex items-center justify-between py-4 border-b border-border last:border-0">
                  <div>
                    <h4 className="font-medium text-foreground">{setting.title}</h4>
                    <p className="text-sm text-muted-foreground">{setting.description}</p>
                  </div>
                  <Switch defaultChecked={setting.defaultChecked} />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-foreground mb-6">Canais de Notificação</h3>
            
            <div className="space-y-4">
              {[
                { id: 'email', title: 'Email', icon: Mail, enabled: true },
                { id: 'push', title: 'Push (Navegador)', icon: Bell, enabled: true },
                { id: 'whatsapp', title: 'WhatsApp', icon: MessageSquare, enabled: false },
              ].map((channel) => (
                <div key={channel.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <channel.icon size={20} className="text-primary" />
                    </div>
                    <span className="font-medium text-foreground">{channel.title}</span>
                  </div>
                  <Switch defaultChecked={channel.enabled} />
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Member Modal */}
      <Dialog open={showMemberModal} onOpenChange={setShowMemberModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Membro' : 'Novo Membro'}</DialogTitle>
            <DialogDescription>
              {editingItem ? 'Atualize os dados do membro da equipe' : 'Adicione um novo membro à equipe'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Nome completo *</label>
              <input
                type="text"
                value={memberForm.name}
                onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Nome do membro"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Email *</label>
              <input
                type="email"
                value={memberForm.email}
                onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
                className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Telefone</label>
              <input
                type="tel"
                value={memberForm.phone}
                onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })}
                className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="+55 21 99999-0000"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Função</label>
                <select
                  value={memberForm.role}
                  onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
                  className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="seller">Vendedor</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="manager">Gerente</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Departamento</label>
                <select
                  value={memberForm.department}
                  onChange={(e) => setMemberForm({ ...memberForm, department: e.target.value })}
                  className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Selecione</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.name}>{dept.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <button
              onClick={() => setShowMemberModal(false)}
              className="px-4 py-2 text-muted-foreground hover:bg-muted rounded-lg"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveMember}
              className="px-6 py-2 btn-gradient text-white rounded-lg font-medium"
            >
              {editingItem ? 'Salvar' : 'Criar'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Department Modal */}
      <Dialog open={showDepartmentModal} onOpenChange={setShowDepartmentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Departamento' : 'Novo Departamento'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Nome *</label>
              <input
                type="text"
                value={departmentForm.name}
                onChange={(e) => setDepartmentForm({ ...departmentForm, name: e.target.value })}
                className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Nome do departamento"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Descrição</label>
              <textarea
                value={departmentForm.description}
                onChange={(e) => setDepartmentForm({ ...departmentForm, description: e.target.value })}
                className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
                rows={3}
                placeholder="Descrição do departamento"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Cor</label>
              <input
                type="color"
                value={departmentForm.color}
                onChange={(e) => setDepartmentForm({ ...departmentForm, color: e.target.value })}
                className="w-full h-12 rounded-xl cursor-pointer"
              />
            </div>
          </div>
          
          <DialogFooter>
            <button
              onClick={() => setShowDepartmentModal(false)}
              className="px-4 py-2 text-muted-foreground hover:bg-muted rounded-lg"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveDepartment}
              className="px-6 py-2 btn-gradient text-white rounded-lg font-medium"
            >
              {editingItem ? 'Salvar' : 'Criar'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Field Modal */}
      <Dialog open={showFieldModal} onOpenChange={setShowFieldModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Campo' : 'Novo Campo Customizado'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Nome do campo *</label>
              <input
                type="text"
                value={fieldForm.name}
                onChange={(e) => setFieldForm({ ...fieldForm, name: e.target.value })}
                className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Ex: Tamanho de camisa"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Tipo</label>
                <select
                  value={fieldForm.type}
                  onChange={(e) => setFieldForm({ ...fieldForm, type: e.target.value })}
                  className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="text">Texto</option>
                  <option value="number">Número</option>
                  <option value="select">Seleção</option>
                  <option value="date">Data</option>
                  <option value="checkbox">Checkbox</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Entidade</label>
                <select
                  value={fieldForm.entity}
                  onChange={(e) => setFieldForm({ ...fieldForm, entity: e.target.value })}
                  className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="contact">Contato</option>
                  <option value="deal">Negócio</option>
                </select>
              </div>
            </div>
            {fieldForm.type === 'select' && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Opções (separadas por vírgula)</label>
                <input
                  type="text"
                  value={fieldForm.options}
                  onChange={(e) => setFieldForm({ ...fieldForm, options: e.target.value })}
                  className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="P, M, G, GG"
                />
              </div>
            )}
            <div className="flex items-center gap-3">
              <Switch
                checked={fieldForm.required}
                onCheckedChange={(checked) => setFieldForm({ ...fieldForm, required: checked })}
              />
              <span className="text-sm text-foreground">Campo obrigatório</span>
            </div>
          </div>
          
          <DialogFooter>
            <button
              onClick={() => setShowFieldModal(false)}
              className="px-4 py-2 text-muted-foreground hover:bg-muted rounded-lg"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveField}
              className="px-6 py-2 btn-gradient text-white rounded-lg font-medium"
            >
              {editingItem ? 'Salvar' : 'Criar'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
