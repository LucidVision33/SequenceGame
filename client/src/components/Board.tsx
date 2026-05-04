import type { BoardCellState } from '../types';
import { BOARD_LAYOUT } from '../data/boardLayout';
import BoardCell from './BoardCell';

interface BoardProps {
  board: BoardCellState[][];
  lastPlayedCell: [number, number] | null;
  validCells: Set<string>;
  previewCells: Set<string>;
  playerColors: Record<string, string>;
  onCellClick: (row: number, col: number) => void;
}

export default function Board({ board, lastPlayedCell, validCells, previewCells, playerColors, onCellClick }: BoardProps) {
  return (
    <div className="board">
      {board.map((row, r) =>
        row.map((cell, c) => (
          <BoardCell
            key={`${r}-${c}`}
            cell={cell}
            row={r}
            col={c}
            isLastPlayed={lastPlayedCell?.[0] === r && lastPlayedCell?.[1] === c}
            isValid={validCells.has(`${r},${c}`)}
            isPreview={previewCells.has(`${r},${c}`)}
            playerColors={playerColors}
            onClick={() => onCellClick(r, c)}
          />
        ))
      )}
    </div>
  );
}

export function makeFreshBoard(): BoardCellState[][] {
  return BOARD_LAYOUT.map(row =>
    row.map(card => ({ card, token: null, lockedBy: null }))
  );
}
