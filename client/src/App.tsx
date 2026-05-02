import { useEffect, useRef, useState, useCallback } from 'react';
import {
  DndContext, PointerSensor, useSensor, useSensors,
  DragOverlay, closestCenter,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import socket from './socket';
import { clientId } from './clientId';
import type { GameView, TokenColor, CardCode } from './types';
import { TOKEN_COLOR_HEX } from './types';
import Board from './components/Board';
import Hand, { CardTile } from './components/Hand';
import Lobby from './components/Lobby';
import GameLog from './components/GameLog';
import { parseCard } from './data/boardLayout';
import { sounds } from './sounds';
import './index.css';

function getValidCells(board: GameView['board'], card: CardCode | null, myId: string): Set<string> {
  if (!card) return new Set();
  const valid = new Set<string>();
  const isTwo = card === 'JC' || card === 'JD';
  const isOne = card === 'JS' || card === 'JH';

  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      const cell = board[r][c];
      if (isTwo) {
        if (cell.card !== 'FREE' && cell.token === null) valid.add(`${r},${c}`);
      } else if (isOne) {
        if (cell.token !== null && cell.token !== myId && !cell.lockedBy) valid.add(`${r},${c}`);
      } else {
        if (cell.card === card && cell.token === null) valid.add(`${r},${c}`);
      }
    }
  }
  return valid;
}

