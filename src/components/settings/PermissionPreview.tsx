import { useMemo } from 'react';
import { 
  Check, 
  X, 
  LayoutDashboard, 
  MessageSquare, 
  Users, 
  Briefcase, 
  FileText, 
  Settings, 
  Radio,
  Tag,
  Smartphone,
  Calendar,
  BarChart3,
  Bot,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Shield
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';

interface PermissionPreviewProps {
  roleKey: string;
  permissions: Record<string, Record<string, boolean>> | null;
  customPermissions?: Record<string, Record<string, boolean>> | null;
}

interface PageAccess {
  key: string;
  name: string;
  icon: LucideIcon;
  hasAccess: boolean;
  requiredPermission: { category: string; action: string } | null;
}

interface SettingsTabAccess {
  key: string;
  name: string;
  hasAccess: boolean;
  requiredPermission: { category: string; action: string } | null;
}

// Define which permissions are needed for each page
const PAGE_PERMISSIONS: { key: string; name: string; icon: LucideIcon; permission: { category: string; action: string } | null }[] = [
  { key: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, permission: { category: 'dashboard', action: 'view' } },
  { key: 'conversations', name: 'Conversas', icon: MessageSquare, permission: { category: 'conversations', action: 'read' } },
  { key: 'contacts', name: 'Contatos', icon: Users, permission: { category: 'contacts', action: 'read' } },
  { key: 'crm', name: 'CRM / Negócios', icon: Briefcase, permission: { category: 'deals', action: 'read' } },
  { key: 'templates', name: 'Mensagens Rápidas', icon: FileText, permission: { category: 'templates', action: 'read' } },
  { key: 'schedules', name: 'Agendamentos', icon: Calendar, permission: { category: 'schedules', action: 'view' } },
  { key: 'automations', name: 'Automações', icon: Bot, permission: { category: 'automations', action: 'view' } },
  { key: 'live', name: 'Monitor ao Vivo', icon: Radio, permission: { category: 'live', action: 'view' } },
  { key: 'reports', name: 'Relatórios', icon: BarChart3, permission: { category: 'reports', action: 'view' } },
  { key: 'channels', name: 'Canais WhatsApp', icon: Smartphone, permission: { category: 'channels', action: 'read' } },
  { key: 'settings', name: 'Configurações', icon: Settings, permission: { category: 'settings', action: 'view' } },
];

// Settings tabs and their required permissions
const SETTINGS_TABS: { key: string; name: string; permission: { category: string; action: string } | null; adminOnly?: boolean }[] = [
  { key: 'team', name: 'Equipe', permission: { category: 'users', action: 'read' } },
  { key: 'departments', name: 'Departamentos', permission: { category: 'settings', action: 'update' } },
  { key: 'roles', name: 'Perfis de Acesso', permission: { category: 'settings', action: 'update' }, adminOnly: true },
  { key: 'channels', name: 'Canais', permission: { category: 'channels', action: 'read' } },
  { key: 'statuses', name: 'Etapas de Lead', permission: { category: 'settings', action: 'update' } },
  { key: 'close-reasons', name: 'Motivos de Fechamento', permission: { category: 'settings', action: 'update' } },
  { key: 'tags', name: 'Etiquetas', permission: { category: 'tags', action: 'read' } },
  { key: 'custom-fields', name: 'Campos Personalizados', permission: { category: 'settings', action: 'update' } },
  { key: 'integrations', name: 'Integrações', permission: { category: 'settings', action: 'update' }, adminOnly: true },
  { key: 'webhooks', name: 'Webhooks / API', permission: { category: 'settings', action: 'update' }, adminOnly: true },
  { key: 'metrics', name: 'Métricas', permission: { category: 'settings', action: 'update' }, adminOnly: true },
  { key: 'company', name: 'Dados da Empresa', permission: { category: 'settings', action: 'update' }, adminOnly: true },
  { key: 'notifications', name: 'Notificações', permission: null },
  { key: 'security', name: 'Segurança', permission: null },
];

export function PermissionPreview({ roleKey, permissions, customPermissions }: PermissionPreviewProps) {
  const [showDetails, setShowDetails] = useState(false);
  const isAdmin = roleKey === 'admin';

  // Check if user has a specific permission
  const hasPermission = (category: string, action: string): boolean => {
    if (isAdmin) return true;
    
    // Check custom permissions first
    if (customPermissions?.[category]?.[action] !== undefined) {
      return customPermissions[category][action];
    }
    
    // Fallback to role permissions
    return permissions?.[category]?.[action] ?? false;
  };

  // Calculate page access
  const pageAccess = useMemo((): PageAccess[] => {
    return PAGE_PERMISSIONS.map(page => ({
      key: page.key,
      name: page.name,
      icon: page.icon,
      hasAccess: page.permission ? hasPermission(page.permission.category, page.permission.action) : true,
      requiredPermission: page.permission
    }));
  }, [permissions, customPermissions, isAdmin]);

  // Calculate settings tabs access
  const settingsTabsAccess = useMemo((): SettingsTabAccess[] => {
    return SETTINGS_TABS.map(tab => {
      let hasAccess = true;
      
      if (tab.adminOnly && !isAdmin) {
        hasAccess = false;
      } else if (tab.permission) {
        hasAccess = hasPermission(tab.permission.category, tab.permission.action);
      }
      
      return {
        key: tab.key,
        name: tab.name,
        hasAccess,
        requiredPermission: tab.permission
      };
    });
  }, [permissions, customPermissions, isAdmin]);

  const accessiblePages = pageAccess.filter(p => p.hasAccess);
  const blockedPages = pageAccess.filter(p => !p.hasAccess);
  const accessibleSettings = settingsTabsAccess.filter(t => t.hasAccess);
  const blockedSettings = settingsTabsAccess.filter(t => !t.hasAccess);

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setShowDetails(!showDetails)}
        className="w-full flex items-center justify-between p-4 bg-primary/5 hover:bg-primary/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Shield size={16} className="text-primary" />
          <span className="font-medium text-foreground">
            Prévia de Acessos
          </span>
          <span className="text-xs text-muted-foreground">
            ({accessiblePages.length} páginas liberadas)
          </span>
        </div>
        {showDetails ? (
          <ChevronUp size={18} className="text-muted-foreground" />
        ) : (
          <ChevronDown size={18} className="text-muted-foreground" />
        )}
      </button>
      
      {showDetails && (
        <div className="p-4 space-y-6 bg-card">
          {/* Pages Access Summary */}
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <Eye size={14} className="text-success" />
              Páginas com Acesso ({accessiblePages.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {accessiblePages.map(page => {
                const Icon = page.icon;
                return (
                  <div 
                    key={page.key}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-success/10 text-success border border-success/20"
                  >
                    <Icon size={12} />
                    {page.name}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Blocked Pages */}
          {blockedPages.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <EyeOff size={14} className="text-destructive" />
                Páginas Bloqueadas ({blockedPages.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {blockedPages.map(page => {
                  const Icon = page.icon;
                  return (
                    <div 
                      key={page.key}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground border border-border"
                    >
                      <Icon size={12} />
                      {page.name}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Settings Tabs - Only show if user has settings.view */}
          {accessiblePages.some(p => p.key === 'settings') && (
            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <Settings size={14} />
                Abas de Configurações
              </h4>
              
              <div className="grid grid-cols-2 gap-2">
                {settingsTabsAccess.map(tab => (
                  <div 
                    key={tab.key}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${
                      tab.hasAccess 
                        ? 'bg-success/10 text-success' 
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {tab.hasAccess ? (
                      <Check size={12} />
                    ) : (
                      <X size={12} />
                    )}
                    {tab.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Admin notice */}
          {isAdmin && (
            <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg text-sm text-primary">
              <Shield size={16} />
              <span>Administradores têm acesso completo a todas as funcionalidades.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
