import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Save, Users, Shield, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useRoles } from '@/hooks/useRoles';
import { useEmailVisibilityRules, useBulkSaveEmailVisibilityRules } from '@/hooks/useEmailVisibilityRules';
import { useAllSharedBoxes } from '@/hooks/useSharedEmailBoxes';
import { Alert, AlertDescription } from '@/components/ui/alert';

type RulesState = Record<string, Record<string, boolean>>;

export function EmailPermissionsSettings() {
  const { data: roles, isLoading: rolesLoading } = useRoles();
  const { data: rules, isLoading: rulesLoading } = useEmailVisibilityRules();
  const { data: sharedBoxes, isLoading: boxesLoading } = useAllSharedBoxes();
  const bulkSave = useBulkSaveEmailVisibilityRules();

  // Estado local para as permissões
  const [rulesState, setRulesState] = useState<RulesState>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Roles que não são admin/supervisor (esses têm acesso total)
  const editableRoles = useMemo(() => {
    return roles?.filter(r => !['admin', 'supervisor'].includes(r.role_key)) || [];
  }, [roles]);

  // Todos os targets possíveis (roles + caixas compartilhadas)
  const targetRoles = useMemo(() => {
    return roles?.filter(r => !['admin', 'supervisor'].includes(r.role_key)) || [];
  }, [roles]);

  // Inicializar estado com regras existentes
  useEffect(() => {
    if (rules && roles && sharedBoxes) {
      const initialState: RulesState = {};

      editableRoles.forEach(role => {
        initialState[role.role_key] = {};

        // Inicializar com false (bloqueado por padrão)
        targetRoles.forEach(targetRole => {
          initialState[role.role_key][`role:${targetRole.role_key}`] = false;
        });
        sharedBoxes.forEach(box => {
          initialState[role.role_key][`box:${box.id}`] = false;
        });
      });

      // Aplicar regras existentes
      rules.forEach(rule => {
        if (initialState[rule.source_role]) {
          if (rule.target_role) {
            initialState[rule.source_role][`role:${rule.target_role}`] = rule.is_allowed;
          } else if (rule.target_shared_box_id) {
            initialState[rule.source_role][`box:${rule.target_shared_box_id}`] = rule.is_allowed;
          }
        }
      });

      setRulesState(initialState);
      setHasChanges(false);
    }
  }, [rules, roles, sharedBoxes, editableRoles, targetRoles]);

  const handleToggle = (sourceRole: string, targetKey: string, checked: boolean) => {
    setRulesState(prev => ({
      ...prev,
      [sourceRole]: {
        ...prev[sourceRole],
        [targetKey]: checked
      }
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    const rulesToSave: Array<{
      source_role: string;
      target_role?: string;
      target_shared_box_id?: string;
      is_allowed: boolean;
    }> = [];

    Object.entries(rulesState).forEach(([sourceRole, targets]) => {
      Object.entries(targets).forEach(([targetKey, isAllowed]) => {
        if (targetKey.startsWith('role:')) {
          rulesToSave.push({
            source_role: sourceRole,
            target_role: targetKey.replace('role:', ''),
            is_allowed: isAllowed
          });
        } else if (targetKey.startsWith('box:')) {
          rulesToSave.push({
            source_role: sourceRole,
            target_shared_box_id: targetKey.replace('box:', ''),
            is_allowed: isAllowed
          });
        }
      });
    });

    try {
      await bulkSave.mutateAsync(rulesToSave);
      toast.success('Permissões salvas com sucesso');
      setHasChanges(false);
    } catch (error) {
      toast.error('Erro ao salvar permissões');
      console.error(error);
    }
  };

  const isLoading = rolesLoading || rulesLoading || boxesLoading;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (editableRoles.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Nenhum role configurável encontrado. Admin e Supervisor têm acesso total por padrão.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          <strong>Admin</strong> e <strong>Supervisor</strong> têm acesso total e podem enviar e-mail para qualquer pessoa.
          Configure abaixo as permissões para os demais roles.
        </AlertDescription>
      </Alert>

      {editableRoles.map(role => (
        <Card key={role.id}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">{role.role_name}</CardTitle>
              <Badge variant="secondary" className="text-xs">
                {role.user_count || 0} usuário{role.user_count !== 1 ? 's' : ''}
              </Badge>
            </div>
            <CardDescription>
              Defina para quem usuários com este role podem enviar e-mail
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Roles */}
              {targetRoles.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Enviar para roles:</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {targetRoles.map(targetRole => {
                      const key = `role:${targetRole.role_key}`;
                      const isSameRole = role.role_key === targetRole.role_key;
                      const isChecked = rulesState[role.role_key]?.[key] ?? false;

                      return (
                        <div key={targetRole.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`${role.role_key}-${key}`}
                            checked={isChecked}
                            onCheckedChange={(checked) => 
                              handleToggle(role.role_key, key, checked as boolean)
                            }
                          />
                          <Label
                            htmlFor={`${role.role_key}-${key}`}
                            className="text-sm cursor-pointer"
                          >
                            {targetRole.role_name}
                            {isSameRole && <span className="text-muted-foreground ml-1">(próprio)</span>}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Caixas Compartilhadas */}
              {sharedBoxes && sharedBoxes.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Enviar para caixas compartilhadas:</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {sharedBoxes.map(box => {
                      const key = `box:${box.id}`;
                      const isChecked = rulesState[role.role_key]?.[key] ?? false;

                      return (
                        <div key={box.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`${role.role_key}-${key}`}
                            checked={isChecked}
                            onCheckedChange={(checked) => 
                              handleToggle(role.role_key, key, checked as boolean)
                            }
                          />
                          <Label
                            htmlFor={`${role.role_key}-${key}`}
                            className="text-sm cursor-pointer"
                          >
                            📦 {box.name}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Botão Salvar */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={!hasChanges || bulkSave.isPending}
        >
          <Save className="h-4 w-4 mr-2" />
          {bulkSave.isPending ? 'Salvando...' : 'Salvar Alterações'}
        </Button>
      </div>
    </div>
  );
}
