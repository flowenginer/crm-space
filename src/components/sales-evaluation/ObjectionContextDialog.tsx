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
  AlertCircle
} from 'lucide-react';

interface ObjectionContextDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objection: {
    name: string;
    originalKey: string;
    tratada: boolean;
    nota: number;
    trecho?: string;
  } | null;
}

function getScoreBgColor(score: number): string {
  if (score >= 8.5) return 'bg-green-100 border-green-200 text-green-700';
  if (score >= 7) return 'bg-blue-100 border-blue-200 text-blue-700';
  if (score >= 5) return 'bg-amber-100 border-amber-200 text-amber-700';
  if (score >= 3) return 'bg-orange-100 border-orange-200 text-orange-700';
  return 'bg-red-100 border-red-200 text-red-700';
}

interface ParsedMessage {
  role: 'cliente' | 'vendedor';
  content: string;
}

function parseTrecho(trecho: string): ParsedMessage[] {
  const messages: ParsedMessage[] = [];
  
  // Split by " | " to separate different messages
  const parts = trecho.split(' | ');
  
  for (const part of parts) {
    const trimmed = part.trim();
    
    // Check if starts with "Cliente:" or "Vendedor:"
    if (trimmed.toLowerCase().startsWith('cliente:')) {
      const content = trimmed.substring(8).trim().replace(/^['"]|['"]$/g, '');
      if (content) {
        messages.push({ role: 'cliente', content });
      }
    } else if (trimmed.toLowerCase().startsWith('vendedor:') || trimmed.toLowerCase().startsWith('vendedora:')) {
      const colonIndex = trimmed.indexOf(':');
      const content = trimmed.substring(colonIndex + 1).trim().replace(/^['"]|['"]$/g, '');
      if (content) {
        messages.push({ role: 'vendedor', content });
      }
    }
  }
  
  return messages;
}

export function ObjectionContextDialog({
  open,
  onOpenChange,
  objection,
}: ObjectionContextDialogProps) {
  if (!objection) return null;

  const parsedMessages = objection.trecho ? parseTrecho(objection.trecho) : [];

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
                  Trecho da conversa onde ocorreu a objeção
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
          {parsedMessages.length > 0 ? (
            <div className="space-y-4 py-2">
              {parsedMessages.map((message, index) => (
                message.role === 'cliente' ? (
                  // Mensagem do cliente - esquerda
                  <div key={index} className="flex gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="flex-1 max-w-[85%]">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium">Cliente</span>
                      </div>
                      <div className="bg-muted rounded-lg rounded-tl-none p-3 text-sm">
                        {message.content}
                      </div>
                    </div>
                  </div>
                ) : (
                  // Mensagem do vendedor - direita
                  <div key={index} className="flex gap-3 justify-end">
                    <div className="flex-1 max-w-[85%]">
                      <div className="flex items-center gap-2 mb-1 justify-end">
                        <span className="text-xs font-medium">Vendedor(a)</span>
                      </div>
                      <div className="bg-primary/10 border border-primary/20 rounded-lg rounded-tr-none p-3 text-sm">
                        {message.content}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <Headphones className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                  </div>
                )
              ))}
            </div>
          ) : objection.trecho ? (
            // Se tem trecho mas não conseguiu parsear, exibe o texto original
            <div className="py-4">
              <div className="bg-muted rounded-lg p-4 text-sm">
                {objection.trecho}
              </div>
            </div>
          ) : (
            // Sem trecho disponível
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mb-3 opacity-50" />
              <p className="text-sm font-medium">Trecho não disponível</p>
              <p className="text-xs mt-1 text-center max-w-sm">
                Esta avaliação não possui o trecho da conversa onde a objeção foi identificada.
              </p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
