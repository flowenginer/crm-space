import { ChevronLeft, MoreVertical, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MobileHeaderProps {
  title?: string;
  subtitle?: string;
  avatarUrl?: string;
  showBack?: boolean;
  onBack?: () => void;
  onCall?: () => void;
  onMore?: () => void;
}

export function MobileHeader({
  title,
  subtitle,
  avatarUrl,
  showBack,
  onBack,
  onCall,
  onMore,
}: MobileHeaderProps) {
  const initials = title?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "??";

  return (
    <header className="flex items-center gap-3 px-4 py-3 bg-background border-b border-border safe-area-inset-top">
      {showBack && (
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ChevronLeft className="h-5 w-5" />
        </Button>
      )}

      {title && (
        <>
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={avatarUrl} alt={title} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-foreground truncate">{title}</h1>
            {subtitle && (
              <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>
        </>
      )}

      <div className="flex items-center gap-1 shrink-0">
        {onCall && (
          <Button variant="ghost" size="icon" onClick={onCall}>
            <Phone className="h-5 w-5" />
          </Button>
        )}

        {onMore && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Ver perfil</DropdownMenuItem>
              <DropdownMenuItem>Transferir</DropdownMenuItem>
              <DropdownMenuItem>Encerrar conversa</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
