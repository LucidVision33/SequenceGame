import { useState } from 'react';
import {
  DndContext, closestCenter,
  DragOverlay, useSensor, useSensors, PointerSensor,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  SortableContext, horizontalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { parseCard } from '../data/boardLayout';
import type { CardCode } from '../types';

interface CardTileProps {
  card: CardCode;
  isSelected: boolean;
  isDragging?: boolean;
  onClick?: () => void;
}

export function CardTile({ card, isSelected, isDragging, onClick }: CardTileProps) {
  const { rank, suit, color } = parseCard(card);
  return (
    <div
      className={[
        'hand-card',
        `hand-card--${color}`,
        isSelected ? 'hand-card--selected' : '',
        isDragging ? 'hand-card--dragging' : '',
      ].join(' ')}
      onClick={onClick}
    >
      <span className="hand-card__rank">{rank}</span>
      <span className="hand-card__suit">{suit}</span>
    </div>
  );
}

interface SortableCardProps {
  id: string;
  card: CardCode;
  isSelected: boolean;
  onClick: () => void;
}

function SortableCard({ id, card, isSelected, onClick }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }}
      {...attributes}
      {...listeners}
    >
      <CardTile card={card} isSelected={isSelected} onClick={onClick} />
    </div>
  );
}

interface HandProps {
  cards: CardCode[];
  selectedCard: CardCode | null;
  onSelectCard: (card: CardCode | null) => void;
  onReorder: (newCards: CardCode[]) => void;
  isMyTurn: boolean;
}

export default function Hand({ cards, selectedCard, onSelectCard, onReorder, isMyTurn }: HandProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  // Stable IDs: index-based since we need to map back to cards after reorder
  const ids = cards.map((_, i) => `hand-${i}`);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragStart = (e: DragStartEvent) => setDraggedId(e.active.id as string);

  const handleDragEnd = (e: DragEndEvent) => {
    setDraggedId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = parseInt((active.id as string).replace('hand-', ''));
    const newIdx = parseInt((over.id as string).replace('hand-', ''));
    onReorder(arrayMove(cards, oldIdx, newIdx));
  };

  const draggedCard = draggedId != null
    ? cards[parseInt(draggedId.replace('hand-', ''))]
    : null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
        <div className={`hand ${isMyTurn ? 'hand--active' : ''}`}>
          {cards.map((card, i) => (
            <SortableCard
              key={ids[i]}
              id={ids[i]}
              card={card}
              isSelected={selectedCard === card && cards.indexOf(card) === i}
              onClick={() => {
                if (!isMyTurn) return;
                onSelectCard(selectedCard === card ? null : card);
              }}
            />
          ))}
        </div>
      </SortableContext>
      <DragOverlay>
        {draggedCard ? <CardTile card={draggedCard} isSelected={false} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}
