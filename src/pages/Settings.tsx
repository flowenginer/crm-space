import { useState } from 'react';
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
  Wrench,
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
import { Facebook, UserCheck } from 'lucide-react';
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

export default function Settings() {
  const { user } = useAuth();
  
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
        <TabsList className="bg-card border border-border rounded-xl p-1 shadow-sm w-full flex flex-wrap mb-6">
          <TabsTrigger
            value="team"
            className="flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white rounded-lg"
          >
            <Users size={18} />
            Equipe
          </TabsTrigger>
          <TabsTrigger
            value="roles"
            className="flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white rounded-lg"
          >
            <Shield size={18} />
            Perfis
          </TabsTrigger>
          <TabsTrigger
            value="departments"
            className="flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white rounded-lg"
          >
            <Building2 size={18} />
            Departamentos
          </TabsTrigger>
          <TabsTrigger
            value="channels"
            className="flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white rounded-lg"
          >
            <MessageSquare size={18} />
            Canais
          </TabsTrigger>
          <TabsTrigger
            value="fields"
            className="flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white rounded-lg"
          >
            <Database size={18} />
            Campos
          </TabsTrigger>
          <TabsTrigger
            value="tags"
            className="flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white rounded-lg"
          >
            <Tag size={18} />
            Etiquetas
          </TabsTrigger>
          <TabsTrigger
            value="owner-agent"
            className="flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white rounded-lg"
          >
            <UserCheck size={18} />
            Responsável
          </TabsTrigger>
          <TabsTrigger
            value="close-reasons"
            className="flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white rounded-lg"
          >
            <X size={18} />
            Fechamento
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className="flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white rounded-lg"
          >
            <Bell size={18} />
            Notificações
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white rounded-lg"
          >
            <Key size={18} />
            Segurança
          </TabsTrigger>
          <TabsTrigger
            value="integrations"
            className="flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white rounded-lg"
          >
            <Plug size={18} />
            Integrações
          </TabsTrigger>
          <TabsTrigger
            value="meta-ads"
            className="flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white rounded-lg"
          >
            <Facebook size={18} />
            Meta Ads
          </TabsTrigger>
          <TabsTrigger
            value="general"
            className="flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white rounded-lg"
          >
            <Palette size={18} />
            Geral
          </TabsTrigger>
          <TabsTrigger
            value="tools"
            className="flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white rounded-lg"
          >
            <Wrench size={18} />
            Ferramentas
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Team Management */}
        <TabsContent value="team" className="space-y-6">
          <UserManagement />
        </TabsContent>

        {/* TAB 2: Role Management */}
        <TabsContent value="roles" className="space-y-6">
          <RoleManagement />
        </TabsContent>

        {/* TAB 3: Departments */}
        <TabsContent value="departments" className="space-y-6">
          <DepartmentManagement />
        </TabsContent>

        {/* TAB: Tags */}
        <TabsContent value="tags" className="space-y-6">
          <TagManagement />
        </TabsContent>

        {/* TAB: Owner Agent Settings */}
        <TabsContent value="owner-agent" className="space-y-6">
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            <OwnerAgentSettings />
          </div>
        </TabsContent>

        {/* TAB: Close Reasons Management */}
        <TabsContent value="close-reasons" className="space-y-6">
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            <CloseReasonManagement />
          </div>
        </TabsContent>

        {/* TAB 4: Channels */}
        <TabsContent value="channels" className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground">Gerencie seus canais de atendimento WhatsApp</p>
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
          </div>

          {loadingChannels ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : channels.length === 0 ? (
            <div className="bg-card rounded-2xl border border-border p-12 text-center">
              <MessageSquare size={48} className="mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum canal cadastrado</p>
            </div>
          ) : (
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
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        channel.status === 'connected'
                          ? 'bg-status-success/10 text-status-success'
                          : 'bg-status-error/10 text-status-error'
                      }`}>
                        {channel.status === 'connected' ? 'Conectado' : 'Desconectado'}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                            <MoreVertical size={16} className="text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditChannel(channel)}>
                            <Edit3 size={14} className="mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteChannel(channel.id)} className="text-status-error">
                            <Trash2 size={14} className="mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-border">
                    <span className="text-sm text-muted-foreground">
                      Departamento: {channel.department?.name || 'Não definido'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB 4: Custom Fields */}
        <TabsContent value="fields" className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground">Crie campos personalizados para contatos e negócios</p>
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

          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            {loadingFields ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
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
                  {customFields.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                        Nenhum campo customizado cadastrado
                      </td>
                    </tr>
                  ) : (
                    customFields.map((field) => (
                      <tr key={field.id} className="hover:bg-muted/30">
                        <td className="px-6 py-4">
                          <div>
                            <span className="font-medium text-foreground">{field.name}</span>
                            {Array.isArray(field.options) && field.options.length > 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Opções: {field.options.join(', ')}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-1 bg-muted rounded-lg text-xs font-medium text-foreground">
                            {fieldTypeLabels[field.field_type] || field.field_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-foreground">
                          {field.entity_type === 'contact' ? 'Contato' : 'Negócio'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {field.is_required ? (
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
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        {/* TAB 5: Notifications */}
        <TabsContent value="notifications" className="space-y-6">
          {loadingNotifications ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-foreground mb-6">Preferências de Notificação</h3>

                <div className="space-y-6">
                  {[
                    { key: 'new_messages', title: 'Novas mensagens', description: 'Receba notificação quando uma nova mensagem chegar' },
                    { key: 'new_deals', title: 'Novos negócios', description: 'Seja notificado quando um novo negócio for criado' },
                    { key: 'stage_changes', title: 'Mudança de etapa', description: 'Notifique quando um negócio mudar de etapa no funil' },
                    { key: 'sla_alerts', title: 'Alerta de SLA', description: 'Avise quando um atendimento estiver perto do limite' },
                    { key: 'daily_summary', title: 'Resumo diário', description: 'Receba um resumo diário das atividades' },
                  ].map((setting) => (
                    <div key={setting.key} className="flex items-center justify-between py-4 border-b border-border last:border-0">
                      <div>
                        <h4 className="font-medium text-foreground">{setting.title}</h4>
                        <p className="text-sm text-muted-foreground">{setting.description}</p>
                      </div>
                      <Switch
                        checked={notificationSettings?.[setting.key as keyof typeof notificationSettings] as boolean ?? false}
                        onCheckedChange={(checked) => handleNotificationChange(setting.key, checked)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-foreground mb-6">Canais de Notificação</h3>

                <div className="space-y-4">
                  {[
                    { key: 'email_enabled', title: 'Email', icon: Mail },
                    { key: 'push_enabled', title: 'Push (Navegador)', icon: Bell },
                    { key: 'whatsapp_enabled', title: 'WhatsApp', icon: MessageSquare },
                  ].map((channel) => (
                    <div key={channel.key} className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                          <channel.icon size={20} className="text-primary" />
                        </div>
                        <span className="font-medium text-foreground">{channel.title}</span>
                      </div>
                      <Switch
                        checked={notificationSettings?.[channel.key as keyof typeof notificationSettings] as boolean ?? false}
                        onCheckedChange={(checked) => handleNotificationChange(channel.key, checked)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </TabsContent>

        {/* TAB 6: Security */}
        <TabsContent value="security" className="space-y-6">
          {/* Change Password */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-foreground mb-6">Alterar Minha Senha</h3>
            <div className="max-w-md space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Nova senha</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Mínimo 6 caracteres</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Confirmar nova senha</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-primary/20 bg-background ${
                    confirmPassword && newPassword !== confirmPassword 
                      ? 'border-destructive' 
                      : 'border-border focus:border-primary'
                  }`}
                />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-destructive mt-1">As senhas não conferem</p>
                )}
              </div>
              <button 
                onClick={handleChangePassword}
                disabled={changingPassword || !newPassword || newPassword !== confirmPassword}
                className="px-6 py-2.5 btn-gradient text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {changingPassword ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Alterando...
                  </>
                ) : (
                  'Alterar senha'
                )}
              </button>
            </div>
          </div>

          {/* Sessions */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-foreground mb-6">Sessões Ativas</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-status-success/10 rounded-lg flex items-center justify-center">
                    <Monitor size={20} className="text-status-success" />
                  </div>
                  <div>
                    <div className="font-medium text-foreground">Chrome - Windows</div>
                    <div className="text-sm text-muted-foreground">Rio de Janeiro, Brasil • Ativo agora</div>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-status-success/10 text-status-success rounded-full text-xs font-medium">
                  Sessão atual
                </span>
              </div>
            </div>
            <button className="mt-4 px-4 py-2 border border-status-error/30 text-status-error rounded-xl hover:bg-status-error/10 transition-colors">
              Encerrar todas as outras sessões
            </button>
          </div>

          {/* Two-Factor Authentication */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Key size={24} className="text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Autenticação de dois fatores</h3>
                  <p className="text-sm text-muted-foreground">Adicione uma camada extra de segurança à sua conta</p>
                </div>
              </div>
              <button className="px-4 py-2 border border-border rounded-xl hover:bg-muted transition-colors">
                Configurar
              </button>
            </div>
          </div>
        </TabsContent>

        {/* TAB: Integrações */}
        <TabsContent value="integrations" className="space-y-6">
          <IntegrationSettings />
        </TabsContent>

        {/* TAB: Meta Ads */}
        <TabsContent value="meta-ads" className="space-y-6">
          <MetaAdsSettings />
        </TabsContent>

        {/* TAB: Ferramentas */}
        <TabsContent value="tools" className="space-y-6">
          <ToolsSettings />
        </TabsContent>


        {/* TAB 7: General */}
        <TabsContent value="general" className="space-y-6">
          {/* Company Info */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-foreground mb-6">Informações da Empresa</h3>
            <div className="max-w-md space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Nome da empresa</label>
                <input
                  type="text"
                  defaultValue="Space Sports"
                  className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">CNPJ</label>
                <input
                  type="text"
                  placeholder="00.000.000/0000-00"
                  className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Telefone</label>
                <input
                  type="tel"
                  placeholder="+55 (00) 00000-0000"
                  className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Email</label>
                <input
                  type="email"
                  placeholder="contato@empresa.com"
                  className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                />
              </div>
              <button className="px-6 py-2.5 btn-gradient text-white rounded-xl font-medium hover:shadow-lg transition-all">
                Salvar alterações
              </button>
            </div>
          </div>

          {/* Working Hours */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <Clock size={20} className="text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Horário de Funcionamento</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 max-w-md mb-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Início</label>
                <input
                  type="time"
                  defaultValue="08:00"
                  className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Fim</label>
                <input
                  type="time"
                  defaultValue="18:00"
                  className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Dias de funcionamento</label>
              <div className="flex gap-2">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, idx) => (
                  <button
                    key={day}
                    className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                      idx >= 1 && idx <= 5
                        ? 'bg-primary text-white'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Timezone */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <Globe size={20} className="text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Fuso Horário</h3>
            </div>
            <select className="w-full max-w-md px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background">
              <option>America/Sao_Paulo (UTC-03:00)</option>
              <option>America/Manaus (UTC-04:00)</option>
              <option>America/Fortaleza (UTC-03:00)</option>
              <option>America/Recife (UTC-03:00)</option>
            </select>
          </div>

          {/* Danger Zone */}
          <div className="bg-status-error/5 rounded-2xl border border-status-error/20 p-6">
            <h3 className="text-lg font-semibold text-status-error mb-2">Zona de Perigo</h3>
            <p className="text-sm text-status-error/80 mb-4">Ações irreversíveis que afetam toda a sua conta</p>
            <div className="flex gap-4">
              <button className="px-4 py-2 border border-status-error/30 text-status-error rounded-xl hover:bg-status-error/10 transition-colors">
                Exportar todos os dados
              </button>
              <button className="px-4 py-2 border border-status-error/30 text-status-error rounded-xl hover:bg-status-error/10 transition-colors">
                Excluir conta
              </button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Member Modal */}
      <Dialog open={showMemberModal} onOpenChange={setShowMemberModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Membro</DialogTitle>
            <DialogDescription>Atualize os dados do membro da equipe</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Nome completo</label>
              <input
                type="text"
                value={memberForm.full_name}
                onChange={(e) => setMemberForm({ ...memberForm, full_name: e.target.value })}
                className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                placeholder="Nome do membro"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Telefone</label>
              <input
                type="tel"
                value={memberForm.phone}
                onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })}
                className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                placeholder="+55 21 99999-0000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Departamento</label>
              <select
                value={memberForm.department_id}
                onChange={(e) => setMemberForm({ ...memberForm, department_id: e.target.value })}
                className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
              >
                <option value="">Selecione</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
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
              disabled={updateMember.isPending}
              className="px-6 py-2 btn-gradient text-white rounded-lg font-medium disabled:opacity-50"
            >
              {updateMember.isPending ? 'Salvando...' : 'Salvar'}
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
                className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                placeholder="Nome do departamento"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Descrição</label>
              <textarea
                value={departmentForm.description}
                onChange={(e) => setDepartmentForm({ ...departmentForm, description: e.target.value })}
                className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none bg-background"
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
              disabled={createDepartment.isPending || updateDepartment.isPending}
              className="px-6 py-2 btn-gradient text-white rounded-lg font-medium disabled:opacity-50"
            >
              {(createDepartment.isPending || updateDepartment.isPending) ? 'Salvando...' : editingItem ? 'Salvar' : 'Criar'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Channel Modal */}
      <Dialog open={showChannelModal} onOpenChange={setShowChannelModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Canal' : 'Novo Canal'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Nome *</label>
              <input
                type="text"
                value={channelForm.name}
                onChange={(e) => setChannelForm({ ...channelForm, name: e.target.value })}
                className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                placeholder="Ex: Vendas 01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Telefone *</label>
              <input
                type="tel"
                value={channelForm.phone}
                onChange={(e) => setChannelForm({ ...channelForm, phone: e.target.value })}
                className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                placeholder="+55 21 99999-0000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Departamento</label>
              <select
                value={channelForm.department_id}
                onChange={(e) => setChannelForm({ ...channelForm, department_id: e.target.value })}
                className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
              >
                <option value="">Selecione</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <button
              onClick={() => setShowChannelModal(false)}
              className="px-4 py-2 text-muted-foreground hover:bg-muted rounded-lg"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveChannel}
              disabled={createChannel.isPending || updateChannel.isPending}
              className="px-6 py-2 btn-gradient text-white rounded-lg font-medium disabled:opacity-50"
            >
              {(createChannel.isPending || updateChannel.isPending) ? 'Salvando...' : editingItem ? 'Salvar' : 'Criar'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Field Modal */}
      <Dialog open={showFieldModal} onOpenChange={setShowFieldModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Campo' : 'Novo Campo'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Nome *</label>
              <input
                type="text"
                value={fieldForm.name}
                onChange={(e) => setFieldForm({ ...fieldForm, name: e.target.value })}
                className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                placeholder="Nome do campo"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Tipo</label>
                <select
                  value={fieldForm.field_type}
                  onChange={(e) => setFieldForm({ ...fieldForm, field_type: e.target.value })}
                  className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                >
                  <option value="text">Texto</option>
                  <option value="number">Número</option>
                  <option value="date">Data</option>
                  <option value="select">Seleção</option>
                  <option value="multiselect">Multi-seleção</option>
                  <option value="checkbox">Checkbox</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Entidade</label>
                <select
                  value={fieldForm.entity_type}
                  onChange={(e) => setFieldForm({ ...fieldForm, entity_type: e.target.value })}
                  className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                >
                  <option value="contact">Contato</option>
                  <option value="deal">Negócio</option>
                </select>
              </div>
            </div>
            {(fieldForm.field_type === 'select' || fieldForm.field_type === 'multiselect') && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Opções (separadas por vírgula)</label>
                <input
                  type="text"
                  value={fieldForm.options}
                  onChange={(e) => setFieldForm({ ...fieldForm, options: e.target.value })}
                  className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                  placeholder="Opção 1, Opção 2, Opção 3"
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="required"
                checked={fieldForm.is_required}
                onChange={(e) => setFieldForm({ ...fieldForm, is_required: e.target.checked })}
                className="rounded border-border"
              />
              <label htmlFor="required" className="text-sm text-foreground">Campo obrigatório</label>
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
              disabled={createField.isPending || updateField.isPending}
              className="px-6 py-2 btn-gradient text-white rounded-lg font-medium disabled:opacity-50"
            >
              {(createField.isPending || updateField.isPending) ? 'Salvando...' : editingItem ? 'Salvar' : 'Criar'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
