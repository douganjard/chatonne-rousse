import type { LucideIcon } from 'lucide-react';
import { Crown, KeyboardMusic, Radio, UserRound } from 'lucide-react';

type BaseNavNode = {
  id: 'about' | 'chess' | 'synth' | 'spotify';
  label: string;
  navLabel?: string;
  tagline: string;
  position: [number, number, number];
  collisionHalfSize: [number, number];
  interactionRadius: number;
  accent: string;
  Icon: LucideIcon;
  objectLabel: string;
};

export type LinkNavNode = BaseNavNode & {
  kind: 'link';
  path: string;
  external?: boolean;
};

export type SpotifyNavNode = BaseNavNode & {
  id: 'spotify';
  kind: 'spotify';
};

export type NavNode = LinkNavNode | SpotifyNavNode;

export function isLinkNavNode(node: NavNode): node is LinkNavNode {
  return node.kind === 'link';
}

export const navNodes: NavNode[] = [
  {
    id: 'about',
    kind: 'link',
    label: 'About',
    path: '/about',
    tagline: 'Profile, role, and current links from my personal site.',
    position: [1.82, 0.84, -2.62],
    collisionHalfSize: [0.14, 0.1],
    interactionRadius: 0.82,
    accent: '#b7743c',
    Icon: UserRound,
    objectLabel: 'Framed portrait',
  },
  {
    id: 'chess',
    kind: 'link',
    label: 'How about a game of chess?',
    navLabel: 'Chess',
    path: 'http://chess.com/play/douganjard',
    tagline: 'Challenge me on Chess.com.',
    position: [-1.55, 0.08, 2.05],
    collisionHalfSize: [0.3, 0.3],
    interactionRadius: 0.68,
    accent: '#d0a856',
    external: true,
    Icon: Crown,
    objectLabel: 'Chess board',
  },
  {
    id: 'synth',
    kind: 'link',
    label: 'Synth Conductor',
    path: 'https://synthconductor.douganjard.com/',
    tagline: 'A browser instrument experiment for conducting synth sounds.',
    position: [1.55, 0.07, 1.55],
    collisionHalfSize: [0.32, 0.12],
    interactionRadius: 0.68,
    accent: '#7fc6b7',
    external: true,
    Icon: KeyboardMusic,
    objectLabel: 'MIDI keyboard',
  },
  {
    id: 'spotify',
    kind: 'spotify',
    label: 'Listening now',
    tagline: 'What I am listening to on Spotify.',
    position: [-2.72, 0, -2.78],
    collisionHalfSize: [0.34, 0.25],
    interactionRadius: 0.92,
    accent: '#1ed760',
    Icon: Radio,
    objectLabel: 'Standing speaker',
  },
];
