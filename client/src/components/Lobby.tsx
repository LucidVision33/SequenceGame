import { useState } from 'react';
import type { GameView, TokenColor } from '../types';
import { TOKEN_COLOR_HEX } from '../types';

const ALL_COLORS: TokenColor[] = ['blue', 'red', 'green', 'yellow', 'purple'];

interface LobbyProps {
  view: GameView | null;
  onCreateRoom: (name: string) => void;
  onJoinRoom: (roomId: string, name: string) => void;
  onStartGame: () => void;
  onSetColor: (color: TokenColor) => void;
  onSetName: (name: string) => void;
  error: string | null;
}

export default function Lobby({
  view, onCreateRoom, onJoinRoom, onStartGame, onSetColor, onSetName, error
}: LobbyProps) {
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');

  const me = view?.players.find(p => p.id === view.myId);
  const isHost = view && view.players[0]?.id === view.myId;

  // Pre-game: no room joined yet
  if (!view) {
    return (
      <div className="lobby">
        <h1 className="lobby__title">Sequence</h1>
        <div className="lobby__actions">
          <div className="lobby__field">
            <label>Your name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Enter name" maxLength={20} />
          </div>
          <button className="btn btn--primary" onClick={() => onCreateRoom(name || 'Player 1')}>
            Create Room
          </button>
          <div className="lobby__divider">or</div>
          <div className="lobby__join-row">
            <input
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Room code"
              maxLength={4}
              className="lobby__code-input"
            />
            <button className="btn btn--secondary" onClick={() => onJoinRoom(joinCode, name || 'Player')}>
              Join
            </button>
          </div>
          {error && <p className="lobby__error">{error}</p>}
        </div>
      </div>
    );
  }

  // In lobby waiting room
  const takenColors = view.players.filter(p => p.id !== view.myId).map(p => p.tokenColor);

  return (
    <div className="lobby">
      <h1 className="lobby__title">Sequence</h1>
      <div className="lobby__room-code">
        Room: <strong>{view.roomId}</strong>
        <span className="lobby__room-hint"> — share this with friends</span>
      </div>

      <div className="lobby__players">
        <h3>Players ({view.players.length}/4)</h3>
        {view.players.map(p => (
          <div key={p.id} className="lobby__player">
            <span
              className="lobby__token-preview"
              style={{ backgroundColor: TOKEN_COLOR_HEX[p.tokenColor] }}
            />
            <span className="lobby__player-name">
              {p.name} {p.id === view.myId ? '(you)' : ''} {p.id === view.players[0].id ? '👑' : ''}
            </span>
          </div>
        ))}
      </div>

      {me && (
        <div className="lobby__customize">
          <h3>Your settings</h3>

          <div className="lobby__field">
            {editingName ? (
              <div className="lobby__name-edit">
                <input
                  value={draftName}
                  onChange={e => setDraftName(e.target.value)}
                  maxLength={20}
                  autoFocus
                />
                <button className="btn btn--small" onClick={() => {
                  onSetName(draftName);
                  setEditingName(false);
                }}>Save</button>
              </div>
            ) : (
              <div className="lobby__name-row">
                <span>{me.name}</span>
                <button className="btn btn--small" onClick={() => { setDraftName(me.name); setEditingName(true); }}>
                  Edit name
                </button>
              </div>
            )}
          </div>

          <div className="lobby__colors">
            <label>Token color</label>
            <div className="lobby__color-row">
              {ALL_COLORS.map(color => (
                <button
                  key={color}
                  className={`lobby__color-btn ${me.tokenColor === color ? 'lobby__color-btn--active' : ''}`}
                  style={{ backgroundColor: TOKEN_COLOR_HEX[color] }}
                  disabled={takenColors.includes(color)}
                  onClick={() => onSetColor(color)}
                  title={color}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {isHost ? (
        <button
          className="btn btn--primary btn--large"
          onClick={onStartGame}
          disabled={view.players.length < 2}
        >
          {view.players.length < 2 ? 'Waiting for players…' : 'Start Game'}
        </button>
      ) : (
        <p className="lobby__waiting">Waiting for host to start…</p>
      )}

      {error && <p className="lobby__error">{error}</p>}
    </div>
  );
}
