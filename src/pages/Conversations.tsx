import { useState } from 'react';
import {
  Search,
  Edit3,
  SlidersHorizontal,
  MessageSquare,
  MessageCircle,
  Phone,
  Video,
  MoreVertical,
  Smile,
  Paperclip,
  Mic,
  Send,
  Check,
  CheckCheck,
  X,
  Plus,
  Calendar,
  Mail,
  Clock,
  ChevronLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { StartConversation } from '@/components/conversations/StartConversation';

// Mock Data
const mockConversations = [
  {
    id: '1',
    contactName: 'Fernando TR Terraplanagem',
    lastMessage: 'Obg',
    timestamp: '15:19',
    isOnline: true,
    channel: 'whatsapp',
    isUnread: true,
    unreadCount: 3,
    phone: '+55 (21) 98533-2473',
    email: 'fernando@terra.com',
    leadStatus: 'negotiation',
    tags: ['Urgente', 'Follow-up'],
    department: 'Vendas',
    assignedTo: 'Diego',
    firstContact: '15/11/2025',
    lastInteraction: 'Hoje, 15:19',
  },
  {
    id: '2',
    contactName: 'Fernando Cofsevicz',
    lastMessage: 'Você: Pra começar o atendimento e já...',
    timestamp: '12:49',
    isOnline: true,
    channel: 'whatsapp',
    isUnread: false,
    unreadCount: 0,
    phone: '+55 (11) 99999-8888',
    email: 'cofsevicz@email.com',
    leadStatus: 'quoted',
    tags: ['Cliente'],
    department: 'Vendas',
    assignedTo: 'Ian',
    firstContact: '10/11/2025',
    lastInteraction: 'Hoje, 12:49',
  },
  {
    id: '3',
    contactName: 'Fernando Serpa',
    lastMessage: 'Você: Pra começar o atendimento e já...',
    timestamp: '06:53',
    isOnline: false,
    channel: 'whatsapp',
    isUnread: false,
    unreadCount: 0,
    phone: '+55 (31) 98765-4321',
    email: 'serpa@gmail.com',
    leadStatus: 'new',
    tags: [],
    department: 'Suporte',
    assignedTo: null,
    firstContact: '01/12/2025',
    lastInteraction: 'Hoje, 06:53',
  },
  {
    id: '4',
    contactName: 'Maria Silva',
    lastMessage: 'Qual o prazo de entrega?',
    timestamp: 'Ontem',
    isOnline: false,
    channel: 'whatsapp',
    isUnread: true,
    unreadCount: 1,
    phone: '+55 (21) 97777-6666',
    email: 'maria@empresa.com',
    leadStatus: 'in_progress',
    tags: ['VIP'],
    department: 'Vendas',
    assignedTo: 'Lara',
    firstContact: '20/11/2025',
    lastInteraction: 'Ontem, 18:30',
  },
  {
    id: '5',
    contactName: 'João Santos',
    lastMessage: 'Você: Segue o orçamento em anexo',
    timestamp: 'Ontem',
    isOnline: false,
    channel: 'email',
    isUnread: false,
    unreadCount: 0,
    phone: '+55 (11) 95555-4444',
    email: 'joao.santos@corp.com',
    leadStatus: 'quoted',
    tags: ['Empresa'],
    department: 'Vendas',
    assignedTo: 'Diego',
    firstContact: '05/11/2025',
    lastInteraction: 'Ontem, 14:22',
  },
];

const mockMessages = [
  {
    id: '1',
    senderId: 'contact',
    content: 'Olá, gostaria de fazer um orçamento de camisetas personalizadas',
    timestamp: '2025-12-03T15:10:00',
    status: 'read',
  },
  {
    id: '2',
    senderId: 'me',
    content: 'Olá! Claro, posso te ajudar. Quantas camisetas você precisa?',
    timestamp: '2025-12-03T15:11:00',
    status: 'read',
  },
  {
    id: '3',
    senderId: 'contact',
    content: 'Preciso de 50 camisetas com proteção UV para o time de futebol',
    timestamp: '2025-12-03T15:15:00',
    status: 'read',
  },
  {
    id: '4',
    senderId: 'me',
    content: 'Perfeito! Temos camisas UV50+ excelentes. Qual a cor e tamanho predominante?',
    timestamp: '2025-12-03T15:16:00',
    status: 'read',
  },
  {
    id: '5',
    senderId: 'contact',
    content: 'Seriam azul marinho, tamanhos variados de P ao GG',
    timestamp: '2025-12-03T15:17:00',
    status: 'read',
  },
  {
    id: '6',
    senderId: 'me',
    content: 'Ótimo! Vou preparar um orçamento detalhado e envio ainda hoje. Precisa de alguma arte ou já tem o design pronto?',
    timestamp: '2025-12-03T15:18:00',
    status: 'delivered',
  },
  {
    id: '7',
    senderId: 'contact',
    content: 'Obg',
    timestamp: '2025-12-03T15:19:00',
    status: 'read',
  },
];

// Conversation Item Component
interface ConversationItemProps {
  conversation: typeof mockConversations[0];
  isSelected: boolean;
  onClick: () => void;
}

function ConversationItem({ conversation, isSelected, onClick }: ConversationItemProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'p-4 border-b border-border/50 cursor-pointer transition-all duration-200',
        isSelected ? 'bg-accent' : conversation.isUnread ? 'bg-purple-50/50' : 'hover:bg-muted/50'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold shadow-md">
            {conversation.contactName.charAt(0)}
          </div>
          {conversation.isOnline && (
            <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-success rounded-full border-2 border-card"></div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className={cn(
              'text-sm truncate',
              conversation.isUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'
            )}>
              {conversation.contactName}
            </h3>
            <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
              {conversation.timestamp}
            </span>
          </div>

          <p className={cn(
            'text-sm truncate mb-2',
            conversation.isUnread ? 'text-foreground font-medium' : 'text-muted-foreground'
          )}>
            {conversation.lastMessage}
          </p>

          <div className="flex items-center justify-between">
            {/* Channel Badge */}
            <div className="flex items-center gap-2">
              {conversation.channel === 'whatsapp' && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-green-100 rounded-full">
                  <MessageCircle size={12} className="text-green-600" />
                  <span className="text-xs text-green-600 font-medium">WhatsApp</span>
                </div>
              )}
              {conversation.channel === 'email' && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 rounded-full">
                  <Mail size={12} className="text-blue-600" />
                  <span className="text-xs text-blue-600 font-medium">Email</span>
                </div>
              )}
            </div>

            {/* Unread Badge */}
            {conversation.isUnread && conversation.unreadCount > 0 && (
              <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                <span className="text-xs text-primary-foreground font-bold">{conversation.unreadCount}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Message Bubble Component
interface MessageBubbleProps {
  message: typeof mockMessages[0];
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isMe = message.senderId === 'me';

  return (
    <div className={cn('flex', isMe ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[70%] rounded-2xl px-4 py-3 shadow-sm',
          isMe
            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
            : 'bg-card border border-border text-foreground'
        )}
      >
        <p className="text-sm leading-relaxed">{message.content}</p>
        <div className={cn(
          'flex items-center justify-end gap-1 mt-1',
          isMe ? 'text-purple-200' : 'text-muted-foreground'
        )}>
          <span className="text-xs">
            {new Date(message.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {isMe && (
            <>
              {message.status === 'sent' && <Check size={14} />}
              {message.status === 'delivered' && <CheckCheck size={14} />}
              {message.status === 'read' && <CheckCheck size={14} className="text-blue-300" />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Conversations() {
  const [selectedConversation, setSelectedConversation] = useState<typeof mockConversations[0] | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState('all');
  const [sortFilter, setSortFilter] = useState('newest');
  const [quickFilter, setQuickFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const isMobile = useIsMobile();

  const filteredConversations = mockConversations.filter((conv) => {
    if (searchQuery && !conv.contactName.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (channelFilter !== 'all' && conv.channel !== channelFilter) {
      return false;
    }
    return true;
  });

  const handleSelectConversation = (conv: typeof mockConversations[0]) => {
    setSelectedConversation(conv);
    if (isMobile) {
      setShowMobileChat(true);
    }
  };

  const handleBackToList = () => {
    setShowMobileChat(false);
  };

  return (
    <div className="flex h-[calc(100vh-72px)] -m-6 md:-m-8 bg-background overflow-hidden">
      {/* Column 1: Conversations List */}
      <div className={cn(
        'w-full md:w-[350px] bg-card border-r border-border flex flex-col transition-all',
        isMobile && showMobileChat ? 'hidden' : 'flex'
      )}>
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-foreground">Conversas</h2>
            <button className="p-2 hover:bg-muted rounded-lg transition-colors">
              <Edit3 size={18} className="text-muted-foreground" />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar conversas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 rounded-xl bg-muted/50 border-border/50"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 py-3 border-b border-border space-y-3">
          <div className="flex items-center gap-2">
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="flex-1 h-10 rounded-lg">
                <SelectValue placeholder="Todos os canais" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os canais</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="email">Email</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortFilter} onValueChange={setSortFilter}>
              <SelectTrigger className="flex-1 h-10 rounded-lg">
                <SelectValue placeholder="Mais novas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Mais novas</SelectItem>
                <SelectItem value="oldest">Mais antigas</SelectItem>
                <SelectItem value="unread">Não lidas</SelectItem>
              </SelectContent>
            </Select>

            <button
              onClick={() => setShowFilters(true)}
              className="p-2.5 hover:bg-muted rounded-lg transition-colors"
            >
              <SlidersHorizontal size={18} className="text-muted-foreground" />
            </button>
          </div>

          {/* Quick Filters */}
          <div className="flex gap-2">
            {['all', 'mine', 'unassigned'].map((filter) => (
              <button
                key={filter}
                onClick={() => setQuickFilter(filter)}
                className={cn(
                  'flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors',
                  quickFilter === filter
                    ? 'text-primary bg-accent'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                {filter === 'all' ? 'Todas' : filter === 'mine' ? 'Minhas' : 'Não atribuídas'}
              </button>
            ))}
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isSelected={selectedConversation?.id === conv.id}
              onClick={() => handleSelectConversation(conv)}
            />
          ))}
        </div>
      </div>

      {/* Column 2: Chat Area */}
      <div className={cn(
        'flex-1 flex flex-col bg-background',
        isMobile && !showMobileChat ? 'hidden' : 'flex'
      )}>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="bg-card border-b border-border px-4 md:px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isMobile && (
                    <button onClick={handleBackToList} className="p-2 -ml-2 hover:bg-muted rounded-lg">
                      <ChevronLeft size={20} />
                    </button>
                  )}
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold shadow-md">
                      {selectedConversation.contactName.charAt(0)}
                    </div>
                    {selectedConversation.isOnline && (
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-success rounded-full border-2 border-card"></div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{selectedConversation.contactName}</h3>
                    <p className={cn(
                      'text-sm flex items-center gap-1',
                      selectedConversation.isOnline ? 'text-success' : 'text-muted-foreground'
                    )}>
                      {selectedConversation.isOnline && (
                        <span className="w-2 h-2 bg-success rounded-full animate-pulse"></span>
                      )}
                      {selectedConversation.isOnline ? 'Online' : 'Offline'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button className="p-2 hover:bg-muted rounded-lg transition-colors">
                    <Search size={20} className="text-muted-foreground" />
                  </button>
                  <button className="p-2 hover:bg-muted rounded-lg transition-colors">
                    <Phone size={20} className="text-muted-foreground" />
                  </button>
                  <button className="p-2 hover:bg-muted rounded-lg transition-colors hidden md:flex">
                    <Video size={20} className="text-muted-foreground" />
                  </button>
                  <button className="p-2 hover:bg-muted rounded-lg transition-colors">
                    <MoreVertical size={20} className="text-muted-foreground" />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
              {/* Date Separator */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-border"></div>
                <span className="text-xs text-muted-foreground font-medium px-2">Hoje</span>
                <div className="flex-1 h-px bg-border"></div>
              </div>

              {mockMessages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
            </div>

            {/* Message Input */}
            <div className="bg-card border-t border-border px-4 md:px-6 py-4">
              <div className="flex items-end gap-2 md:gap-3">
                <button className="p-2 hover:bg-muted rounded-lg transition-colors hidden md:flex">
                  <Smile size={22} className="text-muted-foreground" />
                </button>
                <button className="p-2 hover:bg-muted rounded-lg transition-colors">
                  <Paperclip size={22} className="text-muted-foreground" />
                </button>

                <div className="flex-1">
                  <Textarea
                    placeholder="Digite sua mensagem..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    className="min-h-[44px] max-h-[120px] resize-none rounded-xl bg-muted/50 border-border/50"
                    rows={1}
                  />
                </div>

                <button className="p-2 hover:bg-muted rounded-lg transition-colors hidden md:flex">
                  <Mic size={22} className="text-muted-foreground" />
                </button>
                <button className="p-3 btn-gradient text-white rounded-xl hover:shadow-lg transition-all">
                  <Send size={20} />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Empty State with Start Conversation */
          <StartConversation 
            onConversationCreated={(conversationId) => {
              // Find the conversation in mock data or reload
              const conv = mockConversations.find(c => c.id === conversationId);
              if (conv) {
                setSelectedConversation(conv);
              }
            }}
          />
        )}
      </div>

      {/* Column 3: Contact Details (Desktop Only) */}
      {selectedConversation && (
        <div className="hidden lg:flex w-[350px] bg-card border-l border-border flex-col overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Contact Header */}
            <div className="text-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4 shadow-xl">
                {selectedConversation.contactName.charAt(0)}
              </div>
              <h3 className="text-xl font-bold text-foreground mb-1">{selectedConversation.contactName}</h3>
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                <Phone size={14} />
                {selectedConversation.phone}
              </p>
              <button className="mt-3 px-4 py-2 text-sm text-primary hover:bg-accent rounded-lg transition-colors font-medium">
                Editar contato
              </button>
            </div>

            {/* Lead Status */}
            <div className="bg-muted/50 rounded-xl p-4">
              <label className="block text-sm font-medium text-foreground mb-2">
                Status Lead
              </label>
              <Select defaultValue={selectedConversation.leadStatus}>
                <SelectTrigger className="w-full rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Novo</SelectItem>
                  <SelectItem value="in_progress">Em atendimento</SelectItem>
                  <SelectItem value="quoted">Orçamento enviado</SelectItem>
                  <SelectItem value="negotiation">Negociação</SelectItem>
                  <SelectItem value="won">Fechado - Ganho</SelectItem>
                  <SelectItem value="lost">Fechado - Perdido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tags */}
            <div className="bg-muted/50 rounded-xl p-4">
              <label className="block text-sm font-medium text-foreground mb-3">
                Etiquetas
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {selectedConversation.tags.map((tag) => (
                  <span
                    key={tag}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1',
                      tag === 'Urgente' ? 'bg-red-100 text-red-700' :
                      tag === 'Follow-up' ? 'bg-yellow-100 text-yellow-700' :
                      tag === 'VIP' ? 'bg-purple-100 text-purple-700' :
                      'bg-blue-100 text-blue-700'
                    )}
                  >
                    {tag}
                    <X size={12} className="cursor-pointer hover:opacity-70" />
                  </span>
                ))}
                {selectedConversation.tags.length === 0 && (
                  <span className="text-sm text-muted-foreground">Nenhuma etiqueta</span>
                )}
              </div>
              <button className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1">
                <Plus size={14} />
                Adicionar etiqueta
              </button>
            </div>

            {/* Assigned To */}
            <div className="bg-muted/50 rounded-xl p-4">
              <label className="block text-sm font-medium text-foreground mb-2">
                Atendente Responsável
              </label>
              <Select defaultValue={selectedConversation.assignedTo || 'none'}>
                <SelectTrigger className="w-full rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não atribuído</SelectItem>
                  <SelectItem value="Diego">Diego</SelectItem>
                  <SelectItem value="Ian">Ian</SelectItem>
                  <SelectItem value="Lara">Lara</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Department */}
            <div className="bg-muted/50 rounded-xl p-4">
              <label className="block text-sm font-medium text-foreground mb-2">
                Departamento
              </label>
              <Select defaultValue={selectedConversation.department}>
                <SelectTrigger className="w-full rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Vendas">Vendas</SelectItem>
                  <SelectItem value="Pós-venda">Pós-venda</SelectItem>
                  <SelectItem value="Suporte">Suporte</SelectItem>
                  <SelectItem value="Financeiro">Financeiro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Additional Info */}
            <div className="bg-muted/50 rounded-xl p-4">
              <h4 className="text-sm font-medium text-foreground mb-3">Informações Adicionais</h4>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="text-foreground font-medium">{selectedConversation.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Primeiro contato:</span>
                  <span className="text-foreground font-medium">{selectedConversation.firstContact}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Última interação:</span>
                  <span className="text-foreground font-medium">{selectedConversation.lastInteraction}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-4 border-t border-border">
              <Button className="w-full btn-gradient text-white rounded-xl hover:shadow-lg">
                <Calendar size={18} className="mr-2" />
                Agendar mensagem
              </Button>
              <Button variant="outline" className="w-full rounded-xl border-destructive/50 text-destructive hover:bg-destructive/10">
                <X size={18} className="mr-2" />
                Fechar conversa
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Filters Modal */}
      <Dialog open={showFilters} onOpenChange={setShowFilters}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Filtros Avançados</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Filtrar por agente
              </label>
              <Select defaultValue="all">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="diego">Diego</SelectItem>
                  <SelectItem value="ian">Ian</SelectItem>
                  <SelectItem value="lara">Lara</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Filtrar por etiqueta
              </label>
              <div className="flex flex-wrap gap-2">
                {['Urgente', 'VIP', 'Follow-up', 'Cliente', 'Lead'].map((tag) => (
                  <button
                    key={tag}
                    className="px-3 py-1.5 border border-border rounded-lg text-sm hover:border-primary hover:bg-accent transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Número do Protocolo
              </label>
              <Input
                type="text"
                placeholder="Digite o protocolo..."
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Filas
              </label>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">
                  Fila 1
                </button>
                <button className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                  Fila 2
                </button>
                <button className="px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-lg text-sm font-medium">
                  Fila 3
                </button>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setShowFilters(false)}>
              Limpar
            </Button>
            <Button className="btn-gradient text-white" onClick={() => setShowFilters(false)}>
              Aplicar Filtros
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
