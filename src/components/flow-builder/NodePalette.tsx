import { useState } from 'react';
import { LucideIcon } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useNodeTemplates, FlowNodeTemplate } from '@/hooks/useChatbotFlows';
import { cn } from '@/lib/utils';

const iconMap: Record<string, LucideIcon> = {
  MessageSquare: LucideIcons.MessageSquare,
  UserPlus: LucideIcons.UserPlus,
  Tag: LucideIcons.Tag,
  Clock: LucideIcons.Clock,
  Send: LucideIcons.Send,
  Image: LucideIcons.Image,
  Mic: LucideIcons.Mic,
  Video: LucideIcons.Video,
  File: LucideIcons.File,
  LayoutGrid: LucideIcons.LayoutGrid,
  List: LucideIcons.List,
  UserCheck: LucideIcons.UserCheck,
  Building: LucideIcons.Building,
  TrendingUp: LucideIcons.TrendingUp,
  DollarSign: LucideIcons.DollarSign,
  Globe: LucideIcons.Globe,
  GitBranch: LucideIcons.GitBranch,
  Search: LucideIcons.Search,
  Timer: LucideIcons.Timer,
  Calendar: LucideIcons.Calendar,
  CircleStop: LucideIcons.CircleStop,
  ExternalLink: LucideIcons.ExternalLink,
  MessageCircle: LucideIcons.MessageCircle,
  X: LucideIcons.X,
  StickyNote: LucideIcons.StickyNote,
  XCircle: LucideIcons.XCircle,
  Variable: LucideIcons.Variable,
  ChevronDown: LucideIcons.ChevronDown,
  ChevronRight: LucideIcons.ChevronRight,
};

const categoryLabels: Record<string, string> = {
  trigger: '⚡ Gatilhos',
  action: '▶️ Ações',
  condition: '🔀 Condições',
  delay: '⏱️ Delays',
  end: '🛑 Finalizar',
};

const categoryColors: Record<string, string> = {
  trigger: 'hsl(142, 71%, 45%)',
  action: 'hsl(262, 83%, 58%)',
  condition: 'hsl(38, 92%, 50%)',
  delay: 'hsl(330, 81%, 60%)',
  end: 'hsl(0, 84%, 60%)',
};

export function NodePalette() {
  const { data: templates } = useNodeTemplates();
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['trigger', 'action']);
  
  // Agrupar por categoria
  const grouped = templates?.reduce((acc, template) => {
    const cat = template.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(template);
    return acc;
  }, {} as Record<string, FlowNodeTemplate[]>) || {};
  
  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => 
      prev.includes(cat) 
        ? prev.filter(c => c !== cat)
        : [...prev, cat]
    );
  };
  
  const onDragStart = (event: React.DragEvent, template: FlowNodeTemplate) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({
      nodeType: template.node_type,
      nodeSubtype: template.node_subtype,
      name: template.name,
      icon: template.icon,
      color: template.color,
      config: template.default_config,
    }));
    event.dataTransfer.effectAllowed = 'move';
  };
  
  return (
    <div className="w-64 bg-card border-r border-border overflow-y-auto">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-foreground">Blocos</h3>
        <p className="text-xs text-muted-foreground mt-1">Arraste para o canvas</p>
      </div>
      
      <div className="p-2">
        {Object.entries(categoryLabels).map(([category, label]) => (
          <div key={category} className="mb-2">
            {/* Header da categoria */}
            <button
              onClick={() => toggleCategory(category)}
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <span 
                className="text-sm font-medium"
                style={{ color: categoryColors[category] }}
              >
                {label}
              </span>
              {expandedCategories.includes(category) ? (
                <LucideIcons.ChevronDown size={16} className="text-muted-foreground" />
              ) : (
                <LucideIcons.ChevronRight size={16} className="text-muted-foreground" />
              )}
              <span 
                className="text-sm font-medium"
                style={{ color: categoryColors[category] }}
              >
                {label}
              </span>
            </button>
            
            {/* Lista de nós */}
            {expandedCategories.includes(category) && (
              <div className="space-y-1 mt-1">
                {grouped[category]?.map((template) => {
                  const Icon = iconMap[template.icon || ''] || LucideIcons.MessageSquare;
                  
                  return (
                    <div
                      key={template.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, template)}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-lg bg-muted/50",
                        "hover:bg-muted cursor-grab active:cursor-grabbing",
                        "transition-colors border border-transparent hover:border-border"
                      )}
                    >
                      <div 
                        className="w-7 h-7 rounded flex items-center justify-center"
                        style={{ backgroundColor: `${template.color}30` }}
                      >
                        <Icon size={14} style={{ color: template.color || undefined }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">{template.name}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
