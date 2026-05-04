import type { ServerBoardCell, Room } from './types.js';

export const BOARD_LAYOUT: string[][] = [
  ['FREE', '6D', '7D', '8D', '9D', 'TD', 'QD', 'KD', 'AD', 'FREE'],
  ['5D',   '3H', '2H', '2S', '3S', '4S', '5S', '6S', '7S', 'AC' ],
  ['4D',   '4H', 'KD', 'AD', 'AC', 'KC', 'QC', 'TC', '8S', 'KC' ],
  ['3D',   '5H', 'QD', 'QH', 'TH', '9H', '8H', '9C', '9S', 'QC' ],
  ['2D',   '6H', 'TD', 'KH', '3H', '2H', '7H', '8C', 'TS', 'TC' ],
  ['AS',   '7H', '9D', 'AH', '4H', '5H', '6H', '7C', 'QS', '9C' ],
  ['KS',   '8H', '8D', '2C', '3C', '4C', '5C', '6C', 'KS', '8C' ],
  ['QS',   '9H', '7D', '6D', '5D', '4D', '3D', '2D', 'AS', '7C' ],
  ['TS',   'TH', 'QH', 'KH', 'AH', '2C', '3C', '4C', '5C', '6C' ],
  ['FREE', '9S', '8S', '7S', '6S', '5S', '4S', '3S', '2S', 'FREE'],
];

const TWO_EYED_JACKS = ['JC', 'JD'];
const ONE_EYED_JACKS = ['JS', 'JH'];
const SEQUENCES_TO_WIN = 2;

export const isTwoEyedJack = (c: string) => TWO_EYED_JACKS.includes(c);
export const isOneEyedJack = (c: string) => ONE_EYED_JACKS.includes(c);
export const isJack = (c: string) => c.startsWith('J');

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createDeck(): string[] {
  const suits = ['S', 'C', 'H', 'D'];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
  const single = suits.flatMap(s => ranks.map(r => `${r}${s}`));
  return shuffle([...single, ...single]);
}

export function createInitialBoard(): ServerBoardCell[][] {
  return BOARD_LAYOUT.map(row =>
    row.map(card => ({ card, token: null, lockedBy: null }))
  );
}

export function dealHands(deck: string[], count: number): { hands: string[][], remaining: string[] } {
  const handSize = count === 2 ? 7 : 6;
  const d = [...deck];
  const hands = Array.from({ length: count }, () => d.splice(0, handSize));
  return { hands, remaining: d };
}

export function findBoardPositions(card: string): [number, number][] {
  const out: [number, number][] = [];
  for (let r = 0; r < 10; r++)
    for (let c = 0; c < 10; c++)
      if (BOARD_LAYOUT[r][c] === card) out.push([r, c]);
  return out;
}

function cellKey(r: number, c: number) { return `${r},${c}`; }

const DIRECTIONS: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]];

function getRunInDirection(
  board: ServerBoardCell[][],
  playerId: string,
  row: number, col: number,
  dr: number, dc: number
): [number, number][] {
  const back: [number, number][] = [];
  let r = row - dr, c = col - dc;
  while (r >= 0 && r < 10 && c >= 0 && c < 10) {
    const cell = board[r][c];
    if (cell.token === playerId || cell.card === 'FREE') { back.unshift([r, c]); r -= dr; c -= dc; }
    else break;
  }
  const run: [number, number][] = [...back, [row, col]];
  r = row + dr; c = col + dc;
  while (r >= 0 && r < 10 && c >= 0 && c < 10) {
    const cell = board[r][c];
    if (cell.token === playerId || cell.card === 'FREE') { run.push([r, c]); r += dr; c += dc; }
    else break;
  }
  return run;
}

function getValidWindows(
  run: [number, number][],
  lockedSet: Set<string>
): [number, number][][] {
  const windows: [number, number][][] = [];
  for (let i = 0; i <= run.length - 5; i++) {
    const w = run.slice(i, i + 5) as [number, number][];
    if (w.filter(([r, c]) => lockedSet.has(cellKey(r, c))).length <= 1) windows.push(w);
  }
  return windows;
}

