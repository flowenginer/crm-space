import { useState, useMemo } from 'react';
import {
  Users,
  Building2,
  MessageSquare,
  Database,
  Bell,
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
  Loader2,
  Shield,
  Palette,
  Globe,
  Clock,
  Key,
  Monitor,
  Tag,
  Eye,
  EyeOff,
  Plug,
  Target,
  Wrench,
  Radar,
  Share2,
  LucideIcon,
  Menu,
} from 'lucide-react';
import { UserManagement } from '@/components/settings/UserManagement';
import { RoleManagement } from '@/components/settings/RoleManagement';
import { DepartmentManagement } from '@/components/settings/DepartmentManagement';
import { TagManagement } from '@/components/settings/TagManagement';
import { IntegrationSettings } from '@/components/settings/IntegrationSettings';
import { MetaAdsSettings } from '@/components/settings/MetaAdsSettings';
import { ToolsSettings } from '@/components/settings/ToolsSettings';
import { OwnerAgentSettings } from '@/components/settings/OwnerAgentSettings';
import { CloseReasonManagement } from '@/components/settings/CloseReasonManagement';
import { MetricsSettings } from '@/components/settings/MetricsSettings';
import { AdMessagePatternsSettings } from '@/components/settings/AdMessagePatternsSettings';
import { ActiveSessions } from '@/components/settings/ActiveSessions';
import { AccessPermissionsSettings } from '@/components/settings/AccessPermissionsSettings';
import { LeadDistributionSettings } from '@/components/settings/LeadDistributionSettings';
import { StoreManagement } from '@/components/settings/StoreManagement';
import { SalesGoalsManagement } from '@/components/settings/SalesGoalsManagement';
import { MenuConfiguration } from '@/components/settings/MenuConfiguration';
import { Facebook, UserCheck, Unlock, Store } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermissions } from '@/hooks/usePermissions';
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
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// Hooks
import { useTeam, useUpdateTeamMember } from '@/hooks/useTeam';
import { useDepartments, useCreateDepartment, useUpdateDepartment, useDeleteDepartment } from '@/hooks/useDepartments';
import { useChannels, useCreateChannel, useUpdateChannel, useDeleteChannel } from '@/hooks/useChannels';
import { useCustomFields, useCreateCustomField, useUpdateCustomField, useDeleteCustomField } from '@/hooks/useCustomFields';
import { useNotificationSettings, useUpdateNotificationSettings } from '@/hooks/useNotificationSettings';

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
  multiselect: 'Multi-seleção',
};

// Definição de abas com permissões necessárias
interface SettingsTab {
  value: string;
  label: string;
  icon: LucideIcon;
  // Permissão necessária: [categoria, ação] ou null para acesso livre (ex: notificações pessoais)
  permission: [string, string] | null;
  // Se true, só admins podem ver
  adminOnly?: boolean;
}

const SETTINGS_TABS: SettingsTab[] = [
  { value: 'team', label: 'Equipe', icon: Users, permission: ['settings', 'users'] },
  { value: 'roles', label: 'Perfis', icon: Shield, permission: null, adminOnly: true },
  { value: 'access-permissions', label: 'Acesso Especial', icon: Unlock, permission: null, adminOnly: true },
  { value: 'menu', label: 'Menu', icon: Menu, permission: null, adminOnly: true },
  { value: 'departments', label: 'Departamentos', icon: Building2, permission: ['settings', 'departments'] },
  { value: 'stores', label: 'Lojas', icon: Store, permission: ['settings', 'update'] },
  { value: 'channels', label: 'Canais', icon: MessageSquare, permission: ['settings', 'channels'] },
  { value: 'fields', label: 'Campos', icon: Database, permission: ['settings', 'fields'] },
  { value: 'tags', label: 'Etiquetas', icon: Tag, permission: ['settings', 'tags'] },
  { value: 'sales-goals', label: 'Metas', icon: Target, permission: ['settings', 'update'] },
  { value: 'owner-agent', label: 'Responsável', icon: UserCheck, permission: ['settings', 'update'] },
  { value: 'close-reasons', label: 'Fechamento', icon: X, permission: ['settings', 'close_reasons'] },
  { value: 'lead-distribution', label: 'Distribuição', icon: Share2, permission: ['settings', 'update'] },
  { value: 'notifications', label: 'Notificações', icon: Bell, permission: null },
  { value: 'security', label: 'Segurança', icon: Key, permission: null },
  { value: 'integrations', label: 'Integrações', icon: Plug, permission: ['settings', 'integrations'] },
  { value: 'meta-ads', label: 'Meta Ads', icon: Facebook, permission: ['marketing', 'manage'] },
  { value: 'origin-patterns', label: 'Padrões de Origem', icon: Radar, permission: ['settings', 'update'] },
  { value: 'general', label: 'Geral', icon: Palette, permission: ['settings', 'update'] },
  { value: 'tools', label: 'Ferramentas', icon: Wrench, permission: ['settings', 'update'] },
  { value: 'metrics', label: 'Métricas', icon: Target, permission: ['settings', 'update'] },
];

