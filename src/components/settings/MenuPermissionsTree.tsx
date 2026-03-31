import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, MessageSquare } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useMenuHierarchy, MenuItem } from '@/hooks/useMenuConfig';
import * as LucideIcons from 'lucide-react';

interface MenuPermissionsTreeProps {
  permissions: Record<string, boolean>;
  onChange: (permissions: Record<string, boolean>) => void;
  color?: string;
}

// Mapeamento de href para permission_key
function getPermissionKey(item: MenuItem): string {
  // Use the permission field if available
  if (item.permission) {
    return item.permission;
  }
  
  // Fallback: generate from href
  if (item.href) {
    // Remove leading slash and convert to permission key
    const path = item.href.replace(/^\//, '').replace(/\//g, '_');
    return `menu_${path}`;
  }
  
  // Use id as last resort
  return `menu_${item.id}`;
}

// Obter todos os permission keys de um item e seus filhos
function getAllChildPermissions(item: MenuItem): string[] {
  const keys: string[] = [];
  if (item.href || item.permission) {
    keys.push(getPermissionKey(item));
  }
  if (item.children) {
    item.children.forEach(child => {
      keys.push(...getAllChildPermissions(child));
    });
  }
  return keys;
}

// Definição das permissões de Meta Templates
const META_TEMPLATE_PERMISSIONS = [
  { key: 'meta_templates.view', label: 'Ver' },
  { key: 'meta_templates.send', label: 'Enviar' },
  { key: 'meta_templates.create', label: 'Criar' },
  { key: 'meta_templates.update', label: 'Editar' },
  { key: 'meta_templates.delete', label: 'Excluir' },
];

// Componente de item de menu recursivo
function MenuItemRow({
  item,
  level = 0,
  permissions,
  onToggle,
  expandedItems,
  onToggleExpand,
  color,
}: {
  item: MenuItem;
  level?: number;
  permissions: Record<string, boolean>;
  onToggle: (key: string, value: boolean, batchChanges?: Record<string, boolean>) => void;
  expandedItems: Set<string>;
  onToggleExpand: (id: string) => void;
  color?: string;
}) {
  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = expandedItems.has(item.id);
  const permKey = getPermissionKey(item);
  const isEnabled = permissions[permKey] === true;
  
  // Verificar se item é visível (tem href ou filhos)
  const isClickable = !!item.href || hasChildren;
  
  // Contar filhos habilitados
  const enabledChildCount = hasChildren
    ? item.children!.filter(child => permissions[getPermissionKey(child)] === true).length
    : 0;
  const totalChildren = hasChildren ? item.children!.length : 0;
  
  // Buscar ícone do Lucide
  const IconComponent = (LucideIcons as any)[item.icon] || LucideIcons.Circle;
  
  return (
    <div className="w-full">
      <div
        className={`flex items-center justify-between py-2 px-3 rounded-lg transition-colors ${
          level === 0 ? 'bg-muted/30' : 'hover:bg-muted/20'
        }`}
        style={{ paddingLeft: `${12 + level * 24}px` }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => onToggleExpand(item.id)}
              className="p-0.5 hover:bg-muted rounded transition-colors"
            >
              {isExpanded ? (
                <ChevronDown size={16} className="text-muted-foreground" />
              ) : (
                <ChevronRight size={16} className="text-muted-foreground" />
              )}
            </button>
          ) : (
            <span className="w-5" />
          )}
          
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
            style={{ backgroundColor: color ? `${color}15` : 'hsl(var(--muted))' }}
          >
            <IconComponent size={14} style={{ color: color || 'hsl(var(--muted-foreground))' }} />
          </div>
          
          <span className={`text-sm truncate ${level === 0 ? 'font-medium' : ''}`}>
            {item.title}
          </span>
          
          {hasChildren && (
            <span className="text-xs text-muted-foreground ml-1">
              ({enabledChildCount}/{totalChildren})
            </span>
          )}
        </div>
        
        {isClickable && (
          <div className="flex items-center gap-2 shrink-0">
            {hasChildren && (
              <button
                type="button"
                onClick={() => {
                  const childKeys = getAllChildPermissions(item);
                  const allEnabled = childKeys.every(k => permissions[k] === true);
                  // Criar objeto com todas as mudanças de uma vez
                  const changes: Record<string, boolean> = {};
                  childKeys.forEach(k => {
                    changes[k] = !allEnabled;
                  });
                  onToggle(permKey, !allEnabled, changes);
                }}
                className={`text-xs px-2 py-0.5 rounded transition-colors ${
                  enabledChildCount === totalChildren
                    ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                    : 'bg-primary/10 text-primary hover:bg-primary/20'
                }`}
              >
                {enabledChildCount === totalChildren ? 'Desmarcar' : 'Marcar Todos'}
              </button>
            )}
            <Switch
              checked={isEnabled}
              onCheckedChange={(checked) => {
                // Criar objeto com todas as mudanças de uma vez (batch update)
                const changes: Record<string, boolean> = {
                  [permKey]: checked
                };
                
                // Se tem filhos, incluir todos no mesmo batch
                if (hasChildren && item.children) {
                  getAllChildPermissions(item).forEach(key => {
                    changes[key] = checked;
                  });
                }
                
                onToggle(permKey, checked, changes);
              }}
              className="data-[state=checked]:bg-primary"
            />
          </div>
        )}
      </div>
      
      {/* Renderizar filhos se expandido */}
      {hasChildren && isExpanded && (
        <div className="border-l-2 border-border/50 ml-6">
          {item.children!.map(child => (
            <MenuItemRow
              key={child.id}
              item={child}
              level={level + 1}
              permissions={permissions}
              onToggle={onToggle}
              expandedItems={expandedItems}
              onToggleExpand={onToggleExpand}
              color={color}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function MenuPermissionsTree({ permissions, onChange, color }: MenuPermissionsTreeProps) {
  const { data: menuHierarchy = [], isLoading } = useMenuHierarchy();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [metaExpanded, setMetaExpanded] = useState(true);

  // Expandir itens pai por padrão
  useEffect(() => {
    if (menuHierarchy.length > 0) {
      const parentIds = new Set<string>();
      menuHierarchy.forEach(item => {
        if (item.children && item.children.length > 0) {
          parentIds.add(item.id);
        }
      });
      setExpandedItems(parentIds);
    }
  }, [menuHierarchy]);

  // Handler que suporta batch updates para evitar sobrescrita de estado
  const handleToggle = (key: string, value: boolean, batchChanges?: Record<string, boolean>) => {
    if (batchChanges && Object.keys(batchChanges).length > 0) {
      // Batch update: aplicar todas as mudanças de uma vez
      onChange({
        ...permissions,
        ...batchChanges,
      });
    } else {
      // Update individual
      onChange({
        ...permissions,
        [key]: value,
      });
    }
  };

  const handleToggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleAll = (enable: boolean) => {
    const allKeys: Record<string, boolean> = {};
    menuHierarchy.forEach(item => {
      getAllChildPermissions(item).forEach(key => {
        allKeys[key] = enable;
      });
    });
    // Incluir meta_templates nas ações globais
    META_TEMPLATE_PERMISSIONS.forEach(perm => {
      allKeys[perm.key] = enable;
    });
    onChange(allKeys);
  };

  // Contar total de permissões (incluindo meta_templates)
  const allPermKeys = menuHierarchy.flatMap(item => getAllChildPermissions(item));
  const allMetaKeys = META_TEMPLATE_PERMISSIONS.map(p => p.key);
  const allKeys = [...allPermKeys, ...allMetaKeys];
  const enabledCount = allKeys.filter(k => permissions[k] === true).length;
  const totalCount = allKeys.length;
  const allEnabled = enabledCount === totalCount && totalCount > 0;

  // Contar meta templates habilitados
  const metaEnabledCount = allMetaKeys.filter(k => permissions[k] === true).length;
  const metaTotalCount = allMetaKeys.length;
  const allMetaEnabled = metaEnabledCount === metaTotalCount;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Filtrar apenas itens ativos
  const activeItems = menuHierarchy.filter(item => item.is_active);

  return (
    <div className="space-y-3">
      {/* Header com ações globais */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{enabledCount}</span> de {totalCount} módulos habilitados
        </div>
        <button
          type="button"
          onClick={() => handleToggleAll(!allEnabled)}
          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
            allEnabled
              ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
              : 'bg-primary/10 text-primary hover:bg-primary/20'
          }`}
        >
          {allEnabled ? 'Desmarcar Todos' : 'Marcar Todos'}
        </button>
      </div>
      
      {/* Árvore de menus */}
      <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
        {activeItems.map(item => (
          <MenuItemRow
            key={item.id}
            item={item}
            permissions={permissions}
            onToggle={handleToggle}
            expandedItems={expandedItems}
            onToggleExpand={handleToggleExpand}
            color={color}
          />
        ))}

        {/* Seção: Templates Meta */}
        <div className="w-full mt-2">
          <div
            className="flex items-center justify-between py-2 px-3 rounded-lg transition-colors bg-muted/30"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <button
                type="button"
                onClick={() => setMetaExpanded(!metaExpanded)}
                className="p-0.5 hover:bg-muted rounded transition-colors"
              >
                {metaExpanded ? (
                  <ChevronDown size={16} className="text-muted-foreground" />
                ) : (
                  <ChevronRight size={16} className="text-muted-foreground" />
                )}
              </button>
              
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                style={{ backgroundColor: color ? `${color}15` : 'hsl(var(--muted))' }}
              >
                <MessageSquare size={14} style={{ color: color || 'hsl(var(--muted-foreground))' }} />
              </div>
              
              <span className="text-sm font-medium truncate">
                Templates Meta
              </span>
              
              <span className="text-xs text-muted-foreground ml-1">
                ({metaEnabledCount}/{metaTotalCount})
              </span>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const changes: Record<string, boolean> = {};
                  META_TEMPLATE_PERMISSIONS.forEach(perm => {
                    changes[perm.key] = !allMetaEnabled;
                  });
                  onChange({ ...permissions, ...changes });
                }}
                className={`text-xs px-2 py-0.5 rounded transition-colors ${
                  allMetaEnabled
                    ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                    : 'bg-primary/10 text-primary hover:bg-primary/20'
                }`}
              >
                {allMetaEnabled ? 'Desmarcar' : 'Marcar Todos'}
              </button>
            </div>
          </div>
          
          {/* Filhos: permissões individuais */}
          {metaExpanded && (
            <div className="border-l-2 border-border/50 ml-6">
              {META_TEMPLATE_PERMISSIONS.map(perm => (
                <div
                  key={perm.key}
                  className="flex items-center justify-between py-2 px-3 rounded-lg transition-colors hover:bg-muted/20"
                  style={{ paddingLeft: `${12 + 24}px` }}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="w-5" />
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                      style={{ backgroundColor: color ? `${color}15` : 'hsl(var(--muted))' }}
                    >
                      <MessageSquare size={14} style={{ color: color || 'hsl(var(--muted-foreground))' }} />
                    </div>
                    <span className="text-sm truncate">{perm.label}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={permissions[perm.key] === true}
                      onCheckedChange={(checked) => {
                        onChange({
                          ...permissions,
                          [perm.key]: checked,
                        });
                      }}
                      className="data-[state=checked]:bg-primary"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
