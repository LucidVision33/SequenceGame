import { useState, useEffect, useRef } from 'react';
import type { LogEntry, PlayerInfo } from '../types';
import { TOKEN_COLOR_HEX } from '../types';

interface GameLogProps {
  log: LogEntry[];
  players: PlayerInfo[];
}

export default function GameLog({ log, players }: GameLogProps) {
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const colorFor = (playerId: string) => {
    const p = players.find(p => p.id === playerId);
    return p ? TOKEN_COLOR_HEX[p.tokenColor] : '#888';
  };

  // Scroll to bottom when new entries arrive and log is open
  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [log.length, open]);

  return (
    <div className={`game-log ${open ? 'game-log--open' : ''}`}>
      <button className="game-log__tab" onClick={() => setOpen(o => !o)}>
        Game Log {log.length > 0 && <span className="game-log__count">{log.length}</span>}
        <span className="game-log__arrow">{open ? '▼' : '▲'}</span>
      </button>

      {open && (
        <div className="game-log__panel" ref={listRef}>
          {log.length === 0 && <div className="game-log__empty">No moves yet.</div>}
          {log.map(entry => (
            <div key={entry.id} className="game-log__entry">
              {entry.playerId ? (
                <>
                  <span
                    className="game-log__dot"
                    style={{ backgroundColor: colorFor(entry.playerId) }}
                  />
                  <span className="game-log__name">{entry.playerName}</span>
                  <span className="game-log__action"> {entry.action}</span>
                </>
              ) : (
                <span className="game-log__system">{entry.action}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
