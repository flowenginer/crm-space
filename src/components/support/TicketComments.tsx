import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useTicketComments, useAddComment, useIsSupportTechnician } from '@/hooks/useSupportTickets';
import { TicketComment } from '@/types/support';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Send, Loader2, Lock, MessageSquare } from 'lucide-react';

interface TicketCommentsProps {
  ticketId: string;
}

function CommentItem({ comment }: { comment: TicketComment }) {
  const authorInitials = comment.author?.full_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || '?';

  return (
    <div className={`flex gap-3 p-3 rounded-lg ${comment.is_internal ? 'bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800' : 'bg-muted/50'}`}>
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarImage src={comment.author?.avatar_url || undefined} />
        <AvatarFallback className="text-xs">{authorInitials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm">{comment.author?.full_name || 'Desconhecido'}</span>
          {comment.is_internal && (
            <span className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
              <Lock className="h-3 w-3" />
              Nota interna
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: ptBR })}
          </span>
        </div>
        <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
      </div>
    </div>
  );
}

export function TicketComments({ ticketId }: TicketCommentsProps) {
  const [newComment, setNewComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  
  const { data: comments, isLoading } = useTicketComments(ticketId);
  const { data: isTechnician } = useIsSupportTechnician();
  const addComment = useAddComment();

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    
    try {
      await addComment.mutateAsync({
        ticketId,
        content: newComment,
        isInternal: isTechnician ? isInternal : false,
      });
      setNewComment('');
      setIsInternal(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Comentários
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-16 w-full" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Comentários ({comments?.length || 0})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {comments && comments.length > 0 ? (
          <div className="space-y-3">
            {comments.map((comment) => (
              <CommentItem key={comment.id} comment={comment} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum comentário ainda.
          </p>
        )}

        <div className="border-t pt-4 space-y-3">
          <Textarea
            placeholder="Escreva um comentário..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[100px]"
          />
          
          <div className="flex items-center justify-between">
            {isTechnician && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="internal"
                  checked={isInternal}
                  onCheckedChange={(checked) => setIsInternal(!!checked)}
                />
                <Label htmlFor="internal" className="text-sm flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Nota interna (só visível para técnicos)
                </Label>
              </div>
            )}
            
            <Button 
              onClick={handleSubmit} 
              disabled={!newComment.trim() || addComment.isPending}
              className="ml-auto"
            >
              {addComment.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Enviar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
