import { useState, useMemo } from 'react';
import {
  Mic,
  MessageSquare,
  Image,
  FileText,
  Settings,
  Search,
  Plus,
  Star,
  Edit3,
  Trash2,
  Send,
  Paperclip,
  HelpCircle,
  CheckCheck,
  Loader2,
  Music,
  FileImage,
  File,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import {
  useTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  ContentBlock,
} from '@/hooks/useTemplates';
import { AudioRecorder } from '@/components/quick-messages/AudioRecorder';
import { CompactAudioRecorder } from '@/components/quick-messages/CompactAudioRecorder';
import { FileUploader } from '@/components/quick-messages/FileUploader';
import { EmojiPickerButton } from '@/components/quick-messages/EmojiPickerButton';
import { useUserQuickTemplates, useAddQuickTemplate } from '@/hooks/useQuickTemplates';

import { useApprovedMetaTemplates, MetaMessageTemplate, getTemplateBody } from '@/hooks/useMetaTemplates';
import { MetaTemplateUseModal } from '@/components/meta-templates';
import { Shield } from 'lucide-react';

const categoryConfig = [
  { id: 'messages', icon: MessageSquare, label: 'Mensagens' },
  { id: 'meta_templates', icon: Shield, label: 'Templates Meta' },
];

const variableOptions = [
  { key: 'nome', label: 'Nome' },
  { key: 'telefone', label: 'Telefone' },
  { key: 'email', label: 'Email' },
  { key: 'produto', label: 'Produto' },
  { key: 'valor', label: 'Valor' },
  { key: 'quantidade', label: 'Quantidade' },
  { key: 'data', label: 'Data' },
  { key: 'atendente', label: 'Atendente' },
];

// Helper to get icon for media type
const getMediaIcon = (mediaType: string | null) => {
  if (!mediaType) return null;
  if (mediaType === 'audio') return <Music size={14} className="text-primary" />;
  if (mediaType === 'image' || mediaType === 'video') return <FileImage size={14} className="text-primary" />;
  return <File size={14} className="text-primary" />;
};

export default function QuickMessages() {
  const [activeCategory, setActiveCategory] = useState('messages');
  const [searchQuery, setSearchQuery] = useState('');

  // Supabase hooks
  const { data: templates = [], isLoading } = useTemplates();
  const { data: metaTemplates = [], isLoading: metaLoading } = useApprovedMetaTemplates();
  const { data: quickTemplates = [] } = useUserQuickTemplates();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();
  const addQuickTemplate = useAddQuickTemplate();

  // Modal states
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showUseTemplateModal, setShowUseTemplateModal] = useState(false);
  const [showMetaTemplateModal, setShowMetaTemplateModal] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedMetaTemplate, setSelectedMetaTemplate] = useState<MetaMessageTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form states
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateCategory, setTemplateCategory] = useState('messages');
  const [templateMediaUrl, setTemplateMediaUrl] = useState<string | null>(null);
  const [templateMediaType, setTemplateMediaType] = useState<string | null>(null);
  const [templateMediaName, setTemplateMediaName] = useState<string | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  
  // Audio attachment for messages
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioName, setAudioName] = useState<string | null>(null);
  
  // Quick shortcut position (1-5, null = no shortcut)
  const [quickShortcutPosition, setQuickShortcutPosition] = useState<number | null>(null);
  
  // Audio first option - send audio before text
  const [audioFirst, setAudioFirst] = useState(false);
  
  // Multiple content blocks state
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([{ type: 'text', content: '' }]);
  const [activeBlockIndex, setActiveBlockIndex] = useState(0);

  // Get used quick template positions
  const usedPositions = useMemo(() => {
    return new Set(quickTemplates.map(qt => qt.position));
  }, [quickTemplates]);

  // Calculate category counts dynamically
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    categoryConfig.forEach((cat) => {
      if (cat.id === 'meta_templates') {
        counts[cat.id] = metaTemplates.length;
      } else {
        counts[cat.id] = templates.filter((t) => t.category === cat.id).length;
      }
    });
    return counts;
  }, [templates, metaTemplates]);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((template) => {
      const matchesCategory = template.category === activeCategory;
      const matchesSearch =
        searchQuery === '' ||
        template.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.content.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [templates, activeCategory, searchQuery]);

  // Get selected template from filtered list
  const selectedTemplate = useMemo(() => {
    if (!selectedTemplateId) return null;
    return templates.find((t) => t.id === selectedTemplateId) || null;
  }, [templates, selectedTemplateId]);

  const handleNewTemplate = () => {
    setIsEditing(false);
    setSelectedTemplateId(null);
    setTemplateTitle('');
    setContentBlocks([{ type: 'text', content: '' }]);
    setActiveBlockIndex(0);
    setTemplateCategory(activeCategory);
    setTemplateMediaUrl(null);
    setTemplateMediaType(null);
    setTemplateMediaName(null);
    setAudioUrl(null);
    setAudioName(null);
    setQuickShortcutPosition(null);
    setAudioFirst(false);
    setShowTemplateModal(true);
  };

  const handleEditTemplate = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    
    setIsEditing(true);
    setSelectedTemplateId(templateId);
    setTemplateTitle(template.title);
    setTemplateCategory(template.category || 'messages');
    setTemplateMediaUrl(template.media_url || null);
    setTemplateMediaType(template.media_type || null);
    setTemplateMediaName(template.media_name || null);
    
    // Check if there's audio attached (media_type === 'audio' but category is 'messages')
    if (template.category === 'messages' && template.media_type === 'audio') {
      setAudioUrl(template.media_url);
      setAudioName(template.media_name);
      // Clear the main media fields since this is an audio attachment
      setTemplateMediaUrl(null);
      setTemplateMediaType(null);
      setTemplateMediaName(null);
    } else {
      setAudioUrl(null);
      setAudioName(null);
    }
    
    // Check if template has a quick shortcut position
    const existingQuickTemplate = quickTemplates.find(qt => qt.template_id === templateId);
    setQuickShortcutPosition(existingQuickTemplate?.position || null);
    
    // Load audio_first preference
    setAudioFirst(template.audio_first ?? false);
    
    // Load content blocks or convert from legacy content
    if (template.content_blocks && Array.isArray(template.content_blocks) && template.content_blocks.length > 0) {
      setContentBlocks(template.content_blocks as ContentBlock[]);
    } else {
      setContentBlocks([{ type: 'text', content: template.content }]);
    }
    setActiveBlockIndex(0);
    setShowTemplateModal(true);
  };

  const handleUseTemplate = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;

    setSelectedTemplateId(templateId);
    const variables = template.variables as string[] || [];
    
    if (variables.length > 0) {
      setVariableValues({});
      setShowUseTemplateModal(true);
    } else {
      // Copy all blocks as separate lines or just content
      const blocks = template.content_blocks as ContentBlock[] | null;
      if (blocks && blocks.length > 0) {
        const allContent = blocks
          .filter(b => b.type === 'text' && b.content)
          .map(b => b.content)
          .join('\n---\n');
        navigator.clipboard.writeText(allContent);
      } else {
        navigator.clipboard.writeText(template.content);
      }
      toast({ title: 'Template copiado!', description: 'Cole no chat para enviar.' });
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await deleteTemplate.mutateAsync(templateId);
      toast({ title: 'Template excluído!' });
    } catch (error) {
      toast({ title: 'Erro ao excluir template', variant: 'destructive' });
    }
  };

  const handleSaveTemplate = async () => {
    // For audio/media/documents, content is optional but media is required
    const needsMedia = ['audios', 'media', 'documents'].includes(templateCategory);
    
    if (!templateTitle) {
      toast({ title: 'Preencha o título', variant: 'destructive' });
      return;
    }
    
    if (needsMedia && !templateMediaUrl) {
      toast({ title: 'Faça upload de um arquivo', variant: 'destructive' });
      return;
    }
    
    // For messages, check if at least one block has content OR audio is attached
    const textBlocks = contentBlocks.filter(b => b.type === 'text' && b.content?.trim());
    const hasAudioAttachment = !!audioUrl;
    
    if (!needsMedia && textBlocks.length === 0 && !hasAudioAttachment) {
      toast({ title: 'Preencha uma mensagem ou grave um áudio', variant: 'destructive' });
      return;
    }

    // Get first block content for legacy field + search (use title as fallback for audio-only)
    const firstContent = textBlocks[0]?.content || (hasAudioAttachment ? `🎤 ${templateTitle}` : templateTitle);
    
    // Extract variables from all blocks
    const allContent = contentBlocks
      .filter(b => b.type === 'text')
      .map(b => b.content || '')
      .join(' ');
    const variablesMatch = allContent.match(/\{\{(\w+)\}\}/g) || [];
    const variables = [...new Set(variablesMatch.map((v) => v.replace(/\{\{|\}\}/g, '')))];

    // Determine media fields - for messages category, use audio if present, else use regular media
    const finalMediaUrl = templateCategory === 'messages' && audioUrl ? audioUrl : templateMediaUrl;
    const finalMediaType = templateCategory === 'messages' && audioUrl ? 'audio' : templateMediaType;
    const finalMediaName = templateCategory === 'messages' && audioUrl ? audioName : templateMediaName;

    try {
      let savedTemplateId = selectedTemplateId;
      
      if (isEditing && selectedTemplateId) {
        await updateTemplate.mutateAsync({
          id: selectedTemplateId,
          title: templateTitle,
          content: firstContent,
          category: templateCategory,
          variables,
          media_url: finalMediaUrl,
          media_type: finalMediaType,
          media_name: finalMediaName,
          content_blocks: contentBlocks.filter(b => b.content?.trim() || b.media_url),
          audio_first: audioFirst,
        });
        toast({ title: 'Template atualizado!' });
      } else {
        const newTemplate = await createTemplate.mutateAsync({
          title: templateTitle,
          content: firstContent,
          category: templateCategory,
          variables,
          media_url: finalMediaUrl,
          media_type: finalMediaType,
          media_name: finalMediaName,
          content_blocks: contentBlocks.filter(b => b.content?.trim() || b.media_url),
          audio_first: audioFirst,
        });
        savedTemplateId = newTemplate.id;
        toast({ title: 'Template criado!' });
      }
      
      // Handle quick shortcut if selected
      if (quickShortcutPosition && savedTemplateId) {
        try {
          await addQuickTemplate.mutateAsync({ 
            templateId: savedTemplateId, 
            position: quickShortcutPosition 
          });
          toast({ title: `Atalho rápido ${quickShortcutPosition} configurado!` });
        } catch (error) {
          console.error('Error adding quick shortcut:', error);
        }
      }
      
      setShowTemplateModal(false);
    } catch (error) {
      toast({ title: 'Erro ao salvar template', variant: 'destructive' });
    }
  };

  const handleMediaUploaded = (url: string, type: string, name: string) => {
    setTemplateMediaUrl(url);
    setTemplateMediaType(type);
    setTemplateMediaName(name);
  };

  const handleMediaRemoved = () => {
    setTemplateMediaUrl(null);
    setTemplateMediaType(null);
    setTemplateMediaName(null);
  };

  const handleAudioUploaded = (url: string, type: string, name: string) => {
    setAudioUrl(url);
    setAudioName(name);
  };

  const handleAudioRemoved = () => {
    setAudioUrl(null);
    setAudioName(null);
  };

  // Block management functions
  const handleAddBlock = () => {
    setContentBlocks(prev => [...prev, { type: 'text', content: '' }]);
    setActiveBlockIndex(contentBlocks.length);
  };

  const handleRemoveBlock = (index: number) => {
    if (contentBlocks.length <= 1) return;
    setContentBlocks(prev => prev.filter((_, i) => i !== index));
    if (activeBlockIndex >= index && activeBlockIndex > 0) {
      setActiveBlockIndex(prev => prev - 1);
    }
  };

  const handleBlockContentChange = (index: number, content: string) => {
    setContentBlocks(prev => 
      prev.map((block, i) => i === index ? { ...block, content } : block)
    );
  };

  const handleInsertVariable = (variable: string) => {
    handleBlockContentChange(
      activeBlockIndex, 
      (contentBlocks[activeBlockIndex]?.content || '') + `{{${variable}}}`
    );
  };

  const handleInsertEmoji = (emoji: string) => {
    handleBlockContentChange(
      activeBlockIndex,
      (contentBlocks[activeBlockIndex]?.content || '') + emoji
    );
  };

  const getFilledContent = () => {
    if (!selectedTemplate) return '';
    
    const blocks = selectedTemplate.content_blocks as ContentBlock[] | null;
    const baseContent = blocks && blocks.length > 0
      ? blocks.filter(b => b.type === 'text').map(b => b.content || '').join('\n---\n')
      : selectedTemplate.content;
    
    let content = baseContent;
    Object.entries(variableValues).forEach(([key, value]) => {
      content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || `{{${key}}}`);
    });
    return content;
  };

  const handleSendFilledTemplate = () => {
    const filledContent = getFilledContent();
    navigator.clipboard.writeText(filledContent);
    toast({ title: 'Mensagem copiada!', description: 'Cole no chat para enviar.' });
    setShowUseTemplateModal(false);
  };

  const truncateMessage = (text: string, maxLength: number = 80) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const isSaving = createTemplate.isPending || updateTemplate.isPending;

  return (
    <div className="flex h-[calc(100vh-72px)]">
      {/* Left Sidebar - Categories */}
      <div className="w-56 bg-card border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Mic size={20} className="text-primary" />
            DS Voice
          </h2>
        </div>

        <ScrollArea className="flex-1">
          <nav className="p-2 space-y-1">
            {categoryConfig.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveCategory(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all text-sm ${
                  activeCategory === item.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-muted'
                }`}
              >
                <div className="flex items-center gap-2">
                  <item.icon size={16} />
                  <span className="font-medium">{item.label}</span>
                </div>
                <span
                  className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                    activeCategory === item.id
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {categoryCounts[item.id] || 0}
                </span>
              </button>
            ))}
          </nav>
        </ScrollArea>

        <div className="p-2 border-t border-border">
          <button className="w-full flex items-center gap-2 px-3 py-2.5 text-foreground hover:bg-muted rounded-lg transition-all text-sm">
            <Settings size={16} />
            <span className="font-medium">Configurações</span>
          </button>
        </div>
      </div>

      {/* Main Content - Table Layout */}
      <div className="flex-1 bg-background flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-foreground">Mensagens rápidas</h1>
            <Badge variant="secondary" className="font-medium">
              {filteredTemplates.length}
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 w-64 bg-muted border-0 rounded-lg text-sm focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* New Template Button */}
            <Button onClick={handleNewTemplate} size="sm">
              <Plus size={16} className="mr-1" />
              ADICIONAR
            </Button>
          </div>
        </div>

        {/* Table */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              {/* Meta Templates Table */}
              {activeCategory === 'meta_templates' ? (
                metaLoading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-center gap-4">
                        <Skeleton className="h-4 w-8" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 flex-1" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-8 w-24" />
                      </div>
                    ))}
                  </div>
                ) : metaTemplates.length === 0 ? (
                  <div className="text-center py-12">
                    <Shield className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <h3 className="text-sm font-semibold text-foreground">
                      Nenhum template aprovado
                    </h3>
                    <p className="text-muted-foreground text-xs mt-1 max-w-md mx-auto">
                      Acesse a página de Canais WhatsApp para sincronizar ou criar templates da API Oficial.
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="w-12 text-center">#</TableHead>
                        <TableHead className="w-48">Nome</TableHead>
                        <TableHead>Mensagem</TableHead>
                        <TableHead className="w-24 text-center">Idioma</TableHead>
                        <TableHead className="w-28 text-center">Categoria</TableHead>
                        <TableHead className="w-28 text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {metaTemplates.map((template, index) => (
                        <TableRow key={template.id} className="group">
                          <TableCell className="text-center text-muted-foreground font-mono text-sm">
                            {index + 1}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Shield size={14} className="text-sky-500" />
                              <span className="font-semibold text-foreground">
                                {template.name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-muted-foreground text-sm">
                              {truncateMessage(getTemplateBody(template.components))}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="text-xs">
                              {template.language}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge 
                              variant="secondary" 
                              className={`text-xs ${
                                template.category === 'MARKETING' 
                                  ? 'bg-purple-500/10 text-purple-600' 
                                  : template.category === 'UTILITY'
                                    ? 'bg-blue-500/10 text-blue-600'
                                    : 'bg-amber-500/10 text-amber-600'
                              }`}
                            >
                              {template.category}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setSelectedMetaTemplate(template);
                                  setShowMetaTemplateModal(true);
                                }}
                                title="Usar template"
                              >
                                <Send size={14} />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )
              ) : (
                /* Regular Templates Table */
                isLoading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-center gap-4">
                        <Skeleton className="h-4 w-8" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 flex-1" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-8 w-24" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="w-12 text-center">#</TableHead>
                        <TableHead className="w-48">Chave</TableHead>
                        <TableHead>Mensagem</TableHead>
                        <TableHead className="w-20 text-center">Blocos</TableHead>
                        <TableHead className="w-20 text-center">Anexo</TableHead>
                        <TableHead className="w-32 text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTemplates.map((template, index) => {
                        const blocks = template.content_blocks as ContentBlock[] | null;
                        const blockCount = blocks?.length || 1;
                        
                        return (
                          <TableRow key={template.id} className="group">
                            <TableCell className="text-center text-muted-foreground font-mono text-sm">
                              {index + 1}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground">
                                  {template.title}
                                </span>
                                {template.is_favorite && (
                                  <Star size={12} className="text-yellow-500 fill-yellow-500" />
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-muted-foreground text-sm">
                                {truncateMessage(template.content)}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              {blockCount > 1 ? (
                                <Badge variant="secondary" className="text-xs">
                                  {blockCount}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">1</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {template.media_url ? (
                                <div className="flex items-center justify-center">
                                  {getMediaIcon(template.media_type)}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleUseTemplate(template.id)}
                                  title="Usar template"
                                >
                                  <Send size={14} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleEditTemplate(template.id)}
                                  title="Editar"
                                >
                                  <Edit3 size={14} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteTemplate(template.id)}
                                  disabled={deleteTemplate.isPending}
                                  title="Excluir"
                                >
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )
              )}

              {!isLoading && activeCategory !== 'meta_templates' && filteredTemplates.length === 0 && (
                <div className="text-center py-12">
                  <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Nenhuma mensagem encontrada
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Crie templates para agilizar suas respostas
                  </p>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Template Modal - Create/Edit */}
      <Dialog open={showTemplateModal} onOpenChange={setShowTemplateModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar template' : 'Novo template'}</DialogTitle>
            <DialogDescription>
              Crie mensagens prontas para usar rapidamente no chat
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6 py-4">
            {/* Left Column - Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Título/Chave <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: saudacao, preco, horario..."
                  value={templateTitle}
                  onChange={(e) => setTemplateTitle(e.target.value)}
                  className="w-full px-4 py-3 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                />
              </div>

              {templateCategory === 'audios' && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Áudio <span className="text-destructive">*</span>
                  </label>
                  <AudioRecorder
                    onAudioUploaded={handleMediaUploaded}
                    existingUrl={templateMediaUrl}
                    onRemove={handleMediaRemoved}
                  />
                </div>
              )}

              {templateCategory === 'media' && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Mídia (Imagem/Vídeo) <span className="text-destructive">*</span>
                  </label>
                  <FileUploader
                    category="media"
                    onFileUploaded={handleMediaUploaded}
                    existingUrl={templateMediaUrl}
                    existingType={templateMediaType}
                    existingName={templateMediaName}
                    onRemove={handleMediaRemoved}
                  />
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Legenda (opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Legenda da mídia..."
                      value={contentBlocks[0]?.content || ''}
                      onChange={(e) => handleBlockContentChange(0, e.target.value)}
                      className="w-full px-4 py-3 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                    />
                  </div>
                </div>
              )}

              {templateCategory === 'documents' && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Documento <span className="text-destructive">*</span>
                  </label>
                  <FileUploader
                    category="documents"
                    onFileUploaded={handleMediaUploaded}
                    existingUrl={templateMediaUrl}
                    existingType={templateMediaType}
                    existingName={templateMediaName}
                    onRemove={handleMediaRemoved}
                  />
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Legenda (opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Legenda do documento..."
                      value={contentBlocks[0]?.content || ''}
                      onChange={(e) => handleBlockContentChange(0, e.target.value)}
                      className="w-full px-4 py-3 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                    />
                  </div>
                </div>
              )}

              {templateCategory === 'messages' && (
                <>
                  {/* Multiple Content Blocks */}
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-foreground">
                      Mensagens <span className="text-destructive">*</span>
                    </label>
                    
                    {contentBlocks.map((block, index) => (
                      <div 
                        key={index} 
                        className={`relative border rounded-xl transition-all ${
                          activeBlockIndex === index 
                            ? 'border-primary ring-2 ring-primary/20' 
                            : 'border-border'
                        }`}
                      >
                        <div className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-t-xl border-b border-border">
                          <span className="text-xs font-medium text-muted-foreground">
                            Mensagem {index + 1}
                          </span>
                          {contentBlocks.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveBlock(index)}
                              className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                        <textarea
                          rows={4}
                          placeholder={index === 0 
                            ? `Digite sua mensagem aqui...\n\nUse *texto* para negrito\nUse _texto_ para itálico\nUse {{variavel}} para campos dinâmicos`
                            : 'Digite o conteúdo desta mensagem...'
                          }
                          value={block.content || ''}
                          onChange={(e) => handleBlockContentChange(index, e.target.value)}
                          onFocus={() => setActiveBlockIndex(index)}
                          className="w-full px-4 py-3 border-0 rounded-b-xl focus:ring-0 resize-none font-mono text-sm bg-background"
                        />
                      </div>
                    ))}
                    
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddBlock}
                      className="w-full border-dashed"
                    >
                      <Plus size={14} className="mr-2" />
                      Adicionar mensagem
                    </Button>
                  </div>

                  {/* Compact Audio Recorder */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Anexar áudio (opcional)
                    </label>
                    <CompactAudioRecorder
                      onAudioUploaded={handleAudioUploaded}
                      existingUrl={audioUrl}
                      onRemove={handleAudioRemoved}
                    />
                  </div>

                  {/* Audio Order Selector - only show when both audio and text exist */}
                  {audioUrl && contentBlocks.some(b => b.content?.trim()) && (
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Ordem de envio
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setAudioFirst(false)}
                          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                            !audioFirst 
                              ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2' 
                              : 'bg-muted hover:bg-muted/80 text-foreground'
                          }`}
                        >
                          <MessageSquare size={16} />
                          Texto primeiro
                        </button>
                        <button
                          type="button"
                          onClick={() => setAudioFirst(true)}
                          className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                            audioFirst 
                              ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2' 
                              : 'bg-muted hover:bg-muted/80 text-foreground'
                          }`}
                        >
                          <Mic size={16} />
                          Áudio primeiro
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Escolha qual conteúdo será enviado primeiro
                      </p>
                    </div>
                  )}

                  {/* Compact File Uploader */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Anexar arquivo (opcional)
                    </label>
                    <FileUploader
                      category="documents"
                      onFileUploaded={handleMediaUploaded}
                      existingUrl={templateMediaUrl}
                      existingType={templateMediaType}
                      existingName={templateMediaName}
                      onRemove={handleMediaRemoved}
                      compact
                    />
                  </div>

                  {/* Quick Shortcut Selector */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Atalho rápido (opcional)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5].map((position) => {
                        const isUsed = usedPositions.has(position) && 
                          !quickTemplates.find(qt => qt.template_id === selectedTemplateId && qt.position === position);
                        const isSelected = quickShortcutPosition === position;
                        
                        return (
                          <button
                            key={position}
                            type="button"
                            onClick={() => setQuickShortcutPosition(isSelected ? null : position)}
                            disabled={isUsed}
                            className={`
                              w-10 h-10 rounded-lg text-sm font-bold transition-all
                              ${isSelected 
                                ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2' 
                                : isUsed
                                  ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
                                  : 'bg-muted hover:bg-muted/80 text-foreground'
                              }
                            `}
                            title={isUsed ? 'Posição já ocupada por outro template' : `Atalho ${position}`}
                          >
                            {position}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Selecione uma posição para acessar rapidamente este template
                    </p>
                  </div>

                  {/* Quick Insert Variables */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Inserir variável (na mensagem {activeBlockIndex + 1})
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {variableOptions.map((variable) => (
                        <button
                          key={variable.key}
                          type="button"
                          onClick={() => handleInsertVariable(variable.key)}
                          className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors"
                        >
                          {`{{${variable.key}}}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Emoji Picker */}
                  <EmojiPickerButton onEmojiSelect={handleInsertEmoji} />
                </>
              )}
            </div>

            {/* Right Column - Preview */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Preview (como ficará no WhatsApp)
                </label>

                {/* Phone Frame */}
                <div className="bg-gray-900 rounded-3xl p-3 shadow-2xl">
                  {/* Phone Screen */}
                  <div className="bg-[#ECE5DD] rounded-2xl overflow-hidden">
                    {/* WhatsApp Header */}
                    <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-300"></div>
                      <div className="text-white">
                        <div className="font-semibold">Cliente</div>
                        <div className="text-xs text-green-200">online</div>
                      </div>
                    </div>

                    {/* Chat Area */}
                    <ScrollArea className="h-[320px]">
                      <div className="p-4 space-y-2">
                        {/* Show each block as separate message bubble */}
                        {contentBlocks.filter(b => b.content?.trim()).length > 0 || templateMediaUrl ? (
                          <>
                            {contentBlocks.map((block, index) => (
                              block.content?.trim() && (
                                <div key={index} className="max-w-[85%] ml-auto">
                                  <div className="bg-[#DCF8C6] rounded-lg rounded-tr-none p-3 shadow-sm">
                                    <p className="text-sm text-gray-900 whitespace-pre-line">
                                      {block.content}
                                    </p>
                                    <div className="flex items-center justify-end gap-1 mt-1">
                                      <span className="text-xs text-gray-500">15:30</span>
                                      <CheckCheck size={14} className="text-blue-500" />
                                    </div>
                                  </div>
                                </div>
                              )
                            ))}
                            
                            {/* Media Preview (if any) */}
                            {templateMediaUrl && (
                              <div className="max-w-[85%] ml-auto">
                                <div className="bg-[#DCF8C6] rounded-lg rounded-tr-none p-3 shadow-sm">
                                  {templateMediaType === 'audio' && (
                                    <div className="flex items-center gap-2 p-2 bg-white/50 rounded">
                                      <Music size={20} className="text-green-600" />
                                      <div className="h-1 flex-1 bg-gray-300 rounded" />
                                      <span className="text-xs text-gray-500">0:15</span>
                                    </div>
                                  )}
                                  {templateMediaType === 'image' && (
                                    <img 
                                      src={templateMediaUrl} 
                                      alt="Preview" 
                                      className="rounded max-h-32 object-cover"
                                    />
                                  )}
                                  {templateMediaType === 'video' && (
                                    <div className="relative bg-black rounded overflow-hidden aspect-video">
                                      <video src={templateMediaUrl} className="w-full h-full object-cover" />
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-12 h-12 bg-white/80 rounded-full flex items-center justify-center">
                                          <div className="w-0 h-0 border-l-[16px] border-l-gray-800 border-y-[10px] border-y-transparent ml-1" />
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  {templateMediaType === 'document' && (
                                    <div className="flex items-center gap-2 p-3 bg-white/70 rounded">
                                      <FileText size={24} className="text-red-500" />
                                      <span className="text-xs font-medium text-gray-700 truncate max-w-[150px]">
                                        {templateMediaName || 'Documento'}
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex items-center justify-end gap-1 mt-1">
                                    <span className="text-xs text-gray-500">15:30</span>
                                    <CheckCheck size={14} className="text-blue-500" />
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-center text-gray-500 text-sm pt-20">
                            {templateCategory === 'messages' 
                              ? 'Digite sua mensagem para ver o preview...'
                              : 'Faça upload de um arquivo para ver o preview...'
                            }
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              </div>

              {/* Info about multiple messages */}
              {contentBlocks.filter(b => b.content?.trim()).length > 1 && (
                <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
                  <p className="text-sm text-primary font-medium flex items-center gap-2">
                    <MessageSquare size={16} />
                    {contentBlocks.filter(b => b.content?.trim()).length} mensagens serão enviadas separadamente
                  </p>
                </div>
              )}

              {/* Formatting Tips */}
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl p-4">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                  <HelpCircle size={16} />
                  Dicas de formatação
                </h4>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                  <li>
                    <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">*texto*</code> →{' '}
                    <strong>negrito</strong>
                  </li>
                  <li>
                    <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">_texto_</code> →{' '}
                    <em>itálico</em>
                  </li>
                  <li>
                    <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">~texto~</code> →{' '}
                    <s>riscado</s>
                  </li>
                  <li>
                    <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{`{{nome}}`}</code>{' '}
                    → Variável dinâmica
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-border pt-4">
            <Button variant="ghost" onClick={() => setShowTemplateModal(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSaveTemplate} disabled={isSaving}>
              {isSaving && <Loader2 size={16} className="mr-2 animate-spin" />}
              {isEditing ? 'Salvar alterações' : 'Criar template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Use Template Modal (Fill Variables) */}
      <Dialog open={showUseTemplateModal} onOpenChange={setShowUseTemplateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Preencher variáveis</DialogTitle>
            <DialogDescription>Complete os campos para personalizar a mensagem</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Dynamic Variable Fields */}
            {(selectedTemplate?.variables as string[] || []).map((variable) => (
              <div key={variable}>
                <label className="block text-sm font-medium text-foreground mb-2 capitalize">
                  {variable.replace('_', ' ')}
                </label>
                <input
                  type="text"
                  placeholder={`Digite o ${variable}...`}
                  value={variableValues[variable] || ''}
                  onChange={(e) =>
                    setVariableValues((prev) => ({ ...prev, [variable]: e.target.value }))
                  }
                  className="w-full px-4 py-2.5 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                />
              </div>
            ))}

            {/* Preview with filled variables */}
            <div className="mt-6">
              <label className="block text-sm font-medium text-foreground mb-2">
                Preview da mensagem
              </label>
              <div className="bg-muted rounded-xl p-4 text-sm text-foreground whitespace-pre-line max-h-48 overflow-y-auto">
                {getFilledContent()}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowUseTemplateModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSendFilledTemplate}>
              <Send size={16} className="mr-2" />
              Usar no chat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Meta Template Use Modal */}
      <MetaTemplateUseModal
        template={selectedMetaTemplate}
        open={showMetaTemplateModal}
        onOpenChange={(open) => {
          setShowMetaTemplateModal(open);
          if (!open) setSelectedMetaTemplate(null);
        }}
        onCopyToInput={(content) => {
          navigator.clipboard.writeText(content);
          toast({ title: 'Template copiado!', description: 'Cole no chat para enviar.' });
        }}
      />
    </div>
  );
}
