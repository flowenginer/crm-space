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
  ExternalLink,
  Send,
  Edit2,
  Settings,
  Shield
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useTemplates, useIncrementTemplateUsage, type MessageTemplate, type ContentBlock } from '@/hooks/useTemplates';
import { useUserContext } from '@/hooks/useUserContext';
import { useChatbotFlows } from '@/hooks/useChatbotFlows';
import { useUserQuickTemplates, useAddQuickTemplate } from '@/hooks/useQuickTemplates';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Link } from 'react-router-dom';
import { QuickTemplatesConfigModal } from './QuickTemplatesConfigModal';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { useApprovedMetaTemplates, MetaMessageTemplate, getTemplateBody } from '@/hooks/useMetaTemplates';
import { MetaTemplateUseModal } from '@/components/meta-templates';

type TemplateCategory = 'messages' | 'audios' | 'media' | 'documents' | 'flows' | 'triggers' | 'meta';

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
  { id: 'meta', label: 'Meta', icon: Shield, color: 'text-sky-500', bgColor: 'bg-sky-500/10' },
];

interface QuickTemplatesPopoverProps {
  contactName?: string;
  contactPhone?: string;
  onSelectTemplate: (
    content: string, 
    type: 'text' | 'audio' | 'image' | 'document',
    mediaUrl?: string | null,
    mediaType?: string | null,
    mediaName?: string | null,
    contentBlocks?: ContentBlock[] | null,
    audioFirst?: boolean | null
  ) => void;
  onCopyToInput?: (content: string) => void;
  onStartFlow?: (flowId: string) => void;
  onTriggerAutomation?: (triggerId: string) => void;
  onSendMetaTemplate?: (templateId: string, templateName: string, language: string, variables: Record<string, string>, previewContent: string) => void;
}

