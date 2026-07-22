import type { LucideIcon } from 'lucide-react';
import { Crown, KeyboardMusic, UserRound } from 'lucide-react';

export type NavNode = {
  id: 'about' | 'chess' | 'synth';
  label: string;
  navLabel?: string;
  path: string;
  tagline: string;
  position: [number, number, number];
  collisionHalfSize: [number, number];
  accent: string;
  Icon: LucideIcon;
  external?: boolean;
  objectLabel: string;
};

export const navNodes: NavNode[] = [
  {
    id: 'about',
    label: 'About',
    path: '/about',
    tagline: 'Profile, role, and current links from my personal site.',
    position: [1.82, 0.82, -2.42],
    collisionHalfSize: [0.12, 0.08],
    accent: '#b7743c',
    Icon: UserRound,
    objectLabel: 'Framed portrait',
  },
  {
    id: 'chess',
    label: 'How about a game of chess?',
    navLabel: 'Chess',
    path: 'https://link.chess.com/play/eTlu1T',
    tagline: 'Challenge me on Chess.com.',
    position: [-1.55, 0.08, 2.05],
    collisionHalfSize: [0.3, 0.3],
    accent: '#d0a856',
    external: true,
    Icon: Crown,
    objectLabel: 'Chess board',
  },
  {
    id: 'synth',
    label: 'Synth Conductor',
    path: 'https://synthconductor.douganjard.com/',
    tagline: 'A browser instrument experiment for conducting synth sounds.',
    position: [1.55, 0.07, 1.55],
    collisionHalfSize: [0.32, 0.12],
    accent: '#7fc6b7',
    external: true,
    Icon: KeyboardMusic,
    objectLabel: 'MIDI keyboard',
  },
];
