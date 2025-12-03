import { useState } from 'react';
import { Search, Bell, Calendar, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { useIsMobile } from '@/hooks/use-mobile';

interface HeaderProps {
  title: string;
  onMenuClick?: () => void;
}

export function Header({ title, onMenuClick }: HeaderProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const isMobile = useIsMobile();

  return (
    <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-border/50 bg-card px-6 shadow-sm md:px-8">
      <div className="flex items-center gap-4">
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="md:hidden h-10 w-10 hover:bg-muted"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">
            {title}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar leads, conversas..."
            className="w-80 h-11 pl-11 bg-muted/50 border-border/50 rounded-xl focus:bg-card focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground"
          />
        </div>

        {/* Date Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              size="icon" 
              className="hidden md:flex h-11 w-11 rounded-xl border-border/50 hover:bg-muted hover:border-primary/50 transition-all"
            >
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <CalendarComponent
              mode="single"
              selected={date}
              onSelect={setDate}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* Notifications */}
        <Button 
          variant="outline" 
          size="icon" 
          className="relative h-11 w-11 rounded-xl border-border/50 hover:bg-muted hover:border-primary/50 transition-all"
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-card shadow-sm">
            5
          </span>
        </Button>

        {/* Mobile Search */}
        <Button 
          variant="outline" 
          size="icon" 
          className="md:hidden h-11 w-11 rounded-xl border-border/50 hover:bg-muted transition-all"
        >
          <Search className="h-5 w-5 text-muted-foreground" />
        </Button>
      </div>
    </header>
  );
}
