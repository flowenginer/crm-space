import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
  ChevronDown,
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
  Download,
  Pencil,
  Pin,
  PinOff,
  Tag,
  Plus,
  Globe,
  Lock,
  Building2,
  RefreshCw,
  ArrowRightLeft,
  PenLine,
  CheckSquare,
  SquareCheck,
  Link2,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { AnimatedCounter } from '@/components/ui/animated-counter';
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
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { StartConversation } from '@/components/conversations/StartConversation';
import { ConversationSidebar } from '@/components/conversations/ConversationSidebar';
import { ScheduleMessageModal } from '@/components/conversations/ScheduleMessageModal';
import { QuickTemplatesPopover } from '@/components/conversations/QuickTemplatesPopover';
import { useConversations, useMessages, useSendMessage, useDeleteMessage, useEditMessage, useReactToMessage, uploadAttachment, updateMessageWhatsAppId, useUpdateConversation, type Conversation, type Message, type AssignmentFilter } from '@/hooks/useConversations';
import { usePaginatedConversations, useSortFilterCounts, type SortFilter, type ConversationFilters, type StatusFilter } from '@/hooks/usePaginatedConversations';
import { useConversationTotalCounts, useChannelCounts, useDateFilterCounts, useDepartmentCounts, useOriginCounts, useTagCounts, useAgentCounts, useNoTagCount, type CountFilters } from '@/hooks/useConversationCounts';
import { usePaginatedMessages, getAllPaginatedMessages } from '@/hooks/usePaginatedMessages';
import { supabase } from '@/integrations/supabase/client';
import { useInternalNotes, useCreateInternalNote, useUpdateInternalNote, type InternalNote } from '@/hooks/useInternalNotes';
import { useConversationEvents, useReturnConversation, type ConversationEvent } from '@/hooks/useConversationEvents';
import { TransferEventCard } from '@/components/conversations/TransferEventCard';
import { ReopenEventCard } from '@/components/conversations/ReopenEventCard';
import { CloseEventCard } from '@/components/conversations/CloseEventCard';
import { ShareEventCard } from '@/components/conversations/ShareEventCard';
import { ShareCancelledEventCard } from '@/components/conversations/ShareCancelledEventCard';
import { useRealtimeMessages, useRealtimeConversations, useRealtimeConversationEvents, useTypingIndicator } from '@/hooks/useRealtimeChat';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { sendWhatsAppMessage } from '@/lib/whatsapp/instance-creator';
import { formatDistanceToNow, format, isToday, isYesterday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { toast } from 'sonner';
import { useTeam } from '@/hooks/useTeam';
import { useTags, useAddTagToContact, useRemoveTagFromContact, useCreateTag, TagVisibility } from '@/hooks/useTags';
import { useDepartments } from '@/hooks/useDepartments';
import { useChannels } from '@/hooks/useChannels';
import { usePinnedConversations, useTogglePinConversation } from '@/hooks/usePinnedConversations';
import { useSharedConversations, useSharedConversationCounts, useSharedConversationIds, useAllSharedConversationIds, useMySharePermission } from '@/hooks/useSharedConversations';
import { useSharedConversationsWithDetails } from '@/hooks/useSharedConversationsWithDetails';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { useUserStore } from '@/store/userStore';
import { ContactRequestModal } from '@/components/conversations/ContactRequestModal';
import { ImagePreviewDialog } from '@/components/conversations/ImagePreviewDialog';
import { MediaDownloadButton } from '@/components/conversations/MediaDownloadButton';
import { DocumentPreview } from '@/components/conversations/DocumentPreview';
import { CallLogModal } from '@/components/conversations/CallLogModal';
import type { Profile } from '@/types';

// Helper function to format WhatsApp-style text (bold, italic, strikethrough) and linkify URLs
const formatWhatsAppText = (text: string): React.ReactNode => {
  if (!text) return null;
  
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  
  // First split by URLs to preserve them
  const urlParts = text.split(urlRegex);
  
  const processFormatting = (segment: string, segmentIndex: number): React.ReactNode[] => {
    const elements: React.ReactNode[] = [];
    let remaining = segment;
    let keyCounter = 0;
    
    // Combined regex for all WhatsApp formatting patterns
    // Order matters: we process in order of precedence
    const formatPatterns = [
      { regex: /\*([^*]+)\*/, tag: 'bold' },
      { regex: /_([^_]+)_/, tag: 'italic' },
      { regex: /~([^~]+)~/, tag: 'strikethrough' },
    ];
    
    while (remaining.length > 0) {
      let earliestMatch: { index: number; length: number; content: string; tag: string } | null = null;
      
      // Find the earliest formatting match
      for (const pattern of formatPatterns) {
        const match = remaining.match(pattern.regex);
        if (match && match.index !== undefined) {
          if (!earliestMatch || match.index < earliestMatch.index) {
            earliestMatch = {
              index: match.index,
              length: match[0].length,
              content: match[1],
              tag: pattern.tag,
            };
          }
        }
      }
      
      if (earliestMatch) {
        // Add text before the match
        if (earliestMatch.index > 0) {
          elements.push(remaining.slice(0, earliestMatch.index));
        }
        
        // Add the formatted element
        const key = `${segmentIndex}-${keyCounter++}`;
        const formattedContent = processFormatting(earliestMatch.content, segmentIndex);
        
        switch (earliestMatch.tag) {
          case 'bold':
            elements.push(<strong key={key}>{formattedContent}</strong>);
            break;
          case 'italic':
            elements.push(<em key={key}>{formattedContent}</em>);
            break;
          case 'strikethrough':
            elements.push(<del key={key} className="line-through">{formattedContent}</del>);
            break;
        }
        
        // Continue with the rest
        remaining = remaining.slice(earliestMatch.index + earliestMatch.length);
      } else {
        // No more formatting found, add remaining text
        elements.push(remaining);
        break;
      }
    }
    
    return elements;
  };
  
  return urlParts.map((part, index) => {
    // Check if this part is a URL
    if (urlRegex.test(part)) {
      return (
        <a
          key={`url-${index}`}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:opacity-80 break-all"
        >
          {part}
        </a>
      );
    }
    // Process WhatsApp formatting for non-URL parts
    return <span key={`text-${index}`}>{processFormatting(part, index)}</span>;
  });
};

// Alias for backwards compatibility
const linkifyText = formatWhatsAppText;

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
  isPinned: boolean;
  isShared: boolean;
  isNewTransfer: boolean;
  onClick: () => void;
  onTogglePin: () => void;
  isSelectionMode?: boolean;
  isChecked?: boolean;
  onToggleCheck?: () => void;
}

