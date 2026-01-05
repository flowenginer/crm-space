import { useSwipeable } from 'react-swipeable';
import { cn } from '@/lib/utils';

export type MobilePanel = 'list' | 'chat' | 'details';

interface MobileSwipeNavigationProps {
  currentPanel: MobilePanel;
  onPanelChange: (panel: MobilePanel) => void;
  children: React.ReactNode;
  hasConversation: boolean;
  className?: string;
}

export function MobileSwipeNavigation({
  currentPanel,
  onPanelChange,
  children,
  hasConversation,
  className
}: MobileSwipeNavigationProps) {
  const handlers = useSwipeable({
    onSwipedLeft: () => {
      if (currentPanel === 'list' && hasConversation) {
        onPanelChange('chat');
      } else if (currentPanel === 'chat' && hasConversation) {
        onPanelChange('details');
      }
    },
    onSwipedRight: () => {
      if (currentPanel === 'details') {
        onPanelChange('chat');
      } else if (currentPanel === 'chat') {
        onPanelChange('list');
      }
    },
    trackMouse: false,
    trackTouch: true,
    delta: 50,
    preventScrollOnSwipe: false,
  });

  return (
    <div {...handlers} className={cn('flex-1 overflow-hidden', className)}>
      {children}
    </div>
  );
}

interface MobilePanelIndicatorProps {
  currentPanel: MobilePanel;
  hasConversation: boolean;
  onPanelChange: (panel: MobilePanel) => void;
}

export function MobilePanelIndicator({ 
  currentPanel, 
  hasConversation, 
  onPanelChange 
}: MobilePanelIndicatorProps) {
  if (!hasConversation) return null;

  const panels: { key: MobilePanel; label: string }[] = [
    { key: 'list', label: 'Lista' },
    { key: 'chat', label: 'Chat' },
    { key: 'details', label: 'Cliente' },
  ];

  return (
    <div className="flex items-center justify-center gap-2 py-2 bg-card/80 backdrop-blur-sm border-t border-border">
      {panels.map((panel) => (
        <button
          key={panel.key}
          onClick={() => onPanelChange(panel.key)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
            currentPanel === panel.key
              ? 'bg-primary text-primary-foreground scale-105'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
        >
          <span
            className={cn(
              'w-2 h-2 rounded-full transition-all',
              currentPanel === panel.key
                ? 'bg-primary-foreground'
                : 'bg-muted-foreground/50'
            )}
          />
          {panel.label}
        </button>
      ))}
    </div>
  );
}
