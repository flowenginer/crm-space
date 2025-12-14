import { useState, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { IconSelector } from './IconSelector';
import { MenuItem, MenuItemInput } from '@/hooks/useMenuConfig';
import { Loader2 } from 'lucide-react';

// Permissões disponíveis
const AVAILABLE_PERMISSIONS = [
  { value: '', label: 'Nenhuma (visível para todos)' },
  { value: 'dashboard.view', label: 'Dashboard' },
  { value: 'conversations.view', label: 'Conversas' },
  { value: 'contacts.view', label: 'Contatos' },
  { value: 'deals.view', label: 'CRM / Negócios' },
  { value: 'templates.view', label: 'Templates / Mensagens' },
  { value: 'reports.view', label: 'Relatórios' },
  { value: 'marketing.view', label: 'Marketing' },
  { value: 'marketing.view_campaigns', label: 'Campanhas' },
  { value: 'financial.view', label: 'Financeiro' },
  { value: 'orders.view', label: 'Pedidos' },
  { value: 'settings.view', label: 'Configurações' },
  { value: 'automations.view', label: 'Automações' },
  { value: 'channels.view', label: 'Canais' },
  { value: 'webhooks.view', label: 'Webhooks' },
  { value: 'live.view', label: 'Ao Vivo' },
  { value: 'schedules.view', label: 'Agendamentos' },
  { value: 'conversations.requests', label: 'Requisições' },
];

// Badges disponíveis
const AVAILABLE_BADGES = [
  { value: '', label: 'Nenhum' },
  { value: 'scheduledCount', label: 'Contador de Agendamentos' },
  { value: 'requestsCount', label: 'Contador de Requisições' },
  { value: 'internalChatCount', label: 'Mensagens não lidas (Chat Interno)' },
  { value: 'liveBadge', label: 'Indicador ao Vivo (bolinha verde)' },
];

interface MenuItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: MenuItemInput) => Promise<void>;
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
    }
  }, [editingItem, parentId, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) return;

    await onSave({
      ...form,
      href: form.href || null,
      permission: form.permission || null,
      show_badge: form.show_badge || null,
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
            <Select
              value={form.parent_id || 'none'}
              onValueChange={(value) => setForm({ ...form, parent_id: value === 'none' ? null : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o menu pai" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum (menu principal)</SelectItem>
                {availableParents.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {getItemLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          <div className="space-y-2">
            <Label htmlFor="permission">Permissão necessária</Label>
            <Select
              value={form.permission || ''}
              onValueChange={(value) => setForm({ ...form, permission: value || null })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma permissão" />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_PERMISSIONS.map((perm) => (
                  <SelectItem key={perm.value || 'none'} value={perm.value || 'none'}>
                    {perm.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
