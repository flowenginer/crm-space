import { useState } from 'react';
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
  Copy,
  Paperclip,
  HelpCircle,
  CheckCheck,
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
import { toast } from '@/hooks/use-toast';

interface Template {
  id: string;
  category: string;
  title: string;
  content: string;
  usageCount: number;
  variables: string[];
  folder: string;
  isFavorite: boolean;
  hasAttachment: boolean;
  createdAt: string;
}

const categories = [
  { id: 'messages', icon: MessageSquare, label: 'Mensagens', count: 12 },
  { id: 'audios', icon: Mic, label: 'Áudios', count: 5 },
  { id: 'media', icon: Image, label: 'Mídias', count: 8 },
  { id: 'documents', icon: FileText, label: 'Documentos', count: 3 },
  { id: 'funnels', icon: GitBranch, label: 'Funis', count: 2 },
  { id: 'triggers', icon: Zap, label: 'Gatilhos', count: 4 },
];

const mockTemplates: Template[] = [
  {
    id: '1',
    category: 'messages',
    title: 'DADOS-SC',
    content: `*Me informa seus dados por gentileza!* 
NOME: 
CPF ou CNPJ: 
DATA DE NASCIMENTO: 
CEP: 
ENDEREÇO: Nº: 
COMPLEMENTO: 
BAIRRO: 
CIDADE: 
ESTADO: 
E-MAIL: 
TELEFONE:`,
    usageCount: 145,
    variables: [],
    folder: 'Vendas',
    isFavorite: true,
    hasAttachment: false,
    createdAt: '2025-11-01T10:00:00',
  },
  {
    id: '2',
    category: 'messages',
    title: 'RESGATE',
    content: `Opa! Imagino que por conta da correria do dia a dia, não conseguiu me responder... rs 

Sem problemas... 

Podemos dar continuidade ao seu atendimento agora?`,
    usageCount: 267,
    variables: [],
    folder: 'Resgates',
    isFavorite: false,
    hasAttachment: false,
    createdAt: '2025-11-05T14:00:00',
  },
  {
    id: '3',
    category: 'messages',
    title: 'RESGATE VERÃO-SC',
    content: `*Scarlet:* Olá, {{nome}}! Aqui é a *Scarlet* da *Space Sports* ☀️

O verão está chegando com tudo e esse é o momento ideal para deixar sua equipe preparada com conforto, estilo e proteção contra os raios solares! 

☀️ Vamos renovar suas camisas?`,
    usageCount: 89,
    variables: ['nome'],
    folder: 'Resgates',
    isFavorite: true,
    hasAttachment: false,
    createdAt: '2025-11-10T09:00:00',
  },
  {
    id: '4',
    category: 'messages',
    title: 'ORÇAMENTO MANGA CURTA-SC',
    content: `*Scarlet:* *ORÇAMENTO* 

*10 CAMISAS MANGA CURTA UV50+* 
*VALOR UNITÁRIO - R$ 59,90* 
*TOTAL R$ 599,00* 

*CAMISAS PLUS SIZE (Tamanhos do G1 aos G4), tem R$ 10,00 de acréscimo.* 

---------------
📦 Frete por conta do cliente
⏰ Prazo de produção: 7 a 10 dias úteis`,
    usageCount: 312,
    variables: ['quantidade', 'valor_unitario', 'valor_total'],
    folder: 'Orçamentos',
    isFavorite: true,
    hasAttachment: false,
    createdAt: '2025-11-15T11:00:00',
  },
  {
    id: '5',
    category: 'messages',
    title: 'ORÇAMENTO MANGA LONGA ZÍPER-SC',
    content: `*Scarlet:* *ORÇAMENTO* 

*10 CAMISAS MANGA LONGA ZÍPER UV50+* 
*VALOR UNITÁRIO - R$ 89,90* 
*TOTAL R$ 899,00* 

*CAMISAS PLUS SIZE (Tamanhos do G1 aos G4), tem R$ 10,00 de acréscimo.* 

---------------
📦 Frete por conta do cliente
⏰ Prazo de produção: 7 a 10 dias úteis`,
    usageCount: 198,
    variables: ['quantidade', 'valor_unitario', 'valor_total'],
    folder: 'Orçamentos',
    isFavorite: false,
    hasAttachment: false,
    createdAt: '2025-11-20T16:00:00',
  },
  {
    id: '6',
    category: 'messages',
    title: 'ORÇAMENTO MANGA LONGA-SC',
    content: `*Scarlet:* *ORÇAMENTO* 

*10 CAMISAS MANGA LONGA UV50+* 
*VALOR UNITÁRIO - R$ 79,90* 
*TOTAL R$ 799,00* 

*CAMISAS PLUS SIZE (Tamanhos do G1 aos G4), tem R$ 10,00 de acréscimo.*`,
    usageCount: 256,
    variables: ['quantidade', 'valor_unitario', 'valor_total'],
    folder: 'Orçamentos',
    isFavorite: false,
    hasAttachment: false,
    createdAt: '2025-11-22T08:00:00',
  },
  {
    id: '7',
    category: 'messages',
    title: 'ENCERRAMENTO VENDA 1-SC',
    content: `*Scarlet:* Perfeito! Já inseri seu pedido para andamento. 

Parabéns pelo investimento! 🎉

Foi um prazer atendê-lo. Desejo a você e à sua família um excelente final de ano, repleto de saúde, paz e boas festas! 🎊`,
    usageCount: 134,
    variables: [],
    folder: 'Vendas',
    isFavorite: true,
    hasAttachment: false,
    createdAt: '2025-11-25T13:00:00',
  },
  {
    id: '8',
    category: 'messages',
    title: 'DÚVIDA ORÇAMENTO-SC',
    content: `*Scarlet:* Perfeito, {{nome}}! 

Vou te encaminhar o orçamento detalhado.

Caso tenha ficado algum tipo de dúvida pode me perguntar, ok? 😊`,
    usageCount: 78,
    variables: ['nome'],
    folder: 'Orçamentos',
    isFavorite: false,
    hasAttachment: false,
    createdAt: '2025-11-28T15:00:00',
  },
  {
    id: '9',
    category: 'messages',
    title: 'RESGATE RECOMPRA',
    content: `*Scarlet:* Opa, {{nome}}! Como você está? 😊 

Aqui é a *Scarlet* da *Space Sports*. 

Já faz um tempo desde a sua última compra e gostaria de lembrá-lo dos benefícios das nossas camisas com proteção UV 50+. 

Deseja renovar o estoque ou fazer um novo pedido?`,
    usageCount: 45,
    variables: ['nome'],
    folder: 'Resgates',
    isFavorite: false,
    hasAttachment: false,
    createdAt: '2025-12-01T10:00:00',
  },
  {
    id: '10',
    category: 'messages',
    title: 'ENCERRAMENTO VENDA 2-SC',
    content: `*Scarlet:* Vou te encaminhar ao setor de atendimento ao cliente para o acompanhamento do seu pedido! 

Qualquer dúvida, estou à disposição. 😊`,
    usageCount: 67,
    variables: [],
    folder: 'Vendas',
    isFavorite: false,
    hasAttachment: false,
    createdAt: '2025-12-02T12:00:00',
  },
  {
    id: '11',
    category: 'messages',
    title: 'APRESENTAÇÃO-SC',
    content: `*Scarlet:* Que alegria receber o seu contato! 🎉

Meu nome é *Scarlet*, sou especialista comercial da *Space Sports*, a marca líder em camisas personalizadas no Brasil! 👕

*Me informa seu nome, por gentileza* 😊`,
    usageCount: 423,
    variables: [],
    folder: 'Apresentação',
    isFavorite: true,
    hasAttachment: false,
    createdAt: '2025-12-03T09:00:00',
  },
  {
    id: '12',
    category: 'messages',
    title: 'INSTAGRAM-SC',
    content: `*Scarlet:* Enquanto isso, aqui você conhece um pouco mais sobre o nosso trabalho: 

📸 https://www.instagram.com/spacesports/

Dá uma olhada nos nossos trabalhos! 🔥`,
    usageCount: 189,
    variables: [],
    folder: 'Apresentação',
    isFavorite: false,
    hasAttachment: false,
    createdAt: '2025-12-03T11:00:00',
  },
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
  const [templates, setTemplates] = useState<Template[]>(mockTemplates);

  // Modal states
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showUseTemplateModal, setShowUseTemplateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form states
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateContent, setTemplateContent] = useState('');
  const [templateCategory, setTemplateCategory] = useState('messages');
  const [templateFolder, setTemplateFolder] = useState('');
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});

  const filteredTemplates = templates.filter((template) => {
    const matchesCategory = template.category === activeCategory;
    const matchesSearch =
      searchQuery === '' ||
      template.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleNewTemplate = () => {
    setIsEditing(false);
    setSelectedTemplate(null);
    setTemplateTitle('');
    setTemplateContent('');
    setTemplateCategory('messages');
    setTemplateFolder('');
    setShowTemplateModal(true);
  };

  const handleEditTemplate = (template: Template) => {
    setIsEditing(true);
    setSelectedTemplate(template);
    setTemplateTitle(template.title);
    setTemplateContent(template.content);
    setTemplateCategory(template.category);
    setTemplateFolder(template.folder);
    setShowTemplateModal(true);
  };

  const handleUseTemplate = (template: Template) => {
    setSelectedTemplate(template);
    if (template.variables.length > 0) {
      setVariableValues({});
      setShowUseTemplateModal(true);
    } else {
      navigator.clipboard.writeText(template.content);
      toast({ title: 'Template copiado!', description: 'Cole no chat para enviar.' });
    }
  };

  const handleDeleteTemplate = (templateId: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    toast({ title: 'Template excluído!' });
  };

  const handleSaveTemplate = () => {
    if (!templateTitle || !templateContent) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }

    const variablesMatch = templateContent.match(/\{\{(\w+)\}\}/g) || [];
    const variables = variablesMatch.map((v) => v.replace(/\{\{|\}\}/g, ''));

    if (isEditing && selectedTemplate) {
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === selectedTemplate.id
            ? { ...t, title: templateTitle, content: templateContent, category: templateCategory, folder: templateFolder, variables }
            : t
        )
      );
      toast({ title: 'Template atualizado!' });
    } else {
      const newTemplate: Template = {
        id: Date.now().toString(),
        title: templateTitle,
        content: templateContent,
        category: templateCategory,
        folder: templateFolder || 'Vendas',
        variables,
        usageCount: 0,
        isFavorite: false,
        hasAttachment: false,
        createdAt: new Date().toISOString(),
      };
      setTemplates((prev) => [...prev, newTemplate]);
      toast({ title: 'Template criado!' });
    }
    setShowTemplateModal(false);
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
            {categories.map((item) => (
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
                  {item.count}
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
                          {template.isFavorite && (
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
                        {template.hasAttachment ? (
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
                            onClick={() => handleUseTemplate(template)}
                            title="Usar"
                          >
                            <Send size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEditTemplate(template)}
                            title="Editar"
                          >
                            <Edit3 size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteTemplate(template.id)}
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

              {filteredTemplates.length === 0 && (
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

                {/* Folder */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Pasta
                  </label>
                  <select
                    value={templateFolder}
                    onChange={(e) => setTemplateFolder(e.target.value)}
                    className="w-full px-4 py-3 border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 bg-background"
                  >
                    <option value="">Nenhuma pasta</option>
                    <option value="Orçamentos">Orçamentos</option>
                    <option value="Vendas">Vendas</option>
                    <option value="Resgates">Resgates</option>
                    <option value="Apresentação">Apresentação</option>
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
            <Button variant="ghost" onClick={() => setShowTemplateModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveTemplate}>
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
            {selectedTemplate?.variables.map((variable) => (
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
