import { useState } from 'react';
import {
  Search,
  Plus,
  Upload,
  Download,
  Trash2,
  Tag,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowRight,
  MessageCircle,
  Edit3,
  UserCheck,
  RefreshCw,
  Calendar,
  Check,
  AlertTriangle,
  X,
  Users,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';

interface Contact {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  state: string;
  city: string;
  leadStatus: 'new' | 'active' | 'qualified' | 'unqualified' | 'client';
  tags: string[];
  firstContact: string;
  lastInteraction: string;
  assignedTo: { id: string; name: string; avatar: string | null };
  department: string;
  avatarUrl: string | null;
  isOnline: boolean;
}

interface TagItem {
  name: string;
  color: string;
  count: number;
}

const mockTags: TagItem[] = [
  { name: 'Urgente', color: '#EF4444', count: 234 },
  { name: 'VIP', color: '#F59E0B', count: 89 },
  { name: 'Follow-up', color: '#3B82F6', count: 567 },
  { name: 'Cliente', color: '#10B981', count: 1243 },
  { name: 'Lead', color: '#8B5CF6', count: 2456 },
  { name: 'Novo Lead', color: '#8B5CF6', count: 890 },
  { name: 'Recorrente', color: '#14B8A6', count: 345 },
];

const brazilianStates = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const mockContacts: Contact[] = [
  {
    id: '1',
    fullName: 'Fernando TR Terraplanagem Rincón',
    phone: '+55 (21) 98533-2473',
    email: 'fernando@terraplanagem.com',
    state: 'RJ',
    city: 'Rio de Janeiro',
    leadStatus: 'qualified',
    tags: ['Urgente', 'VIP', 'Follow-up'],
    firstContact: '2025-11-15T10:00:00',
    lastInteraction: '2025-12-03T15:19:00',
    assignedTo: { id: 'user-1', name: 'Diego', avatar: null },
    department: 'Vendas',
    avatarUrl: null,
    isOnline: true,
  },
  {
    id: '2',
    fullName: 'Fernando Cofsevicz',
    phone: '+55 (21) 97654-3210',
    email: 'fernando.cofsevicz@email.com',
    state: 'SP',
    city: 'São Paulo',
    leadStatus: 'new',
    tags: ['Novo Lead'],
    firstContact: '2025-12-01T08:00:00',
    lastInteraction: '2025-12-03T12:49:00',
    assignedTo: { id: 'user-2', name: 'Ian', avatar: null },
    department: 'Pré-vendas',
    avatarUrl: null,
    isOnline: true,
  },
  {
    id: '3',
    fullName: 'Fernando Serpa',
    phone: '+55 (11) 99876-5432',
    email: 'fserpa@empresa.com.br',
    state: 'SP',
    city: 'Campinas',
    leadStatus: 'client',
    tags: ['Cliente', 'Recorrente'],
    firstContact: '2025-10-20T14:30:00',
    lastInteraction: '2025-12-03T06:53:00',
    assignedTo: { id: 'user-1', name: 'Diego', avatar: null },
    department: 'Vendas',
    avatarUrl: null,
    isOnline: false,
  },
  {
    id: '4',
    fullName: 'Maria Silva Santos',
    phone: '+55 (21) 99999-8888',
    email: 'maria.silva@gmail.com',
    state: 'RJ',
    city: 'Niterói',
    leadStatus: 'active',
    tags: ['Follow-up'],
    firstContact: '2025-11-25T09:00:00',
    lastInteraction: '2025-12-02T14:30:00',
    assignedTo: { id: 'user-3', name: 'Lara', avatar: null },
    department: 'Vendas',
    avatarUrl: null,
    isOnline: false,
  },
  {
    id: '5',
    fullName: 'João Pedro Oliveira',
    phone: '+55 (31) 98765-4321',
    email: 'joao.oliveira@empresa.com',
    state: 'MG',
    city: 'Belo Horizonte',
    leadStatus: 'qualified',
    tags: ['VIP', 'Urgente'],
    firstContact: '2025-11-10T11:00:00',
    lastInteraction: '2025-12-01T16:45:00',
    assignedTo: { id: 'user-2', name: 'Ian', avatar: null },
    department: 'Vendas',
    avatarUrl: null,
    isOnline: true,
  },
  {
    id: '6',
    fullName: 'Ana Carolina Mendes',
    phone: '+55 (27) 99888-7777',
    email: 'ana.mendes@hotmail.com',
    state: 'ES',
    city: 'Vitória',
    leadStatus: 'new',
    tags: ['Novo Lead'],
    firstContact: '2025-12-02T16:00:00',
    lastInteraction: '2025-12-03T09:30:00',
    assignedTo: { id: 'user-3', name: 'Lara', avatar: null },
    department: 'Pré-vendas',
    avatarUrl: null,
    isOnline: false,
  },
  {
    id: '7',
    fullName: 'Ricardo Almeida Costa',
    phone: '+55 (71) 97777-6666',
    email: 'ricardo.costa@empresa.com',
    state: 'BA',
    city: 'Salvador',
    leadStatus: 'client',
    tags: ['Cliente', 'VIP'],
    firstContact: '2025-09-15T10:00:00',
    lastInteraction: '2025-12-01T11:00:00',
    assignedTo: { id: 'user-1', name: 'Diego', avatar: null },
    department: 'Pós-vendas',
    avatarUrl: null,
    isOnline: true,
  },
  {
    id: '8',
    fullName: 'Carla Rodrigues Lima',
    phone: '+55 (41) 98666-5555',
    email: 'carla.lima@gmail.com',
    state: 'PR',
    city: 'Curitiba',
    leadStatus: 'unqualified',
    tags: [],
    firstContact: '2025-11-20T14:00:00',
    lastInteraction: '2025-11-25T10:00:00',
    assignedTo: { id: 'user-2', name: 'Ian', avatar: null },
    department: 'Vendas',
    avatarUrl: null,
    isOnline: false,
  },
];

const getLeadStatusLabel = (status: Contact['leadStatus']) => {
  const labels: Record<Contact['leadStatus'], string> = {
    new: 'Novo',
    active: 'Ativo',
    qualified: 'Qualificado',
    unqualified: 'Não qualificado',
    client: 'Cliente',
  };
  return labels[status];
};

const getLeadStatusColor = (status: Contact['leadStatus']) => {
  const colors: Record<Contact['leadStatus'], string> = {
    new: 'bg-blue-100 text-blue-700',
    active: 'bg-yellow-100 text-yellow-700',
    qualified: 'bg-green-100 text-green-700',
    unqualified: 'bg-muted text-muted-foreground',
    client: 'bg-primary/10 text-primary',
  };
  return colors[status];
};

const getTagColor = (tagName: string) => {
  const tag = mockTags.find((t) => t.name === tagName);
  if (!tag) return 'bg-muted text-muted-foreground';
  
  const colorMap: Record<string, string> = {
    '#EF4444': 'bg-red-100 text-red-700',
    '#F59E0B': 'bg-yellow-100 text-yellow-700',
    '#3B82F6': 'bg-blue-100 text-blue-700',
    '#10B981': 'bg-green-100 text-green-700',
    '#8B5CF6': 'bg-purple-100 text-purple-700',
    '#14B8A6': 'bg-teal-100 text-teal-700',
  };
  return colorMap[tag.color] || 'bg-muted text-muted-foreground';
};

export default function Contacts() {
  const [contacts] = useState<Contact[]>(mockContacts);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTagsDropdown, setShowTagsDropdown] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(50);

  // Modal states
  const [showContactModal, setShowContactModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [importStep, setImportStep] = useState(1);

  // Filter contacts
  const filteredContacts = contacts.filter((contact) => {
    const matchesSearch =
      searchQuery === '' ||
      contact.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.phone.includes(searchQuery) ||
      contact.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesState = stateFilter === '' || contact.state === stateFilter;
    const matchesStatus = statusFilter === '' || contact.leadStatus === statusFilter;
    const matchesAssigned = assignedFilter === '' || contact.assignedTo.name === assignedFilter;
    const matchesTags =
      selectedTags.length === 0 || selectedTags.some((tag) => contact.tags.includes(tag));
    return matchesSearch && matchesState && matchesStatus && matchesAssigned && matchesTags;
  });

  const totalContacts = 95590;
  const totalPages = Math.ceil(totalContacts / perPage);

  const handleSelectAll = () => {
    if (selectedContacts.length === filteredContacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(filteredContacts.map((c) => c.id));
    }
  };

  const handleSelectContact = (contactId: string) => {
    setSelectedContacts((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
    );
  };

  const handleNewContact = () => {
    setIsEditing(false);
    setSelectedContact(null);
    setShowContactModal(true);
  };

  const handleEditContact = (contact: Contact) => {
    setIsEditing(true);
    setSelectedContact(contact);
    setShowContactModal(true);
  };

  const handleDeleteContact = (contactId: string) => {
    toast({ title: 'Contato excluído', description: 'O contato foi removido com sucesso.' });
  };

  const handleOpenChat = (contact: Contact) => {
    toast({ title: 'Abrindo conversa', description: `Iniciando chat com ${contact.fullName}` });
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStateFilter('');
    setStatusFilter('');
    setAssignedFilter('');
    setSelectedTags([]);
  };

  const toggleTagFilter = (tagName: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagName) ? prev.filter((t) => t !== tagName) : [...prev, tagName]
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Contatos</h1>
          <p className="text-muted-foreground">
            Total: <span className="font-bold text-primary">{totalContacts.toLocaleString('pt-BR')}</span> contatos
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 border border-border bg-card rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-all shadow-sm"
          >
            <Upload size={18} />
            Importar
          </button>

          <button className="flex items-center gap-2 px-4 py-2.5 border border-border bg-card rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-all shadow-sm">
            <Download size={18} />
            Exportar
          </button>

          <button
            onClick={() => setShowTagsModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 border border-border bg-card rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-all shadow-sm"
          >
            <Tag size={18} />
            Etiquetas
          </button>

          <button
            onClick={handleNewContact}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-primary to-pink-500 text-primary-foreground rounded-xl font-medium hover:shadow-lg transition-all"
          >
            <Plus size={18} />
            Adicionar Contato
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[300px]">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nome, telefone ou email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>

          {/* Tags Filter */}
          <div className="relative">
            <button
              onClick={() => setShowTagsDropdown(!showTagsDropdown)}
              className="flex items-center gap-2 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground hover:bg-muted transition-all"
            >
              <Tag size={16} />
              Etiquetas
              {selectedTags.length > 0 && (
                <span className="px-1.5 py-0.5 bg-primary text-primary-foreground rounded-full text-xs">
                  {selectedTags.length}
                </span>
              )}
              <ChevronDown size={16} />
            </button>

            {showTagsDropdown && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-card rounded-xl border border-border shadow-elevated z-50">
                <div className="p-3 space-y-2">
                  {mockTags.map((tag) => (
                    <label
                      key={tag.name}
                      className="flex items-center gap-2 p-2 hover:bg-muted rounded-lg cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedTags.includes(tag.name)}
                        onCheckedChange={() => toggleTagFilter(tag.name)}
                      />
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="flex-1 text-sm text-foreground">{tag.name}</span>
                      <span className="text-xs text-muted-foreground">{tag.count}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Assigned To Filter */}
          <select
            value={assignedFilter}
            onChange={(e) => setAssignedFilter(e.target.value)}
            className="px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Responsável</option>
            <option value="Diego">Diego</option>
            <option value="Ian">Ian</option>
            <option value="Lara">Lara</option>
            <option value="Michel">Michel</option>
          </select>

          {/* State Filter */}
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Estado</option>
            {brazilianStates.map((state) => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Status Lead</option>
            <option value="new">Novo</option>
            <option value="active">Ativo</option>
            <option value="qualified">Qualificado</option>
            <option value="unqualified">Não qualificado</option>
            <option value="client">Cliente</option>
          </select>

          {/* Date Range */}
          <button className="flex items-center gap-2 px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm text-foreground hover:bg-muted transition-all">
            <Calendar size={16} />
            Data de cadastro
            <ChevronDown size={16} />
          </button>

          {/* Clear Filters */}
          <button
            onClick={clearFilters}
            className="px-4 py-2.5 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
          >
            Limpar filtros
          </button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedContacts.length > 0 && (
        <div className="sticky top-0 z-20 bg-primary text-primary-foreground rounded-xl p-4 shadow-lg flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-medium">{selectedContacts.length} contatos selecionados</span>
            <button
              onClick={() => setSelectedContacts([])}
              className="text-sm text-primary-foreground/70 hover:text-primary-foreground underline"
            >
              Limpar seleção
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors">
              <UserCheck size={16} />
              Atribuir
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors">
              <Tag size={16} />
              Adicionar tags
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors">
              <RefreshCw size={16} />
              Mudar status
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors">
              <Download size={16} />
              Exportar
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-destructive/80 hover:bg-destructive rounded-lg text-sm font-medium transition-colors">
              <Trash2 size={16} />
              Excluir
            </button>
          </div>
        </div>
      )}

      {/* Contacts Table */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="w-12 px-4 py-4">
                  <Checkbox
                    checked={selectedContacts.length === filteredContacts.length && filteredContacts.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </th>
                <th className="text-left px-4 py-4">
                  <button className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground">
                    Nome
                    <ArrowUpDown size={14} />
                  </button>
                </th>
                <th className="text-left px-4 py-4">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    WhatsApp
                  </span>
                </th>
                <th className="text-left px-4 py-4">
                  <button className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground">
                    Estado
                    <ArrowUpDown size={14} />
                  </button>
                </th>
                <th className="text-left px-4 py-4">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Status
                  </span>
                </th>
                <th className="text-left px-4 py-4">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Etiquetas
                  </span>
                </th>
                <th className="text-left px-4 py-4">
                  <button className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground">
                    1ª Conexão
                    <ArrowUpDown size={14} />
                  </button>
                </th>
                <th className="text-left px-4 py-4">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Atendente
                  </span>
                </th>
                <th className="text-left px-4 py-4">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Dept.
                  </span>
                </th>
                <th className="text-center px-4 py-4">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Ações
                  </span>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border/50">
              {filteredContacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-4">
                    <Checkbox
                      checked={selectedContacts.includes(contact.id)}
                      onCheckedChange={() => handleSelectContact(contact.id)}
                    />
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center text-primary-foreground font-semibold shadow-lg">
                          {contact.fullName.charAt(0)}
                        </div>
                        {contact.isOnline && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-card" />
                        )}
                      </div>
                      <div>
                        <button
                          onClick={() => handleEditContact(contact)}
                          className="font-semibold text-foreground hover:text-primary transition-colors text-left"
                        >
                          {contact.fullName}
                        </button>
                        <p className="text-xs text-muted-foreground">{contact.email}</p>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <button
                      onClick={() => handleOpenChat(contact)}
                      className="flex items-center gap-2 text-sm text-foreground hover:text-green-600 transition-colors"
                    >
                      <MessageCircle size={16} className="text-green-600" />
                      {contact.phone}
                    </button>
                  </td>

                  <td className="px-4 py-4">
                    <span className="text-sm text-foreground">{contact.state}</span>
                  </td>

                  <td className="px-4 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getLeadStatusColor(contact.leadStatus)}`}>
                      {getLeadStatusLabel(contact.leadStatus)}
                    </span>
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-1">
                      {contact.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTagColor(tag)}`}>
                          {tag}
                        </span>
                      ))}
                      {contact.tags.length > 2 && (
                        <span className="px-2 py-0.5 bg-muted text-muted-foreground rounded-full text-xs font-medium">
                          +{contact.tags.length - 2}
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <span className="text-sm text-foreground">
                      {new Date(contact.firstContact).toLocaleDateString('pt-BR')}
                    </span>
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center text-primary-foreground text-xs font-semibold">
                        {contact.assignedTo.name.charAt(0)}
                      </div>
                      <span className="text-sm text-foreground">{contact.assignedTo.name}</span>
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <span className="px-2.5 py-1 bg-muted text-muted-foreground rounded-lg text-xs font-medium">
                      {contact.department}
                    </span>
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleOpenChat(contact)}
                        className="p-2 hover:bg-green-500/10 rounded-lg transition-colors"
                        title="Abrir conversa"
                      >
                        <MessageCircle size={18} className="text-green-600" />
                      </button>
                      <button
                        onClick={() => handleEditContact(contact)}
                        className="p-2 hover:bg-primary/10 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit3 size={18} className="text-primary" />
                      </button>
                      <button
                        onClick={() => handleDeleteContact(contact.id)}
                        className="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                        title="Excluir"
                      >
                        <Trash2 size={18} className="text-destructive" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Mostrando</span>
            <select
              value={perPage}
              onChange={(e) => setPerPage(Number(e.target.value))}
              className="px-2 py-1 border border-border rounded-lg text-sm bg-background"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
            <span>de {totalContacts.toLocaleString('pt-BR')} contatos</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
            >
              <ChevronLeft size={18} />
            </button>
            <button className="w-10 h-10 bg-primary text-primary-foreground rounded-lg font-medium">
              {currentPage}
            </button>
            {currentPage < totalPages && (
              <>
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  className="w-10 h-10 hover:bg-muted rounded-lg font-medium text-foreground"
                >
                  {currentPage + 1}
                </button>
                {currentPage + 1 < totalPages && (
                  <button
                    onClick={() => setCurrentPage(currentPage + 2)}
                    className="w-10 h-10 hover:bg-muted rounded-lg font-medium text-foreground"
                  >
                    {currentPage + 2}
                  </button>
                )}
                {currentPage + 3 < totalPages && <span className="px-2 text-muted-foreground">...</span>}
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  className="w-10 h-10 hover:bg-muted rounded-lg font-medium text-foreground"
                >
                  {totalPages}
                </button>
              </>
            )}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {filteredContacts.length === 0 && (
        <div className="text-center py-16">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Nenhum contato encontrado</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Ajuste os filtros ou adicione um novo contato
          </p>
        </div>
      )}

      {/* Add/Edit Contact Modal */}
      <Dialog open={showContactModal} onOpenChange={setShowContactModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar Contato' : 'Novo Contato'}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="basic" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid grid-cols-4 w-full mb-4">
              <TabsTrigger value="basic">Informações Básicas</TabsTrigger>
              <TabsTrigger value="address">Endereço</TabsTrigger>
              <TabsTrigger value="crm">Detalhes CRM</TabsTrigger>
              <TabsTrigger value="custom">Campos Customizados</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto">
              <TabsContent value="basic" className="space-y-4">
                <div className="flex items-center gap-6">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center text-primary-foreground text-3xl font-bold shadow-xl">
                    {selectedContact?.fullName?.charAt(0) || 'N'}
                  </div>
                  <div>
                    <button className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted">
                      Alterar foto
                    </button>
                    <p className="text-xs text-muted-foreground mt-1">JPG, PNG. Máx 2MB</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Nome completo <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Fernando Silva Santos"
                      defaultValue={selectedContact?.fullName}
                      className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Telefone / WhatsApp <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="tel"
                      placeholder="+55 (00) 00000-0000"
                      defaultValue={selectedContact?.phone}
                      className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Email</label>
                    <input
                      type="email"
                      placeholder="email@exemplo.com"
                      defaultValue={selectedContact?.email}
                      className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Data de nascimento</label>
                    <input
                      type="date"
                      className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">CPF / CNPJ</label>
                    <input
                      type="text"
                      placeholder="000.000.000-00"
                      className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-2">Tipo de pessoa</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2">
                        <input type="radio" name="personType" value="individual" defaultChecked />
                        <span className="text-sm text-foreground">Pessoa física</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="radio" name="personType" value="company" />
                        <span className="text-sm text-foreground">Pessoa jurídica</span>
                      </label>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="address" className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">CEP</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="00000-000"
                        className="flex-1 px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                      />
                      <button className="px-4 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors">
                        <Search size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-2">Logradouro</label>
                    <input
                      type="text"
                      placeholder="Rua, Avenida..."
                      className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Número</label>
                    <input
                      type="text"
                      placeholder="123"
                      className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-2">Complemento</label>
                    <input
                      type="text"
                      placeholder="Apto, Bloco, etc."
                      className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Bairro</label>
                    <input
                      type="text"
                      placeholder="Centro"
                      className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Cidade</label>
                    <input
                      type="text"
                      placeholder="Rio de Janeiro"
                      className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Estado</label>
                    <select className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background">
                      <option value="">Selecione</option>
                      {brazilianStates.map((state) => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="crm" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Status Lead</label>
                    <select
                      defaultValue={selectedContact?.leadStatus || 'new'}
                      className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                    >
                      <option value="new">Novo</option>
                      <option value="active">Ativo</option>
                      <option value="qualified">Qualificado</option>
                      <option value="unqualified">Não qualificado</option>
                      <option value="client">Cliente</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Atendente responsável</label>
                    <select className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background">
                      <option value="">Não atribuído</option>
                      <option value="diego">Diego</option>
                      <option value="ian">Ian</option>
                      <option value="lara">Lara</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Departamento</label>
                    <select className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background">
                      <option value="vendas">Vendas</option>
                      <option value="pre-vendas">Pré-vendas</option>
                      <option value="pos-vendas">Pós-vendas</option>
                      <option value="suporte">Suporte</option>
                      <option value="financeiro">Financeiro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Origem</label>
                    <select className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background">
                      <option value="whatsapp">WhatsApp</option>
                      <option value="site">Site</option>
                      <option value="instagram">Instagram</option>
                      <option value="facebook">Facebook</option>
                      <option value="indicacao">Indicação</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-2">Etiquetas</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {(selectedContact?.tags || []).map((tag) => (
                        <span
                          key={tag}
                          className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium flex items-center gap-1"
                        >
                          {tag}
                          <button className="hover:text-primary/70">
                            <X size={14} />
                          </button>
                        </span>
                      ))}
                    </div>
                    <button className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1">
                      <Plus size={14} />
                      Adicionar etiqueta
                    </button>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-foreground mb-2">Observações</label>
                    <textarea
                      rows={4}
                      placeholder="Anotações sobre o contato..."
                      className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none bg-background"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="custom" className="space-y-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Campos customizados definidos nas configurações do sistema.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Tamanho de camisa</label>
                    <select className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background">
                      <option value="">Selecione</option>
                      <option value="P">P</option>
                      <option value="M">M</option>
                      <option value="G">G</option>
                      <option value="GG">GG</option>
                      <option value="G1">G1</option>
                      <option value="G2">G2</option>
                      <option value="G3">G3</option>
                      <option value="G4">G4</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Esporte preferido</label>
                    <input
                      type="text"
                      placeholder="Ex: Futebol, Vôlei..."
                      className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Time/Equipe</label>
                    <input
                      type="text"
                      placeholder="Nome do time"
                      className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Quantidade usual de pedido</label>
                    <input
                      type="number"
                      placeholder="Ex: 50"
                      className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                    />
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter className="border-t border-border pt-4 mt-4">
            <button
              onClick={() => setShowContactModal(false)}
              className="px-4 py-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button className="px-6 py-2 bg-gradient-to-r from-primary to-pink-500 text-primary-foreground rounded-lg font-medium hover:shadow-lg transition-all">
              {isEditing ? 'Salvar alterações' : 'Criar contato'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Modal */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar Contatos</DialogTitle>
            <DialogDescription>Importe contatos de uma planilha CSV ou Excel</DialogDescription>
          </DialogHeader>

          <div className="py-6">
            {importStep === 1 && (
              <div className="text-center">
                <div className="border-2 border-dashed border-border rounded-2xl p-12 hover:border-primary transition-colors cursor-pointer">
                  <Upload size={48} className="mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Arraste seu arquivo ou clique para selecionar
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Formatos aceitos: CSV, XLSX, XLS (máx. 10MB)
                  </p>
                  <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90">
                    Selecionar arquivo
                  </button>
                </div>

                <div className="mt-6 flex justify-center">
                  <button className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1">
                    <Download size={16} />
                    Baixar template de exemplo
                  </button>
                </div>
              </div>
            )}

            {importStep === 2 && (
              <div>
                <h3 className="font-semibold text-foreground mb-4">Mapeie as colunas</h3>
                <div className="space-y-3">
                  {[
                    { source: 'Nome', target: 'Nome completo' },
                    { source: 'Telefone', target: 'Telefone' },
                    { source: 'E-mail', target: 'Email' },
                    { source: 'Endereço', target: 'Logradouro' },
                  ].map((mapping, idx) => (
                    <div key={idx} className="flex items-center gap-4">
                      <div className="flex-1 px-4 py-2 bg-muted rounded-lg text-sm text-foreground">
                        {mapping.source}
                      </div>
                      <ArrowRight size={18} className="text-muted-foreground" />
                      <select className="flex-1 px-4 py-2 border border-border rounded-lg text-sm bg-background">
                        <option>{mapping.target}</option>
                        <option>Ignorar</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {importStep === 3 && (
              <div>
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-2 text-green-600">
                    <Check size={18} />
                    <span className="font-medium">1.000 contatos prontos para importar</span>
                  </div>
                </div>

                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-yellow-600 mb-2">
                    <AlertTriangle size={18} />
                    <span className="font-medium">23 contatos com problemas</span>
                  </div>
                  <ul className="text-sm text-yellow-600 list-disc list-inside">
                    <li>15 telefones duplicados</li>
                    <li>8 emails inválidos</li>
                  </ul>
                </div>
              </div>
            )}

            {importStep === 4 && (
              <div className="text-center py-8">
                <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-6" />
                <h3 className="text-lg font-semibold text-foreground mb-2">Importando contatos...</h3>
                <p className="text-sm text-muted-foreground mb-4">234 de 1.000 contatos importados</p>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full" style={{ width: '23.4%' }} />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <button
              onClick={() => {
                setImportStep(1);
                setShowImportModal(false);
              }}
              className="px-4 py-2 text-muted-foreground hover:bg-muted rounded-lg"
            >
              Cancelar
            </button>
            <button
              onClick={() => setImportStep((s) => Math.min(4, s + 1))}
              className="px-6 py-2 bg-gradient-to-r from-primary to-pink-500 text-primary-foreground rounded-lg font-medium hover:shadow-lg"
            >
              {importStep === 3 ? 'Importar contatos' : 'Continuar'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tags Management Modal */}
      <Dialog open={showTagsModal} onOpenChange={setShowTagsModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerenciar Etiquetas</DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              {mockTags.map((tag) => (
                <div key={tag.name} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: tag.color }} />
                    <span className="font-medium text-foreground">{tag.name}</span>
                    <span className="text-xs text-muted-foreground">({tag.count} contatos)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                      <Edit3 size={14} className="text-muted-foreground" />
                    </button>
                    <button className="p-1.5 hover:bg-destructive/10 rounded-lg transition-colors">
                      <Trash2 size={14} className="text-destructive" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-border">
              <label className="block text-sm font-medium text-foreground mb-2">Nova etiqueta</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  defaultValue="#8B5CF6"
                  className="w-12 h-10 rounded-lg border border-border cursor-pointer"
                />
                <input
                  type="text"
                  placeholder="Nome da etiqueta"
                  className="flex-1 px-4 py-2 border border-border rounded-lg bg-background"
                />
                <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90">
                  <Plus size={18} />
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Click outside to close tags dropdown */}
      {showTagsDropdown && (
        <div className="fixed inset-0 z-40" onClick={() => setShowTagsDropdown(false)} />
      )}
    </div>
  );
}