export default function Settings() {
  const { user } = useAuth();
  const { hasPermission, isAdmin, isFullyLoaded } = usePermissions();
  
  // Filtra abas disponíveis baseado nas permissões do usuário
  const availableTabs = useMemo(() => {
    if (!isFullyLoaded) return [];
    
    return SETTINGS_TABS.filter(tab => {
      // Admin sempre tem acesso a tudo
      if (isAdmin) return true;
      
      // Tabs só para admin
      if (tab.adminOnly) return false;
      
      // Tabs sem permissão específica (ex: notificações pessoais)
      if (tab.permission === null) return true;
      
      // Verifica permissão específica
      const [category, action] = tab.permission;
      return hasPermission(category, action);
    });
  }, [isFullyLoaded, isAdmin, hasPermission]);

  // Define a primeira aba disponível como default
  const defaultTab = availableTabs.length > 0 ? availableTabs[0].value : 'notifications';
  
  // Fetch real data
  const { data: teamMembers = [], isLoading: loadingTeam } = useTeam();
  const { data: departments = [], isLoading: loadingDepts } = useDepartments();
  const { data: channels = [], isLoading: loadingChannels } = useChannels();
  const { data: customFields = [], isLoading: loadingFields } = useCustomFields();
  const { data: notificationSettings, isLoading: loadingNotifications } = useNotificationSettings();

  // Mutations
  const updateMember = useUpdateTeamMember();
  const createDepartment = useCreateDepartment();
  const updateDepartment = useUpdateDepartment();
  const deleteDepartment = useDeleteDepartment();
  const createChannel = useCreateChannel();
  const updateChannel = useUpdateChannel();
  const deleteChannel = useDeleteChannel();
  const createField = useCreateCustomField();
  const updateField = useUpdateCustomField();
  const deleteField = useDeleteCustomField();
  const updateNotifications = useUpdateNotificationSettings();

  const [searchQuery, setSearchQuery] = useState('');
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Member form state
  const [memberForm, setMemberForm] = useState({
    full_name: '',
    phone: '',
    department_id: '',
  });

  // Department form state
  const [departmentForm, setDepartmentForm] = useState({
    name: '',
    description: '',
    color: '#8B5CF6',
  });

  // Channel form state
  const [channelForm, setChannelForm] = useState({
    name: '',
    phone: '',
    department_id: '',
  });

  // Custom field form state
  const [fieldForm, setFieldForm] = useState({
    name: '',
    field_type: 'text',
    options: '',
    entity_type: 'contact',
    is_required: false,
  });

  const filteredMembers = teamMembers.filter(member =>
    member.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSaveMember = async () => {
    if (!editingItem) return;

    try {
      await updateMember.mutateAsync({
        id: editingItem.id,
        full_name: memberForm.full_name,
        phone: memberForm.phone,
        department_id: memberForm.department_id || null,
      });
      toast.success('Membro atualizado com sucesso');
      setShowMemberModal(false);
      setEditingItem(null);
    } catch (error) {
      toast.error('Erro ao atualizar membro');
    }
  };

  const handleSaveDepartment = async () => {
    if (!departmentForm.name) {
      toast.error('Nome do departamento é obrigatório');
      return;
    }

    try {
      if (editingItem) {
        await updateDepartment.mutateAsync({
          id: editingItem.id,
          name: departmentForm.name,
          description: departmentForm.description,
          color: departmentForm.color,
        });
        toast.success('Departamento atualizado');
      } else {
        await createDepartment.mutateAsync({
          name: departmentForm.name,
          description: departmentForm.description,
          color: departmentForm.color,
          is_active: true,
        });
        toast.success('Departamento criado');
      }
      setShowDepartmentModal(false);
      setEditingItem(null);
      setDepartmentForm({ name: '', description: '', color: '#8B5CF6' });
    } catch (error) {
      toast.error('Erro ao salvar departamento');
    }
  };

  const handleSaveChannel = async () => {
    if (!channelForm.name || !channelForm.phone) {
      toast.error('Nome e telefone são obrigatórios');
      return;
    }

    try {
      if (editingItem) {
        await updateChannel.mutateAsync({
          id: editingItem.id,
          name: channelForm.name,
          phone: channelForm.phone,
          department_id: channelForm.department_id || null,
        });
        toast.success('Canal atualizado');
      } else {
        await createChannel.mutateAsync({
          name: channelForm.name,
          phone: channelForm.phone,
          department_id: channelForm.department_id || null,
        });
        toast.success('Canal criado');
      }
      setShowChannelModal(false);
      setEditingItem(null);
      setChannelForm({ name: '', phone: '', department_id: '' });
    } catch (error) {
      toast.error('Erro ao salvar canal');
    }
  };

  const handleSaveField = async () => {
    if (!fieldForm.name) {
      toast.error('Nome do campo é obrigatório');
      return;
    }

    const options = fieldForm.field_type === 'select' || fieldForm.field_type === 'multiselect'
      ? fieldForm.options.split(',').map(o => o.trim()).filter(Boolean)
      : [];

    try {
      if (editingItem) {
        await updateField.mutateAsync({
          id: editingItem.id,
          name: fieldForm.name,
          field_type: fieldForm.field_type,
          entity_type: fieldForm.entity_type,
          options,
          is_required: fieldForm.is_required,
        });
        toast.success('Campo atualizado');
      } else {
        await createField.mutateAsync({
          name: fieldForm.name,
          field_type: fieldForm.field_type,
          entity_type: fieldForm.entity_type,
          options,
          is_required: fieldForm.is_required,
          order_position: customFields.length,
        });
        toast.success('Campo criado');
      }
      setShowFieldModal(false);
      setEditingItem(null);
      setFieldForm({ name: '', field_type: 'text', options: '', entity_type: 'contact', is_required: false });
    } catch (error) {
      toast.error('Erro ao salvar campo');
    }
  };

  const handleEditMember = (member: any) => {
    setEditingItem(member);
    setMemberForm({
      full_name: member.full_name || '',
      phone: member.phone || '',
      department_id: member.department_id || '',
    });
    setShowMemberModal(true);
  };

  const handleEditDepartment = (dept: any) => {
    setEditingItem(dept);
    setDepartmentForm({
      name: dept.name,
      description: dept.description || '',
      color: dept.color || '#8B5CF6',
    });
    setShowDepartmentModal(true);
  };

  const handleEditChannel = (channel: any) => {
    setEditingItem(channel);
    setChannelForm({
      name: channel.name,
      phone: channel.phone,
      department_id: channel.department_id || '',
    });
    setShowChannelModal(true);
  };

  const handleEditField = (field: any) => {
    setEditingItem(field);
    setFieldForm({
      name: field.name,
      field_type: field.field_type,
      options: Array.isArray(field.options) ? field.options.join(', ') : '',
      entity_type: field.entity_type,
      is_required: field.is_required || false,
    });
    setShowFieldModal(true);
  };

  const handleDeleteDepartment = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este departamento?')) return;
    try {
      await deleteDepartment.mutateAsync(id);
      toast.success('Departamento excluído');
    } catch (error) {
      toast.error('Erro ao excluir departamento');
    }
  };

  const handleDeleteChannel = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este canal?')) return;
    try {
      await deleteChannel.mutateAsync(id);
      toast.success('Canal excluído');
    } catch (error) {
      toast.error('Erro ao excluir canal');
    }
  };

  const handleDeleteField = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este campo?')) return;
    try {
      await deleteField.mutateAsync(id);
      toast.success('Campo excluído');
    } catch (error) {
      toast.error('Erro ao excluir campo');
    }
  };

  const handleNotificationChange = async (key: string, value: boolean) => {
    try {
      await updateNotifications.mutateAsync({ [key]: value });
    } catch (error) {
      toast.error('Erro ao atualizar notificação');
    }
  };

  const handleChangePassword = async () => {
    if (!user) {
      toast.error('Usuário não autenticado');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('As senhas não conferem');
      return;
    }

    setChangingPassword(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `https://lkxrmjqrzhaivviuuamp.supabase.co/functions/v1/update-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            userId: user.id,
            password: newPassword
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao alterar senha');
      }

      toast.success('Senha alterada com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao alterar senha');
    } finally {
      setChangingPassword(false);
    }
  };

  // Verifica se uma aba específica está disponível
  const isTabAvailable = (tabValue: string) => {
    return availableTabs.some(tab => tab.value === tabValue);
  };

  // Loading state
  if (!isFullyLoaded) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Se não há abas disponíveis
  if (availableTabs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Acesso Limitado</h2>
          <p className="text-muted-foreground">Você não tem permissão para acessar as configurações do sistema.</p>
        </div>
      </div>
    );
  }

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

      {/* Tabs - Apenas exibe as abas que o usuário tem permissão */}
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="bg-card border border-border rounded-xl p-2 shadow-sm w-full flex flex-wrap gap-1.5 mb-6 h-auto">
          {availableTabs.map(tab => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap text-muted-foreground hover:text-foreground hover:bg-muted/50 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white data-[state=active]:shadow-md"
              >
                <Icon size={16} />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* TAB 1: Team Management */}
        {isTabAvailable('team') && (
          <TabsContent value="team" className="space-y-6">
            <UserManagement />
          </TabsContent>
        )}

        {/* TAB 2: Role Management */}
        {isTabAvailable('roles') && (
          <TabsContent value="roles" className="space-y-6">
            <RoleManagement />
          </TabsContent>
        )}

        {/* TAB: Access Permissions */}
        {isTabAvailable('access-permissions') && (
          <TabsContent value="access-permissions" className="space-y-6">
            <AccessPermissionsSettings />
          </TabsContent>
        )}

        {/* TAB: Menu Configuration */}
        {isTabAvailable('menu') && (
          <TabsContent value="menu" className="space-y-6">
            <MenuConfiguration />
          </TabsContent>
        )}

        {/* TAB 3: Departments */}
        {isTabAvailable('departments') && (
          <TabsContent value="departments" className="space-y-6">
            <DepartmentManagement />
          </TabsContent>
        )}

        {/* TAB: Tags */}
        {isTabAvailable('tags') && (
          <TabsContent value="tags" className="space-y-6">
            <TagManagement />
          </TabsContent>
        )}

        {/* TAB: Sales Goals */}
        {isTabAvailable('sales-goals') && (
          <TabsContent value="sales-goals" className="space-y-6">
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
              <SalesGoalsManagement />
            </div>
          </TabsContent>
        )}

        {/* TAB: Owner Agent Settings */}
        {isTabAvailable('owner-agent') && (
          <TabsContent value="owner-agent" className="space-y-6">
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
              <OwnerAgentSettings />
            </div>
          </TabsContent>
        )}

        {/* TAB: Close Reasons Management */}
        {isTabAvailable('close-reasons') && (
          <TabsContent value="close-reasons" className="space-y-6">
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
              <CloseReasonManagement />
            </div>
          </TabsContent>
        )}

        {/* TAB: Lead Distribution Settings */}
        {isTabAvailable('lead-distribution') && (
          <TabsContent value="lead-distribution" className="space-y-6">
            <LeadDistributionSettings />
          </TabsContent>
        )}

        {/* TAB: Metrics Settings */}
        {isTabAvailable('metrics') && (
          <TabsContent value="metrics" className="space-y-6">
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
              <MetricsSettings />
            </div>
          </TabsContent>
        )}

        {/* TAB: Stores */}
        {isTabAvailable('stores') && (
          <TabsContent value="stores" className="space-y-6">
            <StoreManagement />
          </TabsContent>
        )}

        {/* TAB: Origin Patterns Settings */}
        {isTabAvailable('origin-patterns') && (
          <TabsContent value="origin-patterns" className="space-y-6">
            <AdMessagePatternsSettings />
          </TabsContent>
        )}

        {/* TAB 4: Channels */}
        {isTabAvailable('channels') && (
          <TabsContent value="channels" className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground">Gerencie seus canais de atendimento WhatsApp</p>
              {hasPermission('channels', 'create') && (
                <button
                  onClick={() => {
                    setEditingItem(null);
                    setChannelForm({ name: '', phone: '', department_id: '' });
                    setShowChannelModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 btn-gradient text-white rounded-xl font-medium hover:shadow-lg transition-all"
                >
                  <Plus size={18} />
                  Novo Canal
                </button>
              )}
            </div>

            {loadingChannels ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : channels.length === 0 ? (
              <div className="bg-card rounded-2xl border border-border p-12 text-center">
                <MessageSquare size={48} className="mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum canal cadastrado</h3>
                <p className="text-muted-foreground mb-4">Adicione seu primeiro canal WhatsApp</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {channels.map((channel: any) => (
                  <div
                    key={channel.id}
                    className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <MessageSquare size={20} className="text-primary" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground">{channel.name}</h4>
                          <p className="text-sm text-muted-foreground">{channel.phone}</p>
                        </div>
                      </div>
                      {(hasPermission('channels', 'update') || hasPermission('channels', 'delete')) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                            <MoreVertical size={16} className="text-muted-foreground" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {hasPermission('channels', 'update') && (
                              <DropdownMenuItem onClick={() => handleEditChannel(channel)}>
                                <Edit3 size={14} className="mr-2" />
                                Editar
                              </DropdownMenuItem>
                            )}
                            {hasPermission('channels', 'delete') && (
                              <DropdownMenuItem
                                onClick={() => handleDeleteChannel(channel.id)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 size={14} className="mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          channel.status === 'connected'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}
                      >
                        {channel.status === 'connected' ? 'Conectado' : 'Desconectado'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        )}

        {/* TAB 5: Custom Fields */}
        {isTabAvailable('fields') && (
          <TabsContent value="fields" className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground">Personalize os campos de contatos e negócios</p>
              <button
                onClick={() => {
                  setEditingItem(null);
                  setFieldForm({ name: '', field_type: 'text', options: '', entity_type: 'contact', is_required: false });
                  setShowFieldModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 btn-gradient text-white rounded-xl font-medium hover:shadow-lg transition-all"
              >
                <Plus size={18} />
                Novo Campo
              </button>
            </div>

            {loadingFields ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : customFields.length === 0 ? (
              <div className="bg-card rounded-2xl border border-border p-12 text-center">
                <Database size={48} className="mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum campo personalizado</h3>
                <p className="text-muted-foreground mb-4">Adicione campos para personalizar seus dados</p>
              </div>
            ) : (
              <div className="bg-card rounded-2xl border border-border overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Nome</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Tipo</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Entidade</th>
                      <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">Obrigatório</th>
                      <th className="px-6 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {customFields.map((field: any) => (
                      <tr key={field.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-medium text-foreground">{field.name}</span>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {fieldTypeLabels[field.field_type] || field.field_type}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground capitalize">
                          {field.entity_type === 'contact' ? 'Contato' : 'Negócio'}
                        </td>
                        <td className="px-6 py-4">
                          {field.is_required ? (
                            <Check size={16} className="text-green-500" />
                          ) : (
                            <X size={16} className="text-muted-foreground" />
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                                <MoreVertical size={16} className="text-muted-foreground" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditField(field)}>
                                  <Edit3 size={14} className="mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleDeleteField(field.id)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 size={14} className="mr-2" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        )}

        {/* TAB 6: Notifications */}
        {isTabAvailable('notifications') && (
          <TabsContent value="notifications" className="space-y-6">
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground mb-4">Preferências de Notificação</h3>
              
              {loadingNotifications ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-foreground">Canais de Notificação</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
                        <div className="flex items-center gap-3">
                          <Bell size={20} className="text-muted-foreground" />
                          <div>
                            <p className="font-medium text-foreground">Push (Navegador)</p>
                            <p className="text-sm text-muted-foreground">Receber notificações no navegador</p>
                          </div>
                        </div>
                        <Switch
                          checked={notificationSettings?.push_enabled ?? true}
                          onCheckedChange={(checked) => handleNotificationChange('push_enabled', checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
                        <div className="flex items-center gap-3">
                          <Mail size={20} className="text-muted-foreground" />
                          <div>
                            <p className="font-medium text-foreground">E-mail</p>
                            <p className="text-sm text-muted-foreground">Receber notificações por e-mail</p>
                          </div>
                        </div>
                        <Switch
                          checked={notificationSettings?.email_enabled ?? true}
                          onCheckedChange={(checked) => handleNotificationChange('email_enabled', checked)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-foreground">Eventos</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
                        <div>
                          <p className="font-medium text-foreground">Novas mensagens</p>
                          <p className="text-sm text-muted-foreground">Quando receber novas mensagens</p>
                        </div>
                        <Switch
                          checked={notificationSettings?.new_messages ?? true}
                          onCheckedChange={(checked) => handleNotificationChange('new_messages', checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
                        <div>
                          <p className="font-medium text-foreground">Alertas de SLA</p>
                          <p className="text-sm text-muted-foreground">Quando o SLA estiver próximo do limite</p>
                        </div>
                        <Switch
                          checked={notificationSettings?.sla_alerts ?? true}
                          onCheckedChange={(checked) => handleNotificationChange('sla_alerts', checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
                        <div>
                          <p className="font-medium text-foreground">Novos negócios</p>
                          <p className="text-sm text-muted-foreground">Quando um negócio for criado ou atribuído</p>
                        </div>
                        <Switch
                          checked={notificationSettings?.new_deals ?? true}
                          onCheckedChange={(checked) => handleNotificationChange('new_deals', checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
                        <div>
                          <p className="font-medium text-foreground">Mudanças de etapa</p>
                          <p className="text-sm text-muted-foreground">Quando um negócio mudar de etapa</p>
                        </div>
                        <Switch
                          checked={notificationSettings?.stage_changes ?? false}
                          onCheckedChange={(checked) => handleNotificationChange('stage_changes', checked)}
                        />
                      </div>
                      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
                        <div>
                          <p className="font-medium text-foreground">Resumo diário</p>
                          <p className="text-sm text-muted-foreground">Receber resumo das atividades do dia</p>
                        </div>
                        <Switch
                          checked={notificationSettings?.daily_summary ?? false}
                          onCheckedChange={(checked) => handleNotificationChange('daily_summary', checked)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        )}

        {/* TAB 7: Security */}
        {isTabAvailable('security') && (
          <TabsContent value="security" className="space-y-6">
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground mb-6">Segurança da Conta</h3>
              
              <div className="space-y-6">
                {/* Change Password */}
                <div className="p-6 border border-border rounded-xl">
                  <h4 className="font-medium text-foreground mb-4 flex items-center gap-2">
                    <Key size={18} />
                    Alterar Senha
                  </h4>
                  <div className="space-y-4 max-w-md">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">
                        Nova Senha
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-4 py-2.5 pr-10 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground"
                          placeholder="Digite a nova senha"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">
                        Confirmar Nova Senha
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground"
                        placeholder="Confirme a nova senha"
                      />
                    </div>
                    <button
                      onClick={handleChangePassword}
                      disabled={changingPassword || !newPassword || !confirmPassword}
                      className="flex items-center gap-2 px-4 py-2.5 btn-gradient text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {changingPassword ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Alterando...
                        </>
                      ) : (
                        <>
                          <Key size={16} />
                          Alterar Senha
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Active Sessions */}
                <div className="p-6 border border-border rounded-xl">
                  <h4 className="font-medium text-foreground mb-4 flex items-center gap-2">
                    <Monitor size={18} />
                    Sessões Ativas
                  </h4>
                  <ActiveSessions />
                </div>
              </div>
            </div>
          </TabsContent>
        )}

        {/* TAB 8: Integrations */}
        {isTabAvailable('integrations') && (
          <TabsContent value="integrations" className="space-y-6">
            <IntegrationSettings />
          </TabsContent>
        )}

        {/* TAB: Meta Ads */}
        {isTabAvailable('meta-ads') && (
          <TabsContent value="meta-ads" className="space-y-6">
            <MetaAdsSettings />
          </TabsContent>
        )}

        {/* TAB 9: General / Appearance */}
        {isTabAvailable('general') && (
          <TabsContent value="general" className="space-y-6">
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground mb-6">Configurações Gerais</h3>
              
              <div className="space-y-6">
                {/* Timezone */}
                <div className="p-4 bg-muted/30 rounded-xl">
                  <div className="flex items-center gap-3 mb-3">
                    <Globe size={20} className="text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">Fuso Horário</p>
                      <p className="text-sm text-muted-foreground">Define o fuso horário para agendamentos</p>
                    </div>
                  </div>
                  <select className="w-full max-w-xs px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground">
                    <option value="America/Sao_Paulo">América/São Paulo (BRT)</option>
                    <option value="America/Manaus">América/Manaus (AMT)</option>
                    <option value="America/Fortaleza">América/Fortaleza (BRT)</option>
                  </select>
                </div>

                {/* Business Hours */}
                <div className="p-4 bg-muted/30 rounded-xl">
                  <div className="flex items-center gap-3 mb-3">
                    <Clock size={20} className="text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">Horário de Funcionamento</p>
                      <p className="text-sm text-muted-foreground">Configure os horários de atendimento</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 max-w-md">
                    <div>
                      <label className="block text-sm text-muted-foreground mb-1">Início</label>
                      <input
                        type="time"
                        defaultValue="08:00"
                        className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-muted-foreground mb-1">Fim</label>
                      <input
                        type="time"
                        defaultValue="18:00"
                        className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        )}

        {/* TAB: Tools */}
        {isTabAvailable('tools') && (
          <TabsContent value="tools" className="space-y-6">
            <ToolsSettings />
          </TabsContent>
        )}
      </Tabs>

      {/* Member Edit Modal */}
      <Dialog open={showMemberModal} onOpenChange={setShowMemberModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Membro</DialogTitle>
            <DialogDescription>
              Atualize as informações do membro da equipe
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Nome</label>
              <input
                type="text"
                value={memberForm.full_name}
                onChange={(e) => setMemberForm({ ...memberForm, full_name: e.target.value })}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground"
                placeholder="Nome completo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Telefone</label>
              <input
                type="tel"
                value={memberForm.phone}
                onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground"
                placeholder="(00) 00000-0000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Departamento</label>
              <select
                value={memberForm.department_id}
                onChange={(e) => setMemberForm({ ...memberForm, department_id: e.target.value })}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground"
              >
                <option value="">Sem departamento</option>
                {departments.map((dept: any) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setShowMemberModal(false)}
              className="px-4 py-2.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveMember}
              disabled={updateMember.isPending}
              className="flex items-center gap-2 px-4 py-2.5 btn-gradient text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50"
            >
              {updateMember.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
              Salvar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Department Modal */}
      <Dialog open={showDepartmentModal} onOpenChange={setShowDepartmentModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Departamento' : 'Novo Departamento'}</DialogTitle>
            <DialogDescription>
              {editingItem ? 'Atualize as informações do departamento' : 'Adicione um novo departamento'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Nome</label>
              <input
                type="text"
                value={departmentForm.name}
                onChange={(e) => setDepartmentForm({ ...departmentForm, name: e.target.value })}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground"
                placeholder="Nome do departamento"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Descrição</label>
              <textarea
                value={departmentForm.description}
                onChange={(e) => setDepartmentForm({ ...departmentForm, description: e.target.value })}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground resize-none"
                placeholder="Descrição opcional"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Cor</label>
              <input
                type="color"
                value={departmentForm.color}
                onChange={(e) => setDepartmentForm({ ...departmentForm, color: e.target.value })}
                className="w-16 h-10 rounded-lg cursor-pointer"
              />
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setShowDepartmentModal(false)}
              className="px-4 py-2.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveDepartment}
              disabled={createDepartment.isPending || updateDepartment.isPending}
              className="flex items-center gap-2 px-4 py-2.5 btn-gradient text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50"
            >
              {(createDepartment.isPending || updateDepartment.isPending) ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
              Salvar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Channel Modal */}
      <Dialog open={showChannelModal} onOpenChange={setShowChannelModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Canal' : 'Novo Canal'}</DialogTitle>
            <DialogDescription>
              {editingItem ? 'Atualize as informações do canal' : 'Adicione um novo canal WhatsApp'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Nome</label>
              <input
                type="text"
                value={channelForm.name}
                onChange={(e) => setChannelForm({ ...channelForm, name: e.target.value })}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground"
                placeholder="Nome do canal"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Telefone</label>
              <input
                type="tel"
                value={channelForm.phone}
                onChange={(e) => setChannelForm({ ...channelForm, phone: e.target.value })}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground"
                placeholder="+55 (00) 00000-0000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Departamento</label>
              <select
                value={channelForm.department_id}
                onChange={(e) => setChannelForm({ ...channelForm, department_id: e.target.value })}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground"
              >
                <option value="">Sem departamento</option>
                {departments.map((dept: any) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setShowChannelModal(false)}
              className="px-4 py-2.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveChannel}
              disabled={createChannel.isPending || updateChannel.isPending}
              className="flex items-center gap-2 px-4 py-2.5 btn-gradient text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50"
            >
              {(createChannel.isPending || updateChannel.isPending) ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
              Salvar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Field Modal */}
      <Dialog open={showFieldModal} onOpenChange={setShowFieldModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Campo' : 'Novo Campo'}</DialogTitle>
            <DialogDescription>
              {editingItem ? 'Atualize as informações do campo' : 'Adicione um novo campo personalizado'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Nome</label>
              <input
                type="text"
                value={fieldForm.name}
                onChange={(e) => setFieldForm({ ...fieldForm, name: e.target.value })}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground"
                placeholder="Nome do campo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Tipo</label>
              <select
                value={fieldForm.field_type}
                onChange={(e) => setFieldForm({ ...fieldForm, field_type: e.target.value })}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground"
              >
                <option value="text">Texto</option>
                <option value="number">Número</option>
                <option value="select">Seleção</option>
                <option value="multiselect">Multi-seleção</option>
                <option value="date">Data</option>
                <option value="checkbox">Checkbox</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Entidade</label>
              <select
                value={fieldForm.entity_type}
                onChange={(e) => setFieldForm({ ...fieldForm, entity_type: e.target.value })}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground"
              >
                <option value="contact">Contato</option>
                <option value="deal">Negócio</option>
              </select>
            </div>
            {(fieldForm.field_type === 'select' || fieldForm.field_type === 'multiselect') && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Opções</label>
                <input
                  type="text"
                  value={fieldForm.options}
                  onChange={(e) => setFieldForm({ ...fieldForm, options: e.target.value })}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-foreground"
                  placeholder="Opção 1, Opção 2, Opção 3"
                />
                <p className="text-xs text-muted-foreground mt-1">Separe as opções por vírgula</p>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch
                checked={fieldForm.is_required}
                onCheckedChange={(checked) => setFieldForm({ ...fieldForm, is_required: checked })}
              />
              <span className="text-sm text-foreground">Campo obrigatório</span>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setShowFieldModal(false)}
              className="px-4 py-2.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveField}
              disabled={createField.isPending || updateField.isPending}
              className="flex items-center gap-2 px-4 py-2.5 btn-gradient text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50"
            >
              {(createField.isPending || updateField.isPending) ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Check size={16} />
              )}
              Salvar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
