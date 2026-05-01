export type TokenColor = 'blue' | 'green' | 'red' | 'yellow' | 'purple';
export type GamePhase = 'lobby' | 'playing' | 'finished';
export type CardCode = string;

export interface BoardCellState {
  card: CardCode;
  token: string | null;
  lockedBy: string | null;
}

export interface PlayerInfo {
  id: string;
  name: string;
  tokenColor: TokenColor;
  handSize: number;
  sequenceCount: number;
}

export interface LogEntry {
  id: number;
  playerId: string;
  playerName: string;
  action: string;
}

export interface GameView {
  phase: GamePhase;
  board: BoardCellState[][];
  players: PlayerInfo[];
  myHand: CardCode[];
  myId: string;
  currentPlayerId: string;
  discardPile: CardCode[];
  lastPlayedCell: [number, number] | null;
  winner: string | null;
  roomId: string;
  log: LogEntry[];
}

export const TOKEN_COLOR_HEX: Record<TokenColor, string> = {
  blue:   '#4a90d9',
  red:    '#e05c5c',
  green:  '#5cb85c',
  yellow: '#f0c040',
  purple: '#9b59b6',
};
