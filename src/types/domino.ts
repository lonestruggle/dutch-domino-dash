
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
  forced?: boolean; // Mark special high-priority open ends that bypass forbiddens/neighbor checks
  anchorX?: number; // For forced ends: the occupied cell used as the connection source
  anchorY?: number; // For forced ends: the occupied cell used as the connection source
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
  hardSlamNextMove?: boolean; // Track if next move should be a hard slam
  isHardSlamming?: boolean; // Track if hard slam animation is currently playing

  // Nieuw voor spelafloop
  gameEndReason?: 'blocked' | 'changa' | 'normal';
  winner_position?: number;
}
