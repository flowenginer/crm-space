import { useState, useEffect } from 'react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, FileText, AlertCircle, ImageIcon, VideoIcon, FileIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  useApprovedMetaTemplates, 
  useSyncMetaTemplates,
  extractTemplateVariables,
  extractDetailedVariables,
  getTemplateBody,
  getTemplateHeader,
  getTemplateFooter,
  type MetaMessageTemplate 
} from '@/hooks/useMetaTemplates';

interface MetaTemplateSelectorProps {
  selectedTemplateId?: string;
  onTemplateSelect: (template: MetaMessageTemplate | null) => void;
  variableValues?: Record<string, string>;
  onVariableChange?: (variables: Record<string, string>) => void;
  className?: string;
  showPreview?: boolean;
}

export function MetaTemplateSelector({
  selectedTemplateId,
  onTemplateSelect,
  variableValues = {},
  onVariableChange,
  className,
  showPreview = true,
}: MetaTemplateSelectorProps) {
  const { data: templates = [], isLoading } = useApprovedMetaTemplates();
  const syncTemplates = useSyncMetaTemplates();
  const [localVariables, setLocalVariables] = useState<Record<string, string>>(variableValues);

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
  const detailedVars = selectedTemplate 
    ? extractDetailedVariables(selectedTemplate.components) 
    : null;

  useEffect(() => {
    setLocalVariables(variableValues);
  }, [variableValues]);

  const handleVariableChange = (key: string, value: string) => {
    const newVariables = { ...localVariables, [key]: value };
    setLocalVariables(newVariables);
    onVariableChange?.(newVariables);
  };

  const getPreviewText = (text: string): string => {
    let preview = text;
    Object.entries(localVariables).forEach(([key, value]) => {
      if (key.startsWith('{{')) {
        preview = preview.replace(key, value || `[${key}]`);
      }
    });
    return preview;
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'MARKETING': return 'bg-purple-500/20 text-purple-500 border-purple-500/30';
      case 'UTILITY': return 'bg-blue-500/20 text-blue-500 border-blue-500/30';
      case 'AUTHENTICATION': return 'bg-orange-500/20 text-orange-500 border-orange-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getMediaIcon = (format: string) => {
    switch (format) {
      case 'IMAGE': return <ImageIcon className="h-4 w-4" />;
      case 'VIDEO': return <VideoIcon className="h-4 w-4" />;
      case 'DOCUMENT': return <FileIcon className="h-4 w-4" />;
      default: return null;
    }
  };

  const getMediaLabel = (format: string) => {
    switch (format) {
      case 'IMAGE': return 'URL da imagem do cabeçalho';
      case 'VIDEO': return 'URL do vídeo do cabeçalho';
      case 'DOCUMENT': return 'URL do documento do cabeçalho';
      default: return 'URL da mídia do cabeçalho';
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Label htmlFor="template-select" className="mb-2 block">
            Template Meta (API Oficial)
          </Label>
          <Select
            value={selectedTemplateId ?? undefined}
            onValueChange={(value) => {
              const template = templates.find(t => t.id === value);
              onTemplateSelect(template || null);
              setLocalVariables({});
            }}
          >
            <SelectTrigger id="template-select" className="bg-background">
              <SelectValue placeholder="Selecione um template...">
                {selectedTemplate && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{selectedTemplate.name}</span>
                    <Badge 
                      variant="outline" 
                      className={cn('text-[10px] px-1.5 py-0', getCategoryColor(selectedTemplate.category))}
                    >
                      {selectedTemplate.category}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      ({selectedTemplate.language})
                    </span>
                  </div>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              {templates.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  <p>Nenhum template aprovado encontrado</p>
                  <p className="text-xs">Sincronize ou crie templates primeiro</p>
                </div>
              ) : (
                templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{template.name}</span>
                      <Badge 
                        variant="outline" 
                        className={cn('text-[10px] px-1.5 py-0', getCategoryColor(template.category))}
                      >
                        {template.category}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        ({template.language})
                      </span>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => syncTemplates.mutate()}
          disabled={syncTemplates.isPending}
          className="mt-6"
          title="Sincronizar templates da Meta"
        >
          <RefreshCw className={cn('h-4 w-4', syncTemplates.isPending && 'animate-spin')} />
        </Button>
      </div>

      {/* Media header URL input — REQUIRED for templates with media headers */}
      {selectedTemplate && detailedVars?.hasMediaHeader && (
        <div className="space-y-2 rounded-lg border p-4 bg-muted/30">
          <Label className="text-sm font-medium flex items-center gap-2">
            {getMediaIcon(detailedVars.headerFormat!)}
            Mídia do Cabeçalho
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-destructive text-destructive">
              Obrigatório
            </Badge>
          </Label>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              {getMediaLabel(detailedVars.headerFormat!)}
            </Label>
            <Input
              placeholder="https://exemplo.com/imagem.jpg"
              value={localVariables['header_media_url'] || ''}
              onChange={(e) => handleVariableChange('header_media_url', e.target.value)}
              className="bg-background"
            />
            <p className="text-xs text-muted-foreground">
              Informe a URL pública da mídia que será enviada no cabeçalho do template.
            </p>
          </div>
        </div>
      )}

      {/* Header text variables */}
      {selectedTemplate && detailedVars && detailedVars.headerVarCount > 0 && (
        <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
          <Label className="text-sm font-medium">
            Variáveis do Cabeçalho ({detailedVars.headerVarCount})
          </Label>
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: detailedVars.headerVarCount }, (_, i) => i + 1).map((num) => (
              <div key={`header-${num}`} className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Cabeçalho {`{{${num}}}`}
                </Label>
                <Input
                  placeholder={`Valor para {{${num}}}`}
                  value={localVariables[`{{${num}}}`] || ''}
                  onChange={(e) => handleVariableChange(`{{${num}}}`, e.target.value)}
                  className="bg-background"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Body variables */}
      {selectedTemplate && detailedVars && detailedVars.bodyVarCount > 0 && (
        <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
          <Label className="text-sm font-medium">
            Variáveis do Corpo ({detailedVars.bodyVarCount})
          </Label>
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: detailedVars.bodyVarCount }, (_, i) => {
              const varNum = detailedVars.headerVarCount + i + 1;
              return (
                <div key={`body-${varNum}`} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Corpo {`{{${varNum}}}`}
                  </Label>
                  <Input
                    placeholder={`Valor para {{${varNum}}}`}
                    value={localVariables[`{{${varNum}}}`] || ''}
                    onChange={(e) => handleVariableChange(`{{${varNum}}}`, e.target.value)}
                    className="bg-background"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedTemplate && showPreview && (
        <div className="rounded-lg border bg-muted/30 overflow-hidden">
          <div className="bg-muted/50 px-3 py-2 border-b flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Pré-visualização
            </span>
            <Badge 
              variant="outline" 
              className={cn('text-[10px]', getCategoryColor(selectedTemplate.category))}
            >
              {selectedTemplate.category}
            </Badge>
          </div>
          <div className="p-4 space-y-2">
            {detailedVars?.hasMediaHeader && localVariables['header_media_url'] && (
              <div className="text-xs text-muted-foreground italic flex items-center gap-1">
                {getMediaIcon(detailedVars.headerFormat!)}
                <span>Mídia: {localVariables['header_media_url'].substring(0, 50)}...</span>
              </div>
            )}
            {getTemplateHeader(selectedTemplate.components) && (
              <div className="font-semibold text-sm">
                {getPreviewText(getTemplateHeader(selectedTemplate.components)!)}
              </div>
            )}
            <div className="text-sm whitespace-pre-wrap">
              {getPreviewText(getTemplateBody(selectedTemplate.components))}
            </div>
            {getTemplateFooter(selectedTemplate.components) && (
              <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                {getPreviewText(getTemplateFooter(selectedTemplate.components)!)}
              </div>
            )}
          </div>
        </div>
      )}

      {!selectedTemplate && templates.length === 0 && !isLoading && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10">
          <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-yellow-600">Nenhum template disponível</p>
            <p className="text-muted-foreground mt-1">
              Configure a API Cloud e sincronize seus templates, ou crie novos templates que serão 
              enviados para aprovação da Meta.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}