function ConversationItem({ conversation, isSelected, isPinned, isShared, isNewTransfer, onClick, onTogglePin, isSelectionMode, isChecked, onToggleCheck }: ConversationItemProps) {
  const contactName = conversation.contact?.full_name || 'Contato';
  const isOnline = conversation.contact?.is_online || false;
  const isUnread = conversation.is_unread || false;
  const unreadCount = conversation.unread_count || 0;
  const assigneeName = conversation.assignee?.full_name;
  const firstContactDate = conversation.contact?.first_contact_at || conversation.contact?.created_at;
  const reopenCount = (conversation as any).reopen_count || 0;
  
  const formatTime = (date: string | null) => {
    if (!date) return '';
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: false, locale: ptBR });
    } catch {
      return '';
    }
  };

  const formatFirstContact = (date: string | null) => {
    if (!date) return '';
    try {
      return format(new Date(date), 'dd/MM/yy');
    } catch {
      return '';
    }
  };

  const handleClick = () => {
    if (isSelectionMode && onToggleCheck) {
      onToggleCheck();
    } else {
      onClick();
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'p-4 border-b border-border/50 cursor-pointer transition-all duration-200 group',
        isSelectionMode && isChecked
          ? 'bg-primary/10 border-l-4 border-l-primary'
          : isSelected && !isSelectionMode
            ? 'bg-success/15 border-l-4 border-l-success'
            : isNewTransfer
              ? 'bg-emerald-500/20 border-l-4 border-l-emerald-500 animate-pulse'
              : isUnread 
                ? 'bg-[hsl(var(--unread-bg))] border-l-3 border-l-purple-400/60' 
                : 'hover:bg-muted/50'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Selection Checkbox or Avatar */}
        <div className="relative flex-shrink-0">
          {isSelectionMode ? (
            <div 
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center transition-all",
                isChecked 
                  ? "bg-primary" 
                  : "bg-muted border-2 border-border"
              )}
            >
              {isChecked && <Check size={24} className="text-primary-foreground" />}
            </div>
          ) : conversation.contact?.avatar_url ? (
            <img
              src={conversation.contact.avatar_url}
              alt={contactName}
              loading="lazy"
              className="w-12 h-12 rounded-full object-cover shadow-md"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold shadow-md">
              {contactName.charAt(0).toUpperCase()}
            </div>
          )}
          {isOnline && (
            <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-success rounded-full border-2 border-card"></div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1 group/header">
            <div className="flex items-center gap-1.5 min-w-0">
              {isPinned && (
                <Pin size={12} className="text-primary flex-shrink-0" />
              )}
              {isShared && (
                <Link2 size={12} className="text-blue-500 flex-shrink-0" />
              )}
              <h3 className={cn(
                'text-sm truncate',
                isUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'
              )}>
                {contactName}
              </h3>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0 ml-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePin();
                }}
                className="p-1 rounded hover:bg-muted transition-all"
                title={isPinned ? 'Desafixar' : 'Fixar'}
              >
                {isPinned ? (
                  <PinOff size={14} className="text-green-500" />
                ) : (
                  <Pin size={14} className="text-muted-foreground" />
                )}
              </button>
              <span className="text-xs text-muted-foreground">
                {formatTime(conversation.last_message_at)}
              </span>
            </div>
          </div>

          <p className={cn(
            'text-sm truncate mb-2',
            isUnread ? 'text-foreground font-medium' : 'text-muted-foreground'
          )}>
            {conversation.last_message_preview ? (
              <>
                <span className={cn(
                  'font-medium',
                  conversation.last_message_is_from_me ? 'text-primary' : 'text-muted-foreground'
                )}>
                  {conversation.last_message_is_from_me 
                    ? (assigneeName ? assigneeName.split(' ')[0] : 'Você') 
                    : 'Cliente'}:
                </span>{' '}
                {conversation.last_message_preview}
              </>
            ) : (
              'Nova conversa'
            )}
          </p>

          <div className="flex items-center justify-between gap-2">
            {/* Channel Badge */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 rounded-full">
                <MessageCircle size={12} className="text-green-500" />
                <span className="text-xs text-green-500 font-medium truncate max-w-[80px]">
                  {conversation.channel?.name || 'Chat'}
                </span>
              </div>
              
              {/* Assignee Badge */}
              {assigneeName && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 rounded-full">
                  <span className="text-xs text-blue-500 font-medium truncate max-w-[60px]">
                    {assigneeName.split(' ')[0]}
                  </span>
                </div>
              )}
              
              {/* Meta Ads Badge */}
              {(conversation.referral_source === 'meta_ads' || conversation.contact?.origin === 'meta_ads') && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-600/20 rounded-full" title={conversation.referral_data?.headline || conversation.contact?.origin_campaign || 'Meta Ads'}>
                  <svg className="w-3 h-3 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  <span className="text-xs text-blue-600 font-medium">Ads</span>
                </div>
              )}
              
              {/* Reopen Badge */}
              {reopenCount > 0 && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 rounded-full" title={`Reaberta ${reopenCount}x`}>
                  <RefreshCw size={10} className="text-amber-600 dark:text-amber-400" />
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    {reopenCount}x
                  </span>
                </div>
              )}
              
              {/* Transfer Badge */}
              {isNewTransfer && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/30 rounded-full">
                  <ArrowRightLeft size={10} className="text-emerald-600" />
                  <span className="text-xs text-emerald-600 font-medium">Transferida</span>
                </div>
              )}
              
              {/* First Contact Date */}
              {firstContactDate && (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-muted rounded-full">
                  <Calendar size={10} className="text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {formatFirstContact(firstContactDate)}
                  </span>
                </div>
              )}
            </div>

            {/* Unread Badge */}
            {isUnread && unreadCount > 0 && (
              <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
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
  onDelete?: (message: Message) => void;
  onEdit?: (message: Message, newText: string) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onScrollToMessage?: (messageId: string) => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (messageId: string) => void;
  onEnterSelectionMode?: (message: Message) => void;
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

function MessageBubble({ message, onReply, onDelete, onEdit, onReact, onScrollToMessage, isSelectionMode, isSelected, onToggleSelect, onEnterSelectionMode }: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showFullEmojiPicker, setShowFullEmojiPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editText, setEditText] = useState(message.content || '');
  const [showImagePreview, setShowImagePreview] = useState(false);
  const isMe = message.is_from_me;
  const hasMedia = message.media_url && message.message_type !== 'text';
  const isDeleted = message.is_deleted;
  const isTextMessage = message.message_type === 'text';
  const reactions = (message.reactions || []) as { emoji: string; user_id: string; from_contact?: boolean }[];
  const replyTo = message.reply_to?.[0];

  // Group reactions by emoji, keeping track of source
  const groupedReactions = reactions.reduce((acc, r) => {
    if (!acc[r.emoji]) {
      acc[r.emoji] = { count: 0, fromContact: false, fromAgent: false };
    }
    acc[r.emoji].count += 1;
    if (r.from_contact) {
      acc[r.emoji].fromContact = true;
    } else {
      acc[r.emoji].fromAgent = true;
    }
    return acc;
  }, {} as Record<string, { count: number; fromContact: boolean; fromAgent: boolean }>);

  const handleEmojiReaction = (emojiData: EmojiClickData) => {
    onReact?.(message.id, emojiData.emoji);
    setShowFullEmojiPicker(false);
    setShowReactionPicker(false);
  };

  const handleConfirmDelete = () => {
    onDelete?.(message);
    setShowDeleteConfirm(false);
  };

  const handleConfirmEdit = () => {
    if (editText.trim() && editText.trim() !== message.content) {
      onEdit?.(message, editText.trim());
    }
    setShowEditDialog(false);
  };

  const openEditDialog = () => {
    setEditText(message.content || '');
    setShowEditDialog(true);
  };

  const handleDeleteClick = () => {
    // Enter selection mode with this message selected
    onEnterSelectionMode?.(message);
  };

  return (
    <>
      <div 
        data-message-id={message.id}
        className={cn(
          'flex group items-end gap-1', 
          isMe ? 'justify-end' : 'justify-start',
          isSelectionMode && 'cursor-pointer'
        )}
        onMouseEnter={() => !isSelectionMode && setShowActions(true)}
        onMouseLeave={() => { 
          setShowActions(false); 
          setShowReactionPicker(false); 
          setShowFullEmojiPicker(false);
        }}
        onClick={isSelectionMode ? () => onToggleSelect?.(message.id) : undefined}
      >
        {/* Checkbox for selection mode */}
        {isSelectionMode && (
          <div className={cn(
            'flex items-center justify-center w-6 h-6 rounded-full border-2 transition-all mr-2 mb-2 flex-shrink-0',
            isSelected 
              ? 'bg-primary border-primary' 
              : 'border-muted-foreground/40 hover:border-primary/60'
          )}>
            {isSelected && <Check size={14} className="text-primary-foreground" />}
          </div>
        )}
        
        {/* Action buttons - left side for sent messages */}
        {isMe && !isDeleted && !isSelectionMode && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity mb-2">
            <button 
              onClick={handleDeleteClick}
              className="p-1.5 hover:bg-destructive/20 rounded-full transition-colors"
              title="Apagar (clique para selecionar múltiplas)"
            >
              <Trash2 size={14} className="text-muted-foreground hover:text-destructive" />
            </button>
            {isTextMessage && (
              <button 
                onClick={openEditDialog}
                className="p-1.5 hover:bg-muted rounded-full transition-colors"
                title="Editar"
              >
                <Pencil size={14} className="text-muted-foreground" />
              </button>
            )}
            <button 
              onClick={() => onReply?.(message)}
              className="p-1.5 hover:bg-muted rounded-full transition-colors"
              title="Responder"
            >
              <Reply size={14} className="text-muted-foreground" />
            </button>
          </div>
        )}

        <div className="flex flex-col max-w-[70%]">
          {/* Reply reference - clickable to scroll to original message */}
          {replyTo && !isDeleted && (
            <div 
              onClick={() => onScrollToMessage?.(message.reply_to_message_id!)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 mb-1 rounded-t-xl text-xs border-l-2 cursor-pointer transition-colors',
                isMe 
                  ? 'bg-purple-700/30 border-purple-400 text-purple-200 hover:bg-purple-700/50' 
                  : 'bg-muted/50 border-primary text-muted-foreground hover:bg-muted'
              )}
            >
              <CornerDownRight size={12} className="flex-shrink-0" />
              {/* Image thumbnail for image replies */}
              {replyTo.message_type === 'image' && replyTo.media_url && (
                <img 
                  src={replyTo.media_url} 
                  alt="Imagem" 
                  className="w-8 h-8 rounded object-cover flex-shrink-0"
                />
              )}
              {/* Sticker thumbnail for sticker replies */}
              {replyTo.message_type === 'sticker' && replyTo.media_url && (
                <img 
                  src={replyTo.media_url} 
                  alt="Sticker" 
                  className="w-8 h-8 object-contain flex-shrink-0"
                />
              )}
              <span className="truncate">
                {replyTo.is_deleted 
                  ? 'Mensagem apagada' 
                  : replyTo.message_type === 'image'
                    ? (replyTo.content && replyTo.content !== '[Imagem]' ? replyTo.content.substring(0, 50) : 'Imagem')
                    : replyTo.message_type === 'audio'
                      ? '🎤 Áudio'
                      : replyTo.message_type === 'video'
                        ? '🎬 Vídeo'
                        : replyTo.message_type === 'document'
                          ? '📄 Documento'
                          : replyTo.message_type === 'sticker'
                            ? '🎭 Sticker'
                            : (replyTo.content?.substring(0, 50) || 'Mídia')}
                {replyTo.message_type === 'text' && replyTo.content && replyTo.content.length > 50 ? '...' : ''}
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
                      <div className="relative group/media inline-block">
                        <img 
                          src={message.media_url!} 
                          alt="Imagem" 
                          className="rounded-lg max-h-64 w-auto object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setShowImagePreview(true)}
                          loading="lazy"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            target.parentElement?.insertAdjacentHTML('beforeend', 
                              '<div class="flex items-center gap-2 p-3 bg-muted/50 rounded-lg"><span class="text-sm text-muted-foreground">Imagem não disponível</span></div>'
                            );
                          }}
                        />
                        <MediaDownloadButton
                          url={message.media_url!}
                          fileName={message.content || 'imagem'}
                          className="absolute top-2 right-2 opacity-0 group-hover/media:opacity-100 transition-opacity"
                        />
                      </div>
                    )}
                    {message.message_type === 'video' && (
                      <div className="relative group/media">
                        <video 
                          src={message.media_url!} 
                          controls 
                          preload="metadata"
                          className="rounded-lg max-h-64 w-full bg-black"
                          onError={(e) => {
                            const target = e.target as HTMLVideoElement;
                            target.style.display = 'none';
                            target.parentElement?.insertAdjacentHTML('beforeend', 
                              '<div class="flex items-center gap-2 p-3 bg-muted/50 rounded-lg"><span class="text-sm text-muted-foreground">🎬 Vídeo não disponível</span></div>'
                            );
                          }}
                        >
                          <source src={message.media_url!} />
                          Seu navegador não suporta vídeos.
                        </video>
                        <MediaDownloadButton
                          url={message.media_url!}
                          fileName={message.content || 'video'}
                          className="absolute top-2 right-2 opacity-0 group-hover/media:opacity-100 transition-opacity"
                        />
                      </div>
                    )}
                    {message.message_type === 'audio' && (
                      <div className="relative group/media flex items-center gap-2">
                        <audio 
                          src={message.media_url!} 
                          controls 
                          className="flex-1 min-w-[200px]"
                        />
                        <MediaDownloadButton
                          url={message.media_url!}
                          fileName={message.content || 'audio'}
                          className="opacity-0 group-hover/media:opacity-100 transition-opacity flex-shrink-0"
                        />
                      </div>
                    )}
                    {message.message_type === 'document' && (
                      <DocumentPreview 
                        url={message.media_url!} 
                        fileName={message.content || 'Documento'} 
                        isMe={isMe}
                      />
                    )}
                    {message.message_type === 'sticker' && message.media_url && (
                      <img 
                        src={message.media_url} 
                        alt="Sticker" 
                        className="max-h-32 w-auto object-contain"
                        loading="lazy"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.parentElement?.insertAdjacentHTML('beforeend', 
                            '<span class="text-sm text-muted-foreground">🎭 Sticker</span>'
                          );
                        }}
                      />
                    )}
                  </div>
                )}
                
                {/* Text content */}
                {message.content && message.message_type === 'text' && (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{linkifyText(message.content)}</p>
                )}
                
                {/* Caption for images */}
                {message.message_type === 'image' && message.content && message.content !== '[Imagem]' && (
                  <p className="text-sm leading-relaxed mt-2 whitespace-pre-wrap">{linkifyText(message.content)}</p>
                )}
                
                {/* Caption for videos */}
                {message.message_type === 'video' && message.content && message.content !== '[Vídeo]' && (
                  <p className="text-sm leading-relaxed mt-2 whitespace-pre-wrap">{linkifyText(message.content)}</p>
                )}
                
                {/* Other message types with content */}
                {message.content && !['text', 'document', 'audio', 'video', 'image'].includes(message.message_type || '') && (
                  <p className="text-sm leading-relaxed mt-1 whitespace-pre-wrap">{linkifyText(message.content)}</p>
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
                <span className="flex items-center">
                  {message.status === 'failed' && <X size={14} className="text-red-400" />}
                  {message.status === 'pending' && <Loader2 size={14} className="animate-spin opacity-70" />}
                  {(message.status === 'sent' || !message.status) && <Check size={14} />}
                  {message.status === 'delivered' && <CheckCheck size={14} />}
                  {message.status === 'read' && <CheckCheck size={14} className="text-blue-400" />}
                </span>
              )}
            </div>
          </div>

          {/* Reactions display */}
          {Object.keys(groupedReactions).length > 0 && (
            <div className={cn('flex gap-1 mt-1', isMe ? 'justify-end' : 'justify-start')}>
              {Object.entries(groupedReactions).map(([emoji, data]) => (
                <span 
                  key={emoji} 
                  className={cn(
                    "px-1.5 py-0.5 rounded-full text-xs flex items-center gap-0.5 cursor-pointer transition-colors",
                    data.fromContact 
                      ? "bg-blue-500/20 hover:bg-blue-500/30 ring-1 ring-blue-500/30" 
                      : "bg-muted/80 hover:bg-muted"
                  )}
                  onClick={() => onReact?.(message.id, emoji)}
                  title={data.fromContact ? 'Reação do contato' : 'Sua reação'}
                >
                  {emoji} {data.count > 1 && <span className="text-muted-foreground">{data.count}</span>}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons - right side for received messages */}
        {!isMe && !isDeleted && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity mb-2">
            <button 
              onClick={() => onReply?.(message)}
              className="p-1.5 hover:bg-muted rounded-full transition-colors"
              title="Responder"
            >
              <Reply size={14} className="text-muted-foreground" />
            </button>
            <Popover open={showReactionPicker} onOpenChange={setShowReactionPicker}>
              <PopoverTrigger asChild>
                <button 
                  className="p-1.5 hover:bg-muted rounded-full transition-colors"
                  title="Reagir"
                >
                  <Smile size={14} className="text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" side="top" align="end">
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

      {/* Edit Message Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil size={20} className="text-primary" />
              Editar mensagem
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              placeholder="Digite a nova mensagem..."
              className="min-h-[100px] resize-none"
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmEdit}
              disabled={!editText.trim() || editText.trim() === message.content}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Preview Dialog with Zoom */}
      <ImagePreviewDialog
        open={showImagePreview}
        onOpenChange={setShowImagePreview}
        imageUrl={message.media_url || ''}
        imageName={message.content || undefined}
      />
    </>
  );
}

// Internal Note Card Component
interface InternalNoteCardProps {
  note: InternalNote;
  onUpdate: (noteId: string, content: string) => void;
}

function InternalNoteCard({ note, onUpdate }: InternalNoteCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(note.content);

  const handleSave = () => {
    if (editContent.trim() && editContent !== note.content) {
      onUpdate(note.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditContent(note.content);
    setIsEditing(false);
  };

  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] bg-amber-400 dark:bg-amber-500 rounded-2xl rounded-tr-sm p-4 shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-amber-500/30 dark:border-amber-600/30">
          <div className="flex items-center gap-2">
            <StickyNote size={14} className="text-amber-800 dark:text-amber-900" />
            <span className="text-xs font-bold text-amber-800 dark:text-amber-900">
              Nota interna
            </span>
          </div>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="p-1 hover:bg-amber-500/50 rounded transition-colors"
              title="Editar nota"
            >
              <Pencil size={12} className="text-amber-800 dark:text-amber-900" />
            </button>
          )}
        </div>

        {/* Author */}
        <div className="text-sm font-semibold text-amber-900 mb-1">
          {note.author?.full_name || 'Equipe'}:
        </div>

        {/* Content */}
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[60px] bg-amber-100 border-amber-600 text-amber-900 text-sm resize-none"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancel}
                className="h-7 px-2 text-xs text-amber-800 hover:bg-amber-500/50"
              >
                <X size={12} className="mr-1" />
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                className="h-7 px-2 text-xs bg-amber-600 hover:bg-amber-700 text-white"
              >
                <Check size={12} className="mr-1" />
                Salvar
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-amber-900 whitespace-pre-wrap text-sm">
            {note.content}
          </p>
        )}

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
  // DEBUG: Log every render with timestamp
  console.log('[DEBUG] 🔄 Conversations RENDER', {
    timestamp: new Date().toISOString(),
    url: window.location.href,
    pathname: window.location.pathname,
    search: window.location.search
  });

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // Derive selected conversation ID directly from URL - no state needed
  const selectedConversationId = searchParams.get('id');
  
  // DEBUG: Log searchParams changes
  console.log('[DEBUG] 📍 searchParams:', {
    id: selectedConversationId,
    fullSearch: searchParams.toString()
  });
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [customDateRange, setCustomDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [sortFilter, setSortFilter] = useState<SortFilter>('newest');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [quickFilter, setQuickFilter] = useState<'all' | 'mine' | 'unassigned' | 'pinned' | 'pending' | 'shared'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(!!searchParams.get('id'));
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showCallLogModal, setShowCallLogModal] = useState(false);
  const [isInternalNoteMode, setIsInternalNoteMode] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showMessageSearch, setShowMessageSearch] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [advancedFilters, setAdvancedFilters] = useState({
    agentId: 'all',
    tagIds: [] as string[],
    protocolNumber: '',
    departmentId: 'all',
    origin: 'all' as 'all' | 'meta_ads' | 'whatsapp',
  });
