import { useState, useRef } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Loader2, Info, AlertTriangle, Upload, CheckCircle2, ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCreateMetaTemplate, useUploadMetaMedia, type MetaTemplateComponent } from '@/hooks/useMetaTemplates';

interface MetaTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LANGUAGES = [
  { code: 'pt_BR', label: 'Português (Brasil)' },
  { code: 'en_US', label: 'English (US)' },
  { code: 'es', label: 'Español' },
];

const CATEGORIES = [
  { value: 'MARKETING', label: 'Marketing', description: 'Promoções, ofertas e novidades' },
  { value: 'UTILITY', label: 'Utilidade', description: 'Atualizações de pedidos, lembretes' },
  { value: 'AUTHENTICATION', label: 'Autenticação', description: 'Códigos de verificação' },
];

type ButtonType = {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
  text: string;
  url?: string;
  phone_number?: string;
};

type HeaderType = 'none' | 'text' | 'image';

export function MetaTemplateModal({ open, onOpenChange }: MetaTemplateModalProps) {
  const createTemplate = useCreateMetaTemplate();
  const uploadMedia = useUploadMetaMedia();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [language, setLanguage] = useState('pt_BR');
  const [category, setCategory] = useState<'MARKETING' | 'UTILITY' | 'AUTHENTICATION'>('MARKETING');
  const [headerType, setHeaderType] = useState<HeaderType>('none');
  const [headerText, setHeaderText] = useState('');
  const [headerImageHandle, setHeaderImageHandle] = useState<string | null>(null);
  const [headerImageName, setHeaderImageName] = useState<string | null>(null);
  const [bodyText, setBodyText] = useState('');
  const [footerText, setFooterText] = useState('');
  const [buttons, setButtons] = useState<ButtonType[]>([]);
  const [exampleValues, setExampleValues] = useState<string[]>([]);

  // Extract variables count from body
  const variableMatches = bodyText.match(/\{\{\d+\}\}/g) || [];
  const variableCount = new Set(variableMatches).size;

  const handleAddButton = () => {
    if (buttons.length >= 3) return;
    setButtons([...buttons, { type: 'QUICK_REPLY', text: '' }]);
  };

  const handleRemoveButton = (index: number) => {
    setButtons(buttons.filter((_, i) => i !== index));
  };

  const handleButtonChange = (index: number, field: keyof ButtonType, value: string) => {
    const newButtons = [...buttons];
    newButtons[index] = { ...newButtons[index], [field]: value };
    setButtons(newButtons);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    const validTypes = ['image/jpeg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      toast.error('Formato inválido. Use apenas JPG ou PNG.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Arquivo muito grande. O tamanho máximo é 5MB.');
      return;
    }

    setHeaderImageName(file.name);
    setHeaderImageHandle(null);

    try {
      const handle = await uploadMedia.mutateAsync(file);
      setHeaderImageHandle(handle);
    } catch (error) {
      console.error('[MetaTemplateModal] Upload error:', error);
      setHeaderImageName(null);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleHeaderTypeChange = (value: HeaderType) => {
    setHeaderType(value);
    if (value !== 'text') setHeaderText('');
    if (value !== 'image') {
      setHeaderImageHandle(null);
      setHeaderImageName(null);
    }
  };

  const handleSubmit = async () => {
    if (!/^[a-z0-9_]+$/.test(name)) return;
    if (!bodyText.trim()) return;

    const components: MetaTemplateComponent[] = [];

    // Header component
    if (headerType === 'text' && headerText.trim()) {
      components.push({
        type: 'HEADER',
        format: 'TEXT',
        text: headerText,
      });
    } else if (headerType === 'image' && headerImageHandle) {
      components.push({
        type: 'HEADER',
        format: 'IMAGE',
        example: {
          header_handle: [headerImageHandle],
        },
      });
    }

    // Body component with example values
    const bodyComponent: MetaTemplateComponent = {
      type: 'BODY',
      text: bodyText,
    };

    if (variableCount > 0 && exampleValues.length >= variableCount) {
      bodyComponent.example = {
        body_text: [exampleValues.slice(0, variableCount)],
      };
    }

    components.push(bodyComponent);

    if (footerText.trim()) {
      components.push({
        type: 'FOOTER',
        text: footerText,
      });
    }

    if (buttons.length > 0) {
      components.push({
        type: 'BUTTONS',
        buttons: buttons.filter(b => b.text.trim()),
      });
    }

    try {
      await createTemplate.mutateAsync({
        name,
        language,
        category,
        components,
      });

      // Reset form
      setName('');
      setHeaderType('none');
      setHeaderText('');
      setHeaderImageHandle(null);
      setHeaderImageName(null);
      setBodyText('');
      setFooterText('');
      setButtons([]);
      setExampleValues([]);
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const isImageReady = headerType !== 'image' || !!headerImageHandle;
  const isValid = name && /^[a-z0-9_]+$/.test(name) && bodyText.trim() && 
    (variableCount === 0 || exampleValues.length >= variableCount) && isImageReady;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Novo Template</DialogTitle>
          <DialogDescription>
            O template será enviado para revisão da Meta (geralmente 24-48 horas).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="name">
                Nome do Template *
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                placeholder="meu_template"
                className={cn(
                  'font-mono',
                  name && !/^[a-z0-9_]+$/.test(name) && 'border-red-500'
                )}
              />
              <p className="text-xs text-muted-foreground">
                Apenas letras minúsculas, números e underscore
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">Idioma *</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger id="language" className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoria *</Label>
              <Select 
                value={category} 
                onValueChange={(v) => setCategory(v as typeof category)}
              >
                <SelectTrigger id="category" className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <div className="flex flex-col">
                        <span>{cat.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Header */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Label>Cabeçalho (opcional)</Label>
              <Select value={headerType} onValueChange={(v) => handleHeaderTypeChange(v as HeaderType)}>
                <SelectTrigger className="w-[140px] bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="none">Nenhum</SelectItem>
                  <SelectItem value="text">Texto</SelectItem>
                  <SelectItem value="image">Imagem</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {headerType === 'text' && (
              <div className="space-y-2">
                <Input
                  value={headerText}
                  onChange={(e) => setHeaderText(e.target.value)}
                  placeholder="Título da mensagem"
                  maxLength={60}
                />
                <p className="text-xs text-muted-foreground">
                  {headerText.length}/60 caracteres
                </p>
              </div>
            )}

            {headerType === 'image' && (
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={handleImageSelect}
                />

                {!headerImageName && !uploadMedia.isPending && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <div className="text-center">
                      <p className="text-sm font-medium text-foreground">Selecionar imagem</p>
                      <p className="text-xs text-muted-foreground mt-1">JPG ou PNG, máximo 5MB</p>
                    </div>
                  </button>
                )}

                {uploadMedia.isPending && (
                  <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/30">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <div>
                      <p className="text-sm font-medium">Fazendo upload...</p>
                      <p className="text-xs text-muted-foreground">{headerImageName}</p>
                    </div>
                  </div>
                )}

                {headerImageHandle && headerImageName && (
                  <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="text-sm font-medium">Imagem carregada</p>
                        <p className="text-xs text-muted-foreground">{headerImageName}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setHeaderImageHandle(null);
                        setHeaderImageName(null);
                      }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {!uploadMedia.isPending && headerImageName && !headerImageHandle && (
                  <div className="flex items-center gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/10">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <div>
                      <p className="text-sm font-medium text-destructive">Erro no upload</p>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs"
                        onClick={() => {
                          setHeaderImageName(null);
                          fileInputRef.current?.click();
                        }}
                      >
                        Tentar novamente
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label htmlFor="body">
              Corpo da Mensagem *
            </Label>
            <Textarea
              id="body"
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder="Olá {{1}}, temos uma oferta especial para você! Use o cupom {{2}} e ganhe desconto."
              rows={4}
              maxLength={1024}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{bodyText.length}/1024 caracteres</span>
              {variableCount > 0 && (
                <Badge variant="outline" className="text-xs">
                  {variableCount} variáveis
                </Badge>
              )}
            </div>
          </div>

          {/* Example Values for Variables */}
          {variableCount > 0 && (
            <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-500" />
                <Label className="text-sm font-medium">
                  Valores de exemplo para as variáveis
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                A Meta exige exemplos para aprovar o template
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: variableCount }, (_, i) => i + 1).map((num) => (
                  <div key={num} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Exemplo para {`{{${num}}}`}
                    </Label>
                    <Input
                      placeholder={`Ex: ${num === 1 ? 'João' : num === 2 ? 'DESCONTO10' : 'valor'}`}
                      value={exampleValues[num - 1] || ''}
                      onChange={(e) => {
                        const newValues = [...exampleValues];
                        newValues[num - 1] = e.target.value;
                        setExampleValues(newValues);
                      }}
                      className="bg-background"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="space-y-2">
            <Label htmlFor="footer">Rodapé (opcional)</Label>
            <Input
              id="footer"
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              placeholder="Responda SAIR para cancelar"
              maxLength={60}
            />
            <p className="text-xs text-muted-foreground">
              {footerText.length}/60 caracteres
            </p>
          </div>

          {/* Buttons */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Botões (opcional)</Label>
              {buttons.length < 3 && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleAddButton}
                  className="gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar
                </Button>
              )}
            </div>

            {buttons.map((button, index) => (
              <div key={index} className="flex gap-3 items-start p-3 rounded-lg border bg-muted/30">
                <div className="flex-1 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo</Label>
                    <Select 
                      value={button.type} 
                      onValueChange={(v) => handleButtonChange(index, 'type', v)}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="QUICK_REPLY">Resposta Rápida</SelectItem>
                        <SelectItem value="URL">Link</SelectItem>
                        <SelectItem value="PHONE_NUMBER">Telefone</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Texto do Botão</Label>
                    <Input
                      value={button.text}
                      onChange={(e) => handleButtonChange(index, 'text', e.target.value)}
                      placeholder="Texto do botão"
                      maxLength={25}
                      className="bg-background"
                    />
                  </div>

                  {button.type === 'URL' && (
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">URL</Label>
                      <Input
                        value={button.url || ''}
                        onChange={(e) => handleButtonChange(index, 'url', e.target.value)}
                        placeholder="https://exemplo.com"
                        className="bg-background"
                      />
                    </div>
                  )}

                  {button.type === 'PHONE_NUMBER' && (
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-xs">Número de Telefone</Label>
                      <Input
                        value={button.phone_number || ''}
                        onChange={(e) => handleButtonChange(index, 'phone_number', e.target.value)}
                        placeholder="+5511999999999"
                        className="bg-background"
                      />
                    </div>
                  )}
                </div>

                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => handleRemoveButton(index)}
                  className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {buttons.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Máximo de 3 botões por template
              </p>
            )}
          </div>

          {/* Warning */}
          <div className="flex items-start gap-3 p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10">
            <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-yellow-600">Importante</p>
              <ul className="text-muted-foreground mt-1 space-y-1 list-disc list-inside">
                <li>Templates passam por revisão da Meta (24-48h)</li>
                <li>Templates MARKETING precisam de opt-in do usuário</li>
                <li>Mensagens enviadas fora da janela de 24h são cobradas</li>
              </ul>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!isValid || createTemplate.isPending}
          >
            {createTemplate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar para Aprovação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