function analyzeNewSequences(
  board: ServerBoardCell[][],
  playerId: string,
  row: number, col: number,
  lockedSet: Set<string>
): { autoLocks: [number, number][][]; pendingOptions: [number, number][][][] } {
  const autoLocks: [number, number][][] = [];
  const pendingOptions: [number, number][][][] = [];
  for (const [dr, dc] of DIRECTIONS) {
    const run = getRunInDirection(board, playerId, row, col, dr, dc);
    if (run.length < 5) continue;
    const windows = getValidWindows(run, lockedSet);
    if (windows.length === 0) continue;
    if (windows.length === 1) autoLocks.push(windows[0]);
    else pendingOptions.push(windows);
  }
  return { autoLocks, pendingOptions };
}

export function resolveSequenceChoice(
  room: Room,
  playerId: string,
  chosenCells: [number, number][]
): MoveResult {
  if (!room.pendingSequenceChoice) return { error: 'not_your_turn' };
  if (room.players[room.currentPlayerIndex].id !== playerId) return { error: 'not_your_turn' };
  const chosen = chosenCells.map(([r, c]) => cellKey(r, c)).sort().join('|');
  const isValid = room.pendingSequenceChoice.options.some(
    opt => opt.map(([r, c]) => cellKey(r, c)).sort().join('|') === chosen
  );
  if (!isValid) return { error: 'invalid_target' };

  const newRoom: Room = JSON.parse(JSON.stringify(room));
  const newPlayer = newRoom.players.find(p => p.id === playerId)!;
  newRoom.sequences.push({ playerId, cells: chosenCells });
  for (const [r, c] of chosenCells) newRoom.board[r][c].lockedBy = playerId;
  newPlayer.sequenceCount = newRoom.sequences.filter(s => s.playerId === playerId).length;
  newRoom.log.push({ id: newRoom.log.length, playerId, playerName: newPlayer.name, action: `completed sequence ${newPlayer.sequenceCount}!` });
  if (newPlayer.sequenceCount >= SEQUENCES_TO_WIN) {
    newRoom.winner = playerId;
    newRoom.log.push({ id: newRoom.log.length, playerId, playerName: newPlayer.name, action: `wins the game! 🎉` });
  }
  newRoom.pendingSequenceChoice = null;
  newRoom.currentPlayerIndex = (newRoom.currentPlayerIndex + 1) % newRoom.players.length;
  return { room: newRoom };
}

export function getLockedCells(room: Room): Set<string> {
  const locked = new Set<string>();
  for (const seq of room.sequences)
    for (const [r, c] of seq.cells)
      locked.add(cellKey(r, c));
  return locked;
}

export type MoveError =
  | 'not_your_turn'
  | 'card_not_in_hand'
  | 'invalid_target'
  | 'cell_occupied'
  | 'cell_empty'
  | 'cell_locked'
  | 'own_token';

export interface MoveResult {
  error?: MoveError;
  room?: Room;
}

