import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { IconSelector } from './IconSelector';
import { MenuItem, MenuItemInput } from '@/hooks/useMenuConfig';
import { usePermissionDefinitions } from '@/hooks/useRoles';
import { routeToPermissionKey, CUSTOM_MENU_CATEGORY } from '@/hooks/useMenuPermissionSync';
import { Loader2, ChevronRight, ChevronDown, Check, Circle, icons, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

// Dynamic icon component
const DynamicIcon = ({ name, className }: { name: string; className?: string }) => {
  const IconComponent = icons[name as keyof typeof icons];
  if (!IconComponent) return <Circle className={className} />;
  return <IconComponent className={className} />;
};

// TreeView component for parent selection
interface ParentMenuTreeSelectProps {
  allItems: MenuItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  excludedIds: string[];
  maxDepth?: number;
}

function ParentMenuTreeSelect({
  allItems,
  selectedId,
  onSelect,
  excludedIds,
  maxDepth = 2,
}: ParentMenuTreeSelectProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    // Initialize with parent of selected item expanded
    if (selectedId) {
      const selected = allItems.find(i => i.id === selectedId);
      if (selected?.parent_id) {
        return new Set([selected.parent_id]);
      }
    }
    return new Set();
  });

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const getDepth = (item: MenuItem): number => {
    if (!item.parent_id) return 0;
    const parent = allItems.find(i => i.id === item.parent_id);
    return parent ? getDepth(parent) + 1 : 0;
  };

  const renderItem = (item: MenuItem, depth = 0) => {
    const children = allItems.filter(i => i.parent_id === item.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedIds.has(item.id);
    const isExcluded = excludedIds.includes(item.id);
    const canBeParent = getDepth(item) < maxDepth && !isExcluded;
    const isSelected = selectedId === item.id;

    return (
      <div key={item.id}>
        <div
          className={cn(
            "flex items-center gap-2 py-1.5 px-2 rounded-md transition-colors",
            canBeParent && "cursor-pointer hover:bg-muted",
            !canBeParent && "opacity-50 cursor-not-allowed",
            isSelected && "bg-primary/10 ring-1 ring-primary"
          )}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
          onClick={() => canBeParent && onSelect(item.id)}
        >
          {/* Expand/collapse arrow */}
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => toggleExpand(item.id, e)}
              className="p-0.5 hover:bg-muted-foreground/20 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          ) : (
            <span className="w-5" />
          )}

          {/* Menu icon */}
          <DynamicIcon name={item.icon} className="h-4 w-4 text-muted-foreground" />

          {/* Title */}
          <span className={cn("flex-1 text-sm", isSelected && "font-medium text-primary")}>
            {item.title}
          </span>

          {/* Selected indicator */}
          {isSelected && <Check className="h-4 w-4 text-primary" />}
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="border-l border-border ml-4">
            {children
              .sort((a, b) => (a.position || 0) - (b.position || 0))
              .map(child => renderItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const rootItems = allItems
    .filter(i => !i.parent_id)
    .sort((a, b) => (a.position || 0) - (b.position || 0));

  return (
    <div className="border rounded-lg p-2 max-h-[250px] overflow-y-auto bg-background">
      {/* "None" option */}
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer hover:bg-muted transition-colors",
          !selectedId && "bg-primary/10 ring-1 ring-primary"
        )}
        onClick={() => onSelect(null)}
      >
        <span className="w-5" />
        <Circle className="h-4 w-4 text-muted-foreground" />
        <span className={cn("flex-1 text-sm", !selectedId && "font-medium text-primary")}>
          Nenhum (menu principal)
        </span>
        {!selectedId && <Check className="h-4 w-4 text-primary" />}
      </div>

      {/* Root menu items */}
      {rootItems.map(item => renderItem(item, 0))}
    </div>
  );
}

