
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
  rotation?: number; // Small random rotation in degrees for natural placement (Z-axis)
  rotationX?: number; // X-axis rotation for Hard Slam
  rotationY?: number; // Y-axis rotation for Hard Slam
  rotationZ?: number; // Z-axis rotation for Hard Slam (replaces rotation when set)
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
  actorPosition?: number; // Optional: which player is executing this move (for bot-hosted turns)
}

export interface ShakeAnimationProfile {
  eventId: string;
  seed: number;
  startedAtMs: number;
  intensity: number;
  duration: number;
  rotationAmplitudeX: number;
  rotationAmplitudeY: number;
  rotationAmplitudeZ: number;
  rotationSpeed: number;
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
  
  // Hard Slam properties
  hardSlamNextMove?: boolean;
  isHardSlamming?: boolean;
  hardSlamDominoId?: string; // Track which specific domino triggered the hard slam
  triggerHardSlamAnimation?: boolean; // Separate flag for animation sync across all players
  hardSlamAnimationProfile?: ShakeAnimationProfile; // Shared profile so all clients render the same hard slam motion

  // Nieuw voor spelafloop
  gameEndReason?: 'blocked' | 'changa' | 'normal';
  winner_position?: number;
}
