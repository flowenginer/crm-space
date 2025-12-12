import { useState } from 'react';
import { Plus, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AttributeTypeCard } from '@/components/products/AttributeTypeCard';
import { AttributeTypeModal } from '@/components/products/AttributeTypeModal';
import { useAttributeTypes, useReorderAttributeTypes, type AttributeTypeWithValues } from '@/hooks/useProductAttributes';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

export default function Attributes() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<AttributeTypeWithValues | null>(null);
  
  const { data: attributeTypes = [], isLoading } = useAttributeTypes();
  const reorderMutation = useReorderAttributeTypes();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = attributeTypes.findIndex((t) => t.id === active.id);
      const newIndex = attributeTypes.findIndex((t) => t.id === over.id);

      const newOrder = arrayMove(attributeTypes, oldIndex, newIndex);
      const updates = newOrder.map((item, index) => ({
        id: item.id,
        display_order: index + 1,
      }));

      reorderMutation.mutate(updates);
    }
  };

  const handleEdit = (type: AttributeTypeWithValues) => {
    setEditingType(type);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingType(null);
  };

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Settings2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Atributos de Variação</h1>
              <p className="text-sm text-muted-foreground">
                Configure os tipos de atributos e valores para criar variações
              </p>
            </div>
          </div>
          <Button onClick={() => setIsModalOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Atributo
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : attributeTypes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/20 py-16">
          <Settings2 className="h-12 w-12 text-muted-foreground/40" />
          <h3 className="mt-4 text-lg font-medium text-foreground">Nenhum atributo cadastrado</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie seu primeiro tipo de atributo para começar
          </p>
          <Button onClick={() => setIsModalOpen(true)} className="mt-4 gap-2">
            <Plus className="h-4 w-4" />
            Novo Atributo
          </Button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={attributeTypes.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {attributeTypes.map((type) => (
                <AttributeTypeCard
                  key={type.id}
                  attributeType={type}
                  onEdit={handleEdit}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Modal */}
      <AttributeTypeModal
        open={isModalOpen}
        onOpenChange={handleCloseModal}
        editingType={editingType}
      />
    </div>
  );
}
