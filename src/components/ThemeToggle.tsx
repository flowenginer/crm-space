import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="relative p-2.5 rounded-xl bg-muted hover:bg-muted/80 transition-all duration-300 border border-border/50"
      title={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
    >
      <div className="relative w-5 h-5">
        {/* Sun Icon */}
        <Sun 
          size={20} 
          className={cn(
            "absolute inset-0 text-amber-500 transition-all duration-300",
            theme === 'light' 
              ? 'opacity-100 rotate-0 scale-100' 
              : 'opacity-0 rotate-90 scale-0'
          )}
        />
        {/* Moon Icon */}
        <Moon 
          size={20} 
          className={cn(
            "absolute inset-0 text-primary transition-all duration-300",
            theme === 'dark' 
              ? 'opacity-100 rotate-0 scale-100' 
              : 'opacity-0 -rotate-90 scale-0'
          )}
        />
      </div>
    </button>
  );
}

// Version with text label
export function ThemeToggleWithLabel() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-muted hover:bg-muted/80 transition-all duration-300 w-full"
    >
      {theme === 'light' ? (
        <>
          <Moon size={20} className="text-muted-foreground" />
          <span className="text-sm text-foreground">Modo Escuro</span>
        </>
      ) : (
        <>
          <Sun size={20} className="text-amber-500" />
          <span className="text-sm text-foreground">Modo Claro</span>
        </>
      )}
    </button>
  );
}

// Switch version (iOS style)
export function ThemeSwitch() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "relative w-14 h-8 rounded-full transition-colors duration-300",
        isDark ? 'bg-primary' : 'bg-muted-foreground/30'
      )}
    >
      <div
        className={cn(
          "absolute top-1 w-6 h-6 rounded-full bg-card shadow-md transition-transform duration-300 flex items-center justify-center",
          isDark ? 'translate-x-7' : 'translate-x-1'
        )}
      >
        {isDark ? (
          <Moon size={14} className="text-primary" />
        ) : (
          <Sun size={14} className="text-amber-500" />
        )}
      </div>
    </button>
  );
}
