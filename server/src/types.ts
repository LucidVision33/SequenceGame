export type TokenColor = 'blue' | 'green' | 'red' | 'yellow' | 'purple';
export type GamePhase = 'lobby' | 'playing' | 'finished';

export interface ServerPlayer {
  id: string;
  clientId: string;
  name: string;
  tokenColor: TokenColor;
  hand: string[];
  sequenceCount: number;
}

export interface ServerBoardCell {
  card: string;
  token: string | null;
  lockedBy: string | null;
}

export interface LogEntry {
  id: number;
  playerId: string;
  playerName: string;
  action: string;
}

export interface Room {
  id: string;
  phase: GamePhase;
  players: ServerPlayer[];
  board: ServerBoardCell[][];
  currentPlayerIndex: number;
  deck: string[];
  discardPile: string[];
  lastPlayedCell: [number, number] | null;
  winner: string | null;
  sequences: { playerId: string; cells: [number, number][] }[];
  log: LogEntry[];
}
