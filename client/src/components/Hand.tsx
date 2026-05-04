import { useSortable } from '@dnd-kit/sortable';
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
  const jackLabel = card === 'JC' || card === 'JD' ? 'WILD'
                  : card === 'JS' || card === 'JH' ? 'REMOVE'
                  : null;
  return (
    <div
      className={[
        'hand-card',
        `hand-card--${color}`,
        isSelected ? 'hand-card--selected' : '',
        isDragging  ? 'hand-card--dragging'  : '',
      ].join(' ')}
      onClick={onClick}
    >
      <span className="hand-card__rank">{rank}</span>
      <span className="hand-card__suit">{suit}</span>
      {jackLabel && (
        <span className={`hand-card__jack-label hand-card__jack-label--${jackLabel.toLowerCase()}`}>
          {jackLabel}
        </span>
      )}
    </div>
  );
}

interface SortableCardProps {
  id: string;
  card: CardCode;
  isSelected: boolean;
  onClick: () => void;
}

export function SortableCard({ id, card, isSelected, onClick }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    animateLayoutChanges: () => false,
  });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(
          transform ? { ...transform, scaleX: 1, scaleY: 1 } : null
        ),
        transition: transform ? transition : 'none',
        opacity: isDragging ? 0 : 1,
      }}
      {...attributes}
      {...listeners}
    >
      <CardTile card={card} isSelected={isSelected} onClick={onClick} />
    </div>
  );
}

interface HandProps {
  cards: CardCode[];
  ids: string[];
  selectedCardId: string | null;
  onSelectCard: (id: string, card: CardCode) => void;
  isMyTurn: boolean;
}

export default function Hand({ cards, ids, selectedCardId, onSelectCard, isMyTurn }: HandProps) {
  return (
    <div className={`hand ${isMyTurn ? 'hand--active' : ''}`}>
      {cards.map((card, i) => (
        <SortableCard
          key={ids[i]}
          id={ids[i]}
          card={card}
          isSelected={selectedCardId === ids[i]}
          onClick={() => onSelectCard(ids[i], card)}
        />
      ))}
    </div>
  );
}
