import { useState, useMemo, useCallback } from 'react';
import { 
  MessageSquare, 
  Mic, 
  Image, 
  FileText, 
  GitBranch, 
  Zap, 
  Search, 
  Star,
  Clock,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useTemplates, useIncrementTemplateUsage, type MessageTemplate } from '@/hooks/useTemplates';
import { useChatbotFlows } from '@/hooks/useChatbotFlows';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link } from 'react-router-dom';

type TemplateCategory = 'messages' | 'audios' | 'media' | 'documents' | 'flows' | 'triggers';

interface CategoryConfig {
  id: TemplateCategory;
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

const CATEGORIES: CategoryConfig[] = [
  { id: 'messages', label: 'Mensagens', icon: MessageSquare, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  { id: 'audios', label: 'Áudios', icon: Mic, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  { id: 'media', label: 'Mídias', icon: Image, color: 'text-pink-500', bgColor: 'bg-pink-500/10' },
  { id: 'documents', label: 'Docs', icon: FileText, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  { id: 'flows', label: 'Funis', icon: GitBranch, color: 'text-green-500', bgColor: 'bg-green-500/10' },
  { id: 'triggers', label: 'Gatilhos', icon: Zap, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
];

interface QuickTemplatesPopoverProps {
  contactName?: string;
  contactPhone?: string;
  onSelectTemplate: (content: string, type: 'text' | 'audio' | 'image' | 'document') => void;
  onStartFlow?: (flowId: string) => void;
  onTriggerAutomation?: (triggerId: string) => void;
}

export function QuickTemplatesPopover({
  contactName,
  contactPhone,
  onSelectTemplate,
  onStartFlow,
  onTriggerAutomation,
}: QuickTemplatesPopoverProps) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<TemplateCategory>('messages');
  const [searchQuery, setSearchQuery] = useState('');
  const isMobile = useIsMobile();

  // Fetch templates
  const { data: templates = [], isLoading: templatesLoading } = useTemplates();
  const { data: flows = [], isLoading: flowsLoading } = useChatbotFlows();
  const incrementUsage = useIncrementTemplateUsage();

  // Filter templates by category
  const filteredTemplates = useMemo(() => {
    let filtered = templates;

    // Map category to template categories
    switch (activeCategory) {
      case 'messages':
        filtered = templates.filter(t => !t.category || t.category === 'messages' || t.category === 'text');
        break;
      case 'audios':
        filtered = templates.filter(t => t.category === 'audio' || t.category === 'audios');
        break;
      case 'media':
        filtered = templates.filter(t => t.category === 'media' || t.category === 'image' || t.category === 'video');
        break;
      case 'documents':
        filtered = templates.filter(t => t.category === 'document' || t.category === 'documents' || t.category === 'file');
        break;
      default:
        filtered = [];
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.title.toLowerCase().includes(query) || 
        t.content.toLowerCase().includes(query)
      );
    }

    // Sort: favorites first, then by usage count
    return filtered.sort((a, b) => {
      if (a.is_favorite && !b.is_favorite) return -1;
      if (!a.is_favorite && b.is_favorite) return 1;
      return (b.usage_count || 0) - (a.usage_count || 0);
    });
  }, [templates, activeCategory, searchQuery]);

  // Filter flows
  const filteredFlows = useMemo(() => {
    if (activeCategory !== 'flows') return [];
    if (!searchQuery.trim()) return flows;
    const query = searchQuery.toLowerCase();
    return flows.filter(f => f.name.toLowerCase().includes(query));
  }, [flows, activeCategory, searchQuery]);

  // Replace variables in content
  const replaceVariables = useCallback((content: string) => {
    return content
      .replace(/\{\{nome\}\}/gi, contactName || '')
      .replace(/\{\{primeiro_nome\}\}/gi, contactName?.split(' ')[0] || '')
      .replace(/\{\{telefone\}\}/gi, contactPhone || '')
      .replace(/\{\{data\}\}/gi, new Date().toLocaleDateString('pt-BR'))
      .replace(/\{\{hora\}\}/gi, new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
  }, [contactName, contactPhone]);

  const handleSelectTemplate = useCallback((template: MessageTemplate) => {
    const processedContent = replaceVariables(template.content);
    
    // Determine type based on category
    let type: 'text' | 'audio' | 'image' | 'document' = 'text';
    if (template.category === 'audio' || template.category === 'audios') type = 'audio';
    else if (template.category === 'media' || template.category === 'image') type = 'image';
    else if (template.category === 'document' || template.category === 'documents') type = 'document';

    onSelectTemplate(processedContent, type);
    incrementUsage.mutate(template.id);
    setOpen(false);
    setSearchQuery('');
  }, [replaceVariables, onSelectTemplate, incrementUsage]);

  const handleSelectFlow = useCallback((flowId: string) => {
    onStartFlow?.(flowId);
    setOpen(false);
    setSearchQuery('');
  }, [onStartFlow]);

  const handleTrigger = useCallback((triggerId: string) => {
    onTriggerAutomation?.(triggerId);
    setOpen(false);
    setSearchQuery('');
  }, [onTriggerAutomation]);

  const handleCategoryChange = useCallback((categoryId: TemplateCategory) => {
    setActiveCategory(categoryId);
    setSearchQuery('');
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const currentCategory = CATEGORIES.find(c => c.id === activeCategory);

  const renderContent = () => (
    <div className="flex flex-col h-full">
      {/* Category Tabs - All visible, no overflow */}
      <div className="flex gap-1 p-2 border-b border-border">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.id)}
              className={cn(
                'flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all flex-1 justify-center',
                isActive
                  ? `${cat.bgColor} ${cat.color}`
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <Icon size={14} />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Buscar atalho..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="h-8 pl-8 text-sm bg-muted/50"
            autoComplete="off"
          />
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 max-h-[300px]">
        <div className="p-2 space-y-1">
          {activeCategory === 'flows' ? (
            // Flows list
            flowsLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
            ) : filteredFlows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <GitBranch className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>{searchQuery ? 'Nenhum funil encontrado' : 'Nenhum funil cadastrado'}</p>
                {!searchQuery && (
                  <Link 
                    to="/automations" 
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                    onClick={() => setOpen(false)}
                  >
                    Criar funil <ExternalLink size={10} />
                  </Link>
                )}
              </div>
            ) : (
              filteredFlows.map((flow) => (
                <button
                  key={flow.id}
                  onClick={() => handleSelectFlow(flow.id)}
                  className="w-full flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted transition-colors text-left group"
                >
                  <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <GitBranch size={16} className="text-green-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">
                      {flow.name}
                    </p>
                    {flow.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {flow.description}
                      </p>
                    )}
                  </div>
                </button>
              ))
            )
          ) : activeCategory === 'triggers' ? (
            // Triggers (placeholder)
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Gatilhos manuais</p>
              <p className="text-xs mt-1">Em breve</p>
            </div>
          ) : (
            // Templates list
            templatesLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {currentCategory && (
                  <>
                    <currentCategory.icon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  </>
                )}
                <p>
                  {searchQuery 
                    ? 'Nenhum atalho encontrado' 
                    : `Nenhum atalho de ${currentCategory?.label.toLowerCase() || ''} cadastrado`
                  }
                </p>
                {!searchQuery && (
                  <Link 
                    to="/quick-messages" 
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                    onClick={() => setOpen(false)}
                  >
                    Criar atalho <ExternalLink size={10} />
                  </Link>
                )}
              </div>
            ) : (
              filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className="w-full flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted transition-colors text-left group"
                >
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                    currentCategory?.bgColor || 'bg-muted'
                  )}>
                    {template.is_favorite ? (
                      <Star size={16} className="text-amber-500 fill-amber-500" />
                    ) : (
                      currentCategory && <currentCategory.icon size={16} className={currentCategory.color} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm text-foreground truncate">
                        {template.title}
                      </p>
                      {(template.usage_count || 0) > 0 && (
                        <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                          <Clock size={10} />
                          {template.usage_count}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {template.content}
                    </p>
                  </div>
                </button>
              ))
            )
          )}
        </div>
      </ScrollArea>
    </div>
  );

  // Mobile: Use Sheet (drawer from bottom)
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button 
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            title="Atalhos rápidos"
          >
            <Sparkles size={22} className="text-muted-foreground" />
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[70vh] p-0">
          <SheetHeader className="px-4 py-3 border-b border-border">
            <SheetTitle className="text-left flex items-center gap-2">
              <Sparkles size={18} className="text-primary" />
              Atalhos Rápidos
            </SheetTitle>
          </SheetHeader>
          {renderContent()}
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Use Popover
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button 
          className="p-2 hover:bg-muted rounded-lg transition-colors"
          title="Atalhos rápidos"
        >
          <Sparkles size={22} className="text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent 
        side="top" 
        align="start" 
        className="w-[580px] p-0 max-h-[450px] overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
          <Sparkles size={16} className="text-primary" />
          <span className="font-medium text-sm">Atalhos Rápidos</span>
        </div>
        {renderContent()}
      </PopoverContent>
    </Popover>
  );
}