// Permissões estáticas de fallback (caso o banco não esteja disponível)
const FALLBACK_PERMISSIONS = [
  { value: '', label: 'Nenhuma (visível para todos)' },
  { value: 'dashboard.view', label: 'Dashboard' },
  { value: 'conversations.view', label: 'Conversas' },
  { value: 'contacts.view', label: 'Contatos' },
  { value: 'deals.view', label: 'CRM / Negócios' },
  { value: 'templates.view', label: 'Templates / Mensagens' },
  { value: 'reports.view', label: 'Relatórios' },
  { value: 'internal_email.view', label: 'E-mail Interno' },
  { value: 'internal_chat.view', label: 'Chat Interno' },
  { value: 'marketing.view', label: 'Marketing' },
  { value: 'financial.view', label: 'Financeiro' },
  { value: 'orders.view', label: 'Pedidos' },
  { value: 'quotes.view', label: 'Orçamentos' },
  { value: 'products.view', label: 'Produtos' },
  { value: 'settings.view', label: 'Configurações' },
  { value: 'automations.view', label: 'Automações' },
  { value: 'channels.view', label: 'Canais' },
  { value: 'webhooks.view', label: 'Webhooks' },
  { value: 'live.view', label: 'Monitor Ao Vivo' },
  { value: 'schedules.view', label: 'Agendamentos' },
];

// Badges disponíveis
const AVAILABLE_BADGES = [
  { value: '', label: 'Nenhum' },
  { value: 'scheduledCount', label: 'Contador de Agendamentos' },
  { value: 'requestsCount', label: 'Contador de Requisições' },
  { value: 'internalChatCount', label: 'Mensagens não lidas (Chat Interno)' },
  { value: 'liveBadge', label: 'Indicador ao Vivo (bolinha verde)' },
];

export interface MenuItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: MenuItemInput & { createPermission?: boolean }) => Promise<void>;
  editingItem?: MenuItem | null;
  parentId?: string | null;
  isSubmitting?: boolean;
  allMenuItems?: MenuItem[];
}

