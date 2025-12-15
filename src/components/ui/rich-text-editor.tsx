import { useState, useCallback } from 'react';
import Editor from 'react-simple-wysiwyg';
import { 
  Bold, 
  Italic, 
  Underline, 
  Highlighter,
  List,
  ListOrdered,
  Strikethrough
} from 'lucide-react';
import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from './dropdown-menu';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
}

const HIGHLIGHT_COLORS = [
  { name: 'Amarelo', color: '#fef08a', textColor: '#000' },
  { name: 'Vermelho', color: '#fecaca', textColor: '#000' },
  { name: 'Verde', color: '#bbf7d0', textColor: '#000' },
  { name: 'Azul', color: '#bfdbfe', textColor: '#000' },
  { name: 'Roxo', color: '#ddd6fe', textColor: '#000' },
  { name: 'Laranja', color: '#fed7aa', textColor: '#000' },
];

function execCommand(command: string, value?: string) {
  document.execCommand(command, false, value);
}

// Verifica se uma cor de fundo é um destaque real (não branco/neutro)
function isHighlightColor(color: string): boolean {
  if (!color) return false;
  const lowerColor = color.toLowerCase().trim();
  
  // Cores neutras que devem ser ignoradas
  const neutralPatterns = [
    'white', '#fff', '#ffffff', 'transparent', 'inherit', 'initial', 'unset',
    'rgb(255, 255, 255)', 'rgb(255,255,255)', 'rgba(255, 255, 255',
    'rgba(0, 0, 0, 0)', 'rgba(0,0,0,0)'
  ];
  
  if (neutralPatterns.some(p => lowerColor.includes(p))) return false;
  
  // Verificar RGB com valores muito claros (quase branco)
  const rgbMatch = lowerColor.match(/rgb[a]?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch.map(Number);
    // Se todos os valores são > 250, é praticamente branco
    if (r > 250 && g > 250 && b > 250) return false;
  }
  
  return true;
}

// Sanitiza HTML colado removendo estruturas indesejadas e preservando formatação essencial
function sanitizeHtml(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  // Função para extrair estilos importantes de um elemento
  const getImportantStyles = (el: HTMLElement): string => {
    const styles: string[] = [];
    const computed = el.style;
    
    // Preservar background-color apenas se for destaque real
    if (computed.backgroundColor && isHighlightColor(computed.backgroundColor)) {
      styles.push(`background-color: ${computed.backgroundColor}`);
    }
    
    // Preservar font-weight (negrito)
    if (computed.fontWeight && (computed.fontWeight === 'bold' || parseInt(computed.fontWeight) >= 700)) {
      styles.push('font-weight: bold');
    }
    
    // Preservar font-style (itálico)
    if (computed.fontStyle === 'italic') {
      styles.push('font-style: italic');
    }
    
    // Preservar text-decoration (sublinhado, riscado)
    if (computed.textDecoration && computed.textDecoration !== 'none') {
      styles.push(`text-decoration: ${computed.textDecoration}`);
    }
    
    return styles.join('; ');
  };
  
  // Função recursiva para limpar elementos
  const cleanElement = (el: Element): string => {
    let result = '';
    
    el.childNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.textContent || '';
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        const tagName = element.tagName.toLowerCase();
        
        // Pular elementos de tabela, converter para texto com quebras
        if (['table', 'tbody', 'thead', 'tfoot'].includes(tagName)) {
          result += cleanElement(element);
        } else if (tagName === 'tr') {
          result += cleanElement(element) + '<br>';
        } else if (['td', 'th'].includes(tagName)) {
          result += cleanElement(element) + ' ';
        }
        // Preservar tags semânticas
        else if (['b', 'strong'].includes(tagName)) {
          result += `<strong>${cleanElement(element)}</strong>`;
        } else if (['i', 'em'].includes(tagName)) {
          result += `<em>${cleanElement(element)}</em>`;
        } else if (tagName === 'u') {
          result += `<u>${cleanElement(element)}</u>`;
        } else if (['s', 'strike', 'del'].includes(tagName)) {
          result += `<s>${cleanElement(element)}</s>`;
        } else if (tagName === 'br') {
          result += '<br>';
        } else if (['p', 'div'].includes(tagName)) {
          const content = cleanElement(element);
          if (content.trim()) {
            // Usar apenas texto + quebra de linha, sem envolver em div
            result += content + '<br>';
          }
        } else if (['ul', 'ol', 'li'].includes(tagName)) {
          result += `<${tagName}>${cleanElement(element)}</${tagName}>`;
        } else if (tagName === 'span') {
          const styles = getImportantStyles(element);
          const content = cleanElement(element);
          if (styles) {
            result += `<span style="${styles}">${content}</span>`;
          } else {
            result += content;
          }
        } else if (tagName === 'mark') {
          result += `<mark>${cleanElement(element)}</mark>`;
        } else if (tagName === 'a') {
          const href = element.getAttribute('href');
          if (href) {
            result += `<a href="${href}">${cleanElement(element)}</a>`;
          } else {
            result += cleanElement(element);
          }
        } else {
          // Para outros elementos, verificar se tem estilos importantes
          const styles = getImportantStyles(element);
          const content = cleanElement(element);
          if (styles) {
            result += `<span style="${styles}">${content}</span>`;
          } else {
            result += content;
          }
        }
      }
    });
    
    return result;
  };
  
  let cleaned = cleanElement(doc.body);
  
  // Limpar múltiplas quebras de linha consecutivas
  cleaned = cleaned.replace(/(<br\s*\/?>\s*){3,}/gi, '<br><br>');
  // Remover quebra no início e fim
  cleaned = cleaned.replace(/^(<br\s*\/?>)+/gi, '').replace(/(<br\s*\/?>)+$/gi, '');
  
  return cleaned;
}

