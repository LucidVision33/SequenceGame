import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Room, TokenColor } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import {
  createDeck, createInitialBoard, dealHands, applyMove, buildPlayerView, resolveSequenceChoice
} from './gameEngine.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

const rooms = new Map<string, Room>();
const socketClientMap = new Map<string, string>(); // socket.id → clientId

function makeRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 4; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return rooms.has(id) ? makeRoomId() : id;
}

function broadcastRoom(room: Room) {
  for (const player of room.players) {
    io.to(player.id).emit('game_state', buildPlayerView(room, player.id));
  }
}

const TOKEN_COLORS: TokenColor[] = ['blue', 'red', 'green', 'yellow', 'purple'];

io.on('connection', (socket) => {
  console.log(`[+] ${socket.id}`);

  // Called on every connect/reconnect — registers clientId and re-attaches to room if needed
  socket.on('register', ({ clientId, roomId }: { clientId: string; roomId: string }) => {
    socketClientMap.set(socket.id, clientId);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    const player = room.players.find(p => p.clientId === clientId);
    if (!player) return;

    const oldId = player.id;
    player.id = socket.id;

    if (oldId !== socket.id) {
      // Update every reference to the old socket ID so token colours stay correct
      for (const row of room.board)
        for (const cell of row) {
          if (cell.token === oldId) cell.token = socket.id;
          if (cell.lockedBy === oldId) cell.lockedBy = socket.id;
        }
      for (const seq of room.sequences)
        if (seq.playerId === oldId) seq.playerId = socket.id;
      if (room.winner === oldId) room.winner = socket.id;
      for (const entry of room.log)
        if (entry.playerId === oldId) entry.playerId = socket.id;
    }

    socket.join(roomId);
    broadcastRoom(room); // everyone gets updated player IDs and correct token colours
  });

  socket.on('create_room', (name: string, cb: (res: { roomId: string } | { error: string }) => void) => {
    const clientId = socketClientMap.get(socket.id) ?? socket.id;
    const roomId = makeRoomId();
    const room: Room = {
      id: roomId,
      phase: 'lobby',
      players: [{ id: socket.id, clientId, name: name || 'Player 1', tokenColor: TOKEN_COLORS[0], hand: [], sequenceCount: 0 }],
      board: createInitialBoard(),
      currentPlayerIndex: 0,
      deck: [],
      discardPile: [],
      lastPlayedCell: null,
      winner: null,
      sequences: [],
      log: [],
      pendingSequenceChoice: null,
    };
    rooms.set(roomId, room);
    socket.join(roomId);
    cb({ roomId });
    broadcastRoom(room);
  });

  socket.on('join_room', (
    { roomId, name }: { roomId: string; name: string },
    cb: (res: { ok: true } | { error: string }) => void
  ) => {
    const room = rooms.get(roomId.toUpperCase());
    if (!room) return cb({ error: 'Room not found' });
    if (room.phase !== 'lobby') return cb({ error: 'Game already started' });
    if (room.players.length >= 4) return cb({ error: 'Room is full' });
    if (room.players.find(p => p.id === socket.id)) return cb({ error: 'Already in room' });

    const clientId = socketClientMap.get(socket.id) ?? socket.id;
    const playerName = name || `Player ${room.players.length + 1}`;
    room.players.push({
      id: socket.id,
      clientId,
      name: playerName,
      tokenColor: TOKEN_COLORS[room.players.length % TOKEN_COLORS.length],
      hand: [],
      sequenceCount: 0,
    });
    room.log.push({ id: room.log.length, playerId: socket.id, playerName, action: 'joined the room' });
    socket.join(roomId.toUpperCase());
    cb({ ok: true });
    broadcastRoom(room);
  });

  socket.on('start_game', (roomId: string) => {
    const room = rooms.get(roomId);
    if (!room || room.phase !== 'lobby') return;
    if (room.players[0].id !== socket.id) return; // only host can start
    if (room.players.length < 2) {
      socket.emit('error', 'Need at least 2 players to start');
      return;
    }
    const deck = createDeck();
    const { hands, remaining } = dealHands(deck, room.players.length);
    room.players.forEach((p, i) => { p.hand = hands[i]; });
    room.deck = remaining;
    room.phase = 'playing';
    room.log.push({ id: room.log.length, playerId: '', playerName: '', action: '— Game started —' });
    broadcastRoom(room);
  });

  socket.on('play_card', ({
    roomId, card, row, col
  }: { roomId: string; card: string; row: number; col: number }) => {
    const room = rooms.get(roomId);
    if (!room || room.phase !== 'playing') return;

    const result = applyMove(room, socket.id, card, row, col);
    if (result.error) {
      socket.emit('move_error', result.error);
      return;
    }
    rooms.set(roomId, result.room!);
    if (result.room!.winner) result.room!.phase = 'finished';
    broadcastRoom(result.room!);
  });

  socket.on('restart_game', (roomId: string) => {
    const room = rooms.get(roomId);
    if (!room) return;
    if (!room.players.find(p => p.id === socket.id)) return;
    room.phase = 'lobby';
    room.board = createInitialBoard();
    room.deck = [];
    room.discardPile = [];
    room.lastPlayedCell = null;
    room.winner = null;
    room.sequences = [];
    room.log = [];
    room.currentPlayerIndex = 0;
    room.pendingSequenceChoice = null;
    room.players.forEach(p => { p.hand = []; p.sequenceCount = 0; });
    broadcastRoom(room);
  });

  socket.on('choose_sequence', ({ roomId, cells }: { roomId: string; cells: [number, number][] }) => {
    const room = rooms.get(roomId);
    if (!room || room.phase !== 'playing') return;
    const result = resolveSequenceChoice(room, socket.id, cells);
    if (result.error) { socket.emit('move_error', result.error); return; }
    rooms.set(roomId, result.room!);
    if (result.room!.winner) result.room!.phase = 'finished';
    broadcastRoom(result.room!);
  });

  socket.on('set_color', ({ roomId, color }: { roomId: string; color: TokenColor }) => {
    const room = rooms.get(roomId);
    if (!room || room.phase !== 'lobby') return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    if (room.players.find(p => p.id !== socket.id && p.tokenColor === color)) {
      socket.emit('error', 'Color already taken');
      return;
    }
    player.tokenColor = color;
    broadcastRoom(room);
  });

  socket.on('set_name', ({ roomId, name }: { roomId: string; name: string }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (player) { player.name = name; broadcastRoom(room); }
  });

  socket.on('disconnect', () => {
    console.log(`[-] ${socket.id}`);
    socketClientMap.delete(socket.id);
    for (const [roomId, room] of rooms) {
      const idx = room.players.findIndex(p => p.id === socket.id);
      if (idx !== -1) {
        if (room.phase === 'lobby') {
          // In lobby: remove the player immediately
          room.players.splice(idx, 1);
          if (room.players.length === 0) {
            rooms.delete(roomId);
          } else {
            if (room.currentPlayerIndex >= room.players.length)
              room.currentPlayerIndex = 0;
            broadcastRoom(room);
          }
        }
        // During a game: keep the slot so the player can reconnect via 'register'
      }
    }
  });
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));

const PORT = process.env.PORT ?? 3001;
httpServer.listen(PORT, () => console.log(`Server on :${PORT}`));
