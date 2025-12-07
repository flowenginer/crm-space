import { useState, useMemo } from 'react';
import {
  Mic,
  MessageSquare,
  Image,
  FileText,
  GitBranch,
  Zap,
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
} from '@/hooks/useTemplates';

const categoryConfig = [
  { id: 'messages', icon: MessageSquare, label: 'Mensagens' },
  { id: 'audios', icon: Mic, label: 'Áudios' },
  { id: 'media', icon: Image, label: 'Mídias' },
  { id: 'documents', icon: FileText, label: 'Documentos' },
  { id: 'funnels', icon: GitBranch, label: 'Funis' },
  { id: 'triggers', icon: Zap, label: 'Gatilhos' },
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

const quickEmojis = ['👋', '😊', '🎉', '✅', '📦', '💬', '☀️', '🔥', '👕', '📸'];

export default function QuickMessages() {
  const [activeCategory, setActiveCategory] = useState('messages');
  const [searchQuery, setSearchQuery] = useState('');

  // Supabase hooks
  const { data: templates = [], isLoading } = useTemplates();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();

  // Modal states
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showUseTemplateModal, setShowUseTemplateModal] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form states
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateContent, setTemplateContent] = useState('');
  const [templateCategory, setTemplateCategory] = useState('messages');
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});

  // Calculate category counts dynamically
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    categoryConfig.forEach((cat) => {
      counts[cat.id] = templates.filter((t) => t.category === cat.id).length;
    });
    return counts;
  }, [templates]);

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
    setTemplateContent('');
    setTemplateCategory(activeCategory);
    setShowTemplateModal(true);
  };

  const handleEditTemplate = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    
    setIsEditing(true);
    setSelectedTemplateId(templateId);
    setTemplateTitle(template.title);
    setTemplateContent(template.content);
    setTemplateCategory(template.category || 'messages');
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
      navigator.clipboard.writeText(template.content);
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
    if (!templateTitle || !templateContent) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }

    const variablesMatch = templateContent.match(/\{\{(\w+)\}\}/g) || [];
    const variables = variablesMatch.map((v) => v.replace(/\{\{|\}\}/g, ''));

    try {
      if (isEditing && selectedTemplateId) {
        await updateTemplate.mutateAsync({
          id: selectedTemplateId,
          title: templateTitle,
          content: templateContent,
          category: templateCategory,
          variables,
        });
        toast({ title: 'Template atualizado!' });
      } else {
        await createTemplate.mutateAsync({
          title: templateTitle,
          content: templateContent,
          category: templateCategory,
          variables,
        });
        toast({ title: 'Template criado!' });
      }
      setShowTemplateModal(false);
    } catch (error) {
      toast({ title: 'Erro ao salvar template', variant: 'destructive' });
    }
  };

  const handleInsertVariable = (variable: string) => {
    setTemplateContent((prev) => prev + `{{${variable}}}`);
  };

  const handleInsertEmoji = (emoji: string) => {
    setTemplateContent((prev) => prev + emoji);
  };

  const getFilledContent = () => {
    if (!selectedTemplate) return '';
    let content = selectedTemplate.content;
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
            <h1 className="text-xl font-bold text-foreground">
              Mensagens rápidas
            </h1>
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
              {isLoading ? (
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
                      <TableHead className="w-20 text-center">Anexo</TableHead>
                      <TableHead className="w-32 text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTemplates.map((template, index) => (
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
                          {template.media_url ? (
                            <Paperclip size={14} className="mx-auto text-primary" />
                          ) : (
                            <span className="text-muted-foreground text-sm">Não</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleUseTemplate(template.id)}
                              title="Usar"
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
                    ))}
                  </TableBody>
                </Table>
              )}

              {!isLoading && filteredTemplates.length === 0 && (
                <div className="text-center py-12">
                  <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <h3 className="text-sm font-semibold text-foreground">Nenhum template encontrado</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Crie um novo template ou ajuste os filtros
                  </p>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* New/Edit Template Modal */}
      <Dialog open={showTemplateModal} onOpenChange={setShowTemplateModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar Template' : 'Novo Template'}</DialogTitle>
            <DialogDescription>
              Crie mensagens padronizadas para agilizar seu atendimento
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4">
            <div className="grid grid-cols-2 gap-6">
              {/* Left Column - Form */}
              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Título do template <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: ORÇAMENTO MANGA CURTA"
                    value={templateTitle}
                    onChange={(e) => setTemplateTitle(e.target.value)}
                    className="w-full px-4 py-3 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Categoria
                  </label>
                  <select
                    value={templateCategory}
                    onChange={(e) => setTemplateCategory(e.target.value)}
                    className="w-full px-4 py-3 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                  >
                    <option value="messages">Mensagens</option>
                    <option value="audios">Áudios</option>
                    <option value="media">Mídias</option>
                    <option value="documents">Documentos</option>
                  </select>
                </div>

                {/* Content */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Conteúdo da mensagem <span className="text-destructive">*</span>
                  </label>
                  <textarea
                    rows={10}
                    placeholder={`Digite sua mensagem aqui...

Use *texto* para negrito
Use _texto_ para itálico
Use {{variavel}} para campos dinâmicos`}
                    value={templateContent}
                    onChange={(e) => setTemplateContent(e.target.value)}
                    className="w-full px-4 py-3 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none font-mono text-sm bg-background"
                  />
                </div>

                {/* Quick Insert Variables */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Inserir variável
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

                {/* Quick Insert Emoji */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Emojis rápidos
                  </label>
                  <div className="flex gap-2">
                    {quickEmojis.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => handleInsertEmoji(emoji)}
                        className="w-10 h-10 flex items-center justify-center text-xl hover:bg-muted rounded-lg transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
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
                      <div className="p-4 min-h-[300px]">
                        {templateContent ? (
                          <div className="max-w-[85%] ml-auto">
                            <div className="bg-[#DCF8C6] rounded-lg rounded-tr-none p-3 shadow-sm">
                              <p className="text-sm text-gray-900 whitespace-pre-line">
                                {templateContent}
                              </p>
                              <div className="flex items-center justify-end gap-1 mt-1">
                                <span className="text-xs text-gray-500">15:30</span>
                                <CheckCheck size={14} className="text-blue-500" />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-center text-gray-500 text-sm pt-20">
                            Digite sua mensagem para ver o preview...
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

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
    </div>
  );
}