function ToolbarButton({ 
  onClick, 
  active, 
  children,
  title 
}: { 
  onClick: () => void; 
  active?: boolean; 
  children: React.ReactNode;
  title: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        "h-8 w-8 p-0",
        active && "bg-muted"
      )}
      onClick={onClick}
      title={title}
    >
      {children}
    </Button>
  );
}

export function RichTextEditor({ 
  value, 
  onChange, 
  placeholder = 'Digite aqui...',
  minHeight = '160px',
  className 
}: RichTextEditorProps) {
  const [, setForceUpdate] = useState(0);

  const handleChange = (e: { target: { value: string } }) => {
    onChange(e.target.value);
  };

  const handleFormat = (command: string, value?: string) => {
    execCommand(command, value);
    setForceUpdate(prev => prev + 1);
  };

  const handleHighlight = (color: string) => {
    execCommand('hiliteColor', color);
    setForceUpdate(prev => prev + 1);
  };

  // Handler para limpar HTML colado
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    
    if (html) {
      const cleanedHtml = sanitizeHtml(html);
      document.execCommand('insertHTML', false, cleanedHtml);
    } else if (text) {
      // Converter quebras de linha em <br>
      const htmlText = text.replace(/\n/g, '<br>');
      document.execCommand('insertHTML', false, htmlText);
    }
  }, []);

  return (
    <div className={cn("rounded-md border bg-background overflow-hidden", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 p-1.5 border-b bg-muted/30 flex-wrap">
        <ToolbarButton 
          onClick={() => handleFormat('bold')} 
          title="Negrito"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        
        <ToolbarButton 
          onClick={() => handleFormat('italic')} 
          title="Itálico"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        
        <ToolbarButton 
          onClick={() => handleFormat('underline')} 
          title="Sublinhado"
        >
          <Underline className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton 
          onClick={() => handleFormat('strikeThrough')} 
          title="Riscado"
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Highlight Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              title="Marca-texto"
            >
              <Highlighter className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {HIGHLIGHT_COLORS.map(({ name, color }) => (
              <DropdownMenuItem
                key={color}
                onClick={() => handleHighlight(color)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <div 
                  className="w-4 h-4 rounded border" 
                  style={{ backgroundColor: color }} 
                />
                {name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem
              onClick={() => handleFormat('removeFormat')}
              className="flex items-center gap-2 cursor-pointer"
            >
              <div className="w-4 h-4 rounded border bg-background" />
              Remover formatação
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="w-px h-5 bg-border mx-1" />

        <ToolbarButton 
          onClick={() => handleFormat('insertUnorderedList')} 
          title="Lista com marcadores"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>

        <ToolbarButton 
          onClick={() => handleFormat('insertOrderedList')} 
          title="Lista numerada"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* Editor */}
      <div onPaste={handlePaste}>
        <Editor
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          containerProps={{
            style: {
              minHeight,
              resize: 'vertical',
            }
          }}
          className="rsw-editor [&_.rsw-ce]:outline-none [&_.rsw-ce]:p-3 [&_.rsw-ce]:min-h-[inherit] [&_.rsw-ce]:text-sm [&_.rsw-ce_*]:border-none [&_.rsw-ce_*]:outline-none [&_.rsw-html]:hidden"
        />
      </div>
    </div>
  );
}
