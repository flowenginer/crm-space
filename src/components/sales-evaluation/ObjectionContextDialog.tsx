import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  CheckCircle2, 
  XCircle, 
  MessageCircle, 
  User, 
  Headphones,
  Search,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useObjectionContext } from '@/hooks/useObjectionContext';

interface ObjectionContextDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  objection: {
    name: string;
    originalKey: string;
    tratada: boolean;
    nota: number;
  } | null;
}

function getScoreColor(score: number): string {
  if (score >= 8.5) return 'text-green-600';
  if (score >= 7) return 'text-blue-600';
  if (score >= 5) return 'text-amber-600';
  if (score >= 3) return 'text-orange-600';
  return 'text-red-600';
}

function getScoreBgColor(score: number): string {
  if (score >= 8.5) return 'bg-green-100 border-green-200 text-green-700';
  if (score >= 7) return 'bg-blue-100 border-blue-200 text-blue-700';
  if (score >= 5) return 'bg-amber-100 border-amber-200 text-amber-700';
  if (score >= 3) return 'bg-orange-100 border-orange-200 text-orange-700';
  return 'bg-red-100 border-red-200 text-red-700';
}

export function ObjectionContextDialog({
  open,
  onOpenChange,
  conversationId,
  objection,
}: ObjectionContextDialogProps) {
  const { data, isLoading, error } = useObjectionContext(
    open ? conversationId : null,
    open ? objection?.originalKey || null : null
  );

  if (!objection) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {objection.tratada ? (
                <div className="p-2 rounded-full bg-green-100">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
              ) : (
                <div className="p-2 rounded-full bg-red-100">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
              )}
              <div>
                <DialogTitle className="text-lg">{objection.name}</DialogTitle>
                <DialogDescription className="flex items-center gap-2 mt-1">
                  <MessageCircle className="h-3 w-3" />
                  Contexto da objeção na conversa
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge 
                variant="outline" 
                className={objection.tratada ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}
              >
                {objection.tratada ? 'Tratada' : 'Não Tratada'}
              </Badge>
              {objection.nota > 0 && (
                <Badge variant="outline" className={getScoreBgColor(objection.nota)}>
                  Nota: {objection.nota.toFixed(1)}
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <Separator className="my-2" />

        <ScrollArea className="flex-1 pr-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-3" />
              <p className="text-sm">Buscando contexto na conversa...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mb-3 text-red-500" />
              <p className="text-sm">Erro ao buscar contexto</p>
              <p className="text-xs mt-1">{(error as Error).message}</p>
            </div>
          ) : data?.contexts && data.contexts.length > 0 ? (
            <div className="space-y-6">
              {data.keywordsUsed && data.keywordsUsed.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                  <Search className="h-3.5 w-3.5" />
                  <span>Palavras-chave: {data.keywordsUsed.slice(0, 5).join(', ')}</span>
                </div>
              )}
              
              {data.contexts.map((context, index) => (
                <div key={index} className="space-y-3">
                  {index > 0 && <Separator className="my-4" />}
                  
                  <div className="text-xs font-medium text-muted-foreground mb-2">
                    Momento {index + 1}
                    {context.matchedKeywords.length > 0 && (
                      <span className="ml-2 text-primary">
                        ({context.matchedKeywords.join(', ')})
                      </span>
                    )}
                  </div>
                  
                  {/* Mensagem do cliente */}
                  <div className="flex gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium">Cliente</span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(context.customerMessage.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <div className="bg-muted rounded-lg rounded-tl-none p-3 text-sm">
                        {context.customerMessage.content}
                      </div>
                    </div>
                  </div>

                  {/* Respostas da vendedora */}
                  {context.vendorResponses.length > 0 ? (
                    context.vendorResponses.map((response, respIndex) => (
                      <div key={respIndex} className="flex gap-3 justify-end">
                        <div className="flex-1 max-w-[85%]">
                          <div className="flex items-center gap-2 mb-1 justify-end">
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(response.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </span>
                            <span className="text-xs font-medium">Vendedor(a)</span>
                          </div>
                          <div className="bg-primary/10 border border-primary/20 rounded-lg rounded-tr-none p-3 text-sm">
                            {response.content}
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                            <Headphones className="h-4 w-4 text-primary" />
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex gap-3 justify-end">
                      <div className="flex-1 max-w-[85%]">
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600 italic">
                          Nenhuma resposta identificada após esta mensagem
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                          <XCircle className="h-4 w-4 text-red-500" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Search className="h-8 w-8 mb-3 opacity-50" />
              <p className="text-sm font-medium">Contexto não encontrado</p>
              <p className="text-xs mt-1 text-center max-w-sm">
                Não foi possível identificar automaticamente o momento exato desta objeção na conversa.
              </p>
              {data?.keywordsUsed && data.keywordsUsed.length > 0 && (
                <p className="text-xs mt-3 text-center text-muted-foreground">
                  Palavras buscadas: {data.keywordsUsed.slice(0, 5).join(', ')}
                </p>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
