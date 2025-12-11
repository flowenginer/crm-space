import { useState, useEffect, ReactNode } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { DraggableDashboardCard } from './DraggableDashboardCard';

const STORAGE_KEY = 'dashboard-card-order';

export interface DashboardCardConfig {
  id: string;
  component: ReactNode;
  fullWidth?: boolean; // Card should always occupy 100% width
}

interface DashboardGridProps {
  cards: DashboardCardConfig[];
}

export function DashboardGrid({ cards }: DashboardGridProps) {
  const [orderedCardIds, setOrderedCardIds] = useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Validate that all card IDs exist
        const currentIds = cards.map(c => c.id);
        const validOrder = parsed.filter((id: string) => currentIds.includes(id));
        // Add any new cards that aren't in saved order
        const newCards = currentIds.filter(id => !validOrder.includes(id));
        return [...validOrder, ...newCards];
      } catch {
        return cards.map(c => c.id);
      }
    }
    return cards.map(c => c.id);
  });

  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Sync with new cards if they change
  useEffect(() => {
    const currentIds = cards.map(c => c.id);
    const hasNewCards = currentIds.some(id => !orderedCardIds.includes(id));
    const hasRemovedCards = orderedCardIds.some(id => !currentIds.includes(id));
    
    if (hasNewCards || hasRemovedCards) {
      const validOrder = orderedCardIds.filter(id => currentIds.includes(id));
      const newCards = currentIds.filter(id => !validOrder.includes(id));
      setOrderedCardIds([...validOrder, ...newCards]);
    }
  }, [cards]);

  // Save order to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orderedCardIds));
  }, [orderedCardIds]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      setOrderedCardIds((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Get ordered cards
  const orderedCards = orderedCardIds
    .map(id => cards.find(c => c.id === id))
    .filter(Boolean) as DashboardCardConfig[];

  const activeCard = activeId ? cards.find(c => c.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={orderedCardIds} strategy={rectSortingStrategy}>
        <div className="flex flex-wrap gap-6">
          {orderedCards.map((card) => (
            <DraggableDashboardCard
              key={card.id}
              id={card.id}
              fullWidth={card.fullWidth}
            >
              {card.component}
            </DraggableDashboardCard>
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeCard ? (
          <div className="opacity-80 shadow-2xl rounded-lg">
            {activeCard.component}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