export function MenuItemModal({
  isOpen,
  onClose,
  onSave,
  editingItem,
  parentId,
  isSubmitting,
  allMenuItems = [],
}: MenuItemModalProps) {
  const { data: dbPermissions } = usePermissionDefinitions();
  const [createPermission, setCreatePermission] = useState(true);
  const [form, setForm] = useState<MenuItemInput>({
    title: '',
    href: '',
    icon: 'Circle',
    parent_id: parentId || null,
    permission: null,
    roles: null,
    is_active: true,
    show_badge: null,
  });

  // Monta lista de permissões dinamicamente do banco
  const availablePermissions = useMemo(() => {
    if (!dbPermissions || dbPermissions.length === 0) {
      return FALLBACK_PERMISSIONS;
    }

    const permissions = [{ value: '', label: 'Nenhuma (visível para todos)' }];
    
    // Agrupar por categoria para melhor organização
    const byCategory = new Map<string, Array<{ value: string; label: string }>>();
    
    for (const perm of dbPermissions) {
      const category = perm.category || 'other';
      if (!byCategory.has(category)) {
        byCategory.set(category, []);
      }
      byCategory.get(category)!.push({
        value: perm.permission_key,
        label: perm.permission_name,
      });
    }

    // Adicionar permissões ordenadas
    for (const [_, perms] of byCategory) {
      permissions.push(...perms);
    }

    return permissions;
  }, [dbPermissions]);

  // Verifica se a rota já tem uma permissão associada
  const suggestedPermission = useMemo(() => {
    if (!form.href) return null;
    const permKey = routeToPermissionKey(form.href);
    const exists = dbPermissions?.some(p => p.permission_key === permKey);
    return exists ? permKey : null;
  }, [form.href, dbPermissions]);

  useEffect(() => {
    if (editingItem) {
      setForm({
        title: editingItem.title,
        href: editingItem.href || '',
        icon: editingItem.icon,
        parent_id: editingItem.parent_id,
        permission: editingItem.permission,
        roles: editingItem.roles,
        is_active: editingItem.is_active,
        show_badge: editingItem.show_badge,
      });
      setCreatePermission(false); // Não criar nova permissão ao editar
    } else {
      setForm({
        title: '',
        href: '',
        icon: 'Circle',
        parent_id: parentId || null,
        permission: null,
        roles: null,
        is_active: true,
        show_badge: null,
      });
      setCreatePermission(true); // Por padrão, criar permissão ao criar novo menu
    }
  }, [editingItem, parentId, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) return;

    // Se vai criar permissão, define a permissão automaticamente
    const finalPermission = createPermission && form.href && !editingItem
      ? routeToPermissionKey(form.href)
      : form.permission;

    await onSave({
      ...form,
      href: form.href || null,
      permission: finalPermission || null,
      show_badge: form.show_badge || null,
      createPermission: createPermission && !!form.href && !editingItem,
    });
  };

  // Get depth of an item in the hierarchy
  const getDepth = (item: MenuItem): number => {
    if (!item.parent_id) return 0;
    const parent = allMenuItems.find(i => i.id === item.parent_id);
    return parent ? getDepth(parent) + 1 : 0;
  };

  // Build hierarchical label for an item (e.g., "CRM → Configurações CRM")
  const getItemLabel = (item: MenuItem): string => {
    const buildPath = (current: MenuItem): string[] => {
      if (!current.parent_id) return [current.title];
      const parent = allMenuItems.find(i => i.id === current.parent_id);
      return parent ? [...buildPath(parent), current.title] : [current.title];
    };
    return buildPath(item).join(' → ');
  };

  // Filter valid parent options (exclude self and children to prevent circular deps)
  const getDescendantIds = (itemId: string): string[] => {
    const item = allMenuItems.find(i => i.id === itemId);
    if (!item) return [];
    const children = allMenuItems.filter(i => i.parent_id === itemId);
    return [itemId, ...children.flatMap(c => getDescendantIds(c.id))];
  };

  const excludedIds = editingItem ? getDescendantIds(editingItem.id) : [];
  
  // Allow any menu as parent (up to 2 levels deep to allow max 3 levels)
  const availableParents = allMenuItems
    .filter(item => !excludedIds.includes(item.id) && getDepth(item) < 2)
    .sort((a, b) => {
      // Sort by hierarchy path for better UX
      const pathA = getItemLabel(a);
      const pathB = getItemLabel(b);
      return pathA.localeCompare(pathB);
    });

  const isSubmenu = !!form.parent_id;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingItem ? 'Editar Item' : isSubmenu ? 'Novo Submenu' : 'Novo Menu'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ex: Dashboard"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="parent_id">Menu Pai</Label>
            <ParentMenuTreeSelect
              allItems={allMenuItems}
              selectedId={form.parent_id}
              onSelect={(id) => setForm({ ...form, parent_id: id })}
              excludedIds={excludedIds}
              maxDepth={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="href">
              Rota (URL)
              {!isSubmenu && <span className="text-muted-foreground text-xs ml-2">Deixe vazio para menu cascata</span>}
            </Label>
            <Input
              id="href"
              value={form.href || ''}
              onChange={(e) => setForm({ ...form, href: e.target.value })}
              placeholder="Ex: /dashboard"
            />
          </div>

          <div className="space-y-2">
            <Label>Ícone</Label>
            <IconSelector
              value={form.icon}
              onChange={(icon) => setForm({ ...form, icon })}
            />
          </div>

          {/* Checkbox para criar permissão automaticamente */}
          {!editingItem && form.href && (
            <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg border">
              <Checkbox
                id="createPermission"
                checked={createPermission}
                onCheckedChange={(checked) => setCreatePermission(checked === true)}
              />
              <div className="flex-1">
                <Label htmlFor="createPermission" className="text-sm font-medium cursor-pointer">
                  Criar permissão automaticamente
                </Label>
                <p className="text-xs text-muted-foreground">
                  Cria a permissão "{routeToPermissionKey(form.href)}" para controlar acesso a este menu
                </p>
              </div>
              <Plus className="h-4 w-4 text-primary" />
            </div>
          )}

          {/* Seletor de permissão existente */}
          {(!createPermission || editingItem || !form.href) && (
            <div className="space-y-2">
              <Label htmlFor="permission">Permissão necessária</Label>
              <Select
                value={form.permission || ''}
                onValueChange={(value) => setForm({ ...form, permission: value === 'none' ? null : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma permissão" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {availablePermissions.map((perm) => (
                    <SelectItem key={perm.value || 'none'} value={perm.value || 'none'}>
                      {perm.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {suggestedPermission && !form.permission && (
                <p className="text-xs text-muted-foreground">
                  Sugestão: existe a permissão "{suggestedPermission}" que parece corresponder a esta rota
                </p>
              )}
            </div>
          )}

          {!isSubmenu && (
            <div className="space-y-2">
              <Label htmlFor="badge">Badge / Contador</Label>
              <Select
                value={form.show_badge || ''}
                onValueChange={(value) => setForm({ ...form, show_badge: value || null })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um badge" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_BADGES.map((badge) => (
                    <SelectItem key={badge.value || 'none'} value={badge.value || 'none'}>
                      {badge.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label htmlFor="is_active">Ativo</Label>
            <Switch
              id="is_active"
              checked={form.is_active}
              onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || !form.title}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingItem ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
