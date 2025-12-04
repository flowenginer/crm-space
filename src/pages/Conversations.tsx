import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Edit3,
  SlidersHorizontal,
  MessageCircle,
  Phone,
  Video,
  MoreVertical,
  Smile,
  Paperclip,
  Mic,
  MicOff,
  Send,
  Check,
  CheckCheck,
  X,
  Mail,
  ChevronLeft,
  Loader2,
  Calendar,
  StickyNote,
  FileIcon,
  Image,
  FileText,
  Upload,
  Reply,
  Trash2,
  CornerDownRight,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { StartConversation } from '@/components/conversations/StartConversation';
import { ConversationSidebar } from '@/components/conversations/ConversationSidebar';
import { ScheduleMessageModal } from '@/components/conversations/ScheduleMessageModal';
import { useConversations, useMessages, useSendMessage, useDeleteMessage, useReactToMessage, uploadAttachment, type Conversation, type Message, type AssignmentFilter } from '@/hooks/useConversations';
import { supabase } from '@/integrations/supabase/client';
import { useInternalNotes, useCreateInternalNote, type InternalNote } from '@/hooks/useInternalNotes';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { toast } from 'sonner';

// Mock Data for reference (will be replaced by real data)
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

// Conversation Item Component using real data
interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
}

