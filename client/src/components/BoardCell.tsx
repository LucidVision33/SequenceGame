import { useDroppable } from '@dnd-kit/core';
import type { BoardCellState } from '../types';
import { parseCard } from '../data/boardLayout';

interface BoardCellProps {
  cell: BoardCellState;
  row: number;
  col: number;
  isLastPlayed: boolean;
  isValid: boolean;
  isPreview: boolean;
  playerColors: Record<string, string>;
  onClick: () => void;
}

export default function BoardCell({ cell, row, col, isLastPlayed, isValid, isPreview, playerColors, onClick }: BoardCellProps) {
  const { rank, suit, color } = parseCard(cell.card);
  const isFree = cell.card === 'FREE';
  const tokenHex = cell.token ? (playerColors[cell.token] ?? '#888') : null;

  const { setNodeRef, isOver } = useDroppable({
    id: `cell-${row}-${col}`,
    data: { type: 'board-cell', row, col },
    disabled: !isValid,
  });

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={[
        'board-cell',
        isFree            ? 'board-cell--free'        : '',
        isLastPlayed      ? 'board-cell--last-played' : '',
        isValid           ? 'board-cell--valid'        : '',
        isPreview         ? 'board-cell--preview'     : '',
        isOver && isValid ? 'board-cell--drag-over'   : '',
        cell.lockedBy     ? 'board-cell--locked'      : '',
      ].join(' ')}
    >
      {isFree && <span className="board-cell__free">FREE</span>}

      {!isFree && (
        <>
          {/* Top-left corner */}
          <div className={`board-cell__corner board-cell__corner--tl board-cell__corner--${color}`}>
            <span className="board-cell__corner-rank">{rank}</span>
            <span className="board-cell__corner-suit">{suit}</span>
          </div>

          {/* Bottom-right corner (rotated 180°) */}
          <div className={`board-cell__corner board-cell__corner--br board-cell__corner--${color}`}>
            <span className="board-cell__corner-rank">{rank}</span>
            <span className="board-cell__corner-suit">{suit}</span>
          </div>
        </>
      )}

      {tokenHex && (
        <div
          className={`board-cell__token ${cell.lockedBy ? 'board-cell__token--locked' : ''}`}
          style={{ backgroundColor: tokenHex }}
        />
      )}
    </div>
  );
}
