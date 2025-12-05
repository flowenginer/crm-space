import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedCounterProps {
  value: number;
  className?: string;
  showParentheses?: boolean;
}

export function AnimatedCounter({ value, className, showParentheses = true }: AnimatedCounterProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (prevValueRef.current !== value) {
      setIsAnimating(true);
      prevValueRef.current = value;
      
      const timeout = setTimeout(() => {
        setIsAnimating(false);
      }, 300);
      
      return () => clearTimeout(timeout);
    }
  }, [value]);

  return (
    <span
      className={cn(
        'transition-all duration-300',
        isAnimating && 'text-primary scale-125 font-semibold',
        className
      )}
    >
      {showParentheses ? `(${value})` : value}
    </span>
  );
}
