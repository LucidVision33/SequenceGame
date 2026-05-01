import { useEffect, useState, useCallback } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import socket from './socket';
import type { GameView, TokenColor, CardCode } from './types';
import { TOKEN_COLOR_HEX } from './types';
import Board from './components/Board';
import Hand from './components/Hand';
import Lobby from './components/Lobby';
import GameLog from './components/GameLog';
import { parseCard } from './data/boardLayout';
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
  const [hand, setHand] = useState<CardCode[]>([]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    socket.connect();
    socket.on('game_state', (v: GameView) => {
      setView(v);
      setHand(prev => {
        // Preserve local order when possible
        if (prev.length === 0) return v.myHand;
        const newCards = [...v.myHand];
        const ordered: CardCode[] = [];
        const remaining = [...newCards];
        for (const c of prev) {
          const idx = remaining.indexOf(c);
          if (idx !== -1) { ordered.push(c); remaining.splice(idx, 1); }
        }
        return [...ordered, ...remaining];
      });
      if (v.phase !== 'playing') setSelectedCard(null);
    });
    socket.on('move_error', (msg: string) => setError(msg));
    socket.on('error', (msg: string) => setError(msg));
    return () => { socket.disconnect(); };
  }, []);

  useEffect(() => {
    if (error) { const t = setTimeout(() => setError(null), 3000); return () => clearTimeout(t); }
  }, [error]);

  const handleCreateRoom = (name: string) => {
    socket.emit('create_room', name, (res: { roomId: string } | { error: string }) => {
      if ('error' in res) setError(res.error);
    });
  };

  const handleJoinRoom = (roomId: string, name: string) => {
    socket.emit('join_room', { roomId, name }, (res: { ok: true } | { error: string }) => {
      if ('error' in res) setError(res.error);
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
    setSelectedCard(null);
  }, [view]);

  const handleCellClick = (row: number, col: number) => {
    if (!view || view.phase !== 'playing') return;
    if (view.currentPlayerId !== view.myId) return;
    if (!selectedCard) return;
    const valid = getValidCells(view.board, selectedCard, view.myId);
    if (valid.has(`${row},${col}`)) playCard(selectedCard, row, col);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { over } = e;
    if (!over || !selectedCard) return;
    const id = over.id as string;
    if (id.startsWith('cell-')) {
      const [, r, c] = id.split('-').map(Number);
      const valid = getValidCells(view!.board, selectedCard, view!.myId);
      if (valid.has(`${r},${c}`)) playCard(selectedCard, r, c);
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

  const isMyTurn = view.currentPlayerId === view.myId;
  const validCells = getValidCells(view.board, selectedCard, view.myId);
  const playerColors: Record<string, string> = {};
  for (const p of view.players) playerColors[p.id] = TOKEN_COLOR_HEX[p.tokenColor];

  const discardTop = view.discardPile.at(-1);

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      {error && <div className="toast">{error}</div>}
      <div className="game">

        {/* ── Left: Board ── */}
        <div className="game__board-col">
          {view.winner ? (
            <div className="winner-banner">
              🎉 {view.players.find(p => p.id === view.winner)?.name ?? 'Someone'} wins!
            </div>
          ) : (
            <div className={`turn-banner ${isMyTurn ? 'turn-banner--mine' : ''}`}>
              {isMyTurn ? 'Your turn' : `${view.players.find(p => p.id === view.currentPlayerId)?.name}'s turn`}
              {isMyTurn && selectedCard && <span className="turn-hint"> — click a highlighted cell</span>}
            </div>
          )}

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
              selectedCard={selectedCard}
              onSelectCard={setSelectedCard}
              onReorder={setHand}
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
    </DndContext>
  );
}