export default function App() {
  const [view, setView] = useState<GameView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<CardCode | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [hand, setHand] = useState<CardCode[]>([]);
  const [draggedHandId, setDraggedHandId] = useState<string | null>(null);

  // Stable IDs that travel with hand cards through reorders
  const stableHandIds = useRef<string[]>([]);
  const handIdCounter = useRef(0);

  const prevTurnRef = useRef<string | null>(null);
  const prevSeqRef = useRef<number>(0);
  const prevWinnerRef = useRef<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  useEffect(() => {
    socket.connect();
    socket.on('connect', () => {
      socket.emit('register', {
        clientId,
        roomId: localStorage.getItem('seq_room_id') ?? '',
      });
    });
    socket.on('game_state', (v: GameView) => {
      setView(v);
      setHand(prev => {
        if (prev.length === 0) return v.myHand;
        const ordered: CardCode[] = [];
        const remaining = [...v.myHand];
        for (const c of prev) {
          const idx = remaining.indexOf(c);
          if (idx !== -1) { ordered.push(c); remaining.splice(idx, 1); }
        }
        return [...ordered, ...remaining];
      });
      if (v.phase !== 'playing') { setSelectedCard(null); setSelectedCardId(null); }
    });
    socket.on('move_error', (msg: string) => setError(msg));
    socket.on('error', (msg: string) => setError(msg));
    return () => { socket.disconnect(); };
  }, []);

  useEffect(() => {
    if (error) { const t = setTimeout(() => setError(null), 3000); return () => clearTimeout(t); }
  }, [error]);

  // Sound effects
  useEffect(() => {
    if (!view || view.phase !== 'playing') return;
    const mySeq = view.players.find(p => p.id === view.myId)?.sequenceCount ?? 0;

    if (view.winner && view.winner !== prevWinnerRef.current) {
      sounds.win();
    } else if (view.currentPlayerId === view.myId && prevTurnRef.current !== view.myId) {
      sounds.yourTurn();
    } else if (mySeq > prevSeqRef.current) {
      sounds.sequence();
    }

    prevTurnRef.current = view.currentPlayerId;
    prevSeqRef.current = mySeq;
    prevWinnerRef.current = view.winner;
  }, [view]);

  const handleCreateRoom = (name: string) => {
    socket.emit('create_room', name, (res: { roomId: string } | { error: string }) => {
      if ('error' in res) setError(res.error);
      else localStorage.setItem('seq_room_id', res.roomId);
    });
  };

  const handleJoinRoom = (roomId: string, name: string) => {
    socket.emit('join_room', { roomId, name }, (res: { ok: true } | { error: string }) => {
      if ('error' in res) setError(res.error);
      else localStorage.setItem('seq_room_id', roomId.toUpperCase());
    });
  };

  const handleStartGame = () => {
    if (view) socket.emit('start_game', view.roomId);
  };

  const handleSetColor = (color: TokenColor) => {
    if (view) socket.emit('set_color', { roomId: view.roomId, color });
  };

  const handleSetName = (name: string) => {
    if (view) socket.emit('set_name', { roomId: view.roomId, name });
  };

  const playCard = useCallback((card: CardCode, row: number, col: number) => {
    if (!view) return;
    socket.emit('play_card', { roomId: view.roomId, card, row, col });
    sounds.placeToken();
    setSelectedCard(null);
    setSelectedCardId(null);
  }, [view]);

  const handleSelectCard = (id: string, card: CardCode) => {
    if (selectedCardId === id) {
      setSelectedCard(null);
      setSelectedCardId(null);
    } else {
      setSelectedCard(card);
      setSelectedCardId(id);
    }
  };

  const handleCellClick = (row: number, col: number) => {
    if (!view || view.phase !== 'playing') return;
    if (view.currentPlayerId !== view.myId) return;
    if (!selectedCard) return;
    const valid = getValidCells(view.board, selectedCard, view.myId);
    if (valid.has(`${row},${col}`)) playCard(selectedCard, row, col);
  };

  const handleDragStart = (e: DragStartEvent) => {
    const id = e.active.id as string;
    if (id.startsWith('hc-')) {
      setDraggedHandId(id);
      const idx = stableHandIds.current.indexOf(id);
      if (idx !== -1) {
        setSelectedCard(hand[idx]);
        setSelectedCardId(id);
      }
    }
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setDraggedHandId(null);
    if (!over) return;

    const overId = over.id as string;

    if (overId.startsWith('cell-')) {
      // Drag from hand to board
      if (!view || view.currentPlayerId !== view.myId) return;
      const [, r, c] = overId.split('-').map(Number);
      const idx = stableHandIds.current.indexOf(active.id as string);
      const card = hand[idx];
      if (!card) return;
      const valid = getValidCells(view.board, card, view.myId);
      if (valid.has(`${r},${c}`)) playCard(card, r, c);
    } else if (overId.startsWith('hc-')) {
      // Reorder hand
      const oldIdx = stableHandIds.current.indexOf(active.id as string);
      const newIdx = stableHandIds.current.indexOf(overId);
      if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
        stableHandIds.current = arrayMove([...stableHandIds.current], oldIdx, newIdx);
        setHand(prev => arrayMove(prev, oldIdx, newIdx));
      }
    }
  };

  if (!view || view.phase === 'lobby') {
    return (
      <Lobby
        view={view}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        onStartGame={handleStartGame}
        onSetColor={handleSetColor}
        onSetName={handleSetName}
        error={error}
      />
    );
  }

  // Sync stable hand IDs with current hand length
  while (stableHandIds.current.length < hand.length) {
    stableHandIds.current.push(`hc-${++handIdCounter.current}`);
  }
  if (stableHandIds.current.length > hand.length) {
    stableHandIds.current = stableHandIds.current.slice(0, hand.length);
  }

  const isMyTurn = view.currentPlayerId === view.myId;
  const draggedCard = draggedHandId !== null
    ? (hand[stableHandIds.current.indexOf(draggedHandId)] ?? null)
    : null;
  const validCells = getValidCells(view.board, selectedCard ?? draggedCard, view.myId);
  const playerColors: Record<string, string> = {};
  for (const p of view.players) playerColors[p.id] = TOKEN_COLOR_HEX[p.tokenColor];

  const discardTop = view.discardPile.at(-1);
  const winnerName = view.players.find(p => p.id === view.winner)?.name ?? 'Someone';

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={stableHandIds.current} strategy={rectSortingStrategy}>
        {error && <div className="toast">{error}</div>}

        {view.winner && (
          <div className="win-overlay">
            <div className="win-modal">
              <div className="win-modal__emoji">🎉</div>
              <div className="win-modal__label">Winner!</div>
              <div className="win-modal__name">{winnerName}</div>
            </div>
          </div>
        )}

        <div className="game">

          {/* ── Left: Board ── */}
          <div className="game__board-col">
            <div className={`turn-banner ${isMyTurn ? 'turn-banner--mine' : ''}`}>
              {isMyTurn ? 'Your turn' : `${view.players.find(p => p.id === view.currentPlayerId)?.name}'s turn`}
              {isMyTurn && (selectedCard || draggedCard) && <span className="turn-hint"> — drop on a highlighted cell</span>}
            </div>

            <Board
              board={view.board}
              lastPlayedCell={view.lastPlayedCell}
              validCells={validCells}
              playerColors={playerColors}
              onCellClick={handleCellClick}
            />
          </div>

          {/* ── Middle: Discard + Log + Hand ── */}
          <div className="game__middle-col">
            <div className="discard-log-stack">
              <div className="discard-area">
                <div className="discard-label">Last Played</div>
                {discardTop ? (
                  <div className={`discard-card discard-card--${parseCard(discardTop).color}`}>
                    <span className="discard-card__rank">{parseCard(discardTop).rank}</span>
                    <span className="discard-card__suit">{parseCard(discardTop).suit}</span>
                    {(discardTop === 'JC' || discardTop === 'JD') && <span className="discard-card__jack-label discard-card__jack-label--wild">WILD</span>}
                    {(discardTop === 'JS' || discardTop === 'JH') && <span className="discard-card__jack-label discard-card__jack-label--remove">REMOVE</span>}
                  </div>
                ) : (
                  <div className="discard-empty">—</div>
                )}
              </div>
              <GameLog log={view.log ?? []} players={view.players} />
            </div>

            <div className="hand-area">
              <div className="hand-label">Your Hand</div>
              <Hand
                cards={hand}
                ids={stableHandIds.current}
                selectedCardId={selectedCardId}
                onSelectCard={handleSelectCard}
                isMyTurn={isMyTurn}
              />
            </div>
          </div>

          {/* ── Right: Players + Chat ── */}
          <div className="game__right-col">
            <div className="players-list">
              {view.players.map(p => (
                <div key={p.id} className={`player-row ${p.id === view.currentPlayerId ? 'player-row--active' : ''}`}>
                  <span className="player-token" style={{ backgroundColor: TOKEN_COLOR_HEX[p.tokenColor] }} />
                  <span className="player-name">{p.name}{p.id === view.myId ? ' (you)' : ''}</span>
                  <span className="player-meta">{p.handSize} cards · {p.sequenceCount} seq</span>
                </div>
              ))}
            </div>

            <div className="chat-placeholder">
              <div className="chat-placeholder__label">Chat</div>
              <div className="chat-placeholder__messages" />
              <div className="chat-placeholder__input">
                <input placeholder="Coming soon…" disabled />
              </div>
            </div>
          </div>

        </div>
      </SortableContext>

      <DragOverlay dropAnimation={null}>
        {draggedCard
          ? <CardTile card={draggedCard} isSelected={false} isDragging />
          : null}
      </DragOverlay>
    </DndContext>
  );
}
