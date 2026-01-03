import { useState, useRef, ReactNode } from "react";
import { useSwipeable } from "react-swipeable";
import { cn } from "@/lib/utils";
import { SwipeIndicator } from "./SwipeIndicator";

interface SwipeableViewProps {
  children: ReactNode[];
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
  showIndicator?: boolean;
  labels?: string[];
}

export function SwipeableView({
  children,
  initialIndex = 1,
  onIndexChange,
  showIndicator = true,
  labels = ["Contatos", "Chat", "Detalhes"],
}: SwipeableViewProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isAnimating, setIsAnimating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSwipe = (direction: "left" | "right") => {
    if (isAnimating) return;

    let newIndex = currentIndex;
    if (direction === "left" && currentIndex < children.length - 1) {
      newIndex = currentIndex + 1;
    } else if (direction === "right" && currentIndex > 0) {
      newIndex = currentIndex - 1;
    }

    if (newIndex !== currentIndex) {
      setIsAnimating(true);
      setCurrentIndex(newIndex);
      onIndexChange?.(newIndex);
      setTimeout(() => setIsAnimating(false), 300);
    }
  };

  const handlers = useSwipeable({
    onSwipedLeft: () => handleSwipe("left"),
    onSwipedRight: () => handleSwipe("right"),
    preventScrollOnSwipe: true,
    trackMouse: false,
    delta: 50,
    swipeDuration: 500,
  });

  const goToIndex = (index: number) => {
    if (index !== currentIndex && !isAnimating) {
      setIsAnimating(true);
      setCurrentIndex(index);
      onIndexChange?.(index);
      setTimeout(() => setIsAnimating(false), 300);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Swipeable container */}
      <div
        ref={containerRef}
        {...handlers}
        className="flex-1 relative overflow-hidden touch-pan-y"
      >
        <div
          className={cn(
            "flex h-full transition-transform duration-300 ease-out",
            isAnimating && "pointer-events-none"
          )}
          style={{
            width: `${children.length * 100}%`,
            transform: `translateX(-${(currentIndex * 100) / children.length}%)`,
          }}
        >
          {children.map((child, index) => (
            <div
              key={index}
              className="h-full overflow-hidden"
              style={{ width: `${100 / children.length}%` }}
            >
              {child}
            </div>
          ))}
        </div>
      </div>

      {/* Indicator */}
      {showIndicator && (
        <SwipeIndicator
          total={children.length}
          current={currentIndex}
          labels={labels}
          onSelect={goToIndex}
        />
      )}
    </div>
  );
}
