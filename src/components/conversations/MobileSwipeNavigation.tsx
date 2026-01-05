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
    <div {...handlers} className={cn('flex-1 overflow-hidden w-full', className)}>
      {children}
    </div>
  );
}
