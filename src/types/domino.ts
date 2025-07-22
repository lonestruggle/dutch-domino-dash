export interface DominoData {
  value1: number;
  value2: number;
}

export interface DominoState {
  data: DominoData;
  x: number;
  y: number;
  orientation: 'horizontal' | 'vertical';
  flipped: boolean;
  isSpinner: boolean;
  rotation?: number; // Small random rotation in degrees for natural placement
}

export interface OpenEnd {
  x: number;
  y: number;
  value: number;
  fromDir: 'N' | 'S' | 'E' | 'W';
}

export interface LegalMove {
  end: OpenEnd;
  dominoData: DominoData;
  flipped: boolean;
  orientation: 'horizontal' | 'vertical';
  x: number;
  y: number;
  fromDomino?: DominoState;
  index?: number;
}

export interface GameState {
  dominoes: Record<string, DominoState>;
  board: Record<string, { dominoId: string; value: number }>;
  playerHand: DominoData[];
  playerHands?: DominoData[][]; // Add this for multiplayer support
  boneyard: DominoData[];
  openEnds: OpenEnd[];
  forbiddens: Record<string, boolean>;
  nextDominoId: number;
  spinnerId: string | null;
  isGameOver: boolean;
  selectedHandIndex: number | null;
  currentPlayer?: number; // Add current player for multiplayer sync
  hardSlamUsesRemaining?: number; // Track hard slam uses for current player
}