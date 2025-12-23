import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useMenuHierarchy, MenuItem } from '@/hooks/useMenuConfig';
import * as LucideIcons from 'lucide-react';
import { normalizeModuleKeyFromHref, normalizeModuleKey } from '@/lib/moduleKeys';

interface TenantModulesTreeProps {
  modules: string[];
  onChange: (modules: string[]) => void;
}

// Mapeamento de href para module_key (chaves normalizadas com underscore)
function getModuleKey(item: MenuItem): string {
  if (!item.href) {
    // Para menus cascata sem href, usar o id normalizado
    return normalizeModuleKey(item.id);
  }
  // Usa a função de normalização padrão
  return normalizeModuleKeyFromHref(item.href) || normalizeModuleKey(item.id);
}

// Obter todos os module keys de um item e seus filhos (deduplicados)
function getAllChildModules(item: MenuItem): string[] {
  const keysSet = new Set<string>();
  
  if (item.href || item.permission) {
    keysSet.add(getModuleKey(item));
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
  onToggle,
  expandedItems,
  onToggleExpand,
}: {
  item: MenuItem;
  level?: number;
  enabledModules: Set<string>;
  onToggle: (key: string, value: boolean, childKeys?: string[]) => void;
  expandedItems: Set<string>;
  onToggleExpand: (id: string) => void;
}) {
  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = expandedItems.has(item.id);
  const moduleKey = getModuleKey(item);
  const isEnabled = enabledModules.has(moduleKey);
  
  const isClickable = !!item.href || hasChildren;
  
  // Contar filhos habilitados (usando chaves únicas)
  const childModuleKeys = useMemo(() => {
    if (!hasChildren) return [];
    return [...new Set(item.children!.map(child => getModuleKey(child)))];
  }, [item.children, hasChildren]);
  
  const enabledChildCount = childModuleKeys.filter(k => enabledModules.has(k)).length;
  const totalChildren = childModuleKeys.length;
  
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
                onClick={() => {
                  const childKeys = getAllChildModules(item);
                  const allEnabled = childKeys.every(k => enabledModules.has(k));
                  childKeys.forEach(k => onToggle(k, !allEnabled));
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
                onToggle(moduleKey, checked);
                
                if (hasChildren && item.children) {
                  const allChildKeys = getAllChildModules(item);
                  allChildKeys.forEach(k => onToggle(k, checked));
                }
              }}
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
              onToggle={onToggle}
              expandedItems={expandedItems}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TenantModulesTree({ modules, onChange }: TenantModulesTreeProps) {
  const { data: menuHierarchy = [], isLoading } = useMenuHierarchy();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  
  // Normalizar os módulos recebidos para o padrão com underscores
  const enabledModules = useMemo(() => {
    return new Set(modules.map(m => normalizeModuleKey(m)));
  }, [modules]);

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

  const handleToggle = (key: string, value: boolean) => {
    const normalizedKey = normalizeModuleKey(key);
    if (value) {
      if (!enabledModules.has(normalizedKey)) {
        // Adiciona apenas se não existir (evita duplicatas)
        const newModules = [...new Set([...modules.map(m => normalizeModuleKey(m)), normalizedKey])];
        onChange(newModules);
      }
    } else {
      onChange(modules.map(m => normalizeModuleKey(m)).filter(m => m !== normalizedKey));
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
    const allKeysSet = new Set<string>();
    menuHierarchy.forEach(item => {
      getAllChildModules(item).forEach(key => {
        allKeysSet.add(key);
      });
    });
    onChange(enable ? Array.from(allKeysSet) : []);
  };

  // Contar total de módulos ÚNICOS
  const { uniqueModuleKeys, enabledCount, totalCount, allEnabled } = useMemo(() => {
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
      uniqueModuleKeys: uniqueKeys,
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
            enabledModules={enabledModules}
            onToggle={handleToggle}
            expandedItems={expandedItems}
            onToggleExpand={handleToggleExpand}
          />
        ))}
      </div>
    </div>
  );
}
