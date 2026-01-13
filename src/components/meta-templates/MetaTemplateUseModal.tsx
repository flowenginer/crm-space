import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Send, MessageSquare, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { 
  MetaMessageTemplate,
  extractTemplateVariables,
  getTemplateBody,
  getTemplateHeader,
  getTemplateFooter
} from '@/hooks/useMetaTemplates';

interface MetaTemplateUseModalProps {
  template: MetaMessageTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend?: (templateId: string, templateName: string, variables: Record<string, string>) => void;
  onCopyToInput?: (content: string) => void;
  contactName?: string;
}

export function MetaTemplateUseModal({
  template,
  open,
  onOpenChange,
  onSend,
  onCopyToInput,
  contactName,
}: MetaTemplateUseModalProps) {
  const [variables, setVariables] = useState<Record<string, string>>({});

  const variableCount = useMemo(() => {
    if (!template) return 0;
    return extractTemplateVariables(template.components);
  }, [template]);

  const bodyText = useMemo(() => {
    if (!template) return '';
    return getTemplateBody(template.components);
  }, [template]);

  const headerText = useMemo(() => {
    if (!template) return null;
    return getTemplateHeader(template.components);
  }, [template]);

  const footerText = useMemo(() => {
    if (!template) return null;
    return getTemplateFooter(template.components);
  }, [template]);

  // Build preview with variables replaced
  const previewContent = useMemo(() => {
    let content = bodyText;
    
    for (let i = 1; i <= variableCount; i++) {
      const value = variables[String(i)] || `{{${i}}}`;
      content = content.replace(new RegExp(`\\{\\{${i}\\}\\}`, 'g'), value);
    }
    
    return content;
  }, [bodyText, variables, variableCount]);

  const handleVariableChange = (key: string, value: string) => {
    setVariables(prev => ({ ...prev, [key]: value }));
  };

  const handleCopy = () => {
    let fullContent = '';
    if (headerText) fullContent += headerText + '\n\n';
    fullContent += previewContent;
    if (footerText) fullContent += '\n\n' + footerText;
    
    navigator.clipboard.writeText(fullContent);
    toast.success('Conteúdo copiado para a área de transferência!');
    onOpenChange(false);
  };

  const handleCopyToInput = () => {
    let fullContent = '';
    if (headerText) fullContent += headerText + '\n\n';
    fullContent += previewContent;
    if (footerText) fullContent += '\n\n' + footerText;
    
    onCopyToInput?.(fullContent);
    onOpenChange(false);
  };

  const handleSend = () => {
    if (!template) return;
    
    // Check if all variables are filled
    for (let i = 1; i <= variableCount; i++) {
      if (!variables[String(i)]) {
        toast.error(`Preencha a variável {{${i}}}`);
        return;
      }
    }
    
    onSend?.(template.id, template.name, variables);
    onOpenChange(false);
  };

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Usar Template: {template.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Variables Form */}
          {variableCount > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Preencha as variáveis:</Label>
              <div className="grid gap-2">
                {Array.from({ length: variableCount }, (_, i) => i + 1).map((num) => (
                  <div key={num} className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-12">{`{{${num}}}`}</span>
                    <Input
                      placeholder={num === 1 && contactName ? contactName : `Valor para {{${num}}}`}
                      value={variables[String(num)] || ''}
                      onChange={(e) => handleVariableChange(String(num), e.target.value)}
                      className="flex-1"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Preview:</Label>
            <div className="bg-muted/50 rounded-lg p-4 border">
              {/* WhatsApp-style bubble */}
              <div className="bg-[#dcf8c6] dark:bg-green-800/30 rounded-lg p-3 max-w-xs ml-auto shadow-sm">
                {headerText && (
                  <p className="font-semibold text-sm mb-1">{headerText}</p>
                )}
                <p className="text-sm whitespace-pre-wrap">{previewContent}</p>
                {footerText && (
                  <p className="text-xs text-muted-foreground mt-2">{footerText}</p>
                )}
                <div className="flex items-center justify-end gap-1 mt-1">
                  <span className="text-[10px] text-muted-foreground">
                    {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <CheckCircle className="h-3 w-3 text-blue-500" />
                </div>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-2">
            <p>
              <strong>Nota:</strong> Este é um template aprovado pela Meta. 
              Pode ser enviado para contatos fora da janela de 24 horas.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCopy}>
            <Copy className="h-4 w-4 mr-2" />
            Copiar
          </Button>
          {onCopyToInput && (
            <Button variant="secondary" onClick={handleCopyToInput}>
              Inserir no Chat
            </Button>
          )}
          {onSend && (
            <Button onClick={handleSend}>
              <Send className="h-4 w-4 mr-2" />
              Enviar Template
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
