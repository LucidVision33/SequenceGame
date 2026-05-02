import type { CardCode } from '../types';

// Official Sequence board layout (Jax Ltd.)
// Each non-Jack card appears exactly twice. FREE = corner wild spaces.
export const BOARD_LAYOUT: CardCode[][] = [
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

export function parseCard(code: CardCode): { rank: string; suit: string; color: 'red' | 'black' | 'free' } {
  if (code === 'FREE') return { rank: '★', suit: '', color: 'free' };
  const suit = code.slice(-1) as Suit;
  const rankRaw = code.slice(0, -1);
  const rank = rankRaw === 'T' ? '10' : rankRaw;
  const suitSymbol = { S: '♠', C: '♣', H: '♥', D: '♦' }[suit];
  const color = suit === 'H' || suit === 'D' ? 'red' : 'black';
  return { rank, suit: suitSymbol, color };
}

type Suit = 'S' | 'C' | 'H' | 'D';