export function QuickTemplatesPopover({
  contactName,
  contactPhone,
  onSelectTemplate,
  onCopyToInput,
  onStartFlow,
  onTriggerAutomation,
  onSendMetaTemplate,
}: QuickTemplatesPopoverProps) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<TemplateCategory>('messages');
  const [searchQuery, setSearchQuery] = useState('');
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const isMobile = useIsMobile();
  
  // Get user context for role-based filtering
  const { profile } = useUserContext();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'supervisor';
  const canUseMetaTemplates = isAdmin || profile?.role === 'sac';

  // Fetch templates
  const { data: templates = [], isLoading: templatesLoading } = useTemplates();
  const { data: flows = [], isLoading: flowsLoading } = useChatbotFlows();
  const { data: quickTemplates = [] } = useUserQuickTemplates();
  const { data: metaTemplates = [], isLoading: metaTemplatesLoading } = useApprovedMetaTemplates();
  const incrementUsage = useIncrementTemplateUsage();
  
  // Meta template modal state
  const [selectedMetaTemplate, setSelectedMetaTemplate] = useState<MetaMessageTemplate | null>(null);

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

    // Apply search filter - only by title
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.title.toLowerCase().includes(query)
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

  // Filter meta templates
  const filteredMetaTemplates = useMemo(() => {
    if (activeCategory !== 'meta') return [];
    if (!searchQuery.trim()) return metaTemplates;
    const query = searchQuery.toLowerCase();
    return metaTemplates.filter(t => t.name.toLowerCase().includes(query));
  }, [metaTemplates, activeCategory, searchQuery]);

  // Handle meta template selection
  const handleSelectMetaTemplate = useCallback((template: MetaMessageTemplate) => {
    setSelectedMetaTemplate(template);
  }, []);

  const handleMetaTemplateUse = useCallback((content: string) => {
    onCopyToInput?.(content);
    setSelectedMetaTemplate(null);
    setOpen(false);
    setSearchQuery('');
  }, [onCopyToInput]);

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
    
    // Process content_blocks with variable replacement
    const processedBlocks = template.content_blocks?.map(block => ({
      ...block,
      content: block.content ? replaceVariables(block.content) : undefined
    })) || null;
    
    // Determine type based on category or media_url presence
    let type: 'text' | 'audio' | 'image' | 'document' = 'text';
    
    // If template has media_url, determine type from media_type
    if (template.media_url) {
      if (template.media_type?.startsWith('audio')) type = 'audio';
      else if (template.media_type?.startsWith('image') || template.media_type?.startsWith('video')) type = 'image';
      else type = 'document';
    } else {
      // Fallback to category
      if (template.category === 'audio' || template.category === 'audios') type = 'audio';
      else if (template.category === 'media' || template.category === 'image') type = 'image';
      else if (template.category === 'document' || template.category === 'documents') type = 'document';
    }

    onSelectTemplate(processedContent, type, template.media_url, template.media_type, template.media_name, processedBlocks, template.audio_first);
    incrementUsage.mutate(template.id);
    setOpen(false);
    setSearchQuery('');
  }, [replaceVariables, onSelectTemplate, incrementUsage]);

  const handleCopyToInput = useCallback((template: MessageTemplate) => {
    const processedContent = replaceVariables(template.content);
    onCopyToInput?.(processedContent);
    incrementUsage.mutate(template.id);
    setOpen(false);
    setSearchQuery('');
  }, [replaceVariables, onCopyToInput, incrementUsage]);

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

  // Filter categories based on permissions - Meta only for admin/supervisor/sac
  const visibleCategories = useMemo(() => {
    return CATEGORIES.filter(cat => {
      if (cat.id === 'meta') {
        return canUseMetaTemplates;
      }
      return true;
    });
  }, [canUseMetaTemplates]);

  const currentCategory = CATEGORIES.find(c => c.id === activeCategory);

  // Handle quick template click
  const handleQuickTemplateClick = useCallback((qt: typeof quickTemplates[0]) => {
    if (!qt.template) return;
    
    const processedContent = replaceVariables(qt.template.content);
    const processedBlocks = qt.template.content_blocks?.map(block => ({
      ...block,
      content: block.content ? replaceVariables(block.content) : undefined
    })) || null;
    
    let type: 'text' | 'audio' | 'image' | 'document' = 'text';
    if (qt.template.media_url) {
      if (qt.template.media_type?.startsWith('audio')) type = 'audio';
      else if (qt.template.media_type?.startsWith('image') || qt.template.media_type?.startsWith('video')) type = 'image';
      else type = 'document';
    }
    
    onSelectTemplate(processedContent, type, qt.template.media_url, qt.template.media_type, qt.template.media_name, processedBlocks, qt.template.audio_first);
    incrementUsage.mutate(qt.template_id);
    setOpen(false);
  }, [replaceVariables, onSelectTemplate, incrementUsage]);

  const renderContent = () => (
    <div className="flex flex-col h-full">
      {/* Category Tabs - All visible, no overflow */}
      <div className="flex gap-1 p-2 border-b border-border">
        {visibleCategories.map((cat) => {
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

      {/* Quick Favorites Section - Only show in messages category */}
      {activeCategory === 'messages' && (
        <div className="px-2 pt-2 pb-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Star size={12} className="text-amber-500" />
              Meus Favoritos
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                setConfigModalOpen(true);
              }}
              className="p-1 hover:bg-muted rounded transition-colors"
              title="Configurar favoritos"
            >
              <Settings size={12} className="text-muted-foreground" />
            </button>
          </div>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((position) => {
              const qt = quickTemplates.find(q => q.position === position);
              return (
                <Tooltip key={position}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => qt && handleQuickTemplateClick(qt)}
                      disabled={!qt}
                      className={cn(
                        'flex-1 h-9 rounded-md text-[10px] font-medium transition-all truncate px-1.5',
                        qt
                          ? 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20'
                          : 'bg-muted/50 text-muted-foreground/50 border border-dashed border-muted-foreground/20 cursor-default'
                      )}
                    >
                      {qt?.template?.title ? (
                        <span className="truncate block">{qt.template.title.slice(0, 8)}</span>
                      ) : (
                        <span className="opacity-50">—</span>
                      )}
                    </button>
                  </TooltipTrigger>
                  {qt?.template && (
                    <TooltipContent side="bottom" className="max-w-[200px]">
                      <p className="font-medium text-xs">{qt.template.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{qt.template.content}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })}
          </div>
        </div>
      )}

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
      <ScrollArea className="h-[380px]" type="always">
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
          ) : activeCategory === 'meta' ? (
            // Meta Templates list
            metaTemplatesLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
            ) : filteredMetaTemplates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>{searchQuery ? 'Nenhum template encontrado' : 'Nenhum template aprovado'}</p>
                {!searchQuery && (
                  <Link 
                    to="/whatsapp-channels" 
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                    onClick={() => setOpen(false)}
                  >
                    Gerenciar templates <ExternalLink size={10} />
                  </Link>
                )}
              </div>
            ) : (
              filteredMetaTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleSelectMetaTemplate(template)}
                  className="w-full flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted transition-colors text-left group"
                >
                  <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center flex-shrink-0">
                    <Shield size={16} className="text-sky-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm text-foreground truncate">
                        {template.name}
                      </p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 font-medium">
                        {template.language}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-3 mt-0.5">
                      {getTemplateBody(template.components)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <span className="p-1.5 hover:bg-primary/10 rounded-md transition-colors">
                      <Send size={14} className="text-primary" />
                    </span>
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
                <div
                  key={template.id}
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
                    <p className="text-xs text-muted-foreground line-clamp-3 mt-0.5">
                      {template.content}
                    </p>
                  </div>
                  {/* Action buttons */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleCopyToInput(template)}
                      className="p-1.5 hover:bg-background rounded-md transition-colors"
                      title="Editar antes de enviar"
                    >
                      <Edit2 size={14} className="text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => handleSelectTemplate(template)}
                      className="p-1.5 hover:bg-primary/10 rounded-md transition-colors"
                      title="Enviar direto"
                    >
                      <Send size={14} className="text-primary" />
                    </button>
                  </div>
                </div>
              ))
            )
          )}
        </div>
        <ScrollBar className="w-2.5 bg-muted/30 hover:bg-muted/50" />
      </ScrollArea>
    </div>
  );

  // Mobile: Use Sheet (drawer from bottom)
  if (isMobile) {
    return (
      <>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button 
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              title="Atalhos rápidos"
            >
              <Sparkles size={22} className="text-muted-foreground" />
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh] p-0">
            <SheetHeader className="px-4 py-3 border-b border-border">
              <SheetTitle className="text-left flex items-center gap-2">
                <Sparkles size={18} className="text-primary" />
                Atalhos Rápidos
              </SheetTitle>
            </SheetHeader>
            {renderContent()}
          </SheetContent>
        </Sheet>
        <QuickTemplatesConfigModal 
          open={configModalOpen} 
          onOpenChange={setConfigModalOpen} 
        />
        <MetaTemplateUseModal
          template={selectedMetaTemplate}
          open={!!selectedMetaTemplate}
          onOpenChange={(open) => !open && setSelectedMetaTemplate(null)}
          onCopyToInput={handleMetaTemplateUse}
          onSend={onSendMetaTemplate ? (templateId, templateName, variables, previewContent) => {
            onSendMetaTemplate(templateId, templateName, selectedMetaTemplate?.language || 'pt_BR', variables, previewContent);
            setSelectedMetaTemplate(null);
            setOpen(false);
          } : undefined}
          contactName={contactName}
        />
      </>
    );
  }

  // Desktop: Use Popover
  return (
    <>
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
          className="w-[580px] p-0 max-h-[600px] overflow-hidden"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
            <Sparkles size={16} className="text-primary" />
            <span className="font-medium text-sm">Atalhos Rápidos</span>
          </div>
          {renderContent()}
        </PopoverContent>
      </Popover>
      <QuickTemplatesConfigModal 
        open={configModalOpen} 
        onOpenChange={setConfigModalOpen} 
      />
      <MetaTemplateUseModal
        template={selectedMetaTemplate}
        open={!!selectedMetaTemplate}
        onOpenChange={(open) => !open && setSelectedMetaTemplate(null)}
        onCopyToInput={handleMetaTemplateUse}
        onSend={onSendMetaTemplate ? (templateId, templateName, variables, previewContent) => {
          onSendMetaTemplate(templateId, templateName, selectedMetaTemplate?.language || 'pt_BR', variables, previewContent);
          setSelectedMetaTemplate(null);
          setOpen(false);
        } : undefined}
        contactName={contactName}
      />
    </>
  );
}