export function applyMove(
  room: Room,
  playerId: string,
  card: string,
  row: number,
  col: number
): MoveResult {
  if (room.pendingSequenceChoice) return { error: 'not_your_turn' };
  if (room.players[room.currentPlayerIndex].id !== playerId)
    return { error: 'not_your_turn' };

  const player = room.players.find(p => p.id === playerId)!;
  const cardIdx = player.hand.indexOf(card);
  if (cardIdx === -1) return { error: 'card_not_in_hand' };

  const cell = room.board[row][col];
  const locked = getLockedCells(room);
  const isLocked = locked.has(cellKey(row, col));

  if (isTwoEyedJack(card)) {
    if (cell.card === 'FREE' || cell.token !== null) return { error: 'cell_occupied' };
  } else if (isOneEyedJack(card)) {
    if (cell.token === null) return { error: 'cell_empty' };
    if (cell.token === playerId) return { error: 'own_token' };
    if (isLocked) return { error: 'cell_locked' };
  } else {
    if (cell.card !== card) return { error: 'invalid_target' };
    if (cell.token !== null) return { error: 'cell_occupied' };
    if (cell.card === 'FREE') return { error: 'invalid_target' };
  }

  // Deep clone room state
  const newRoom: Room = JSON.parse(JSON.stringify(room));
  const newPlayer = newRoom.players.find(p => p.id === playerId)!;

  const cellCard = room.board[row][col].card;

  // Apply board change
  if (isOneEyedJack(card)) {
    newRoom.board[row][col].token = null;
  } else {
    newRoom.board[row][col].token = playerId;
  }

  // Discard played card, draw new one
  newRoom.discardPile.push(card);
  newPlayer.hand.splice(newPlayer.hand.indexOf(card), 1);
  if (newRoom.deck.length === 0) {
    const last = newRoom.discardPile.pop()!;
    newRoom.deck = shuffle(newRoom.discardPile);
    newRoom.discardPile = [last];
  }
  if (newRoom.deck.length > 0) newPlayer.hand.push(newRoom.deck.shift()!);

  newRoom.lastPlayedCell = [row, col];

  // Log the move
  const logId = newRoom.log.length;
  if (isTwoEyedJack(card)) {
    newRoom.log.push({ id: logId, playerId, playerName: newPlayer.name, action: `placed wild Jack on ${fmt(cellCard)}` });
  } else if (isOneEyedJack(card)) {
    newRoom.log.push({ id: logId, playerId, playerName: newPlayer.name, action: `removed a token from ${fmt(cellCard)}` });
  } else {
    newRoom.log.push({ id: logId, playerId, playerName: newPlayer.name, action: `played ${fmt(card)}` });
  }

  // Check for new sequences (only on placement, not removal)
  if (!isOneEyedJack(card)) {
    const newLocked = getLockedCells(newRoom);
    const { autoLocks, pendingOptions } = analyzeNewSequences(newRoom.board, playerId, row, col, newLocked);
    for (const cells of autoLocks) {
      newRoom.sequences.push({ playerId, cells });
      for (const [r, c] of cells) newRoom.board[r][c].lockedBy = playerId;
    }
    newPlayer.sequenceCount = newRoom.sequences.filter(s => s.playerId === playerId).length;
    if (autoLocks.length > 0) {
      newRoom.log.push({ id: newRoom.log.length, playerId, playerName: newPlayer.name, action: `completed sequence ${newPlayer.sequenceCount}!` });
    }
    if (newPlayer.sequenceCount >= SEQUENCES_TO_WIN) {
      newRoom.winner = playerId;
      newRoom.log.push({ id: newRoom.log.length, playerId, playerName: newPlayer.name, action: `wins the game! 🎉` });
      newRoom.currentPlayerIndex = (newRoom.currentPlayerIndex + 1) % newRoom.players.length;
      return { room: newRoom };
    }
    if (pendingOptions.length > 0) {
      newRoom.pendingSequenceChoice = { options: pendingOptions[0] };
      return { room: newRoom };
    }
  }

  newRoom.currentPlayerIndex = (newRoom.currentPlayerIndex + 1) % newRoom.players.length;
  return { room: newRoom };
}

function fmt(code: string): string {
  if (code === 'FREE') return 'FREE';
  const suit = code.slice(-1);
  const rank = code.slice(0, -1) === 'T' ? '10' : code.slice(0, -1);
  const sym = ({ S: '♠', C: '♣', H: '♥', D: '♦' } as Record<string, string>)[suit] ?? suit;
  return `${rank}${sym}`;
}

export function buildPlayerView(room: Room, socketId: string) {
  const me = room.players.find(p => p.id === socketId);
  return {
    phase: room.phase,
    board: room.board,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      tokenColor: p.tokenColor,
      handSize: p.hand.length,
      sequenceCount: p.sequenceCount,
    })),
    myHand: me?.hand ?? [],
    myId: socketId,
    currentPlayerId: room.players[room.currentPlayerIndex]?.id ?? '',
    discardPile: room.discardPile,
    lastPlayedCell: room.lastPlayedCell,
    winner: room.winner,
    roomId: room.id,
    log: room.log,
    totalSequences: room.sequences.length,
    pendingSequenceChoice: room.pendingSequenceChoice ?? null,
  };
}
