import { useState } from 'react';
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
        className="rsw-editor [&_.rsw-ce]:outline-none [&_.rsw-ce]:p-3 [&_.rsw-ce]:min-h-[inherit] [&_.rsw-ce]:text-sm"
      />
    </div>
  );
}
