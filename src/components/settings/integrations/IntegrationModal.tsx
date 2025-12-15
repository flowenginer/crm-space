import { ReactNode } from 'react';
import { LucideIcon, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface IntegrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: LucideIcon;
  name: string;
  color?: string;
  children: ReactNode;
}

export function IntegrationModal({
  open,
  onOpenChange,
  icon: Icon,
  name,
  color = 'hsl(var(--primary))',
  children,
}: IntegrationModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${color}15` }}
            >
              <Icon className="w-6 h-6" style={{ color }} />
            </div>
            <div>
              <DialogTitle className="text-xl">{name}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                Configure sua integração
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="p-6">{children}</div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