function ConversationItem({ conversation, isSelected, onClick }: ConversationItemProps) {
  const contactName = conversation.contact?.full_name || 'Contato';
  const isOnline = conversation.contact?.is_online || false;
  const isUnread = conversation.is_unread || false;
  const unreadCount = conversation.unread_count || 0;
  
  const formatTime = (date: string | null) => {
    if (!date) return '';
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: false, locale: ptBR });
    } catch {
      return '';
    }
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'p-4 border-b border-border/50 cursor-pointer transition-all duration-200',
        isSelected ? 'bg-accent' : isUnread ? 'bg-purple-500/10' : 'hover:bg-muted/50'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold shadow-md">
            {contactName.charAt(0).toUpperCase()}
          </div>
          {isOnline && (
            <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-success rounded-full border-2 border-card"></div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className={cn(
              'text-sm truncate',
              isUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'
            )}>
              {contactName}
            </h3>
            <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
              {formatTime(conversation.last_message_at)}
            </span>
          </div>

          <p className={cn(
            'text-sm truncate mb-2',
            isUnread ? 'text-foreground font-medium' : 'text-muted-foreground'
          )}>
            {conversation.last_message_preview || 'Nova conversa'}
          </p>

          <div className="flex items-center justify-between">
            {/* Channel Badge */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 rounded-full">
                <MessageCircle size={12} className="text-green-500" />
                <span className="text-xs text-green-500 font-medium">
                  {conversation.channel?.name || 'Chat'}
                </span>
              </div>
            </div>

            {/* Unread Badge */}
            {isUnread && unreadCount > 0 && (
              <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                <span className="text-xs text-primary-foreground font-bold">{unreadCount}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Message Bubble Component using real data
interface MessageBubbleProps {
  message: Message;
  onReply?: (message: Message) => void;
  onDelete?: (messageId: string) => void;
  onReact?: (messageId: string, emoji: string) => void;
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

function MessageBubble({ message, onReply, onDelete, onReact }: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showFullEmojiPicker, setShowFullEmojiPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isMe = message.is_from_me;
  const hasMedia = message.media_url && message.message_type !== 'text';
  const isDeleted = message.is_deleted;
  const reactions = (message.reactions || []) as { emoji: string; user_id: string }[];
  const replyTo = message.reply_to?.[0];

  // Group reactions by emoji
  const groupedReactions = reactions.reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleEmojiReaction = (emojiData: EmojiClickData) => {
    onReact?.(message.id, emojiData.emoji);
    setShowFullEmojiPicker(false);
    setShowReactionPicker(false);
  };

  const handleConfirmDelete = () => {
    onDelete?.(message.id);
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <div 
        className={cn('flex group relative', isMe ? 'justify-end' : 'justify-start')}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => { 
          setShowActions(false); 
          setShowReactionPicker(false); 
          setShowFullEmojiPicker(false);
        }}
      >
        {/* Action buttons - left side for received messages */}
        {!isMe && showActions && !isDeleted && (
          <div className="flex items-center gap-1 mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Popover open={showReactionPicker} onOpenChange={setShowReactionPicker}>
              <PopoverTrigger asChild>
                <button 
                  className="p-1.5 hover:bg-muted rounded-full transition-colors"
                  title="Reagir"
                >
                  <Smile size={16} className="text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" side="top" align="start">
                {showFullEmojiPicker ? (
                  <EmojiPicker
                    onEmojiClick={handleEmojiReaction}
                    theme={Theme.AUTO}
                    lazyLoadEmojis
                    searchPlaceholder="Buscar emoji..."
                    width={320}
                    height={350}
                  />
                ) : (
                  <div className="p-2">
                    <div className="flex gap-1 mb-2">
                      {QUICK_REACTIONS.map(emoji => (
                        <button 
                          key={emoji}
                          onClick={() => { onReact?.(message.id, emoji); setShowReactionPicker(false); }}
                          className="text-xl hover:bg-muted p-1.5 rounded transition-colors"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setShowFullEmojiPicker(true)}
                      className="w-full text-xs text-muted-foreground hover:text-foreground py-1 border-t border-border"
                    >
                      Mais emojis...
                    </button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
            <button 
              onClick={() => onReply?.(message)}
              className="p-1.5 hover:bg-muted rounded-full transition-colors"
              title="Responder"
            >
              <Reply size={16} className="text-muted-foreground" />
            </button>
          </div>
        )}

        <div className="flex flex-col max-w-[70%]">
          {/* Reply reference */}
          {replyTo && !isDeleted && (
            <div 
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 mb-1 rounded-t-xl text-xs border-l-2',
                isMe 
                  ? 'bg-purple-700/30 border-purple-400 text-purple-200' 
                  : 'bg-muted/50 border-primary text-muted-foreground'
              )}
            >
              <CornerDownRight size={12} />
              <span className="truncate">
                {replyTo.is_deleted ? 'Mensagem apagada' : replyTo.content?.substring(0, 50) || 'Mídia'}
                {replyTo.content && replyTo.content.length > 50 ? '...' : ''}
              </span>
            </div>
          )}

          <div
            className={cn(
              'rounded-2xl px-4 py-3 shadow-sm',
              isMe
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                : 'bg-card border border-border text-foreground',
              isDeleted && 'opacity-60 italic'
            )}
          >
            {isDeleted ? (
              <p className="text-sm">🚫 Mensagem apagada</p>
            ) : (
              <>
                {/* Media content */}
                {hasMedia && (
                  <div className="mb-2">
                    {message.message_type === 'image' && (
                      <img 
                        src={message.media_url!} 
                        alt="Imagem" 
                        className="rounded-lg max-h-64 w-auto object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => window.open(message.media_url!, '_blank')}
                      />
                    )}
                    {message.message_type === 'video' && (
                      <video 
                        src={message.media_url!} 
                        controls 
                        className="rounded-lg max-h-64 w-full"
                      />
                    )}
                    {message.message_type === 'audio' && (
                      <audio 
                        src={message.media_url!} 
                        controls 
                        className="w-full min-w-[200px]"
                      />
                    )}
                    {message.message_type === 'document' && (
                      <a 
                        href={message.media_url!} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={cn(
                          'flex items-center gap-2 p-2 rounded-lg transition-colors',
                          isMe ? 'bg-white/10 hover:bg-white/20' : 'bg-muted hover:bg-muted/80'
                        )}
                      >
                        <FileText size={24} className={isMe ? 'text-white' : 'text-muted-foreground'} />
                        <span className="text-sm truncate">{message.content || 'Documento'}</span>
                      </a>
                    )}
                  </div>
                )}
                
                {/* Text content */}
                {message.content && message.message_type === 'text' && (
                  <p className="text-sm leading-relaxed">{message.content}</p>
                )}
                {message.content && message.message_type !== 'text' && message.message_type !== 'document' && (
                  <p className="text-sm leading-relaxed mt-1">{message.content}</p>
                )}
              </>
            )}
            
            <div className={cn(
              'flex items-center justify-end gap-1 mt-1',
              isMe ? 'text-purple-200' : 'text-muted-foreground'
            )}>
              <span className="text-xs">
                {new Date(message.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
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

          {/* Reactions display */}
          {Object.keys(groupedReactions).length > 0 && (
            <div className={cn('flex gap-1 mt-1', isMe ? 'justify-end' : 'justify-start')}>
              {Object.entries(groupedReactions).map(([emoji, count]) => (
                <span 
                  key={emoji} 
                  className="bg-muted/80 px-1.5 py-0.5 rounded-full text-xs flex items-center gap-0.5 cursor-pointer hover:bg-muted"
                  onClick={() => onReact?.(message.id, emoji)}
                >
                  {emoji} {count > 1 && <span className="text-muted-foreground">{count}</span>}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons - right side for sent messages */}
        {isMe && showActions && !isDeleted && (
          <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={() => onReply?.(message)}
              className="p-1.5 hover:bg-muted rounded-full transition-colors"
              title="Responder"
            >
              <Reply size={16} className="text-muted-foreground" />
            </button>
            <button 
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1.5 hover:bg-destructive/20 rounded-full transition-colors"
              title="Apagar"
            >
              <Trash2 size={16} className="text-destructive" />
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 size={20} className="text-destructive" />
              Apagar mensagem?
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja apagar esta mensagem? Esta ação não pode ser desfeita.
            </p>
            {message.content && (
              <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-border">
                <p className="text-sm text-foreground line-clamp-3">
                  {message.content}
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
            >
              Apagar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Internal Note Card Component
interface InternalNoteCardProps {
  note: InternalNote;
}

function InternalNoteCard({ note }: InternalNoteCardProps) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] bg-amber-400 dark:bg-amber-500 rounded-2xl rounded-tr-sm p-4 shadow-lg">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-amber-500/30 dark:border-amber-600/30">
          <StickyNote size={14} className="text-amber-800 dark:text-amber-900" />
          <span className="text-xs font-bold text-amber-800 dark:text-amber-900">
            Nota interna
          </span>
        </div>

        {/* Author */}
        <div className="text-sm font-semibold text-amber-900 mb-1">
          {note.author?.full_name || 'Equipe'}:
        </div>

        {/* Content */}
        <p className="text-amber-900 whitespace-pre-wrap text-sm">
          {note.content}
        </p>

        {/* Time */}
        <div className="text-right mt-2">
          <span className="text-xs text-amber-700 dark:text-amber-800">
            {format(new Date(note.created_at), 'HH:mm')}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Conversations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    searchParams.get('id')
  );
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState('all');
  const [sortFilter, setSortFilter] = useState('newest');
  const [quickFilter, setQuickFilter] = useState<'all' | 'mine' | 'unassigned'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [isInternalNoteMode, setIsInternalNoteMode] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const dragCounterRef = useRef(0);
  const isMobile = useIsMobile();

  // Fetch real conversations from database with filter
  const { data: conversations = [], isLoading: conversationsLoading } = useConversations(quickFilter);
  const { data: messages = [], isLoading: messagesLoading } = useMessages(selectedConversationId);
  const { data: internalNotes = [], isLoading: notesLoading } = useInternalNotes(selectedConversationId);
  const sendMessage = useSendMessage();
  const deleteMessage = useDeleteMessage();
  const reactToMessage = useReactToMessage();
  const createInternalNote = useCreateInternalNote();

  // Find selected conversation from real data
  const selectedConversation = conversations.find(c => c.id === selectedConversationId) || null;

  // Combine messages and internal notes, sorted by created_at
  const allChatItems = useMemo(() => {
    const msgItems = messages.map(m => ({ ...m, itemType: 'message' as const }));
    const noteItems = internalNotes.map(n => ({ ...n, itemType: 'note' as const }));
    return [...msgItems, ...noteItems].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [messages, internalNotes]);

  // Handle URL param for conversation selection
  useEffect(() => {
    const idFromUrl = searchParams.get('id');
    if (idFromUrl && idFromUrl !== selectedConversationId) {
      setSelectedConversationId(idFromUrl);
      if (isMobile) {
        setShowMobileChat(true);
      }
    }
  }, [searchParams]);

  // Filter conversations based on search
  const filteredConversations = conversations.filter((conv) => {
    const contactName = conv.contact?.full_name || '';
    if (searchQuery && !contactName.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const handleSelectConversation = (conv: Conversation) => {
    setSelectedConversationId(conv.id);
    setSearchParams({ id: conv.id });
    setIsInternalNoteMode(false);
    if (isMobile) {
      setShowMobileChat(true);
    }
  };

  const handleBackToList = () => {
    setShowMobileChat(false);
  };

  const handleSendMessage = async () => {
    if (!selectedConversationId) return;
    
    // Check if we have either text or files
    const hasText = messageInput.trim().length > 0;
    const hasFiles = selectedFiles.length > 0;
    
    if (!hasText && !hasFiles) return;
    
    if (isInternalNoteMode) {
      if (!hasText) return;
      createInternalNote.mutate({
        conversationId: selectedConversationId,
        content: messageInput.trim(),
      });
      setMessageInput('');
      setIsInternalNoteMode(false);
      return;
    }

    try {
      setIsUploading(true);
      
      // Send text message first if exists
      if (hasText && !hasFiles) {
        sendMessage.mutate({
          conversation_id: selectedConversationId,
          content: messageInput.trim(),
          is_from_me: true,
          message_type: 'text',
          reply_to_message_id: replyingTo?.id,
        });
        setMessageInput('');
        setReplyingTo(null);
      } else if (hasFiles) {
        // Send each file as a separate message
        for (const file of selectedFiles) {
          const result = await uploadAttachment(file, selectedConversationId);
          
          // Determine message type based on file type
          let messageType = 'document';
          if (file.type.startsWith('image/')) {
            messageType = 'image';
          } else if (file.type.startsWith('video/')) {
            messageType = 'video';
          } else if (file.type.startsWith('audio/')) {
            messageType = 'audio';
          }

          sendMessage.mutate({
            conversation_id: selectedConversationId,
            content: file.name,
            is_from_me: true,
            message_type: messageType,
            media_url: result.url,
            media_mime_type: result.mimeType,
            reply_to_message_id: replyingTo?.id,
          });
        }
        
        // Send text after files if exists
        if (hasText) {
          sendMessage.mutate({
            conversation_id: selectedConversationId,
            content: messageInput.trim(),
            is_from_me: true,
            message_type: 'text',
          });
        }
        
        setMessageInput('');
        setReplyingTo(null);
        clearSelectedFiles();
        toast.success(selectedFiles.length > 1 ? `${selectedFiles.length} arquivos enviados!` : 'Arquivo enviado!');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Erro ao enviar mensagem. Tente novamente.');
    } finally {
      setIsUploading(false);
    }
  };

  // Message action handlers
  const handleReplyMessage = (message: Message) => {
    setReplyingTo(message);
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!selectedConversationId) return;
    deleteMessage.mutate({ messageId, conversationId: selectedConversationId });
    toast.success('Mensagem apagada');
  };

  const handleReactToMessage = async (messageId: string, emoji: string) => {
    if (!selectedConversationId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    reactToMessage.mutate({ messageId, conversationId: selectedConversationId, emoji, userId: user.id });
  };

  // Emoji picker handler
  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setMessageInput(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  // File attachment handler
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const validFiles: File[] = [];
      const maxFiles = 10;
      const maxSize = 10 * 1024 * 1024; // 10MB

      Array.from(files).slice(0, maxFiles).forEach(file => {
        if (file.size > maxSize) {
          toast.error(`"${file.name}" é muito grande. Máximo: 10MB`);
        } else {
          validFiles.push(file);
        }
      });

      if (validFiles.length > 0) {
        setSelectedFiles(prev => [...prev, ...validFiles].slice(0, maxFiles));
        toast.success(`${validFiles.length} arquivo(s) selecionado(s)`);
      }
    }
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const clearSelectedFiles = () => {
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const validFiles: File[] = [];
      const maxFiles = 10;
      const maxSize = 10 * 1024 * 1024; // 10MB

      Array.from(files).slice(0, maxFiles).forEach(file => {
        if (file.size > maxSize) {
          toast.error(`"${file.name}" é muito grande. Máximo: 10MB`);
        } else {
          validFiles.push(file);
        }
      });

      if (validFiles.length > 0) {
        setSelectedFiles(prev => [...prev, ...validFiles].slice(0, maxFiles));
        toast.success(`${validFiles.length} arquivo(s) selecionado(s)`);
      }
    }
  };

  // Audio recording handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
        setSelectedFiles([audioFile]);
        toast.success('Áudio gravado com sucesso');
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start recording timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast.error('Não foi possível acessar o microfone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingTime(0);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
            {(['all', 'mine', 'unassigned'] as const).map((filter) => (
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
          {conversationsLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
              <MessageCircle size={40} className="mb-3 opacity-50" />
              <p className="text-sm">Nenhuma conversa encontrada</p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isSelected={selectedConversationId === conv.id}
                onClick={() => handleSelectConversation(conv)}
              />
            ))
          )}
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
                      {(selectedConversation.contact?.full_name || 'C').charAt(0).toUpperCase()}
                    </div>
                    {selectedConversation.contact?.is_online && (
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-success rounded-full border-2 border-card"></div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{selectedConversation.contact?.full_name || 'Contato'}</h3>
                    <p className={cn(
                      'text-sm flex items-center gap-1',
                      selectedConversation.contact?.is_online ? 'text-success' : 'text-muted-foreground'
                    )}>
                      {selectedConversation.contact?.is_online && (
                        <span className="w-2 h-2 bg-success rounded-full animate-pulse"></span>
                      )}
                      {selectedConversation.contact?.is_online ? 'Online' : 'Offline'}
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

            {/* Messages Area with Drag & Drop */}
            <div 
              className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 relative"
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              {/* Drag Overlay */}
              {isDragging && (
                <div className="absolute inset-0 z-50 bg-primary/10 backdrop-blur-sm border-2 border-dashed border-primary rounded-lg flex flex-col items-center justify-center">
                  <div className="bg-primary/20 p-6 rounded-full mb-4">
                    <Upload size={48} className="text-primary" />
                  </div>
                  <p className="text-lg font-semibold text-primary">Solte o arquivo aqui</p>
                  <p className="text-sm text-muted-foreground mt-1">Máximo: 10MB</p>
                </div>
              )}
              {(messagesLoading || notesLoading) ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : allChatItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <MessageCircle size={48} className="mb-4 opacity-50" />
                  <p>Nenhuma mensagem ainda</p>
                  <p className="text-sm">Envie a primeira mensagem</p>
                </div>
              ) : (
                <>
                  {/* Date Separator */}
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-border"></div>
                    <span className="text-xs text-muted-foreground font-medium px-2">Hoje</span>
                    <div className="flex-1 h-px bg-border"></div>
                  </div>

                  {allChatItems.map((item) => (
                    item.itemType === 'note' ? (
                      <InternalNoteCard key={`note-${item.id}`} note={item as InternalNote} />
                    ) : (
                      <MessageBubble 
                        key={`msg-${item.id}`} 
                        message={item as Message}
                        onReply={handleReplyMessage}
                        onDelete={handleDeleteMessage}
                        onReact={handleReactToMessage}
                      />
                    )
                  ))}
                </>
              )}
            </div>

            {/* Internal Note Mode Banner */}
            {isInternalNoteMode && (
              <div className="flex items-center justify-between px-4 py-2 bg-amber-500/20 border-y border-amber-500/30">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <StickyNote size={16} />
                  <span className="text-sm font-medium">Modo Nota Interna</span>
                  <span className="text-xs opacity-70">
                    (Apenas a equipe verá esta mensagem)
                  </span>
                </div>
                <button
                  onClick={() => setIsInternalNoteMode(false)}
                  className="p-1 hover:bg-amber-500/20 rounded"
                >
                  <X size={16} className="text-amber-600 dark:text-amber-400" />
                </button>
              </div>
            )}

            {/* Reply Preview */}
            {replyingTo && (
              <div className="flex items-center justify-between px-4 py-2 bg-primary/10 border-y border-primary/30">
                <div className="flex items-center gap-2 text-primary flex-1 min-w-0">
                  <Reply size={16} />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-medium">Respondendo</span>
                    <span className="text-xs opacity-70 truncate">
                      {replyingTo.content?.substring(0, 60) || 'Mídia'}
                      {replyingTo.content && replyingTo.content.length > 60 ? '...' : ''}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setReplyingTo(null)}
                  className="p-1 hover:bg-primary/20 rounded"
                >
                  <X size={16} className="text-primary" />
                </button>
              </div>
            )}

            {/* Selected Files Preview */}
            {selectedFiles.length > 0 && (
              <div className="px-4 py-2 bg-muted/50 border-y border-border space-y-2 max-h-32 overflow-y-auto">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {selectedFiles.length} arquivo(s) selecionado(s)
                  </span>
                  <button
                    onClick={clearSelectedFiles}
                    className="text-xs text-destructive hover:underline"
                  >
                    Limpar todos
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedFiles.map((file, index) => (
                    <div 
                      key={index}
                      className="flex items-center gap-1.5 bg-background rounded-lg px-2 py-1 border border-border"
                    >
                      {file.type.startsWith('image/') ? (
                        <Image size={14} className="text-blue-500" />
                      ) : file.type.startsWith('audio/') ? (
                        <Mic size={14} className="text-green-500" />
                      ) : file.type.startsWith('video/') ? (
                        <Video size={14} className="text-purple-500" />
                      ) : (
                        <FileIcon size={14} className="text-muted-foreground" />
                      )}
                      <span className="text-xs text-foreground truncate max-w-[120px]">
                        {file.name}
                      </span>
                      <button
                        onClick={() => removeFile(index)}
                        className="p-0.5 hover:bg-destructive/20 rounded"
                      >
                        <X size={12} className="text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Message Input */}
            <div className="bg-card border-t border-border px-4 md:px-6 py-4">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                onChange={handleFileSelect}
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              />

              {/* Recording UI */}
              {isRecording ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1 bg-destructive/10 rounded-xl px-4 py-3">
                    <div className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
                    <span className="text-destructive font-medium">Gravando...</span>
                    <span className="text-destructive font-mono">{formatRecordingTime(recordingTime)}</span>
                  </div>
                  <button
                    onClick={cancelRecording}
                    className="p-3 hover:bg-muted rounded-xl transition-colors"
                    title="Cancelar gravação"
                  >
                    <X size={22} className="text-muted-foreground" />
                  </button>
                  <button
                    onClick={stopRecording}
                    className="p-3 bg-destructive text-white rounded-xl hover:bg-destructive/90 transition-colors"
                    title="Parar e enviar"
                  >
                    <MicOff size={22} />
                  </button>
                </div>
              ) : (
                <div className="flex items-end gap-2 md:gap-3">
                  {/* Emoji Picker */}
                  <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                    <PopoverTrigger asChild>
                      <button 
                        className="p-2 hover:bg-muted rounded-lg transition-colors hidden md:flex"
                        title="Emoji"
                      >
                        <Smile size={22} className="text-muted-foreground" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 border-0" side="top" align="start">
                      <EmojiPicker
                        onEmojiClick={handleEmojiClick}
                        theme={Theme.AUTO}
                        lazyLoadEmojis
                        searchPlaceholder="Buscar emoji..."
                        width={320}
                        height={400}
                      />
                    </PopoverContent>
                  </Popover>

                  {/* Attachment Button */}
                  <button 
                    onClick={handleAttachmentClick}
                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                    title="Anexar arquivo"
                  >
                    <Paperclip size={22} className="text-muted-foreground" />
                  </button>

                  {/* Schedule Message */}
                  <button 
                    onClick={() => setShowScheduleModal(true)}
                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                    title="Agendar mensagem"
                  >
                    <Calendar size={22} className="text-muted-foreground" />
                  </button>

                  {/* Internal Note Button */}
                  <button
                    onClick={() => setIsInternalNoteMode(!isInternalNoteMode)}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      isInternalNoteMode 
                        ? 'bg-amber-500 text-white' 
                        : 'hover:bg-muted text-muted-foreground'
                    )}
                    title="Criar nota interna"
                  >
                    <StickyNote size={22} />
                  </button>

                  <div className="flex-1">
                    <Textarea
                      placeholder={isInternalNoteMode ? "Digite sua nota interna..." : "Digite sua mensagem..."}
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      className={cn(
                        'min-h-[44px] max-h-[120px] resize-none rounded-xl',
                        isInternalNoteMode
                          ? 'bg-amber-500/10 border-amber-500/30 placeholder:text-amber-600/50 dark:placeholder:text-amber-400/50'
                          : 'bg-muted/50 border-border/50'
                      )}
                      rows={1}
                    />
                  </div>

                  {/* Audio Recording Button */}
                  <button 
                    onClick={startRecording}
                    className="p-2 hover:bg-muted rounded-lg transition-colors hidden md:flex"
                    title="Gravar áudio"
                  >
                    <Mic size={22} className="text-muted-foreground" />
                  </button>

                  {/* Send Button */}
                  <button 
                    onClick={handleSendMessage}
                    disabled={(!messageInput.trim() && selectedFiles.length === 0) || sendMessage.isPending || createInternalNote.isPending || isUploading}
                    className={cn(
                      'p-3 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50',
                      isInternalNoteMode ? 'bg-amber-500 hover:bg-amber-600' : 'btn-gradient'
                    )}
                  >
                    {(sendMessage.isPending || createInternalNote.isPending || isUploading) 
                      ? <Loader2 size={20} className="animate-spin" /> 
                      : <Send size={20} />}
                  </button>
                </div>
              )}
            </div>

            {/* Schedule Message Modal */}
            <ScheduleMessageModal
              open={showScheduleModal}
              onClose={() => setShowScheduleModal(false)}
              contactId={selectedConversation.contact_id}
              conversationId={selectedConversation.id}
              channelId={selectedConversation.channel_id}
              contactName={selectedConversation.contact?.full_name}
            />
          </>
        ) : (
          /* Empty State with Start Conversation */
          <StartConversation 
            onConversationCreated={(conversationId) => {
              setSelectedConversationId(conversationId);
              setSearchParams({ id: conversationId });
            }}
          />
        )}
      </div>

      {/* Column 3: Contact Details (Desktop Only) */}
      {selectedConversation && (
        <div className="hidden lg:flex">
          <ConversationSidebar conversationId={selectedConversation.id} />
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
