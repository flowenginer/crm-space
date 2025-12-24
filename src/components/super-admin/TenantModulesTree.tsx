import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ChevronDown, ChevronRight, RefreshCw, AlertCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useBaseMenuHierarchy, useSyncTenantMenu } from '@/hooks/useBaseMenuConfig';
import { MenuItem } from '@/hooks/useMenuConfig';
import * as LucideIcons from 'lucide-react';
import { normalizeModuleKey } from '@/lib/moduleKeys';

interface TenantModulesTreeProps {
  modules: string[];
  onChange: (modules: string[]) => void;
  tenantId?: string; // ID do tenant sendo editado
}

// Obter module_key diretamente do item (já populado no banco)
function getModuleKey(item: MenuItem): string | null {
  // Usar module_key do banco diretamente
  if (item.module_key) {
    return item.module_key;
  }
  // Fallback para items antigos sem module_key
  if (!item.href) {
    return null;
  }
  // Gerar module_key a partir do href (mesma lógica do banco)
  if (item.href === '/') return 'dashboard';
  return item.href
    .substring(1)
    .replace(/\//g, '_')
    .replace(/-/g, '_')
    .replace(/\?tab=/g, '_')
    .replace(/\?/g, '_');
}

// Obter todos os module keys VÁLIDOS de um item e seus filhos
function getAllChildModules(item: MenuItem): string[] {
  const keysSet = new Set<string>();
  
  const key = getModuleKey(item);
  if (key) {
    keysSet.add(key);
  }
  
  if (item.children) {
    item.children.forEach(child => {
      getAllChildModules(child).forEach(k => keysSet.add(k));
    });
  }
  
  return Array.from(keysSet);
}

// Componente de item de menu recursivo
function MenuItemRow({
  item,
  level = 0,
  enabledModules,
  onToggleBatch,
  expandedItems,
  onToggleExpand,
}: {
  item: MenuItem;
  level?: number;
  enabledModules: Set<string>;
  onToggleBatch: (keys: string[], value: boolean) => void;
  expandedItems: Set<string>;
  onToggleExpand: (id: string) => void;
}) {
  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = expandedItems.has(item.id);
  const moduleKey = getModuleKey(item);
  
  const allChildKeys = useMemo(() => getAllChildModules(item), [item]);
  
  const isEnabled = useMemo(() => {
    if (moduleKey) {
      return enabledModules.has(moduleKey);
    }
    if (hasChildren && allChildKeys.length > 0) {
      return allChildKeys.every(k => enabledModules.has(k));
    }
    return false;
  }, [moduleKey, hasChildren, allChildKeys, enabledModules]);
  
  const isClickable = !!item.href || hasChildren;
  
  const childModuleKeys = useMemo(() => {
    if (!hasChildren) return [];
    return [...new Set(
      item.children!
        .map(child => getModuleKey(child))
        .filter((k): k is string => k !== null)
    )];
  }, [item.children, hasChildren]);
  
  const enabledChildCount = childModuleKeys.filter(k => enabledModules.has(k)).length;
  const totalChildren = childModuleKeys.length;
  
  const IconComponent = (LucideIcons as any)[item.icon] || LucideIcons.Circle;
  
  const handleSwitchChange = useCallback((checked: boolean) => {
    const keysToChange: string[] = [];
    
    if (moduleKey) {
      keysToChange.push(moduleKey);
    }
    
    if (hasChildren) {
      allChildKeys.forEach(k => {
        if (!keysToChange.includes(k)) {
          keysToChange.push(k);
        }
      });
    }
    
    if (keysToChange.length > 0) {
      onToggleBatch(keysToChange, checked);
    }
  }, [moduleKey, hasChildren, allChildKeys, onToggleBatch]);
  
  const handleMarkAllClick = useCallback(() => {
    const childKeys = getAllChildModules(item);
    const allEnabled = childKeys.every(k => enabledModules.has(k));
    onToggleBatch(childKeys, !allEnabled);
  }, [item, enabledModules, onToggleBatch]);
  
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
            className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-primary/10"
          >
            <IconComponent size={14} className="text-primary" />
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
                onClick={handleMarkAllClick}
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
              onCheckedChange={handleSwitchChange}
              className="data-[state=checked]:bg-primary"
            />
          </div>
        )}
      </div>
      
      {hasChildren && isExpanded && (
        <div className="border-l-2 border-border/50 ml-6">
          {item.children!.map(child => (
            <MenuItemRow
              key={child.id}
              item={child}
              level={level + 1}
              enabledModules={enabledModules}
              onToggleBatch={onToggleBatch}
              expandedItems={expandedItems}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TenantModulesTree({ modules, onChange, tenantId }: TenantModulesTreeProps) {
  // Usa o menu BASE (tenant padrão) como catálogo de módulos
  const { data: menuHierarchy = [], isLoading } = useBaseMenuHierarchy();
  const syncMenu = useSyncTenantMenu();
  
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const hasInitializedExpand = useRef(false);
  
  const enabledModules = useMemo(() => {
    return new Set(modules.map(m => normalizeModuleKey(m)));
  }, [modules]);

  useEffect(() => {
    if (menuHierarchy.length > 0 && !hasInitializedExpand.current) {
      hasInitializedExpand.current = true;
      const parentIds = new Set<string>();
      menuHierarchy.forEach(item => {
        if (item.children && item.children.length > 0) {
          parentIds.add(item.id);
        }
      });
      setExpandedItems(parentIds);
    }
  }, [menuHierarchy]);

  const handleToggleBatch = useCallback((keys: string[], value: boolean) => {
    const normalizedKeys = keys.map(k => normalizeModuleKey(k));
    
    if (value) {
      const currentSet = new Set(modules.map(m => normalizeModuleKey(m)));
      normalizedKeys.forEach(k => currentSet.add(k));
      onChange(Array.from(currentSet));
    } else {
      const keysToRemove = new Set(normalizedKeys);
      const newModules = modules
        .map(m => normalizeModuleKey(m))
        .filter(m => !keysToRemove.has(m));
      onChange(newModules);
    }
  }, [modules, onChange]);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleToggleAll = useCallback((enable: boolean) => {
    const allKeysSet = new Set<string>();
    menuHierarchy.forEach(item => {
      getAllChildModules(item).forEach(key => {
        allKeysSet.add(key);
      });
    });
    onChange(enable ? Array.from(allKeysSet) : []);
  }, [menuHierarchy, onChange]);

  const handleSyncMenu = useCallback(() => {
    if (tenantId) {
      syncMenu.mutate(tenantId);
    }
  }, [tenantId, syncMenu]);

  const { enabledCount, totalCount, allEnabled } = useMemo(() => {
    const allKeysSet = new Set<string>();
    menuHierarchy.forEach(item => {
      getAllChildModules(item).forEach(key => {
        allKeysSet.add(key);
      });
    });
    
    const uniqueKeys = Array.from(allKeysSet);
    const enabled = uniqueKeys.filter(k => enabledModules.has(k)).length;
    const total = uniqueKeys.length;
    
    return {
      enabledCount: enabled,
      totalCount: total,
      allEnabled: enabled === total && total > 0
    };
  }, [menuHierarchy, enabledModules]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const activeItems = menuHierarchy.filter(item => item.is_active);

  return (
    <div className="space-y-3">
      {/* Alerta sobre sincronização de menu */}
      {tenantId && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm">
          <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-amber-700 dark:text-amber-400">
              Para que os módulos apareçam no menu do tenant, clique em <strong>Sincronizar Menu</strong> abaixo.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSyncMenu}
            disabled={syncMenu.isPending}
            className="shrink-0"
          >
            <RefreshCw size={14} className={syncMenu.isPending ? 'animate-spin' : ''} />
            Sincronizar Menu
          </Button>
        </div>
      )}
      
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
            enabledModules={enabledModules}
            onToggleBatch={handleToggleBatch}
            expandedItems={expandedItems}
            onToggleExpand={handleToggleExpand}
          />
        ))}
      </div>
    </div>
  );
}