const [showHeaderTagPopover, setShowHeaderTagPopover] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [filterTagSearchQuery, setFilterTagSearchQuery] = useState('');
  const [showCreateTagModal, setShowCreateTagModal] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#8B5CF6');
  const [newTagDescription, setNewTagDescription] = useState('');
  const [newTagVisibility, setNewTagVisibility] = useState<TagVisibility>('public');
  const [newTagDepartmentId, setNewTagDepartmentId] = useState('');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const [isConversationSelectionMode, setIsConversationSelectionMode] = useState(false);
  const [selectedConversationIds, setSelectedConversationIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const dragCounterRef = useRef<number>(0);
  const isSendingRef = useRef(false);
  const recordingCancelledRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const conversationListRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  // Usar Map com timestamp para proteção temporal (5 segundos de proteção)
  const markedUnreadAtRef = useRef<Map<string, number>>(new Map());

  // Função para redimensionar o textarea baseado no conteúdo
  const resizeTextarea = useCallback(() => {
    if (messageInputRef.current) {
      const textarea = messageInputRef.current;
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, []);

  // Auto-resize quando messageInput muda (ex: inserção de mensagem rápida)
  useEffect(() => {
    requestAnimationFrame(() => {
      resizeTextarea();
    });
  }, [messageInput, resizeTextarea]);
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
const { isAdmin, isSupervisor, profile, isFullyLoaded, hasPermission, canViewAllConversations } = usePermissions();
  const { profile: authProfile, user } = useAuth();
  const { setProfile } = useUserStore();
  
  // Forçar reload do profile do banco para garantir signature_name e signature_enabled atualizados
  useEffect(() => {
    const refreshProfile = async () => {
      if (user?.id) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (data) {
          setProfile(data as Profile);
        }
      }
    };
    refreshProfile();
  }, [user?.id, setProfile]);
  
  // Acesso total: admin, supervisor, ou usuários com permissão especial (individual ou do departamento)
  const canAccessAllConversations = canViewAllConversations;
  
  // Permissão para ver conversas não atribuídas (admins, supervisores ou com permissão específica)
  const canViewUnassigned = canAccessAllConversations || hasPermission('conversations', 'view_unassigned');
  
  // Permissão para ver conversas pendentes do departamento
  const canViewPending = canAccessAllConversations || hasPermission('conversations', 'view_pending');
  
  // Filtros disponíveis baseados nas permissões
  const availableQuickFilters = useMemo(() => {
    const filters: ('all' | 'pinned' | 'shared' | 'mine' | 'pending' | 'unassigned')[] = ['all', 'pinned', 'shared', 'mine'];
    
    if (canViewPending) {
      filters.push('pending');
    }
    
    if (canViewUnassigned) {
      filters.push('unassigned');
    }
    
    return filters;
  }, [canViewPending, canViewUnassigned]);

  // Modal de solicitação de acesso
  const [showContactRequestModal, setShowContactRequestModal] = useState(false);
  const [blockedContact, setBlockedContact] = useState<{ id: string; full_name: string; phone: string } | null>(null);
  const [blockedByAgent, setBlockedByAgent] = useState<{ id: string; full_name: string | null; avatar_url: string | null } | null>(null);
  const [blockedConversationId, setBlockedConversationId] = useState<string | null>(null);

  // Debounce search query for server-side search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Build filters for server-side filtering and sorting
  const conversationFilters: ConversationFilters = useMemo(() => ({
    assignment: (quickFilter === 'pinned' || quickFilter === 'shared') ? 'all' : quickFilter === 'pending' ? 'pending' : quickFilter,
    sortBy: (sortFilter === 'newest' || sortFilter === 'oldest' || sortFilter === 'unread') ? sortFilter : 'newest',
    channelId: channelFilter !== 'all' ? channelFilter : undefined,
    isUnread: sortFilter === 'unread' ? true : undefined,
    // Filtros avançados - aplicados no servidor
    departmentId: advancedFilters.departmentId !== 'all' ? advancedFilters.departmentId : undefined,
    agentId: advancedFilters.agentId !== 'all' ? advancedFilters.agentId : undefined,
    origin: advancedFilters.origin !== 'all' ? advancedFilters.origin : undefined,
    dateFilter: dateFilter !== 'all' ? dateFilter : undefined,
    customDateFrom: customDateRange.from,
    customDateTo: customDateRange.to,
    // Filtro por tags - aplicado no servidor via contact_tags
    tagIds: advancedFilters.tagIds.length > 0 ? advancedFilters.tagIds : undefined,
    // Busca por telefone ou nome - direto no banco
    searchQuery: debouncedSearchQuery || undefined,
    // Filtro de status da conversa
    statusFilter: statusFilter,
    // Permissões - para filtrar conversas quando assignment é 'all'
    canViewPending,
    canViewUnassigned,
  }), [quickFilter, sortFilter, channelFilter, advancedFilters.departmentId, advancedFilters.agentId, advancedFilters.origin, advancedFilters.tagIds, dateFilter, customDateRange.from, customDateRange.to, debouncedSearchQuery, statusFilter, canViewPending, canViewUnassigned]);

  // Fetch real conversations from database with filter (PAGINATED + SERVER SORTED)
  const { 
    data: conversationsData, 
    isLoading: conversationsLoading,
    fetchNextPage: fetchNextConversations,
    hasNextPage: hasMoreConversations,
    isFetchingNextPage: isFetchingMoreConversations,
  } = usePaginatedConversations(conversationFilters);

  // Build filters for contextual counts - TODOS os filtros ativos
  const countFilters: CountFilters = useMemo(() => ({
    departmentId: advancedFilters.departmentId !== 'all' ? advancedFilters.departmentId : undefined,
    agentId: advancedFilters.agentId !== 'all' ? advancedFilters.agentId : undefined,
    origin: advancedFilters.origin !== 'all' ? advancedFilters.origin as 'meta_ads' | 'organic' : undefined,
    channelId: channelFilter !== 'all' ? channelFilter : undefined,
    // Filtros adicionais que agora são aplicados:
    dateFilter: dateFilter !== 'all' ? dateFilter : undefined,
    customDateFrom: customDateRange.from,
    customDateTo: customDateRange.to,
    sortFilter: (sortFilter !== 'newest' && sortFilter !== 'oldest') ? sortFilter : undefined,
    tagId: advancedFilters.tagIds.length === 1 ? advancedFilters.tagIds[0] : undefined, // Single tag filter
    statusFilter: statusFilter, // Status filter for conversation counts
  }), [advancedFilters.departmentId, advancedFilters.agentId, advancedFilters.origin, advancedFilters.tagIds, channelFilter, dateFilter, customDateRange.from, customDateRange.to, sortFilter, statusFilter]);

  // Filters for each count type (excluding self to avoid circular filtering)
  const deptCountFilters: CountFilters = useMemo(() => ({ ...countFilters, departmentId: undefined }), [countFilters]);
  const agentCountFilters: CountFilters = useMemo(() => ({ ...countFilters, agentId: undefined }), [countFilters]);
  const originCountFilters: CountFilters = useMemo(() => ({ ...countFilters, origin: undefined }), [countFilters]);
  const channelCountFilters: CountFilters = useMemo(() => ({ ...countFilters, channelId: undefined }), [countFilters]);
  // Tags mantém todos os filtros (agentId, departmentId, etc.) mas exclui tagId
  const tagCountFilters: CountFilters = useMemo(() => ({ ...countFilters, tagId: undefined }), [countFilters]);

  // Fetch REAL counts from database with contextual filters
  const { data: totalCounts } = useConversationTotalCounts(countFilters);
  const { data: channelCountsData } = useChannelCounts(channelCountFilters);
  const { data: dateFilterCountsData } = useDateFilterCounts(countFilters);
  const { data: departmentCountsData } = useDepartmentCounts(deptCountFilters);
  const { data: originCountsData } = useOriginCounts(originCountFilters);
  const { data: tagCountsData } = useTagCounts(tagCountFilters);
  const { data: absoluteTagCountsData } = useTagCounts(); // Contagens absolutas sem filtros para o modal
  const { data: noTagCount } = useNoTagCount(tagCountFilters); // Contagem de conversas sem etiqueta
  const { data: agentCountsData } = useAgentCounts(agentCountFilters);
  const { data: sortFilterCountsFromDb } = useSortFilterCounts(statusFilter); // Real counts for not_replied and client_not_replied
  
  // Flatten paginated conversations
  const paginatedConversations = useMemo(() => {
    if (!conversationsData?.pages) return [];
    return conversationsData.pages.flatMap(page => page.conversations);
  }, [conversationsData]);

  // Fetch messages with pagination
  const {
    data: messagesData,
    isLoading: messagesLoading,
    fetchNextPage: fetchOlderMessages,
    hasNextPage: hasMoreMessages,
    isFetchingNextPage: isFetchingMoreMessages,
  } = usePaginatedMessages(selectedConversationId);
  
  // Get all messages in chronological order
  const messages = useMemo(() => {
    return getAllPaginatedMessages(messagesData?.pages);
  }, [messagesData]);
  const { data: internalNotes = [], isLoading: notesLoading } = useInternalNotes(selectedConversationId);
  const { data: conversationEvents = [], isLoading: eventsLoading } = useConversationEvents(selectedConversationId);
  const { data: teamMembers = [] } = useTeam();
  const { data: tags = [] } = useTags();
  const addTagToContact = useAddTagToContact();
  const removeTagFromContact = useRemoveTagFromContact();
  const createTag = useCreateTag();
  const { data: departments = [] } = useDepartments();
  const { data: channels = [] } = useChannels();
  const { data: pinnedConversations = [] } = usePinnedConversations();
  const { isPinned, togglePin } = useTogglePinConversation();
  const { data: sharedConversations = [] } = useSharedConversations();
  const { data: sharedCounts } = useSharedConversationCounts();
  const { ids: sharedConversationIds, isLoading: isLoadingSharedIds } = useSharedConversationIds(); // IDs shared WITH me (for badge)
  const allSharedConversationIds = useAllSharedConversationIds(); // All shared IDs (WITH me + BY me)
  const { data: sharedConversationsData = [] } = useSharedConversationsWithDetails();
  const sharePermission = useMySharePermission(selectedConversationId);
  const sendMessage = useSendMessage();
  const deleteMessage = useDeleteMessage();
  const editMessage = useEditMessage();
  const reactToMessage = useReactToMessage();
  const createInternalNote = useCreateInternalNote();
  const updateInternalNote = useUpdateInternalNote();
  const updateConversation = useUpdateConversation();

  // Get current user for filter counts
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    staleTime: 300000, // 5 minutes cache - user rarely changes
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Get company timezone
  const { data: companyTimezone = 'America/Sao_Paulo' } = useQuery({
    queryKey: ['company-timezone'],
    staleTime: 1000 * 60 * 60, // 1 hour cache
    queryFn: async () => {
      const { data } = await supabase
        .from('company_settings')
        .select('timezone')
        .limit(1)
        .single();
      return data?.timezone || 'America/Sao_Paulo';
    },
  });

  // Helper function to format date separator considering timezone
  const formatDateSeparator = useCallback((utcDateStr: string): string => {
    const utcDate = parseISO(utcDateStr);
    const localDate = toZonedTime(utcDate, companyTimezone);
    const now = toZonedTime(new Date(), companyTimezone);
    
    // Check if same day
    if (
      localDate.getFullYear() === now.getFullYear() &&
      localDate.getMonth() === now.getMonth() &&
      localDate.getDate() === now.getDate()
    ) {
      return 'Hoje';
    }
    
    // Check if yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (
      localDate.getFullYear() === yesterday.getFullYear() &&
      localDate.getMonth() === yesterday.getMonth() &&
      localDate.getDate() === yesterday.getDate()
    ) {
      return 'Ontem';
    }
    
    // Return full date
    return format(localDate, "EEEE, dd 'de' MMMM", { locale: ptBR });
  }, [companyTimezone]);

  // Helper to check if two dates are the same local day
  const isSameLocalDay = useCallback((date1: string, date2: string): boolean => {
    const d1 = toZonedTime(parseISO(date1), companyTimezone);
    const d2 = toZonedTime(parseISO(date2), companyTimezone);
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  }, [companyTimezone]);

  // Create a map of tag counts from DATABASE (real counts via hook)
  const tagCountMap = useMemo(() => {
    const map = new Map<string, number>();
    if (tagCountsData) {
      Object.entries(tagCountsData).forEach(([tagId, count]) => {
        map.set(tagId, count);
      });
    }
    return map;
  }, [tagCountsData]);

  // Mapa de contagens absolutas de tags (sem filtros) para o modal de Filtros Avançados
  const absoluteTagCountMap = useMemo(() => {
    const map = new Map<string, number>();
    if (absoluteTagCountsData) {
      Object.entries(absoluteTagCountsData).forEach(([tagId, count]) => {
        map.set(tagId, count);
      });
    }
    return map;
  }, [absoluteTagCountsData]);

  // Create a map of department counts from DATABASE (real counts)
  const departmentCountMap = useMemo(() => {
    const map = new Map<string, number>();
    if (departmentCountsData) {
      Object.entries(departmentCountsData).forEach(([deptId, count]) => {
        map.set(deptId, count);
      });
    }
    return map;
  }, [departmentCountsData]);

  // Realtime subscriptions
  useRealtimeMessages(selectedConversationId);
  useRealtimeConversations();
  useRealtimeConversationEvents(selectedConversationId);
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(selectedConversationId);

  // Direct fetch for selected conversation - ALWAYS fetch when we have a selectedConversationId
  // This ensures we can display the conversation even if server-side filters exclude it
  const { data: directSelectedConversation } = useQuery({
    queryKey: ['conversation-direct', selectedConversationId],
    queryFn: async () => {
      if (!selectedConversationId) return null;
      
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          contact_id,
          channel_id,
          assigned_to,
          department_id,
          status,
          is_unread,
          unread_count,
          last_message_at,
          last_message_preview,
          lead_status,
          created_at,
          referral_source,
          referral_data,
          contact:contacts(id, full_name, phone, email, avatar_url, is_online, is_typing, first_contact_at, created_at, origin, origin_campaign, referral_data),
          assignee:profiles!conversations_assigned_to_fkey(id, full_name),
          channel:whatsapp_channels(id, name)
        `)
        .eq('id', selectedConversationId)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching direct conversation:', error);
        return null;
      }
      
      return data as unknown as Conversation;
    },
    // ALWAYS enabled when we have a selectedConversationId - don't depend on paginated results
    enabled: !!selectedConversationId,
    staleTime: 30000, // 30 seconds cache
  });

  // Fetch pinned conversations directly from database (with full data)
  // This ensures pinned conversations appear in "Fixadas" tab even if not in current paginated results
  const pinnedConversationIds = useMemo(() => 
    pinnedConversations.map(p => p.conversation_id), 
    [pinnedConversations]
  );

  const { data: pinnedConversationsData = [] } = useQuery({
    queryKey: ['pinned-conversations-full', pinnedConversationIds],
    queryFn: async () => {
      if (pinnedConversationIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          contact_id,
          channel_id,
          assigned_to,
          department_id,
          status,
          is_unread,
          unread_count,
          last_message_at,
          last_message_preview,
          lead_status,
          created_at,
          referral_source,
          referral_data,
          contact:contacts(id, full_name, phone, email, avatar_url, is_online, is_typing, first_contact_at, created_at, origin, origin_campaign, referral_data),
          assignee:profiles!conversations_assigned_to_fkey(id, full_name),
          channel:whatsapp_channels(id, name)
        `)
        .in('id', pinnedConversationIds)
        .order('last_message_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching pinned conversations:', error);
        return [];
      }
      
      return data as unknown as Conversation[];
    },
    enabled: pinnedConversationIds.length > 0,
    staleTime: 30000, // 30 seconds cache
  });

  // Merge paginated conversations with directly fetched selected conversation, pinned conversations, AND shared conversations
  // This ensures selected, pinned, and shared conversations ALWAYS appear in the list
  const conversations = useMemo(() => {
    // Start with paginated conversations
    let result = [...paginatedConversations];
    const existingIds = new Set(result.map(c => c.id));
    
    // Add pinned conversations that are not already in the list
    for (const pinnedConv of pinnedConversationsData) {
      if (!existingIds.has(pinnedConv.id)) {
        result.push(pinnedConv);
        existingIds.add(pinnedConv.id);
      }
    }
    
    // Add shared conversations that are not already in the list
    for (const sharedConv of sharedConversationsData) {
      if (!existingIds.has(sharedConv.id)) {
        result.push(sharedConv);
        existingIds.add(sharedConv.id);
      }
    }
    
    // If we have a directly fetched conversation and it's not already in the list, append it (don't move to top)
    // The conversation will only move to the top naturally when a message is sent (due to last_message_at sorting)
    if (directSelectedConversation && !existingIds.has(directSelectedConversation.id)) {
      result = [...result, directSelectedConversation];
    }
    
    return result;
  }, [paginatedConversations, directSelectedConversation, pinnedConversationsData, sharedConversationsData]);

  // Find selected conversation from the merged list
  const selectedConversation = conversations.find(c => c.id === selectedConversationId) || null;

  // ============ VERIFICAÇÃO DE PERMISSÃO VIA URL ============
  // Bloquear acesso quando a conversa é carregada via URL e está atribuída a outro vendedor
  // EXCEÇÃO: Conversas compartilhadas com o usuário têm acesso permitido
  useEffect(() => {
    // Aguardar permissões E compartilhamentos carregarem completamente
    // Se compartilhamentos ainda estão carregando, não bloquear (evita falso positivo)
    if (!isFullyLoaded || !selectedConversationId || !selectedConversation || isLoadingSharedIds) return;
    
    // Admin e supervisor podem ver tudo
    if (canAccessAllConversations) return;
    
    // Verificar se a conversa está atribuída a outro usuário
    if (selectedConversation.assigned_to && selectedConversation.assigned_to !== profile?.id) {
      // EXCEÇÃO: Se a conversa foi compartilhada COM o usuário, permitir acesso
      const isSharedWithUser = sharedConversationIds.includes(selectedConversation.id);
      if (isSharedWithUser) {
        console.log('[Conversations] Acesso permitido via compartilhamento:', {
          conversationId: selectedConversationId,
          sharedWithUser: true,
        });
        return; // Permite o acesso
      }
      
      const assignedAgent = teamMembers.find(t => t.id === selectedConversation.assigned_to);
      
      console.log('[Conversations] Bloqueando acesso via URL:', {
        conversationId: selectedConversationId,
        assignedTo: selectedConversation.assigned_to,
        currentUserId: profile?.id,
        isSharedWithUser: false,
      });
      
      setBlockedContact({
        id: selectedConversation.contact_id,
        full_name: selectedConversation.contact?.full_name || 'Contato',
        phone: selectedConversation.contact?.phone || '',
      });
      setBlockedByAgent({
        id: selectedConversation.assigned_to,
        full_name: assignedAgent?.full_name || selectedConversation.assignee?.full_name || null,
        avatar_url: assignedAgent?.avatar_url || null,
      });
      setBlockedConversationId(selectedConversationId);
      setShowContactRequestModal(true);
      
      // Limpar a URL para remover o ID da conversa bloqueada
      navigate('/conversations', { replace: true });
    }
  }, [selectedConversationId, selectedConversation, canAccessAllConversations, profile?.id, isFullyLoaded, teamMembers, navigate, sharedConversationIds, isLoadingSharedIds]);

  // Note: last_message_is_from_me is now included directly in conversation data from the server
  // No need to fetch last messages separately anymore
  
  // Fetch contact tags for the selected conversation
  const { data: contactTags = [], refetch: refetchContactTags } = useQuery({
    queryKey: ['contact-tags', selectedConversation?.contact?.id],
    staleTime: 30000, // 30 seconds cache
    queryFn: async () => {
      if (!selectedConversation?.contact?.id) return [];
      const { data, error } = await supabase
        .from('contact_tags')
        .select('tag:tags(*)')
        .eq('contact_id', selectedConversation.contact.id);
      if (error) throw error;
      return (data || []).map((ct: any) => ct.tag).filter(Boolean);
    },
    enabled: !!selectedConversation?.contact?.id,
  });
  
  // Track contact typing status with realtime
  const [contactIsTyping, setContactIsTyping] = useState(false);
  
  useEffect(() => {
    if (!selectedConversation?.contact?.id) {
      setContactIsTyping(false);
      return;
    }
    
    // Set initial typing status from conversation data
    setContactIsTyping(selectedConversation.contact.is_typing ?? false);
    
    // Subscribe to realtime contact updates for typing status
    const channel = supabase
      .channel(`contact-typing:${selectedConversation.contact.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'contacts',
          filter: `id=eq.${selectedConversation.contact.id}`,
        },
        (payload) => {
          const newTyping = (payload.new as any)?.is_typing ?? false;
          setContactIsTyping(newTyping);
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation?.contact?.id, selectedConversation?.contact?.is_typing]);

  // Mark conversation as read when selected (respeitando marcação manual de não lida)
  useEffect(() => {
    // Se não há conversa selecionada ou não está como não lida, não fazer nada
    if (!selectedConversationId || !selectedConversation?.is_unread) {
      return;
    }
    
    // Verificar se a conversa foi marcada como não lida recentemente (dentro de 10 segundos)
    const markedAt = markedUnreadAtRef.current.get(selectedConversationId);
    if (markedAt) {
      const elapsed = Date.now() - markedAt;
      if (elapsed < 10000) { // 10 segundos de proteção
        console.log('[Auto-read] Bloqueado: marcado como não lida há', Math.round(elapsed / 1000), 'segundos');
        return;
      } else {
        // Remover entradas antigas
        markedUnreadAtRef.current.delete(selectedConversationId);
      }
    }
    
    // Marcar como lida apenas se não foi recentemente marcada como não lida
    console.log('[Auto-read] Marcando conversa como lida:', selectedConversationId);
    updateConversation.mutate({
      id: selectedConversationId,
      is_unread: false,
      unread_count: 0,
    });
  }, [selectedConversationId, selectedConversation?.is_unread]);

  // Combine messages, internal notes, and conversation events, sorted by created_at
  const allChatItems = useMemo(() => {
    const msgItems = messages.map(m => ({ ...m, itemType: 'message' as const }));
    const noteItems = internalNotes.map(n => ({ ...n, itemType: 'note' as const }));
    const eventItems = conversationEvents.map(e => ({ ...e, itemType: 'event' as const }));
    return [...msgItems, ...noteItems, ...eventItems].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [messages, internalNotes, conversationEvents]);

  // Find the latest transfer event for the return button
  const latestTransferEvent = useMemo(() => {
    const transferEvents = conversationEvents.filter(e => e.event_type === 'transfer');
    return transferEvents.length > 0 ? transferEvents[transferEvents.length - 1] : null;
  }, [conversationEvents]);

  // Return conversation mutation
  const returnConversation = useReturnConversation();

  // Filter messages for in-conversation search
  const filteredChatItems = useMemo(() => {
    if (!messageSearchQuery.trim()) return allChatItems;
    return allChatItems.filter(item => 
      item.itemType === 'message' && 
      (item as Message).content?.toLowerCase().includes(messageSearchQuery.toLowerCase())
    );
  }, [allChatItems, messageSearchQuery]);

  // Auto-scroll to bottom when new messages arrive (not when loading older)
  const prevMessagesLengthRef = useRef(0);
  const isLoadingOlderRef = useRef(false);
  
  // State to show/hide scroll to bottom button
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const scrollToBottom = useCallback((force?: boolean) => {
    const container = messagesContainerRef.current;
    if (!container) {
      // Fallback to scrollIntoView
      messagesEndRef.current?.scrollIntoView({ behavior: force ? 'auto' : 'smooth' });
      return;
    }
    
    const doScroll = () => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: force ? 'auto' : 'smooth'
      });
    };
    
    // Immediate scroll
    doScroll();
    
    // Retry after short delay (for content still rendering)
    setTimeout(doScroll, 150);
    setTimeout(doScroll, 400);
  }, []);

  useEffect(() => {
    // Only auto-scroll if new messages were added (not older ones loaded)
    if (allChatItems.length > prevMessagesLengthRef.current && !isLoadingOlderRef.current) {
      const timeout = setTimeout(() => {
        scrollToBottom();
      }, 100);
      return () => clearTimeout(timeout);
    }
    prevMessagesLengthRef.current = allChatItems.length;
  }, [allChatItems.length, selectedConversationId, scrollToBottom]);

  // Reset when conversation changes
  useEffect(() => {
    prevMessagesLengthRef.current = 0;
    isLoadingOlderRef.current = false;
    scrollToBottom();
  }, [selectedConversationId]);

  // Infinite scroll handler for conversations list
  const handleConversationListScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    
    // Load more when near bottom (within 200px)
    if (scrollBottom < 200 && hasMoreConversations && !isFetchingMoreConversations) {
      fetchNextConversations();
    }
  }, [hasMoreConversations, isFetchingMoreConversations, fetchNextConversations]);

  // Infinite scroll handler for messages (load older on scroll up)
  const handleMessagesScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    
    // Show/hide scroll to bottom button based on distance from bottom
    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    setShowScrollToBottom(distanceFromBottom > 200);
    
    // Load more when near top (within 100px)
    if (target.scrollTop < 100 && hasMoreMessages && !isFetchingMoreMessages) {
      isLoadingOlderRef.current = true;
      
      // Save scroll position to restore after loading
      const scrollHeightBefore = target.scrollHeight;
      
      fetchOlderMessages().then(() => {
        // Restore scroll position after new messages are added
        requestAnimationFrame(() => {
          const scrollHeightAfter = target.scrollHeight;
          const heightDiff = scrollHeightAfter - scrollHeightBefore;
          target.scrollTop = heightDiff;
          isLoadingOlderRef.current = false;
        });
      });
    }
  }, [hasMoreMessages, isFetchingMoreMessages, fetchOlderMessages]);

  // Reset selection mode when changing conversation
  useEffect(() => {
    setIsSelectionMode(false);
    setSelectedMessageIds(new Set());
  }, [selectedConversationId]);

  // Filtro de data agora é aplicado no servidor via usePaginatedConversations

  // Filter conversations based on all filters (search, channel, sort, advanced, date)
  // Nota: filtros avançados (departamento, agente, origem, data, busca) agora são aplicados no servidor
  const filteredConversations = useMemo(() => {
    const pinnedIds = new Set(pinnedConversations.map(p => p.conversation_id));
    
    const filtered = conversations
      .filter((conv) => {
        const isPinnedConv = pinnedIds.has(conv.id);
        
        // Pinned filter logic:
        // - If quickFilter is 'pinned', only show pinned conversations (including selected if it's pinned)
        // - If quickFilter is NOT 'pinned', hide pinned conversations (they only appear in 'Fixadas')
        // - EXCEPTION: If there's an active search, show pinned conversations in results
        if (quickFilter === 'pinned') {
          // On "Fixadas" tab: only show pinned conversations
          // Even selected conversation must be pinned to appear here
          if (!isPinnedConv) return false;
        } else if (quickFilter === 'shared') {
          // On "Compartilhadas" tab: only show shared conversations (both directions)
          const sharedIds = new Set(allSharedConversationIds);
          if (!sharedIds.has(conv.id)) return false;
        } else {
          // On other tabs: show selected conversation regardless of pinned/shared status
          if (selectedConversationId && conv.id === selectedConversationId) {
            return true;
          }
          // Don't hide pinned conversations when there's an active search
          if (isPinnedConv && !debouncedSearchQuery) return false;
          // Don't hide shared conversations when there's an active search
          // Shared conversations only appear in "Compartilhadas" tab
          const isSharedConv = allSharedConversationIds.includes(conv.id);
          if (isSharedConv && !debouncedSearchQuery) return false;
        }
        
        // Channel filter - aplicado no servidor, mas mantemos para consistência visual imediata
        if (channelFilter !== 'all') {
          if (channelFilter === 'no_channel') {
            if (conv.channel_id) return false;
          } else {
            if (conv.channel_id !== channelFilter) {
              return false;
            }
          }
        }
        
        // Filtro de protocolo (busca em ID) - continua local
        if (advancedFilters.protocolNumber && !conv.id.includes(advancedFilters.protocolNumber)) {
          return false;
        }
        
        return true;
      })
      .sort((a, b) => {
        // NEW TRANSFERS FIRST - conversations transferred to current user
        const aIsNewTransfer = !!(a as any).is_new_transfer && a.assigned_to === profile?.id;
        const bIsNewTransfer = !!(b as any).is_new_transfer && b.assigned_to === profile?.id;
        if (aIsNewTransfer && !bIsNewTransfer) return -1;
        if (!aIsNewTransfer && bIsNewTransfer) return 1;
        
        // For server-sorted filters, preserve server order
        // All filters are now server-side (not_replied and client_not_replied included)
        // Server already sorted/filtered these, just maintain relative order
        return 0;
      });
    
    return filtered;
  }, [conversations, channelFilter, sortFilter, advancedFilters.protocolNumber, pinnedConversations, quickFilter, selectedConversationId, profile?.id, debouncedSearchQuery, allSharedConversationIds]);

  // Calculate unread count for pinned conversations (for notification badge)
  const pinnedUnreadCount = useMemo(() => {
    const pinnedIds = new Set(pinnedConversations.map(p => p.conversation_id));
    return conversations.filter(conv => 
      pinnedIds.has(conv.id) && 
      conv.is_unread && 
      // Don't count the currently selected conversation if user is viewing it
      !(quickFilter === 'pinned' && selectedConversationId === conv.id)
    ).length;
  }, [conversations, pinnedConversations, quickFilter, selectedConversationId]);

  // Calculate unread count for shared conversations (for notification badge)
  // Count unread from both directions (shared WITH me + shared BY me)
  const sharedUnreadCount = useMemo(() => {
    const sharedIds = new Set(allSharedConversationIds);
    return conversations.filter(conv => 
      sharedIds.has(conv.id) && 
      conv.is_unread && 
      // Don't count the currently selected conversation if user is viewing it
      !(quickFilter === 'shared' && selectedConversationId === conv.id)
    ).length;
  }, [conversations, allSharedConversationIds, quickFilter, selectedConversationId]);

  // Calculate filter counts - USE REAL COUNTS FROM DATABASE
  const filterCounts = useMemo(() => {
    const pinnedCount = pinnedConversations.length;
    // Use combined shared count (both directions: shared WITH me + shared BY me)
    const sharedCount = allSharedConversationIds.length;
    
    // Count pending conversations (assigned_to = null AND department_id is not null for user's departments)
    const pendingCount = totalCounts?.pending ?? 0;
    
    // Se não pode ver não atribuídas, "Todas" exclui as não atribuídas
    if (!canViewUnassigned) {
      return { 
        all: (totalCounts?.mine ?? 0) + pinnedCount - sharedCount, // Todas = minhas + fixadas - compartilhadas
        pinned: pinnedCount, 
        shared: sharedCount,
        mine: totalCounts?.mine ?? 0,
        pending: pendingCount,
        unassigned: 0 // Não mostrado, mas evita erro de tipo
      };
    }
    
    // Use real database counts when available, fallback to loaded conversations
    return { 
      all: (totalCounts?.all ?? conversations.length) - sharedCount, // Subtrair compartilhadas de "Todas"
      pinned: pinnedCount, 
      shared: sharedCount,
      mine: totalCounts?.mine ?? 0, 
      pending: pendingCount,
      unassigned: totalCounts?.unassigned ?? 0 
    };
  }, [totalCounts, conversations.length, pinnedConversations, allSharedConversationIds, canViewUnassigned]);

  // Calculate date filter counts - USE REAL COUNTS FROM DATABASE
  const dateFilterCounts = useMemo(() => {
    // Use real database counts when available
    if (dateFilterCountsData) {
      return dateFilterCountsData;
    }
    // Fallback to empty counts (database query still loading)
    return {
      today: 0,
      yesterday: 0,
      this_week: 0,
      last_week: 0,
      this_month: 0,
      last_month: 0,
    };
  }, [dateFilterCountsData]);

  // Calculate channel filter counts - USE REAL COUNTS FROM DATABASE
  const channelFilterCounts = useMemo(() => {
    // Use real database counts when available
    if (channelCountsData) {
      return channelCountsData;
    }
    // Fallback to loaded conversations
    const counts: Record<string, number> = {};
    conversations.forEach(conv => {
      const channelId = conv.channel_id || 'no_channel';
      counts[channelId] = (counts[channelId] || 0) + 1;
    });
    return counts;
  }, [channelCountsData, conversations]);

  // Calculate sort filter counts - use REAL counts from database for accuracy
  const sortFilterCounts = useMemo(() => {
    // Use real database count for unread
    const unreadCount = totalCounts?.unread ?? conversations.filter(conv => conv.is_unread).length;
    
    // Use real database counts for not_replied and client_not_replied
    const notRepliedCount = sortFilterCountsFromDb?.not_replied ?? 0;
    const clientNotRepliedCount = sortFilterCountsFromDb?.client_not_replied ?? 0;
    
    return { unread: unreadCount, not_replied: notRepliedCount, client_not_replied: clientNotRepliedCount };
  }, [totalCounts, conversations, sortFilterCountsFromDb]);

  // Conversation action handlers
  const handleMarkAsUnread = () => {
    if (selectedConversationId) {
      // Proteger contra auto-marcar como lida por 10 segundos
      console.log('[Mark Unread] Adicionando proteção para:', selectedConversationId);
      markedUnreadAtRef.current.set(selectedConversationId, Date.now());
      updateConversation.mutate({ id: selectedConversationId, is_unread: true, unread_count: 1 });
      toast.success('Conversa marcada como não lida');
    }
  };

  // Bulk mark as unread
  const handleBulkMarkAsUnread = async () => {
    if (selectedConversationIds.size === 0) return;
    
    const ids = Array.from(selectedConversationIds);
    
    // Exit selection mode FIRST to update UI immediately
    setSelectedConversationIds(new Set());
    setIsConversationSelectionMode(false);
    
    try {
      // Mark all IDs with timestamp to prevent auto-marking as read
      const now = Date.now();
      console.log('[Bulk Unread] Adicionando IDs ao markedUnreadAtRef:', ids);
      ids.forEach(id => markedUnreadAtRef.current.set(id, now));
      console.log('[Bulk Unread] markedUnreadAtRef atual:', Array.from(markedUnreadAtRef.current.entries()));
      
      // Update all selected conversations - .select() ensures query execution
      const results = await Promise.all(
        ids.map(id => 
          supabase
            .from('conversations')
            .update({ is_unread: true, unread_count: 1 })
            .eq('id', id)
            .select()
        )
      );
      
      // Log any errors
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        console.error('Erros ao marcar conversas como não lidas:', errors);
      }
      
      // Invalidate queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-counts'] });
      
      toast.success(`${ids.length} conversa(s) marcada(s) como não lida(s)`);
    } catch (error) {
      toast.error('Erro ao marcar conversas como não lidas');
    }
  };

  // Toggle conversation selection
  const toggleConversationSelection = (id: string) => {
    setSelectedConversationIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Cancel selection mode
  const cancelConversationSelection = () => {
    setSelectedConversationIds(new Set());
    setIsConversationSelectionMode(false);
  };

  // Select all visible conversations
  const selectAllConversations = () => {
    const allIds = new Set(filteredConversations.map(c => c.id));
    setSelectedConversationIds(allIds);
  };

  const handleCloseConversation = () => {
    if (selectedConversationId) {
      const conversationIdToClose = selectedConversationId;
      
      // 1. Limpar seleção ANTES da remoção para evitar estado inconsistente
      navigate('/conversations', { replace: true });
      
      // 2. Remoção otimista de TODAS as queries de conversas paginadas (usando predicate)
      queryClient.setQueriesData(
        { 
          predicate: (query) => 
            Array.isArray(query.queryKey) && 
            query.queryKey[0] === 'conversations-paginated' 
        },
        (oldData: any) => {
          if (!oldData?.pages) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              conversations: (page.conversations || []).filter(
                (c: any) => c.id !== conversationIdToClose
              ),
            })),
          };
        }
      );
      
      // 3. Também remover de queries não-paginadas
      queryClient.setQueriesData(
        { 
          predicate: (query) => 
            Array.isArray(query.queryKey) && 
            query.queryKey[0] === 'conversations' &&
            query.queryKey[0] !== 'conversations-paginated'
        },
        (oldData: any) => {
          if (!Array.isArray(oldData)) return oldData;
          return oldData.filter((c: any) => c.id !== conversationIdToClose);
        }
      );
      
      // 4. Atualiza no banco
      updateConversation.mutate({ 
        id: conversationIdToClose, 
        status: 'closed',
        closed_at: new Date().toISOString(),
      });
      
      // 5. Invalidar contagens para refletir a mudança
      queryClient.invalidateQueries({ queryKey: ['conversation-total-counts'] });
      queryClient.invalidateQueries({ queryKey: ['sort-filter-counts'] });
      queryClient.invalidateQueries({ queryKey: ['all-conversation-counts'] });
      
      toast.success('Conversa fechada');
    }
  };

  const handleExportConversation = () => {
    if (!selectedConversation || messages.length === 0) {
      toast.error('Nenhuma mensagem para exportar');
      return;
    }
    
    const messagesText = messages.map(m => 
      `[${format(new Date(m.created_at), 'dd/MM/yyyy HH:mm')}] ${m.is_from_me ? 'Você' : selectedConversation.contact?.full_name || 'Contato'}: ${m.content || '[Mídia]'}`
    ).join('\n');
    
    const blob = new Blob([messagesText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversa-${selectedConversation.contact?.full_name || 'contato'}-${format(new Date(), 'dd-MM-yyyy')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Conversa exportada!');
  };

  const handleClearAdvancedFilters = () => {
    setAdvancedFilters({
      agentId: 'all',
      tagIds: [],
      protocolNumber: '',
      departmentId: 'all',
      origin: 'all',
    });
  };

  const handleApplyFilters = () => {
    setShowFilters(false);
    toast.success('Filtros aplicados');
  };

  const handleSelectConversation = useCallback(async (conv: Conversation) => {
    console.log('[DEBUG] 👆 handleSelectConversation CALLED', {
      convId: conv.id,
      currentId: searchParams.get('id'),
      willUpdate: searchParams.get('id') !== conv.id
    });
    
    // ============ VERIFICAÇÃO DE PERMISSÃO ============
    // Se NÃO for admin/supervisor, verificar se a conversa está atribuída a outro vendedor
    // EXCEÇÃO: Conversas compartilhadas com o usuário têm acesso permitido
    // IMPORTANTE: Se compartilhamentos ainda estão carregando, permitir acesso (evita falso bloqueio)
    if (!canAccessAllConversations && conv.assigned_to && conv.assigned_to !== profile?.id) {
      // Se ainda está carregando os compartilhamentos, permitir acesso temporariamente
      // O useEffect de verificação via URL irá revalidar após carregar
      if (!isLoadingSharedIds) {
        // EXCEÇÃO: Se a conversa foi compartilhada COM o usuário, permitir acesso
        const isSharedWithUser = sharedConversationIds.includes(conv.id);
        if (!isSharedWithUser) {
          const assignedAgent = teamMembers.find(t => t.id === conv.assigned_to);
          setBlockedContact({
            id: conv.contact_id,
            full_name: conv.contact?.full_name || 'Contato',
            phone: conv.contact?.phone || '',
          });
          setBlockedByAgent({
            id: conv.assigned_to,
            full_name: assignedAgent?.full_name || conv.assignee?.full_name || null,
            avatar_url: assignedAgent?.avatar_url || null,
          });
          setBlockedConversationId(conv.id);
          setShowContactRequestModal(true);
          return;
        }
      }
    }
    // ============ FIM DA VERIFICAÇÃO ============
    
    // Clear is_new_transfer flag when selecting a transferred conversation
    if ((conv as any).is_new_transfer && conv.assigned_to === profile?.id) {
      supabase
        .from('conversations')
        .update({ is_new_transfer: false })
        .eq('id', conv.id)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
        });
    }
    
    const currentId = searchParams.get('id');
    if (currentId !== conv.id) {
      console.log('[DEBUG] 🚀 Navigating with object format');
      // Use navigate with object to prevent URL encoding issues
      navigate(
        { pathname: '/conversations', search: `?id=${conv.id}` },
        { replace: true }
      );
      console.log('[DEBUG] ✅ navigate called');
    }
    setIsInternalNoteMode(false);
    if (isMobile) {
      setShowMobileChat(true);
    }
  }, [searchParams, navigate, isMobile, canAccessAllConversations, profile?.id, teamMembers, queryClient, sharedConversationIds, isLoadingSharedIds]);

  const handleBackToList = () => {
    setShowMobileChat(false);
  };

  const handleSendMessage = async () => {
    if (!selectedConversationId) return;
    
    // Prevent duplicate sends
    if (isSendingRef.current) return;
    
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

    // Buscar dados da conversa para envio via WhatsApp
    const selectedConv = conversations?.find(c => c.id === selectedConversationId);
    const channelId = selectedConv?.channel_id;
    const contactPhone = selectedConv?.contact?.phone;

    try {
      isSendingRef.current = true;
      setIsUploading(true);
      
      
      // Helper to add signature to text content
      const addSignatureToContent = (content: string): string => {
        const signatureName = authProfile?.signature_name || authProfile?.full_name;
        const signatureEnabled = authProfile?.signature_enabled !== false; // Default true
        if (signatureEnabled && signatureName) {
          return `*${signatureName}*:\n${content}`;
        }
        return content;
      };
      
      // Função auxiliar para enviar via WhatsApp (Edge Function - sem CORS)
      // NOTE: Content should already have signature added before calling this
      const sendViaWhatsApp = async (content: string, type: string, mediaUrl?: string, quotedMsgId?: string): Promise<string | undefined> => {
        if (channelId && contactPhone) {
          try {
            const result = await sendWhatsAppMessage(
              channelId, 
              contactPhone, 
              content, 
              type as 'text' | 'image' | 'audio' | 'video' | 'document',
              mediaUrl,
              quotedMsgId
            );
            if (!result.success) {
              console.error('[WhatsApp Send Error]', result.error);
              toast.error('Erro ao enviar para WhatsApp: ' + (result.error || 'Erro desconhecido'));
              return undefined;
            }
            return result.messageId;
          } catch (whatsappError) {
            console.error('[WhatsApp Send Error]', whatsappError);
            return undefined;
          }
        }
        return undefined;
      };
      
      // Get the whatsapp_message_id of the message being replied to
      const quotedWhatsAppId = replyingTo?.whatsapp_message_id || undefined;
      
      // Send text message first if exists
      if (hasText && !hasFiles) {
        const textContent = messageInput.trim();
        // Add signature BEFORE saving to database for consistency
        const contentWithSignature = addSignatureToContent(textContent);
        
        // INSTANT: Save to database first (optimistic update shows immediately)
        sendMessage.mutate({
          conversation_id: selectedConversationId,
          content: contentWithSignature,
          is_from_me: true,
          message_type: 'text',
          reply_to_message_id: replyingTo?.id,
        });
        
        // Clear input immediately for better UX
        setMessageInput('');
        setReplyingTo(null);
        
        // BACKGROUND: Send to WhatsApp with same content (already has signature)
        sendViaWhatsApp(contentWithSignature, 'text', undefined, quotedWhatsAppId).catch(console.error);
      } else if (hasFiles) {
        // For files, we need to upload first (can't be avoided)
        for (const file of selectedFiles) {
          const result = await uploadAttachment(file, selectedConversationId);
          
          let messageType = 'document';
          if (file.type.startsWith('image/')) {
            messageType = 'image';
          } else if (file.type.startsWith('video/')) {
            messageType = 'video';
          } else if (file.type.startsWith('audio/')) {
            messageType = 'audio';
          }

          // INSTANT: Save to database first
          sendMessage.mutate({
            conversation_id: selectedConversationId,
            content: file.name,
            is_from_me: true,
            message_type: messageType,
            media_url: result.url,
            media_mime_type: result.mimeType,
            reply_to_message_id: replyingTo?.id,
          });

          // BACKGROUND: Send to WhatsApp (don't await)
          sendViaWhatsApp(file.name, messageType, result.url, quotedWhatsAppId).catch(console.error);
        }
        
        // Send text after files if exists
        if (hasText) {
          const textContent = messageInput.trim();
          // Add signature BEFORE saving to database for consistency
          const contentWithSignature = addSignatureToContent(textContent);
          
          sendMessage.mutate({
            conversation_id: selectedConversationId,
            content: contentWithSignature,
            is_from_me: true,
            message_type: 'text',
          });
          
          // BACKGROUND: Send to WhatsApp with same content (already has signature)
          sendViaWhatsApp(contentWithSignature, 'text', undefined, undefined).catch(console.error);
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
      isSendingRef.current = false;
    }
  };

  // Message action handlers
  const handleReplyMessage = (message: Message) => {
    setReplyingTo(message);
    // Focus the message input after setting reply
    setTimeout(() => {
      messageInputRef.current?.focus();
    }, 0);
  };

  const handleDeleteMessage = async (message: Message) => {
    if (!selectedConversationId) return;
    
    // Get conversation to get channel and contact info
    const selectedConv = conversations?.find(c => c.id === selectedConversationId);
    
    deleteMessage.mutate({ 
      messageId: message.id, 
      conversationId: selectedConversationId,
      whatsappMessageId: message.whatsapp_message_id,
      channelId: selectedConv?.channel_id,
      contactPhone: selectedConv?.contact?.phone,
    });
    toast.success('Mensagem apagada');
  };

  // Selection mode handlers for bulk delete
  const handleEnterSelectionMode = (message: Message) => {
    setIsSelectionMode(true);
    setSelectedMessageIds(new Set([message.id]));
  };

  const handleToggleMessageSelect = (messageId: string) => {
    setSelectedMessageIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const myMessageIds = messages.filter(m => m.is_from_me && !m.is_deleted).map(m => m.id);
    setSelectedMessageIds(new Set(myMessageIds));
  };

  const handleCancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedMessageIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (!selectedConversationId || selectedMessageIds.size === 0) return;
    
    const selectedConv = conversations?.find(c => c.id === selectedConversationId);
    const messagesToDelete = messages.filter(m => selectedMessageIds.has(m.id));
    
    // Delete each message
    for (const message of messagesToDelete) {
      deleteMessage.mutate({ 
        messageId: message.id, 
        conversationId: selectedConversationId,
        whatsappMessageId: message.whatsapp_message_id,
        channelId: selectedConv?.channel_id,
        contactPhone: selectedConv?.contact?.phone,
      });
    }
    
    toast.success(`${selectedMessageIds.size} mensagem(ns) apagada(s)`);
    handleCancelSelection();
  };

  const handleEditMessage = async (message: Message, newText: string) => {
    if (!selectedConversationId) return;
    
    const selectedConv = conversations?.find(c => c.id === selectedConversationId);
    
    try {
      await editMessage.mutateAsync({ 
        messageId: message.id, 
        conversationId: selectedConversationId,
        newText,
        whatsappMessageId: message.whatsapp_message_id,
        channelId: selectedConv?.channel_id,
        contactPhone: selectedConv?.contact?.phone,
      });
      toast.success('Mensagem editada');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao editar mensagem');
    }
  };

  const handleReactToMessage = async (messageId: string, emoji: string) => {
    if (!selectedConversationId || !selectedConversation) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    // Find the message to get whatsappMessageId
    const targetMessage = messages.find(m => m.id === messageId);
    
    reactToMessage.mutate({ 
      messageId, 
      conversationId: selectedConversationId, 
      emoji, 
      userId: user.id,
      whatsappMessageId: targetMessage?.whatsapp_message_id,
      channelId: selectedConversation?.channel_id,
      contactPhone: selectedConversation?.contact?.phone,
    });
  };

  // Scroll to message when clicking on reply reference
  const handleScrollToMessage = (messageId: string) => {
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add highlight effect
      messageElement.classList.add('animate-pulse', 'ring-2', 'ring-primary', 'ring-offset-2', 'rounded-lg');
      setTimeout(() => {
        messageElement.classList.remove('animate-pulse', 'ring-2', 'ring-primary', 'ring-offset-2', 'rounded-lg');
      }, 2000);
    }
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
      const maxSize = 30 * 1024 * 1024; // 30MB

      Array.from(files).slice(0, maxFiles).forEach(file => {
        if (file.size > maxSize) {
          toast.error(`"${file.name}" é muito grande. Máximo: 30MB`);
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

  // Handler para colar imagens do clipboard (Ctrl+V)
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const clipboardData = e.clipboardData;
    
    if (!clipboardData || !clipboardData.items) return;
    
    const imageItems: File[] = [];
    
    // Percorrer todos os itens do clipboard
    for (let i = 0; i < clipboardData.items.length; i++) {
      const item = clipboardData.items[i];
      
      // Verificar se é uma imagem
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          // Criar nome amigável para o arquivo
          const extension = item.type.split('/')[1] || 'png';
          const fileName = `screenshot_${Date.now()}_${i}.${extension}`;
          
          // Criar novo File com nome personalizado
          const renamedFile = new File([file], fileName, { type: file.type });
          imageItems.push(renamedFile);
        }
      }
    }
    
    if (imageItems.length > 0) {
      e.preventDefault(); // Evitar colar como texto
      
      const maxFiles = 10;
      const maxSize = 30 * 1024 * 1024; // 30MB
      
      const validFiles = imageItems.filter(file => {
        if (file.size > maxSize) {
          toast.error(`Imagem muito grande. Máximo: 30MB`);
          return false;
        }
        return true;
      });
      
      const currentCount = selectedFiles.length;
      const availableSlots = maxFiles - currentCount;
      
      if (availableSlots <= 0) {
        toast.error(`Máximo de ${maxFiles} arquivos permitido`);
        return;
      }
      
      const filesToAdd = validFiles.slice(0, availableSlots);
      
      if (filesToAdd.length > 0) {
        setSelectedFiles(prev => [...prev, ...filesToAdd]);
        toast.success(
          filesToAdd.length === 1 
            ? 'Imagem colada do clipboard!' 
            : `${filesToAdd.length} imagens coladas do clipboard!`
        );
      }
    }
    // Se não for imagem, deixar o comportamento padrão (colar texto)
  }, [selectedFiles.length]);

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
      const maxSize = 30 * 1024 * 1024; // 30MB

      Array.from(files).slice(0, maxFiles).forEach(file => {
        if (file.size > maxSize) {
          toast.error(`"${file.name}" é muito grande. Máximo: 30MB`);
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

      mediaRecorder.onstop = async () => {
        // Stop all tracks first
        stream.getTracks().forEach(track => track.stop());
        
        // Check if recording was cancelled - if so, don't send
        if (recordingCancelledRef.current) {
          recordingCancelledRef.current = false;
          audioChunksRef.current = [];
          return;
        }
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
        
        // Prevent duplicate sends
        if (isSendingRef.current) return;
        
        // Send audio directly without confirmation
        const selectedConv = conversations?.find(c => c.id === selectedConversationId);
        const channelId = selectedConv?.channel_id;
        const contactPhone = selectedConv?.contact?.phone;
        
        if (selectedConversationId) {
          try {
            isSendingRef.current = true;
            setIsUploading(true);
            const result = await uploadAttachment(audioFile, selectedConversationId);
            
            // INSTANT: Save to database first
            sendMessage.mutate({
              conversation_id: selectedConversationId,
              content: '',
              is_from_me: true,
              message_type: 'audio',
              media_url: result.url,
              media_mime_type: result.mimeType,
            });
            
            // BACKGROUND: Send via WhatsApp (don't await)
            if (channelId && contactPhone) {
              sendWhatsAppMessage(channelId, contactPhone, '', 'audio', result.url).catch(console.error);
            }
            
            toast.success('Áudio enviado!');
          } catch (error) {
            console.error('Error sending audio:', error);
            toast.error('Erro ao enviar áudio');
          } finally {
            setIsUploading(false);
            isSendingRef.current = false;
          }
        }
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
    // Ensure we're sending (not cancelling)
    recordingCancelledRef.current = false;
    
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
    // IMPORTANT: Set cancelled flag BEFORE calling stop()
    recordingCancelledRef.current = true;
    
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
    <div className="flex h-full w-full bg-background overflow-hidden">
      {/* Modal de Solicitação de Acesso */}
      {blockedContact && blockedByAgent && (
        <ContactRequestModal
          open={showContactRequestModal}
          onOpenChange={setShowContactRequestModal}
          contact={blockedContact}
          currentOwner={blockedByAgent}
          conversationId={blockedConversationId}
        />
      )}

      {/* Column 1: Conversations List */}
      <div className={cn(
        'w-full md:w-[500px] md:min-w-[500px] md:max-w-[500px] bg-card border-r border-border flex flex-col flex-shrink-0',
        isMobile && showMobileChat ? 'hidden' : 'flex'
      )}>
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-foreground">Conversas</h2>
            <div className="flex items-center gap-1">
              {/* Bulk Select Button */}
              <button 
                onClick={() => setIsConversationSelectionMode(!isConversationSelectionMode)}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  isConversationSelectionMode 
                    ? "bg-primary text-primary-foreground" 
                    : "hover:bg-muted text-muted-foreground"
                )}
                title={isConversationSelectionMode ? "Cancelar seleção" : "Selecionar múltiplas"}
              >
                <CheckSquare size={18} />
              </button>
              <button className="p-2 hover:bg-muted rounded-lg transition-colors">
                <Edit3 size={18} className="text-muted-foreground" />
              </button>
            </div>
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
          {/* Date Filter (Master) */}
          <Select 
            value={dateFilter} 
            onValueChange={(value) => {
              setDateFilter(value);
              if (value === 'custom') {
                setShowCustomDatePicker(true);
              }
            }}
          >
            <SelectTrigger className="w-full h-10 rounded-lg">
              <Calendar size={14} className="mr-2 text-muted-foreground" />
              <SelectValue placeholder="Data do primeiro contato">
                {dateFilter === 'custom' && customDateRange.from 
                  ? `${format(customDateRange.from, 'dd/MM/yy')}${customDateRange.to ? ` - ${format(customDateRange.to, 'dd/MM/yy')}` : ''}`
                  : undefined
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as datas</SelectItem>
              <SelectItem value="today">Hoje ({dateFilterCounts.today})</SelectItem>
              <SelectItem value="yesterday">Ontem ({dateFilterCounts.yesterday})</SelectItem>
              <SelectItem value="this_week">Esta semana ({dateFilterCounts.this_week})</SelectItem>
              <SelectItem value="last_week">Semana passada ({dateFilterCounts.last_week})</SelectItem>
              <SelectItem value="this_month">Este mês ({dateFilterCounts.this_month})</SelectItem>
              <SelectItem value="last_month">Mês passado ({dateFilterCounts.last_month})</SelectItem>
              <SelectItem value="custom">Período personalizado...</SelectItem>
            </SelectContent>
          </Select>

          {/* Custom Date Range Picker */}
          {showCustomDatePicker && (
            <div className="p-3 bg-muted/50 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Selecione o período</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setShowCustomDatePicker(false);
                    if (!customDateRange.from) {
                      setDateFilter('all');
                    }
                  }}
                >
                  <X size={16} />
                </Button>
              </div>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1 justify-start text-left font-normal">
                      <Calendar size={14} className="mr-2" />
                      {customDateRange.from ? format(customDateRange.from, 'dd/MM/yyyy') : 'Data inicial'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <div className="p-3 pointer-events-auto">
                      <input
                        type="date"
                        className="w-full px-3 py-2 border rounded-md bg-background"
                        value={customDateRange.from ? format(customDateRange.from, 'yyyy-MM-dd') : ''}
                        onChange={(e) => setCustomDateRange(prev => ({ ...prev, from: e.target.value ? new Date(e.target.value + 'T00:00:00') : undefined }))}
                      />
                    </div>
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1 justify-start text-left font-normal">
                      <Calendar size={14} className="mr-2" />
                      {customDateRange.to ? format(customDateRange.to, 'dd/MM/yyyy') : 'Data final'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <div className="p-3 pointer-events-auto">
                      <input
                        type="date"
                        className="w-full px-3 py-2 border rounded-md bg-background"
                        value={customDateRange.to ? format(customDateRange.to, 'yyyy-MM-dd') : ''}
                        onChange={(e) => setCustomDateRange(prev => ({ ...prev, to: e.target.value ? new Date(e.target.value + 'T00:00:00') : undefined }))}
                        min={customDateRange.from ? format(customDateRange.from, 'yyyy-MM-dd') : undefined}
                      />
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <Button 
                size="sm" 
                className="w-full"
                disabled={!customDateRange.from}
                onClick={() => setShowCustomDatePicker(false)}
              >
                Aplicar filtro
              </Button>
            </div>
          )}

          <div className="flex items-center gap-2">
            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="flex-1 h-10 rounded-lg">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="open">Abertos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="closed">Fechados</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>

            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="flex-1 h-10 rounded-lg">
                <SelectValue placeholder="Todos os canais" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os canais</SelectItem>
                {channels.map((channel) => (
                  <SelectItem key={channel.id} value={channel.id}>
                    {channel.name} ({channelFilterCounts[channel.id] || 0})
                  </SelectItem>
                ))}
                <SelectItem value="no_channel">Sem canal ({channelFilterCounts['no_channel'] || 0})</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortFilter} onValueChange={(v) => setSortFilter(v as SortFilter)}>
              <SelectTrigger className="flex-1 h-10 rounded-lg">
                <SelectValue placeholder="Mais novas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Mais novas</SelectItem>
                <SelectItem value="oldest">Mais antigas</SelectItem>
                <SelectItem value="unread">Não lidas ({sortFilterCounts.unread})</SelectItem>
                <SelectItem value="not_replied">Não respondidas ({sortFilterCounts.not_replied})</SelectItem>
                <SelectItem value="client_not_replied">Cliente não respondeu ({sortFilterCounts.client_not_replied})</SelectItem>
              </SelectContent>
            </Select>

            <button
              onClick={() => setShowFilters(true)}
              className="p-2.5 hover:bg-muted rounded-lg transition-colors"
            >
              <SlidersHorizontal size={18} className="text-muted-foreground" />
            </button>
          </div>

          {/* Active Filters Indicator */}
          {(dateFilter !== 'all' || channelFilter !== 'all' || advancedFilters.agentId !== 'all' || advancedFilters.departmentId !== 'all' || advancedFilters.origin !== 'all') && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Department Filter Badge */}
              {advancedFilters.departmentId !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-violet-500/10 text-violet-600 dark:text-violet-400 text-xs rounded-full">
                  <Building2 size={12} />
                  {departments.find(d => d.id === advancedFilters.departmentId)?.name || 'Departamento'}
                  <button 
                    onClick={() => setAdvancedFilters(prev => ({ ...prev, departmentId: 'all' }))} 
                    className="ml-1 hover:opacity-70"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}
              
              {/* Agent Filter Badge */}
              {advancedFilters.agentId !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs rounded-full">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  {teamMembers.find(t => t.id === advancedFilters.agentId)?.full_name?.split(' ')[0] || 'Agente'}
                  <button 
                    onClick={() => setAdvancedFilters(prev => ({ ...prev, agentId: 'all' }))} 
                    className="ml-1 hover:opacity-70"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}
              
              {/* Origin Filter Badge */}
              {advancedFilters.origin !== 'all' && (
                <span className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full",
                  advancedFilters.origin === 'meta_ads' 
                    ? "bg-blue-600/10 text-blue-600 dark:text-blue-400" 
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                )}>
                  {advancedFilters.origin === 'meta_ads' ? (
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  ) : (
                    <Globe size={12} />
                  )}
                  {advancedFilters.origin === 'meta_ads' ? 'Meta Ads' : 'Orgânico'}
                  <button 
                    onClick={() => setAdvancedFilters(prev => ({ ...prev, origin: 'all' }))} 
                    className="ml-1 hover:opacity-70"
                  >
                    <X size={12} />
                  </button>
                </span>
              )}
              
              {/* Channel Filter Badge */}
              {channelFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-600 dark:text-green-400 text-xs rounded-full">
                  <MessageCircle size={12} />
                  {channels.find(c => c.id === channelFilter)?.name || 'Sem canal'}
                  <button onClick={() => setChannelFilter('all')} className="ml-1 hover:opacity-70">
                    <X size={12} />
                  </button>
                </span>
              )}
              
              {/* Date Filter Badge */}
              {dateFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-full">
                  <Calendar size={12} />
                  {dateFilter === 'today' ? 'Hoje' : 
                   dateFilter === 'yesterday' ? 'Ontem' : 
                   dateFilter === 'this_week' ? 'Esta semana' : 
                   dateFilter === 'last_week' ? 'Sem. passada' : 
                   dateFilter === 'this_month' ? 'Este mês' : 
                   dateFilter === 'last_month' ? 'Mês passado' :
                   dateFilter === 'custom' && customDateRange.from ? 
                     `${format(customDateRange.from, 'dd/MM')}${customDateRange.to ? ` - ${format(customDateRange.to, 'dd/MM')}` : ''}` : 
                   'Personalizado'}
                  <button onClick={() => { setDateFilter('all'); setCustomDateRange({ from: undefined, to: undefined }); setShowCustomDatePicker(false); }} className="ml-1 hover:opacity-70">
                    <X size={12} />
                  </button>
                </span>
              )}
              
              {/* Clear All Filters Button */}
              <button
                onClick={() => {
                  setDateFilter('all');
                  setChannelFilter('all');
                  setCustomDateRange({ from: undefined, to: undefined });
                  setShowCustomDatePicker(false);
                  handleClearAdvancedFilters();
                }}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Limpar filtros
              </button>
            </div>
          )}

          {/* Quick Filters */}
          <div className="flex gap-2">
            {availableQuickFilters.map((filter) => (
              <button
                key={filter}
                onClick={() => setQuickFilter(filter)}
                className={cn(
                  'flex-1 py-2 px-2 text-sm font-medium rounded-lg transition-colors relative flex flex-col items-center justify-center min-h-[52px]',
                  quickFilter === filter
                    ? 'text-primary bg-accent'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <span className="text-xs whitespace-nowrap">{filter === 'all' ? 'Todas' : filter === 'pinned' ? 'Fixadas' : filter === 'shared' ? 'Compartilhadas' : filter === 'mine' ? 'Minhas' : filter === 'pending' ? 'Pendentes' : 'Não atribuídas'}</span>
                <AnimatedCounter value={filterCounts[filter]} className="text-xs opacity-70" />
                {/* Red notification badge for pinned conversations with unread messages */}
                {filter === 'pinned' && quickFilter !== 'pinned' && pinnedUnreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    {pinnedUnreadCount > 9 ? '9+' : pinnedUnreadCount}
                  </span>
                )}
                {/* Red notification badge for shared conversations with unread messages */}
                {filter === 'shared' && quickFilter !== 'shared' && sharedUnreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    {sharedUnreadCount > 9 ? '9+' : sharedUnreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Conversations List */}
        <div 
          ref={conversationListRef}
          className="flex-1 overflow-y-auto"
          onScroll={handleConversationListScroll}
        >
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
            <>
              {filteredConversations.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isSelected={selectedConversationId === conv.id}
                  isPinned={isPinned(conv.id)}
                  isShared={sharedConversationIds.includes(conv.id)}
                  isNewTransfer={!!(conv as any).is_new_transfer && conv.assigned_to === profile?.id}
                  onClick={() => handleSelectConversation(conv)}
                  onTogglePin={() => {
                    togglePin(conv.id);
                    toast.success(isPinned(conv.id) ? 'Conversa desafixada' : 'Conversa fixada');
                  }}
                  isSelectionMode={isConversationSelectionMode}
                  isChecked={selectedConversationIds.has(conv.id)}
                  onToggleCheck={() => toggleConversationSelection(conv.id)}
                />
              ))}
              {/* Loading indicator for more conversations */}
              {isFetchingMoreConversations && (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Carregando mais...</span>
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Bulk Actions Floating Toolbar */}
        {isConversationSelectionMode && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-card border border-border rounded-xl shadow-lg px-4 py-3">
            <span className="text-sm text-muted-foreground mr-2">
              {selectedConversationIds.size} selecionada(s)
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={selectAllConversations}
              className="h-8"
            >
              <SquareCheck size={16} className="mr-1" />
              Todas
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={handleBulkMarkAsUnread}
              disabled={selectedConversationIds.size === 0}
              className="h-8"
            >
              <Mail size={16} className="mr-1" />
              Não lidas
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={cancelConversationSelection}
              className="h-8"
            >
              <X size={16} className="mr-1" />
              Cancelar
            </Button>
          </div>
        )}
      </div>

      {/* Column 2: Chat Area */}
      <div className={cn(
        'flex-1 flex flex-col bg-background min-w-0',
        isMobile && !showMobileChat ? 'hidden' : 'flex'
      )}>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="bg-card border-b border-border px-4 md:px-6 py-3 space-y-2">
              {/* Linha 1: Avatar + Nome + Etiquetas (quando cabem) + Ícones */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 flex-shrink-0">
                  {isMobile && (
                    <button onClick={handleBackToList} className="p-2 -ml-2 hover:bg-muted rounded-lg">
                      <ChevronLeft size={20} />
                    </button>
                  )}
                  <div className="relative">
                    {selectedConversation.contact?.avatar_url ? (
                      <img 
                        src={selectedConversation.contact.avatar_url}
                        alt={selectedConversation.contact.full_name || 'Contato'}
                        loading="lazy"
                        className="w-10 h-10 rounded-full object-cover shadow-md"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold shadow-md text-sm">
                        {(selectedConversation.contact?.full_name || 'C').charAt(0).toUpperCase()}
                      </div>
                    )}
                    {selectedConversation.contact?.is_online && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-success rounded-full border-2 border-card"></div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground text-sm truncate max-w-[120px] md:max-w-[180px]">
                      {selectedConversation.contact?.full_name || 'Contato'}
                    </h3>
                    {typingUsers.length > 0 ? (
                      <p className="text-xs text-primary flex items-center gap-1">
                        <span className="flex gap-0.5">
                          <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                          <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </span>
                        digitando...
                      </p>
                    ) : (
                      <p className={cn(
                        'text-xs flex items-center gap-1',
                        selectedConversation.contact?.is_online ? 'text-success' : 'text-muted-foreground'
                      )}>
                        {selectedConversation.contact?.is_online && (
                          <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse"></span>
                        )}
                        {selectedConversation.contact?.is_online ? 'Online' : 'Offline'}
                      </p>
                    )}
                  </div>
                </div>

                {/* Etiquetas na linha 1 - apenas em telas grandes E com poucas etiquetas */}
                {!isMobile && contactTags.length <= 2 && (
                  <div className="hidden lg:flex items-center gap-1.5 flex-1 mx-3 min-w-0 overflow-hidden">
                    {contactTags.map((tag: any) => (
                      <span 
                        key={tag.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
                        style={{ 
                          backgroundColor: `${tag.color || '#8B5CF6'}20`,
                          color: tag.color || '#8B5CF6'
                        }}
                      >
                        {tag.name}
                        <button 
                          onClick={() => {
                            if (selectedConversation?.contact?.id) {
                              removeTagFromContact.mutate(
                                { contactId: selectedConversation.contact.id, tagId: tag.id },
                                { onSuccess: () => refetchContactTags() }
                              );
                            }
                          }}
                          className="hover:opacity-70"
                          disabled={removeTagFromContact.isPending}
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                    
                    <Popover open={showHeaderTagPopover} onOpenChange={setShowHeaderTagPopover}>
                      <PopoverTrigger asChild>
                        <button className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors flex-shrink-0">
                          <Plus size={10} />
                          Etiqueta
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-3" align="start">
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">Adicionar etiqueta</p>
                          
                          <div className="relative">
                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              type="text"
                              placeholder="Buscar etiqueta..."
                              value={tagSearchQuery}
                              onChange={(e) => setTagSearchQuery(e.target.value)}
                              className="h-8 pl-8 text-sm"
                            />
                          </div>
                          
                          <div className="max-h-48 overflow-y-auto space-y-0.5">
                            {tags
                              .filter((t: any) => !contactTags.some((ct: any) => ct.id === t.id))
                              .filter((t: any) => t.name.toLowerCase().includes(tagSearchQuery.toLowerCase()))
                              .slice(0, 15)
                              .map((tag: any) => (
                                <button
                                  key={tag.id}
                                  onClick={() => {
                                    if (selectedConversation?.contact?.id) {
                                      addTagToContact.mutate(
                                        { contactId: selectedConversation.contact.id, tagId: tag.id },
                                        { onSuccess: () => { refetchContactTags(); setShowHeaderTagPopover(false); setTagSearchQuery(''); } }
                                      );
                                    }
                                  }}
                                  disabled={addTagToContact.isPending}
                                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-left text-sm"
                                >
                                  <span 
                                    className="w-3 h-3 rounded-full flex-shrink-0" 
                                    style={{ backgroundColor: tag.color || '#8B5CF6' }}
                                  />
                                  <span className="truncate">{tag.name}</span>
                                </button>
                              ))}
                            {tags
                              .filter((t: any) => !contactTags.some((ct: any) => ct.id === t.id))
                              .filter((t: any) => t.name.toLowerCase().includes(tagSearchQuery.toLowerCase()))
                              .length === 0 && (
                              <p className="text-xs text-muted-foreground text-center py-2">
                                {tagSearchQuery ? 'Nenhuma etiqueta encontrada' : 'Todas etiquetas adicionadas'}
                              </p>
                            )}
                          </div>
                          
                          <div className="pt-2 border-t">
                            <button
                              onClick={() => {
                                setShowHeaderTagPopover(false);
                                setShowCreateTagModal(true);
                              }}
                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-left text-sm text-primary"
                            >
                              <Plus size={14} />
                              <span>Criar nova etiqueta</span>
                            </button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {/* Ícones de ação - sempre visíveis */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  {showMessageSearch ? (
                    <div className="flex items-center gap-2 bg-muted rounded-lg px-2 py-1">
                      <Search size={14} className="text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Buscar..."
                        value={messageSearchQuery}
                        onChange={(e) => setMessageSearchQuery(e.target.value)}
                        className="h-7 w-28 md:w-40 border-0 bg-transparent p-0 text-sm focus-visible:ring-0"
                        autoFocus
                      />
                      <button 
                        onClick={() => { setShowMessageSearch(false); setMessageSearchQuery(''); }}
                        className="p-1 hover:bg-background rounded"
                      >
                        <X size={14} className="text-muted-foreground" />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setShowMessageSearch(true)}
                      className="p-2 hover:bg-muted rounded-lg transition-colors"
                    >
                      <Search size={18} className="text-muted-foreground" />
                    </button>
                  )}
                  <button 
                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                    onClick={() => setShowCallLogModal(true)}
                    title="Gestor de Ligações"
                  >
                    <Phone size={18} className="text-muted-foreground" />
                  </button>
                  <button className="p-2 hover:bg-muted rounded-lg transition-colors hidden md:flex">
                    <Video size={18} className="text-muted-foreground" />
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-2 hover:bg-muted rounded-lg transition-colors">
                        <MoreVertical size={18} className="text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 bg-popover">
                      <DropdownMenuItem onClick={handleMarkAsUnread}>
                        <Mail size={16} className="mr-2" />
                        Marcar como não lida
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleCloseConversation}>
                        <X size={16} className="mr-2" />
                        Fechar conversa
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleExportConversation}>
                        <Download size={16} className="mr-2" />
                        Exportar conversa
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Linha 2: Etiquetas - quando tem muitas OU em mobile/tablet */}
              {(isMobile || contactTags.length > 2) && (
                <div className="flex items-center gap-1.5 flex-wrap pl-0 md:pl-[52px]">
                  {contactTags.map((tag: any) => (
                    <span 
                      key={tag.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ 
                        backgroundColor: `${tag.color || '#8B5CF6'}20`,
                        color: tag.color || '#8B5CF6'
                      }}
                    >
                      {tag.name}
                      <button 
                        onClick={() => {
                          if (selectedConversation?.contact?.id) {
                            removeTagFromContact.mutate(
                              { contactId: selectedConversation.contact.id, tagId: tag.id },
                              { onSuccess: () => refetchContactTags() }
                            );
                          }
                        }}
                        className="hover:opacity-70"
                        disabled={removeTagFromContact.isPending}
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">
                        <Plus size={10} />
                        Etiqueta
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-3" align="start">
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Adicionar etiqueta</p>
                        
                        <div className="relative">
                          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            type="text"
                            placeholder="Buscar etiqueta..."
                            value={tagSearchQuery}
                            onChange={(e) => setTagSearchQuery(e.target.value)}
                            className="h-8 pl-8 text-sm"
                          />
                        </div>
                        
                        <div className="max-h-48 overflow-y-auto space-y-0.5">
                          {tags
                            .filter((t: any) => !contactTags.some((ct: any) => ct.id === t.id))
                            .filter((t: any) => t.name.toLowerCase().includes(tagSearchQuery.toLowerCase()))
                            .slice(0, 15)
                            .map((tag: any) => (
                              <button
                                key={tag.id}
                                onClick={() => {
                                  if (selectedConversation?.contact?.id) {
                                    addTagToContact.mutate(
                                      { contactId: selectedConversation.contact.id, tagId: tag.id },
                                      { onSuccess: () => { refetchContactTags(); setTagSearchQuery(''); } }
                                    );
                                  }
                                }}
                                disabled={addTagToContact.isPending}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-left text-sm"
                              >
                                <span 
                                  className="w-3 h-3 rounded-full flex-shrink-0" 
                                  style={{ backgroundColor: tag.color || '#8B5CF6' }}
                                />
                                <span className="truncate">{tag.name}</span>
                              </button>
                            ))}
                          {tags
                            .filter((t: any) => !contactTags.some((ct: any) => ct.id === t.id))
                            .filter((t: any) => t.name.toLowerCase().includes(tagSearchQuery.toLowerCase()))
                            .length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-2">
                              {tagSearchQuery ? 'Nenhuma etiqueta encontrada' : 'Todas etiquetas adicionadas'}
                            </p>
                          )}
                        </div>
                        
                        <div className="pt-2 border-t">
                          <button
                            onClick={() => setShowCreateTagModal(true)}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-left text-sm text-primary"
                          >
                            <Plus size={14} />
                            <span>Criar nova etiqueta</span>
                          </button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>

            {/* Selection Mode Toolbar */}
            {isSelectionMode && (
              <div className="flex items-center justify-between px-4 py-2 bg-destructive/10 border-y border-destructive/30">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-destructive">
                    <Trash2 size={16} />
                    <span className="text-sm font-medium">
                      {selectedMessageIds.size} selecionada(s)
                    </span>
                  </div>
                  <button
                    onClick={handleSelectAll}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Selecionar todas minhas
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelSelection}
                    className="h-8"
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={selectedMessageIds.size === 0}
                    className="h-8 gap-1"
                  >
                    <Trash2 size={14} />
                    Apagar ({selectedMessageIds.size})
                  </Button>
                </div>
              </div>
            )}

            {/* Messages Area with Drag & Drop */}
            <div 
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 space-y-4 relative"
              onScroll={handleMessagesScroll}
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
                  <p className="text-sm text-muted-foreground mt-1">Máximo: 30MB</p>
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
                  {/* Loading indicator for older messages */}
                  {isFetchingMoreMessages && (
                    <div className="flex items-center justify-center py-3">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-sm text-muted-foreground">Carregando mensagens anteriores...</span>
                    </div>
                  )}
                  
                  {/* Load more button (optional, for manual loading) */}
                  {hasMoreMessages && !isFetchingMoreMessages && (
                    <div className="flex items-center justify-center py-2">
                      <button
                        onClick={() => {
                          isLoadingOlderRef.current = true;
                          fetchOlderMessages();
                        }}
                        className="text-xs text-primary hover:underline"
                      >
                        Carregar mensagens anteriores
                      </button>
                    </div>
                  )}

                  {/* Search Results Indicator */}
                  {messageSearchQuery && (
                    <div className="flex items-center justify-center py-2">
                      <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                        {filteredChatItems.length} resultado(s) encontrado(s)
                      </span>
                    </div>
                  )}
                  
                  {/* Dynamic Date Separators - render inline with messages */}
                  {(messageSearchQuery ? filteredChatItems : allChatItems).map((item, index, items) => {
                    const prevItem = index > 0 ? items[index - 1] : null;
                    const showDateSeparator = !messageSearchQuery && (
                      !prevItem || !isSameLocalDay(prevItem.created_at, item.created_at)
                    );

                    return (
                      <div key={item.id}>
                        {showDateSeparator && (
                          <div className="flex items-center gap-3 my-4">
                            <div className="flex-1 h-px bg-border"></div>
                            <span className="text-xs text-muted-foreground font-medium px-2 capitalize">
                              {formatDateSeparator(item.created_at)}
                            </span>
                            <div className="flex-1 h-px bg-border"></div>
                          </div>
                        )}
                        
                        {item.itemType === 'note' ? (
                          <InternalNoteCard 
                            key={`note-${item.id}`} 
                            note={item as InternalNote} 
                            onUpdate={(noteId, content) => updateInternalNote.mutate({ 
                              noteId, 
                              content, 
                              conversationId: selectedConversationId! 
                            })}
                          />
                        ) : item.itemType === 'event' ? (
                          // Render different event cards based on event_type
                          (item as ConversationEvent).event_type === 'reopen' ? (
                            <ReopenEventCard 
                              key={`event-${item.id}`} 
                              event={item as ConversationEvent}
                            />
          ) : (item as ConversationEvent).event_type === 'close' ? (
                            <CloseEventCard 
                              key={`event-${item.id}`} 
                              event={item as ConversationEvent}
                            />
                          ) : (item as ConversationEvent).event_type === 'share' ? (
                            <ShareEventCard 
                              key={`event-${item.id}`} 
                              event={item as ConversationEvent}
                              currentUserId={currentUser?.id}
                            />
                          ) : (item as ConversationEvent).event_type === 'share_cancelled' ? (
                            <ShareCancelledEventCard 
                              key={`event-${item.id}`} 
                              event={item as ConversationEvent}
                              currentUserId={currentUser?.id}
                            />
                          ) : (
                            <TransferEventCard
                              key={`event-${item.id}`} 
                              event={item as ConversationEvent}
                              currentUserId={currentUser?.id}
                              isAdmin={isAdmin}
                              isLatestTransfer={latestTransferEvent?.id === item.id}
                              isReturning={returnConversation.isPending}
                              onReturn={() => {
                                const eventData = (item as ConversationEvent).data;
                                if (eventData.from_user_id && selectedConversationId) {
                                  returnConversation.mutate({
                                    conversationId: selectedConversationId,
                                    toUserId: eventData.from_user_id,
                                    toUserName: eventData.from_user_name || 'Usuário',
                                  }, {
                                    onSuccess: () => {
                                      toast.success('Conversa devolvida com sucesso');
                                    },
                                    onError: () => {
                                      toast.error('Erro ao devolver conversa');
                                    }
                                  });
                                }
                              }}
                            />
                          )
                        ) : (
                          <MessageBubble 
                            key={`msg-${item.id}`} 
                            message={item as Message}
                            onReply={handleReplyMessage}
                            onDelete={handleDeleteMessage}
                            onEdit={handleEditMessage}
                            onReact={handleReactToMessage}
                            onScrollToMessage={handleScrollToMessage}
                            isSelectionMode={isSelectionMode}
                            isSelected={selectedMessageIds.has(item.id)}
                            onToggleSelect={handleToggleMessageSelect}
                            onEnterSelectionMode={handleEnterSelectionMode}
                          />
                        )}
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
              
              {/* Floating Scroll to Bottom Button */}
              {showScrollToBottom && (
                <button
                  onClick={() => scrollToBottom()}
                  className="absolute bottom-4 right-4 z-40 p-3 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-all hover:scale-105 active:scale-95"
                  title="Ir para o final"
                >
                  <ChevronDown size={20} />
                </button>
              )}
            </div>

            {/* Contact Typing Indicator */}
            {contactIsTyping && (
              <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-t border-border">
                <div className="flex items-center gap-1.5">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {selectedConversation?.contact?.full_name || 'Contato'} está digitando...
                  </span>
                </div>
              </div>
            )}

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
                  {/* Image thumbnail for image messages */}
                  {replyingTo.message_type === 'image' && replyingTo.media_url && (
                    <img 
                      src={replyingTo.media_url} 
                      alt="Imagem" 
                      className="w-10 h-10 rounded object-cover flex-shrink-0"
                    />
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-medium">Respondendo</span>
                    <span className="text-xs opacity-70 truncate">
                      {replyingTo.message_type === 'image' 
                        ? (replyingTo.content && replyingTo.content !== '[Imagem]' 
                            ? replyingTo.content.substring(0, 60) 
                            : 'Imagem')
                        : replyingTo.message_type === 'audio'
                          ? '🎤 Áudio'
                          : replyingTo.message_type === 'video'
                            ? '🎬 Vídeo'
                            : replyingTo.message_type === 'document'
                              ? '📄 Documento'
                              : (replyingTo.content?.substring(0, 60) || 'Mídia')}
                      {replyingTo.message_type === 'text' && replyingTo.content && replyingTo.content.length > 60 ? '...' : ''}
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
            {(() => {
              // Determine if user can send messages
              const isOwner = selectedConversation?.assigned_to === profile?.id;
              const isAdmin = canAccessAllConversations;
              const canSendMessages = isOwner || isAdmin || sharePermission.canEdit || !sharePermission.isShared;

              if (!canSendMessages) {
                // View-only access - show disabled state
                return (
                  <div className="bg-card border-t border-border px-4 md:px-6 py-4">
                    <div className="flex items-center justify-center gap-3 p-4 bg-muted/50 rounded-xl border border-border/50">
                      <Eye size={20} className="text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Você tem acesso apenas para visualização desta conversa
                      </span>
                    </div>
                  </div>
                );
              }

              return (
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
                    className="p-3 bg-destructive text-white rounded-xl hover:bg-destructive/90 transition-colors"
                    title="Cancelar gravação"
                  >
                    <X size={22} />
                  </button>
                  <button
                    onClick={stopRecording}
                    className="p-3 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors"
                    title="Parar e enviar"
                  >
                    <Send size={22} />
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

                  {/* Quick Templates Popover */}
                  <QuickTemplatesPopover
                    contactName={selectedConversation?.contact?.full_name}
                    contactPhone={selectedConversation?.contact?.phone}
                    onSelectTemplate={async (content, type, mediaUrl, mediaType, mediaName, contentBlocks) => {
                      const channelId = selectedConversation?.channel_id;
                      const contactPhone = selectedConversation?.contact?.phone;
                      
                      // Helper to build full media URL
                      const getFullMediaUrl = (url: string) => 
                        url.startsWith('http') 
                          ? url 
                          : `${supabase.storage.from('template-attachments').getPublicUrl(url).data.publicUrl}`;
                      
                      // Helper to determine message type from mime type
                      const getMessageType = (mimeType?: string | null): 'text' | 'image' | 'audio' | 'video' | 'document' => {
                        if (mimeType?.startsWith('audio')) return 'audio';
                        if (mimeType?.startsWith('image')) return 'image';
                        if (mimeType?.startsWith('video')) return 'video';
                        return 'document';
                      };
                      
                      // If template has content_blocks, send each block separately
                      if (contentBlocks && contentBlocks.length > 0 && selectedConversationId) {
                        try {
                          for (let i = 0; i < contentBlocks.length; i++) {
                            const block = contentBlocks[i];
                            
                            if (block.type === 'text' && block.content?.trim()) {
                              let textContent = block.content;
                              const sigName = authProfile?.signature_name || authProfile?.full_name;
                              const sigEnabled = authProfile?.signature_enabled !== false;
                              if (sigEnabled && sigName && i === 0) {
                                textContent = `*${sigName}*:\n${block.content}`;
                              }
                              
                              // Save to database
                              sendMessage.mutate({
                                conversation_id: selectedConversationId,
                                content: textContent,
                                is_from_me: true,
                                message_type: 'text',
                              });
                              
                              // Send via WhatsApp
                              if (channelId && contactPhone) {
                                await sendWhatsAppMessage(channelId, contactPhone, textContent, 'text');
                              }
                            } else if (block.type === 'media' && block.media_url) {
                              const fullUrl = getFullMediaUrl(block.media_url);
                              const msgType = getMessageType(block.media_type);
                              
                              sendMessage.mutate({
                                conversation_id: selectedConversationId,
                                content: '',
                                is_from_me: true,
                                message_type: msgType,
                                media_url: fullUrl,
                                media_mime_type: block.media_type,
                              });
                              
                              if (channelId && contactPhone) {
                                await sendWhatsAppMessage(channelId, contactPhone, '', msgType, fullUrl);
                              }
                            }
                            
                            // Delay between messages
                            if (i < contentBlocks.length - 1 || mediaUrl) {
                              await new Promise(resolve => setTimeout(resolve, 700));
                            }
                          }
                          
                          // After all blocks, send the main attachment if exists
                          if (mediaUrl) {
                            const fullMediaUrl = getFullMediaUrl(mediaUrl);
                            const messageType = getMessageType(mediaType);
                            
                            sendMessage.mutate({
                              conversation_id: selectedConversationId,
                              content: mediaName || '',
                              is_from_me: true,
                              message_type: messageType,
                              media_url: fullMediaUrl,
                              media_mime_type: mediaType,
                            });
                            
                            if (channelId && contactPhone) {
                              await sendWhatsAppMessage(channelId, contactPhone, '', messageType, fullMediaUrl, undefined, mediaName || undefined);
                            }
                          }
                          toast.success('Mensagens enviadas!');
                        } catch (error) {
                          console.error('Error sending template blocks:', error);
                          toast.error('Erro ao enviar mensagens');
                        }
                      } else if (mediaUrl && selectedConversationId) {
                        // Template without content_blocks but with media
                        const fullMediaUrl = getFullMediaUrl(mediaUrl);
                        const messageType = getMessageType(mediaType);
                        
                        try {
                          // Send text first if exists
                          if (content && content.trim()) {
                            let textContent = content;
                            const sigName = authProfile?.signature_name || authProfile?.full_name;
                            const sigEnabled = authProfile?.signature_enabled !== false;
                            if (sigEnabled && sigName) {
                              textContent = `*${sigName}*:\n${content}`;
                            }
                            
                            sendMessage.mutate({
                              conversation_id: selectedConversationId,
                              content: textContent,
                              is_from_me: true,
                              message_type: 'text',
                            });
                            
                            if (channelId && contactPhone) {
                              await sendWhatsAppMessage(channelId, contactPhone, textContent, 'text');
                            }
                            
                            await new Promise(resolve => setTimeout(resolve, 500));
                          }
                          
                          // Then send media
                          sendMessage.mutate({
                            conversation_id: selectedConversationId,
                            content: mediaName || '',
                            is_from_me: true,
                            message_type: messageType,
                            media_url: fullMediaUrl,
                            media_mime_type: mediaType,
                          });
                          
                          if (channelId && contactPhone) {
                            await sendWhatsAppMessage(channelId, contactPhone, '', messageType, fullMediaUrl, undefined, mediaName || undefined);
                          }
                          
                          toast.success('Mensagem e anexo enviados!');
                        } catch (error) {
                          console.error('Error sending template with media:', error);
                          toast.error('Erro ao enviar mensagem');
                        }
                      } else {
                        // Text only - just put in input field
                        setMessageInput(content);
                        messageInputRef.current?.focus();
                      }
                    }}
                    onCopyToInput={(content) => {
                      setMessageInput(content);
                      messageInputRef.current?.focus();
                    }}
                    onStartFlow={(flowId) => {
                      toast.info('Iniciando funil...', { description: `Flow ID: ${flowId}` });
                      // TODO: Implement flow start logic
                    }}
                    onTriggerAutomation={(triggerId) => {
                      toast.info('Executando gatilho...', { description: `Trigger ID: ${triggerId}` });
                      // TODO: Implement trigger execution
                    }}
                  />

                  <div className="flex-1">
                    <Textarea
                      ref={messageInputRef}
                      placeholder={isInternalNoteMode ? "Digite sua nota interna..." : "Digite sua mensagem..."}
                      value={messageInput}
                      onChange={(e) => {
                        setMessageInput(e.target.value);
                        resizeTextarea();
                        
                        if (!isInternalNoteMode && e.target.value.length > 0) {
                          startTyping();
                        } else {
                          stopTyping();
                        }
                      }}
                      onPaste={handlePaste}
                      onBlur={() => stopTyping()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          stopTyping();
                          handleSendMessage();
                          // Reset height após enviar
                          if (messageInputRef.current) {
                            messageInputRef.current.style.height = 'auto';
                          }
                        }
                      }}
                      className={cn(
                        'min-h-[44px] max-h-[200px] resize-none rounded-xl overflow-y-auto transition-[height] duration-100',
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
              );
            })()}

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
              // Reset ALL filters to ensure conversation appears in list
              setQuickFilter('all');
              setChannelFilter('all');
              setDateFilter('all');
              setSearchQuery('');
              setDebouncedSearchQuery('');
              setSortFilter('newest');
              setAdvancedFilters({
                agentId: 'all',
                tagIds: [],
                protocolNumber: '',
                departmentId: 'all',
                origin: 'all',
              });
              navigate(
                { pathname: '/conversations', search: `?id=${conversationId}` },
                { replace: true }
              );
            }}
          />
        )}
      </div>

      {/* Column 3: Contact Details (Desktop Only) */}
      {selectedConversation && (
        <div className="hidden lg:flex flex-shrink-0">
          <ConversationSidebar 
            conversationId={selectedConversation.id} 
            onNavigateAway={() => {
              // Clear selection and URL when conversation is closed
              navigate('/conversations', { replace: true });
            }}
          />
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
              <Select 
                value={advancedFilters.agentId} 
                onValueChange={(v) => setAdvancedFilters(prev => ({ ...prev, agentId: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name || 'Sem nome'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-foreground">
                  Filtrar por etiqueta
                </label>
                {advancedFilters.tagIds.length > 0 && (
                  <button
                    onClick={() => setAdvancedFilters(prev => ({ ...prev, tagIds: [] }))}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Limpar ({advancedFilters.tagIds.length})
                  </button>
                )}
              </div>
              
              {/* Campo de busca */}
              <div className="relative mb-2">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar etiqueta..."
                  value={filterTagSearchQuery}
                  onChange={(e) => setFilterTagSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
              
              {/* Container com scroll - Lista vertical com checkboxes */}
              <div className="max-h-[200px] overflow-y-auto space-y-1">
                {/* Opção "Sem etiqueta" - sempre no topo */}
                <label className="flex items-center gap-2 p-2 hover:bg-muted rounded-lg cursor-pointer transition-colors border-b border-border pb-2 mb-2">
                  <Checkbox
                    checked={advancedFilters.tagIds.includes('no_tag')}
                    onCheckedChange={() => {
                      setAdvancedFilters(prev => ({
                        ...prev,
                        tagIds: prev.tagIds.includes('no_tag')
                          ? prev.tagIds.filter(id => id !== 'no_tag')
                          : [...prev.tagIds, 'no_tag']
                      }));
                    }}
                  />
                  <span className="w-3 h-3 rounded-full flex-shrink-0 bg-muted-foreground/30" />
                  <span className="flex-1 text-sm text-foreground">⚠️ Sem etiqueta</span>
                  <span className="text-xs text-muted-foreground">{noTagCount || 0}</span>
                </label>

                {/* Tags existentes */}
                {(() => {
                  const filteredTags = filterTagSearchQuery.trim()
                    ? tags.filter(tag => tag.name.toLowerCase().includes(filterTagSearchQuery.toLowerCase()))
                    : tags;
                  
                  return filteredTags.length > 0 ? filteredTags.map((tag) => {
                    const count = absoluteTagCountMap.get(tag.id) || 0;
                    const isSelected = advancedFilters.tagIds.includes(tag.id);
                    return (
                      <label
                        key={tag.id}
                        className="flex items-center gap-2 p-2 hover:bg-muted rounded-lg cursor-pointer transition-colors"
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => {
                            setAdvancedFilters(prev => ({
                              ...prev,
                              tagIds: prev.tagIds.includes(tag.id)
                                ? prev.tagIds.filter(id => id !== tag.id)
                                : [...prev.tagIds, tag.id]
                            }));
                          }}
                        />
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: tag.color || '#8B5CF6' }}
                        />
                        <span className="flex-1 text-sm text-foreground">{tag.name}</span>
                        <span className="text-xs text-muted-foreground">{count}</span>
                      </label>
                    );
                  }) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      {filterTagSearchQuery ? 'Nenhuma etiqueta encontrada' : 'Nenhuma etiqueta cadastrada'}
                    </p>
                  );
                })()}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Número do Protocolo
              </label>
              <Input
                type="text"
                placeholder="Digite o protocolo..."
                value={advancedFilters.protocolNumber}
                onChange={(e) => setAdvancedFilters(prev => ({ ...prev, protocolNumber: e.target.value }))}
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Departamento
              </label>
              <div className="flex flex-wrap gap-2">
                {departments.length > 0 ? departments.map((dept) => {
                  const count = departmentCountMap.get(dept.id) || 0;
                  const isSelected = advancedFilters.departmentId === dept.id;
                  return (
                    <button
                      key={dept.id}
                      onClick={() => setAdvancedFilters(prev => ({ 
                        ...prev, 
                        departmentId: prev.departmentId === dept.id ? 'all' : dept.id 
                      }))}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                        isSelected ? 'text-white' : 'text-white/90 hover:opacity-80'
                      )}
                      style={{ 
                        backgroundColor: dept.color || '#8B5CF6',
                        opacity: isSelected ? 1 : 0.7
                      }}
                    >
                      {dept.name} ({count})
                    </button>
                  );
                }) : (
                  <p className="text-sm text-muted-foreground">Nenhum departamento cadastrado</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Origem do Lead
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setAdvancedFilters(prev => ({ ...prev, origin: 'all' }))}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    advancedFilters.origin === 'all' 
                      ? 'bg-primary text-white' 
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  Todas
                </button>
                <button
                  onClick={() => setAdvancedFilters(prev => ({ ...prev, origin: 'meta_ads' }))}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5',
                    advancedFilters.origin === 'meta_ads' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-blue-600/20 text-blue-600 hover:bg-blue-600/30'
                  )}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  Meta Ads ({originCountsData?.meta_ads ?? 0})
                </button>
                <button
                  onClick={() => setAdvancedFilters(prev => ({ ...prev, origin: 'whatsapp' }))}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5',
                    advancedFilters.origin === 'whatsapp' 
                      ? 'bg-green-600 text-white' 
                      : 'bg-green-600/20 text-green-600 hover:bg-green-600/30'
                  )}
                >
                  <MessageCircle size={14} />
                  Orgânico ({originCountsData?.organic ?? 0})
                </button>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={handleClearAdvancedFilters}>
              Limpar
            </Button>
            <Button className="btn-gradient text-white" onClick={handleApplyFilters}>
              Aplicar Filtros
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Tag Modal */}
      <Dialog open={showCreateTagModal} onOpenChange={setShowCreateTagModal}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Etiqueta</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Crie uma nova etiqueta para organizar seus contatos e conversas
            </p>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome da Etiqueta *</label>
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Ex: Cliente VIP, Urgente, Follow-up..."
              />
            </div>
            
            {/* Color */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Cor</label>
              <div className="flex flex-wrap gap-2">
                {['#8B5CF6', '#EC4899', '#EF4444', '#F97316', '#EAB308', '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6', '#6366F1', '#A855F7', '#64748B'].map(color => (
                  <button
                    key={color}
                    onClick={() => setNewTagColor(color)}
                    className={cn(
                      'w-8 h-8 rounded-lg transition-all hover:scale-110 flex items-center justify-center',
                      newTagColor === color ? 'ring-2 ring-offset-2 ring-primary' : ''
                    )}
                    style={{ backgroundColor: color }}
                  >
                    {newTagColor === color && <Check size={16} className="text-white" />}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer border-0"
                />
                <Input
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="flex-1 font-mono text-sm"
                  placeholder="#8B5CF6"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição (opcional)</label>
              <Textarea
                value={newTagDescription}
                onChange={(e) => setNewTagDescription(e.target.value)}
                placeholder="Descreva quando usar esta etiqueta..."
                rows={2}
              />
            </div>

            {/* Visibility */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Visibilidade</label>
              <div className="space-y-2">
                {/* Public Option */}
                <label
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer border-2 transition-colors',
                    newTagVisibility === 'public' ? 'border-green-500' : 'border-transparent'
                  )}
                >
                  <input
                    type="radio"
                    name="tag-visibility"
                    value="public"
                    checked={newTagVisibility === 'public'}
                    onChange={() => setNewTagVisibility('public')}
                    className="sr-only"
                  />
                  <div className="w-9 h-9 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <Globe size={18} className="text-green-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground text-sm">Pública</div>
                    <div className="text-xs text-muted-foreground">Visível para toda a equipe</div>
                  </div>
                  {newTagVisibility === 'public' && <Check size={16} className="text-green-500 flex-shrink-0" />}
                </label>

                {/* Private Option */}
                <label
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer border-2 transition-colors',
                    newTagVisibility === 'private' ? 'border-purple-500' : 'border-transparent'
                  )}
                >
                  <input
                    type="radio"
                    name="tag-visibility"
                    value="private"
                    checked={newTagVisibility === 'private'}
                    onChange={() => setNewTagVisibility('private')}
                    className="sr-only"
                  />
                  <div className="w-9 h-9 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <Lock size={18} className="text-purple-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground text-sm">Privada</div>
                    <div className="text-xs text-muted-foreground">Visível apenas para você</div>
                  </div>
                  {newTagVisibility === 'private' && <Check size={16} className="text-purple-500 flex-shrink-0" />}
                </label>

                {/* Department Option */}
                <label
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer border-2 transition-colors',
                    newTagVisibility === 'department' ? 'border-blue-500' : 'border-transparent'
                  )}
                >
                  <input
                    type="radio"
                    name="tag-visibility"
                    value="department"
                    checked={newTagVisibility === 'department'}
                    onChange={() => setNewTagVisibility('department')}
                    className="sr-only"
                  />
                  <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <Building2 size={18} className="text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground text-sm">Departamento</div>
                    <div className="text-xs text-muted-foreground">Visível para o departamento selecionado</div>
                  </div>
                  {newTagVisibility === 'department' && <Check size={16} className="text-blue-500 flex-shrink-0" />}
                </label>
              </div>

              {/* Department Select */}
              {newTagVisibility === 'department' && (
                <Select value={newTagDepartmentId} onValueChange={setNewTagDepartmentId}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Selecione o departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Preview */}
            <div className="pt-2">
              <p className="text-sm text-muted-foreground">Pré-visualização:</p>
              <span 
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium mt-2 text-white"
                style={{ backgroundColor: newTagColor }}
              >
                {newTagName || 'Nome da etiqueta'}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="ghost" 
              onClick={() => { 
                setShowCreateTagModal(false); 
                setNewTagName(''); 
                setNewTagColor('#8B5CF6'); 
                setNewTagDescription('');
                setNewTagVisibility('public');
                setNewTagDepartmentId('');
              }}
            >
              Cancelar
            </Button>
            <Button 
              className="btn-gradient text-white"
              onClick={() => {
                if (!newTagName.trim()) {
                  toast.error('Digite um nome para a etiqueta');
                  return;
                }
                if (newTagVisibility === 'department' && !newTagDepartmentId) {
                  toast.error('Selecione um departamento');
                  return;
                }
                createTag.mutate(
                  { 
                    name: newTagName.trim(), 
                    color: newTagColor,
                    description: newTagDescription.trim() || null,
                    visibility: newTagVisibility,
                    department_id: newTagVisibility === 'department' ? newTagDepartmentId : null,
                  },
                  {
                    onSuccess: (newTag) => {
                      // Automatically apply the tag to the current contact
                      if (selectedConversation?.contact?.id && newTag?.id) {
                        addTagToContact.mutate(
                          { contactId: selectedConversation.contact.id, tagId: newTag.id },
                          {
                            onSuccess: () => {
                              refetchContactTags();
                              toast.success('Etiqueta criada e aplicada!');
                            },
                            onError: () => {
                              toast.success('Etiqueta criada!');
                              toast.error('Erro ao aplicar etiqueta ao contato');
                            },
                          }
                        );
                      } else {
                        toast.success('Etiqueta criada com sucesso!');
                      }
                      setShowCreateTagModal(false);
                      setNewTagName('');
                      setNewTagColor('#8B5CF6');
                      setNewTagDescription('');
                      setNewTagVisibility('public');
                      setNewTagDepartmentId('');
                    },
                    onError: (error: any) => {
                      if (error.code === '23505') {
                        toast.error('Já existe uma etiqueta com este nome');
                      } else {
                        toast.error('Erro ao criar etiqueta');
                      }
                    },
                  }
                );
              }}
              disabled={createTag.isPending || !newTagName.trim()}
            >
              {createTag.isPending ? 'Criando...' : 'Criar etiqueta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Call Log Modal */}
      <CallLogModal
        open={showCallLogModal}
        onOpenChange={setShowCallLogModal}
        contact={selectedConversation?.contact ? {
          id: selectedConversation.contact.id,
          full_name: selectedConversation.contact.full_name,
          phone: selectedConversation.contact.phone,
        } : null}
        conversationId={selectedConversation?.id}
      />
    </div>
  );
}
