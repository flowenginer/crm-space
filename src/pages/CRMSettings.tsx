import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Building2, 
  User, 
  ShieldCheck,
  Loader2,
  Settings2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useDepartments } from '@/hooks/useDepartments';
import { useTeam } from '@/hooks/useTeam';
import {
  useRequiredFieldsRules,
  useCreateRequiredFieldsRule,
  useUpdateRequiredFieldsRule,
  useDeleteRequiredFieldsRule,
  useToggleRequiredFieldsRule,
  AVAILABLE_FIELDS,
  type RequiredFieldsRule,
  type RequiredFieldsRuleInput,
} from '@/hooks/useRequiredFieldsRules';

type ScopeType = 'department' | 'user';

interface RuleFormData {
  scopeType: ScopeType;
  departmentId: string;
  userId: string;
  requiredFields: string[];
  isEnabled: boolean;
}

const defaultFormData: RuleFormData = {
  scopeType: 'department',
  departmentId: '',
  userId: '',
  requiredFields: [],
  isEnabled: true,
};

export default function CRMSettings() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RequiredFieldsRule | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);
  const [formData, setFormData] = useState<RuleFormData>(defaultFormData);

  const { data: rules, isLoading: isLoadingRules } = useRequiredFieldsRules();
  const { data: departments } = useDepartments();
  const { data: teamMembers } = useTeam();
  const createRule = useCreateRequiredFieldsRule();
  const updateRule = useUpdateRequiredFieldsRule();
  const deleteRule = useDeleteRequiredFieldsRule();
  const toggleRule = useToggleRequiredFieldsRule();

  // Filter out departments/users that already have rules
  const availableDepartments = departments?.filter(d => 
    !rules?.some(r => r.department_id === d.id) || editingRule?.department_id === d.id
  ) || [];
  
  const availableUsers = teamMembers?.filter(u => 
    !rules?.some(r => r.user_id === u.id) || editingRule?.user_id === u.id
  ) || [];

  const handleOpenModal = (rule?: RequiredFieldsRule) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({
        scopeType: rule.department_id ? 'department' : 'user',
        departmentId: rule.department_id || '',
        userId: rule.user_id || '',
        requiredFields: rule.required_fields || [],
        isEnabled: rule.is_enabled,
      });
    } else {
      setEditingRule(null);
      setFormData(defaultFormData);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRule(null);
    setFormData(defaultFormData);
  };

  const handleFieldToggle = (fieldKey: string) => {
    setFormData(prev => ({
      ...prev,
      requiredFields: prev.requiredFields.includes(fieldKey)
        ? prev.requiredFields.filter(f => f !== fieldKey)
        : [...prev.requiredFields, fieldKey],
    }));
  };

  const handleSubmit = async () => {
    // Validation
    if (formData.scopeType === 'department' && !formData.departmentId) {
      toast.error('Selecione um departamento');
      return;
    }
    if (formData.scopeType === 'user' && !formData.userId) {
      toast.error('Selecione um usuário');
      return;
    }
    if (formData.requiredFields.length === 0) {
      toast.error('Selecione pelo menos um campo obrigatório');
      return;
    }

    const input: RequiredFieldsRuleInput = {
      department_id: formData.scopeType === 'department' ? formData.departmentId : null,
      user_id: formData.scopeType === 'user' ? formData.userId : null,
      required_fields: formData.requiredFields,
      is_enabled: formData.isEnabled,
    };

    try {
      if (editingRule) {
        await updateRule.mutateAsync({ id: editingRule.id, ...input });
      } else {
        await createRule.mutateAsync(input);
      }
      handleCloseModal();
    } catch (error) {
      // Error handled in mutation
    }
  };

  const handleDelete = async () => {
    if (!deletingRuleId) return;
    try {
      await deleteRule.mutateAsync(deletingRuleId);
      setIsDeleteDialogOpen(false);
      setDeletingRuleId(null);
    } catch (error) {
      // Error handled in mutation
    }
  };

  const handleToggle = async (rule: RequiredFieldsRule) => {
    await toggleRule.mutateAsync({ id: rule.id, is_enabled: !rule.is_enabled });
  };

  const confirmDelete = (ruleId: string) => {
    setDeletingRuleId(ruleId);
    setIsDeleteDialogOpen(true);
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings2 className="h-6 w-6" />
          Configurações CRM
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure regras e comportamentos do CRM
        </p>
      </div>

      {/* Required Fields Rules Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Campos Obrigatórios para Envio
              </CardTitle>
              <CardDescription className="mt-1">
                Defina quais campos devem ser preenchidos antes de enviar mensagens
              </CardDescription>
            </div>
            <Button onClick={() => handleOpenModal()}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Regra
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingRules ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : !rules || rules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma regra configurada</p>
              <p className="text-sm">Crie uma regra para exigir preenchimento de campos</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Escopo</TableHead>
                  <TableHead>Campos Obrigatórios</TableHead>
                  <TableHead className="text-center">Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {rule.department_id ? (
                          <>
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span>{rule.department?.name || 'Departamento'}</span>
                          </>
                        ) : (
                          <>
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span>{rule.user?.full_name || 'Usuário'}</span>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {rule.required_fields.map((field) => {
                          const fieldDef = AVAILABLE_FIELDS.find(f => f.key === field);
                          return (
                            <Badge key={field} variant="secondary" className="text-xs">
                              {fieldDef?.label || field}
                            </Badge>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={rule.is_enabled}
                        onCheckedChange={() => handleToggle(rule)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenModal(rule)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => confirmDelete(rule.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? 'Editar Regra' : 'Nova Regra de Campos Obrigatórios'}
            </DialogTitle>
            <DialogDescription>
              Defina para quem e quais campos serão obrigatórios
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Scope Type */}
            <div className="space-y-2">
              <Label>Aplicar regra para</Label>
              <Select
                value={formData.scopeType}
                onValueChange={(value: ScopeType) => setFormData(prev => ({
                  ...prev,
                  scopeType: value,
                  departmentId: '',
                  userId: '',
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="department">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Departamento
                    </div>
                  </SelectItem>
                  <SelectItem value="user">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Usuário Específico
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Department or User Selection */}
            {formData.scopeType === 'department' ? (
              <div className="space-y-2">
                <Label>Departamento</Label>
                <Select
                  value={formData.departmentId}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, departmentId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDepartments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Usuário</Label>
                <Select
                  value={formData.userId}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, userId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Required Fields */}
            <div className="space-y-3">
              <Label>Campos Obrigatórios</Label>
              <div className="space-y-2">
                {AVAILABLE_FIELDS.map((field) => (
                  <div
                    key={field.key}
                    className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      id={field.key}
                      checked={formData.requiredFields.includes(field.key)}
                      onCheckedChange={() => handleFieldToggle(field.key)}
                    />
                    <div className="space-y-0.5">
                      <Label htmlFor={field.key} className="font-medium cursor-pointer">
                        {field.label}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {field.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Enable Toggle */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label>Regra Ativa</Label>
                <p className="text-xs text-muted-foreground">
                  Ativar ou desativar esta regra
                </p>
              </div>
              <Switch
                checked={formData.isEnabled}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isEnabled: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseModal}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={createRule.isPending || updateRule.isPending}
            >
              {(createRule.isPending || updateRule.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingRule ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Regra</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta regra? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteRule.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
