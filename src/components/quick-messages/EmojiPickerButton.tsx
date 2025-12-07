import { useState } from 'react';
import { Plus } from 'lucide-react';
import EmojiPicker, { EmojiClickData, Theme } from 'emoji-picker-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTheme } from '@/contexts/ThemeContext';

interface EmojiPickerButtonProps {
  onEmojiSelect: (emoji: string) => void;
  quickEmojis?: string[];
}

const DEFAULT_QUICK_EMOJIS = ['👋', '😊', '🎉', '✅', '📦', '💬', '☀️', '🔥', '👕', '📸'];

export function EmojiPickerButton({ 
  onEmojiSelect, 
  quickEmojis = DEFAULT_QUICK_EMOJIS 
}: EmojiPickerButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { theme } = useTheme();

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onEmojiSelect(emojiData.emoji);
    setIsOpen(false);
  };

  const handleQuickEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-foreground">
        Emojis rápidos
      </label>
      <div className="flex flex-wrap gap-2 items-center">
        {quickEmojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => handleQuickEmojiClick(emoji)}
            className="w-10 h-10 flex items-center justify-center text-xl hover:bg-muted rounded-lg transition-colors"
          >
            {emoji}
          </button>
        ))}

        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="w-10 h-10 flex items-center justify-center rounded-lg border border-dashed border-border hover:border-primary hover:bg-primary/5 transition-colors"
              title="Mais emojis"
            >
              <Plus size={18} className="text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-auto p-0 border-0" 
            align="start"
            side="right"
            sideOffset={8}
          >
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              theme={theme === 'dark' ? Theme.DARK : Theme.LIGHT}
              width={320}
              height={400}
              searchPlaceholder="Buscar emoji..."
              previewConfig={{ showPreview: false }}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
