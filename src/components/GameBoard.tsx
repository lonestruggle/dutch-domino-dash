import React, { useRef, useEffect, useState } from 'react';
import { DominoTile } from './DominoTile';
import { PlacementTarget } from './PlacementTarget';
import { GameState, LegalMove } from '@/types/domino';
import { useIsMobile } from '@/hooks/use-mobile';
import { useGameVisualSettings } from '@/hooks/useGameVisualSettings';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useAuth } from '@/hooks/useAuth';
import { useStonePhysics } from '@/hooks/useStonePhysics';
import { supabase } from '@/integrations/supabase/client';
import dominoTable1 from '@/assets/domino-table-1.webp';
import dominoTable2 from '@/assets/domino-table-2.webp';
const curacaoFlagTable = '/lovable-uploads/f85e0ba4-a21e-4716-b54c-d9c55efc9496.png';
const premiumWoodTable = '/lovable-uploads/06c1799a-c59e-44f8-8d9c-3cc8d671f4c2.png';
const BASE_GLOVE_IMAGE = '/glove-hand.svg';

const withCacheBuster = (url: string, version: string) => {
  if (!url) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${encodeURIComponent(version)}`;
};

interface PlayerGloveSkinConfig {
  imageUrl: string;
  overlayOffsetX: number;
  overlayOffsetY: number;
  overlayScale: number;
  overlayRotation: number;
  showOverlay: boolean;
}

interface GameBoardProps {
  gameState: GameState;
  legalMoves: LegalMove[];
  playerUserIds?: string[];
  currentTurnUserId?: string | null;
  onMoveExecute: (move: LegalMove) => void;
  onCenterView: () => void;
  hasDifferentNeighbor: (x: number, y: number) => boolean;
  backgroundChoice?: string;
  tableBackgroundUrl?: string;
  onRotateDomino?: (dominoId: string) => void;
  hardSlamMode?: boolean;
  isMyTurn?: boolean;
}

// Grid-based constants - each domino occupies 2 grid cells
// GRID_CELL_SIZE is now dynamic based on settings
const MIN_SCALE = 0.25;
const MAX_SCALE = 1.0;
const MIN_BOARD_SIZE = 1200;
const PADDING = 400;

const getStableAngleFromId = (dominoId: string): number => {
  // Stable pseudo-random angle so dominoes don't "jitter" between renders.
  let hash = 0;
  for (let i = 0; i < dominoId.length; i += 1) {
    hash = (hash * 31 + dominoId.charCodeAt(i)) >>> 0;
  }
  return 5 + (hash % 1500) / 100; // 5.00 .. 19.99 degrees
};

const getDominoNumericId = (dominoId: string): number => {
  const match = dominoId.match(/^d(\d+)$/);
  return match ? Number(match[1]) : -1;
};

const createSeededRandom = (seed: number) => {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

interface PlaceHandAnimationState {
  dominoId: string;
  left: number;
  top: number;
}

interface HardSlamHandPlacementState {
  left: number;
  top: number;
}

interface HardSlamShakeFrameState {
  env: number;
  intensity: number;
  elapsedTime: number;
}

interface HardSlamScatterAction {
  id: string;
  dx: number;
  dy: number;
  daDeg: number;
  targetDaDeg: number;
}

interface PendingHardSlamScatter {
  eventId: string;
  actions: HardSlamScatterAction[];
}

const HARD_SLAM_HAND_ANIMATION_MS = 980;

export const GameBoard: React.FC<GameBoardProps> = ({ 
  gameState, 
  legalMoves, 
  playerUserIds = [],
  currentTurnUserId = null,
  onMoveExecute, 
  onCenterView, 
  hasDifferentNeighbor, 
  backgroundChoice = 'domino-table-2',
  tableBackgroundUrl,
  onRotateDomino,
  hardSlamMode,
  isMyTurn = true
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const {
    settings,
    applyOriginalRotations,
    isAnimating,
    animationMode,
    updateGlovePosition,
    updateShakeIntensity,
    updateShakeDuration,
    startShakeAnimation,
  } = useGameVisualSettings();
  const { getSetting } = useAppSettings();
  const [playerGloveSkinByUserId, setPlayerGloveSkinByUserId] = useState<Record<string, PlayerGloveSkinConfig>>({});
  const [placeHandAnimation, setPlaceHandAnimation] = useState<PlaceHandAnimationState | null>(null);
  const [hardSlamHandPlacement, setHardSlamHandPlacement] = useState<HardSlamHandPlacementState | null>(null);
  const [showHardSlamHand, setShowHardSlamHand] = useState(false);
  const [hardSlamHandAnimKey, setHardSlamHandAnimKey] = useState(0);
  const [isGloveImageUnavailable, setIsGloveImageUnavailable] = useState(false);
  const [processedGloveImageSrc, setProcessedGloveImageSrc] = useState<string | null>(null);
  const [isDraggingPersistentGlove, setIsDraggingPersistentGlove] = useState(false);
  const [persistentGlovePreviewPos, setPersistentGlovePreviewPos] = useState<{ x: number; y: number } | null>(null);

  // --- STAP 1: OBB / SAT physics-laag (debug) -------------------------------
  // Anker start op 0.000: stenen blijven liggen waar collision ze duwt.
  const [physicsEnabled, setPhysicsEnabled] = useState(true);
  const [anchorStrength, setAnchorStrength] = useState(0.1);
  const [showCollisionDebug, setShowCollisionDebug] = useState(false);
  const [physicsPanelOpen, setPhysicsPanelOpen] = useState(false);
  // Hard-slam visuele tuning (matcht CanvasDemo defaults).
  // scatterBase = pixels dat elke steen wegspringt (demo: 70)
  // jumpHeight  = pixels dat de steen "omhoog" wipt via translate (demo: 20)
  // popScale    = extra schaal op de piek van de envelope (demo: 0.15)
  // shakeAmp    = per-frame trill-amplitude in pixels (demo: 15)
  const [scatterBase, setScatterBase] = useState(70);
  const [jumpHeight, setJumpHeight] = useState(20);
  const [popScaleAmount, setPopScaleAmount] = useState(0.15);
  const [shakeAmp, setShakeAmp] = useState(15);
  // Bouncing jump: het aantal keer dat de steen op-en-neer wipt en hoe snel
  // die bounces uitdempen. |sin(π·f·t)| * exp(-t·damping) geeft meerdere
  // decayende sprongetjes zoals een echte steen die op tafel valt.
  const [bounceFrequency, setBounceFrequency] = useState(5); // Hz (aantal bounces per seconde)
  const [bounceDamping, setBounceDamping] = useState(2.5); // hoe snel de sprong uitdempt
  // Vergelijkings-modus: twee presets (A/B) om snel te wisselen tussen
  // physics-instellingen en het effect na een Hard Slam te vergelijken.
  type PhysicsPreset = { intensity: number; duration: number; anchor: number };
  const [comparisonMode, setComparisonMode] = useState(false);
  const [activePreset, setActivePreset] = useState<'A' | 'B'>('A');
  const [presetA, setPresetA] = useState<PhysicsPreset>({ intensity: 0.4, duration: 0.6, anchor: 0.1 });
  const [presetB, setPresetB] = useState<PhysicsPreset>({ intensity: 1.0, duration: 1.5, anchor: 0.4 });
  // ------------------------------------------------------------------------

  // --- Drag & Drop placement -----------------------------------------------
  // Wanneer een steen in de hand is geselecteerd verschijnt een floating
  // ghost-steen midden op tafel. De speler kan die met pointer/touch
  // verslepen en op een legal target droppen. Klikken op een target blijft
  // ook werken als alternatief.
  const [dragGhostPos, setDragGhostPos] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingHandGhost, setIsDraggingHandGhost] = useState(false);
  const [hoverMoveKey, setHoverMoveKey] = useState<string | null>(null);
  const [hardSlamShakeFrame, setHardSlamShakeFrame] = useState<HardSlamShakeFrameState>({
    env: 0,
    intensity: 0,
    elapsedTime: 0,
  });
  const pendingHardSlamScatterRef = useRef<PendingHardSlamScatter | null>(null);
  const stonePhysicsRef = useRef<ReturnType<typeof useStonePhysics> | null>(null);
  // ------------------------------------------------------------------------

  const persistentGlovePosRef = useRef<{ x: number; y: number }>({
    x: settings.glovePosX || 82,
    y: settings.glovePosY || 76,
  });
  const configuredBaseGloveImageUrl = String(
    getSetting('global_base_glove_image_url', BASE_GLOVE_IMAGE) || BASE_GLOVE_IMAGE
  ).trim() || BASE_GLOVE_IMAGE;
  const gloveAssetVersion = String(getSetting('global_glove_asset_version', '1') || '1');
  const versionedBaseGloveImageUrl = withCacheBuster(configuredBaseGloveImageUrl, gloveAssetVersion);

  const fallbackSkinConfig: PlayerGloveSkinConfig | null = null;
  const resolveUserSkinConfig = (userId?: string | null): PlayerGloveSkinConfig | null =>
    (userId ? playerGloveSkinByUserId[userId] : undefined) || fallbackSkinConfig;
  const persistentGloveSkinConfig = resolveUserSkinConfig(currentTurnUserId || user?.id || null);
  const placeAnimationGloveSkinConfig = resolveUserSkinConfig(gameState.lastMoveActorUserId || null);
  const hardSlamGloveSkinConfig = resolveUserSkinConfig(gameState.hardSlamActorUserId || null);
  const globalGloveAlwaysVisible = Boolean(getSetting('global_glove_always_visible', true));
  const previousDominoIdsRef = useRef<Set<string>>(new Set(Object.keys(gameState.dominoes)));
  const lastAnimatedDominoIdRef = useRef<string | null>(null);
  const lastHardSlamEventRef = useRef<string | null>(null);
  useEffect(() => {
    const uniqueUserIds = Array.from(new Set(
      [...(playerUserIds || []), user?.id]
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
    ));
    if (uniqueUserIds.length === 0) {
      setPlayerGloveSkinByUserId({});
      return;
    }

    let cancelled = false;
    const loadPlayerGloveSkins = async () => {
      try {
        const { data: profileRows, error: profileError } = await supabase
          .rpc('get_co_player_glove_skins', { p_user_ids: uniqueUserIds });

        if (profileError) throw profileError;
        if (cancelled) return;

        const selectedByUser = new Map<string, string>();
        (profileRows || []).forEach((row: any) => {
          if (row.selected_glove_skin_id) {
            selectedByUser.set(row.user_id, row.selected_glove_skin_id);
          }
        });

        const selectedSkinIds = Array.from(new Set(Array.from(selectedByUser.values())));
        if (selectedSkinIds.length === 0) {
          setPlayerGloveSkinByUserId({});
          return;
        }

        const { data: skinRows, error: skinError } = await supabase
          .from('glove_skins')
          .select('id, name, image_url, overlay_offset_x, overlay_offset_y, overlay_scale, overlay_rotation')
          .in('id', selectedSkinIds)
          .eq('is_active', true);

        if (skinError) throw skinError;
        if (cancelled) return;

        const validSkinById = new Map<string, PlayerGloveSkinConfig>();
        (skinRows || []).forEach((skin) => {
          const isStandardSkin = (skin.name || '').trim().toLowerCase() === 'standaard';
          const hasVisibleOverlay = Number.isFinite(skin.overlay_scale) ? skin.overlay_scale > 0.001 : true;
          validSkinById.set(skin.id, {
            imageUrl: skin.image_url,
            overlayOffsetX: Number.isFinite(skin.overlay_offset_x) ? skin.overlay_offset_x : 0,
            overlayOffsetY: Number.isFinite(skin.overlay_offset_y) ? skin.overlay_offset_y : 0,
            overlayScale: Number.isFinite(skin.overlay_scale) ? skin.overlay_scale : 1,
            overlayRotation: Number.isFinite(skin.overlay_rotation) ? skin.overlay_rotation : 0,
            showOverlay: !isStandardSkin && hasVisibleOverlay,
          });
        });

        const resolvedMap: Record<string, PlayerGloveSkinConfig> = {};
        selectedByUser.forEach((skinId, selectedUserId) => {
          const skinConfig = validSkinById.get(skinId);
          if (!skinConfig) return;
          resolvedMap[selectedUserId] = skinConfig;
        });

        setPlayerGloveSkinByUserId(resolvedMap);
      } catch (error) {
        console.error('Failed to load player glove skins:', error);
        if (!cancelled) setPlayerGloveSkinByUserId({});
      }
    };

    void loadPlayerGloveSkins();
    return () => {
      cancelled = true;
    };
  }, [playerUserIds, user?.id]);

  
  // Dynamic grid cell size based on settings - each domino = 2 grid cells
  const GRID_CELL_SIZE = settings.dominoWidth / 2;

  // STAP 1: Physics-hook (OBB/SAT). Werkt puur visueel met translate3d
  // op de wrapper-div; gameState (grid-coords) blijft onaangetast.
  const stonePhysics = useStonePhysics(
    gameState.dominoes as unknown as Record<
      string,
      { x: number; y: number; orientation: 'horizontal' | 'vertical'; rotation?: number }
    >,
    GRID_CELL_SIZE,
    { anchorStrength, enabled: physicsEnabled },
  );
  stonePhysicsRef.current = stonePhysics;

  // Debug: expose physics + domino-ids op window zodat je vanuit de console
  // `stonePhysics.nudge(id, dx, dy)` kan aanroepen om een steen te verschuiven.
  useEffect(() => {
    (window as any).stonePhysics = stonePhysics;
    (window as any).dominoIds = Object.keys(gameState.dominoes);
  }, [stonePhysics, gameState.dominoes]);

  useEffect(() => {
    const handleHardSlamShakeFrame = (event: Event) => {
      const detail = (event as CustomEvent<Partial<HardSlamShakeFrameState> & { done?: boolean }>).detail || {};
      if (detail.done) {
        setHardSlamShakeFrame({ env: 0, intensity: 0, elapsedTime: 0 });
        return;
      }

      const pendingScatter = pendingHardSlamScatterRef.current;
      const physics = stonePhysicsRef.current;
      if (pendingScatter && physics) {
        pendingScatter.actions.forEach(({ id, dx, dy, daDeg, targetDaDeg }) => {
          physics.scatter(id, dx, dy, daDeg, targetDaDeg);
        });
        pendingHardSlamScatterRef.current = null;
      }

      setHardSlamShakeFrame({
        env: Math.max(0, Number(detail.env) || 0),
        intensity: Math.max(0, Number(detail.intensity) || 0),
        elapsedTime: Math.max(0, Number(detail.elapsedTime) || 0),
      });
    };

    window.addEventListener('dominoHardSlamShakeFrame', handleHardSlamShakeFrame);
    return () => window.removeEventListener('dominoHardSlamShakeFrame', handleHardSlamShakeFrame);
  }, []);


  // Listen for live settings updates and reapply scaling
  useEffect(() => {
    const handleAnyUpdate = () => {
      updateDominoScaling();
    };

    window.addEventListener('vibrationSettingsUpdated', handleAnyUpdate);
    window.addEventListener('visualSettingsUpdated', handleAnyUpdate);

    return () => {
      window.removeEventListener('vibrationSettingsUpdated', handleAnyUpdate);
      window.removeEventListener('visualSettingsUpdated', handleAnyUpdate);
    };
  }, [gameState]);

  // Base domino scale - allow user settings to take effect
  const calculateDominoScale = () => {
    // Return base scale of 1.0 to let user dominoScale setting control the size
    return 1.0; // Base scale - user settings will be applied on top of this
  };

  // Update CSS scaling
  const updateDominoScaling = () => {
    // Prefer globally broadcast settings to ensure live updates across components
    const latest = (() => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (window as any).__dominoSettings || settings;
      } catch {
        return settings;
      }
    })();

    const baseScale = calculateDominoScale();
    const userScale = latest.dominoScale;
    const finalScale = baseScale * userScale;
    const selectedScale = finalScale * 1.05;
    const hoverScale = finalScale;
    
    const rootElement = document.documentElement;
    rootElement.style.setProperty('--domino-scale', finalScale.toString());
    rootElement.style.setProperty('--domino-scale-selected', selectedScale.toString());
    rootElement.style.setProperty('--domino-scale-hover', hoverScale.toString());
    // IMPORTANT: Hand domino scale must be independent from board scale
    rootElement.style.setProperty('--hand-domino-scale', (latest.handDominoScale || 1).toString());
    
    // Apply global domino dimension settings
    rootElement.style.setProperty('--domino-width', (latest.dominoWidth || 80).toString() + 'px');
    rootElement.style.setProperty('--domino-height', (latest.dominoHeight || 40).toString() + 'px');
    rootElement.style.setProperty('--domino-thickness', (latest.dominoThickness || 8).toString() + 'px');
    
    // Calculate dynamic double offset for proper centering (based on grid cell size)
    const doubleOffset = GRID_CELL_SIZE / 2;
    rootElement.style.setProperty('--double-offset', `-${doubleOffset}px`);
    
    if (boardRef.current) {
      boardRef.current.getBoundingClientRect();
    }
  };

  useEffect(() => {
    updateDominoScaling();
    const handleResize = () => updateDominoScaling();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobile, settings.dominoScale, settings.dominoWidth, settings.dominoHeight, settings.dominoThickness]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => updateDominoScaling());
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [settings.dominoScale, settings.dominoWidth, settings.dominoHeight, settings.dominoThickness]);

  useEffect(() => {
    updateDominoScaling();
    // Apply original rotations after rendering new dominoes
    const timer = setTimeout(() => {
      applyOriginalRotations();
    }, 100);
    return () => clearTimeout(timer);
  }, [gameState.dominoes, settings.dominoScale, settings.dominoWidth, settings.dominoHeight, settings.dominoThickness, applyOriginalRotations]);
  // Note: hardSlamMode is intentionally NOT in dependencies - we only want to trigger on new dominoes

  // Original PC logic for board size calculation
  const calculateOptimalScale = () => {
    if (!containerRef.current || Object.keys(gameState.dominoes).length === 0) {
      return MAX_SCALE;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const availableWidth = containerRect.width;
    const availableHeight = containerRect.height;

    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    
    Object.values(gameState.dominoes).forEach(domino => {
      const dominoWidth = domino.orientation === 'horizontal' ? 2 : 1;
      const dominoHeight = domino.orientation === 'vertical' ? 2 : 1;
      
      minX = Math.min(minX, domino.x);
      maxX = Math.max(maxX, domino.x + dominoWidth - 1);
      minY = Math.min(minY, domino.y);
      maxY = Math.max(maxY, domino.y + dominoHeight - 1);
    });

    const extraPadding = 4;
    const requiredWidth = (maxX - minX + 1 + extraPadding * 2) * GRID_CELL_SIZE;
    const requiredHeight = (maxY - minY + 1 + extraPadding * 2) * GRID_CELL_SIZE;

    const scaleX = availableWidth / requiredWidth;
    const scaleY = availableHeight / requiredHeight;
    const optimalScale = Math.min(scaleX, scaleY, MAX_SCALE);

    return Math.max(optimalScale, MIN_SCALE);
  };

  // Original PC logic for board size
  const calculateBoardSize = () => {
    if (Object.keys(gameState.dominoes).length === 0) {
      return MIN_BOARD_SIZE;
    }

    let minX = 0, maxX = 0, minY = 0, maxY = 0;
    
    Object.values(gameState.dominoes).forEach(domino => {
      const dominoWidth = domino.orientation === 'horizontal' ? 2 : 1;
      const dominoHeight = domino.orientation === 'vertical' ? 2 : 1;
      
      minX = Math.min(minX, domino.x);
      maxX = Math.max(maxX, domino.x + dominoWidth - 1);
      minY = Math.min(minY, domino.y);
      maxY = Math.max(maxY, domino.y + dominoHeight - 1);
    });

    const requiredWidth = (maxX - minX + 1) * GRID_CELL_SIZE + PADDING * 2;
    const requiredHeight = (maxY - minY + 1) * GRID_CELL_SIZE + PADDING * 2;
    const requiredSize = Math.max(requiredWidth, requiredHeight, MIN_BOARD_SIZE);
    
    return Math.max(requiredSize, MIN_BOARD_SIZE);
  };

  // Original PC viewport calculation
  const calculateOptimalViewport = () => {
    if (!containerRef.current) return null;

    const dominoes = Object.values(gameState.dominoes);
    if (dominoes.length === 0) return null;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    dominoes.forEach(domino => {
      const dominoWidth = domino.orientation === 'horizontal' ? 2 : 1;
      const dominoHeight = domino.orientation === 'vertical' ? 2 : 1;
      
      minX = Math.min(minX, domino.x);
      maxX = Math.max(maxX, domino.x + dominoWidth - 1);
      minY = Math.min(minY, domino.y);
      maxY = Math.max(maxY, domino.y + dominoHeight - 1);
    });

    legalMoves.forEach(move => {
      const { end } = move;
      let { x, y } = end;
      const { orientation } = move;
      
      if (orientation === "horizontal" && end.fromDir === "W") x -= 1;
      if (orientation === "vertical" && end.fromDir === "N") y -= 1;

      const width = orientation === "horizontal" ? 2 : 1;
      const height = orientation === "vertical" ? 2 : 1;
      
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x + width - 1);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y + height - 1);
    });

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const boardSize = calculateBoardSize();
    
    const pixelCenterX = boardSize / 2 + centerX * GRID_CELL_SIZE;
    const pixelCenterY = boardSize / 2 + centerY * GRID_CELL_SIZE;
    
    const optimalScrollX = pixelCenterX - containerRect.width / 2;
    const optimalScrollY = pixelCenterY - containerRect.height / 2;
    
    return {
      scrollLeft: Math.max(0, optimalScrollX),
      scrollTop: Math.max(0, optimalScrollY)
    };
  };

  const boardSize = calculateBoardSize();
  const dynamicScale = calculateOptimalScale();

  // Camera offset in board pixels. Keep the visible chain centered without
  // scrolling the container; scrolling plus transforms caused stones to slide
  // out of view after a move.
  const boardCameraOffset = (() => {
    const dominoes = Object.values(gameState.dominoes);
    const hasDominoes = dominoes.length > 0;
    const hasTargets = legalMoves.length > 0;
    if (!hasDominoes && !hasTargets) return { x: 0, y: 0 };

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const includeRect = (x: number, y: number, width: number, height: number) => {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x + width);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y + height);
    };

    dominoes.forEach(domino => {
      includeRect(
        domino.x,
        domino.y,
        domino.orientation === 'horizontal' ? 2 : 1,
        domino.orientation === 'vertical' ? 2 : 1
      );
    });

    legalMoves.forEach(move => {
      let targetX = typeof move.x === 'number' ? move.x : move.end.x;
      let targetY = typeof move.y === 'number' ? move.y : move.end.y;
      if (typeof move.x !== 'number' && move.orientation === 'horizontal' && move.end.fromDir === 'W') targetX -= 1;
      if (typeof move.y !== 'number' && move.orientation === 'vertical' && move.end.fromDir === 'N') targetY -= 1;
      includeRect(targetX, targetY, move.orientation === 'horizontal' ? 2 : 1, move.orientation === 'vertical' ? 2 : 1);
    });

    return {
      x: ((minX + maxX) / 2) * GRID_CELL_SIZE,
      y: ((minY + maxY) / 2) * GRID_CELL_SIZE,
    };
  })();

  useEffect(() => {
    const dominoEntries = Object.entries(gameState.dominoes);
    const currentIds = new Set(dominoEntries.map(([id]) => id));
    const previousIds = previousDominoIdsRef.current;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    if (dominoEntries.length < previousIds.size) {
      lastAnimatedDominoIdRef.current = null;
      setPlaceHandAnimation(null);
      // Reset previous-id tracking too, anders blokkeren oude id's (zoals d0)
      // de animatie van de eerste steen in een nieuw spel.
      previousDominoIdsRef.current = currentIds;
      return;
    }

    const addedEntries = dominoEntries.filter(([id]) => !previousIds.has(id));
    if (addedEntries.length > 0) {
      const newestAdded = addedEntries.reduce<(typeof addedEntries)[number] | null>((selected, candidate) => {
        if (!selected) return candidate;
        const selectedNumeric = getDominoNumericId(selected[0]);
        const candidateNumeric = getDominoNumericId(candidate[0]);
        if (candidateNumeric > selectedNumeric) return candidate;
        // Fallback for non-dN ids: stable lexical compare so we still pick one deterministically.
        if (candidateNumeric === selectedNumeric && candidate[0] > selected[0]) return candidate;
        return selected;
      }, null);

      if (newestAdded && newestAdded[0] !== lastAnimatedDominoIdRef.current) {
        const [newestId, newestDomino] = newestAdded;
        const widthCells = newestDomino.orientation === 'horizontal' ? 2 : 1;
        const heightCells = newestDomino.orientation === 'vertical' ? 2 : 1;
        const centerX = newestDomino.x + widthCells / 2;
        const centerY = newestDomino.y + heightCells / 2;

        setPlaceHandAnimation({
          dominoId: newestId,
          left: boardSize / 2 + centerX * GRID_CELL_SIZE,
          top: boardSize / 2 + centerY * GRID_CELL_SIZE,
        });
        lastAnimatedDominoIdRef.current = newestId;

        hideTimer = setTimeout(() => {
          setPlaceHandAnimation((current) => (current?.dominoId === newestId ? null : current));
        }, 900);
      }
    }

    previousDominoIdsRef.current = currentIds;
    return () => {
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [gameState.dominoes, boardSize, GRID_CELL_SIZE]);

  useEffect(() => {
    const profile = gameState.hardSlamAnimationProfile;
    const eventId = profile?.eventId || gameState.hardSlamDominoId || null;
    const hardSlamEndMs = profile ? profile.startedAtMs + profile.duration * 1000 + 120 : 0;
    const isHardSlamActive =
      Boolean(gameState.triggerHardSlamAnimation) ||
      Boolean(gameState.isHardSlamming) ||
      (hardSlamEndMs > 0 && Date.now() < hardSlamEndMs);

    if (!eventId || !isHardSlamActive) return;
    if (gameState.hardSlamDominoId && !gameState.dominoes[gameState.hardSlamDominoId]) return;
    if (lastHardSlamEventRef.current === eventId) return;

    lastHardSlamEventRef.current = eventId;
    const random = profile ? createSeededRandom(profile.seed) : Math.random;
    const intensity = Math.max(0.3, profile?.intensity ?? settings.shakeIntensity ?? 1);

    pendingHardSlamScatterRef.current = {
      eventId,
      actions: Object.keys(gameState.dominoes).map((id) => {
        const dx = (random() - 0.5) * 2 * scatterBase * intensity;
        const dy = (random() - 0.5) * 2 * scatterBase * intensity;
        const daDeg = ((random() - 0.5) * 0.8 * intensity * 180) / Math.PI;
        const targetDaDeg = ((random() - 0.5) * 0.6 * intensity * 180) / Math.PI;
        return { id, dx, dy, daDeg, targetDaDeg };
      }),
    };

    const slammedDomino = gameState.hardSlamDominoId ? gameState.dominoes[gameState.hardSlamDominoId] : undefined;
    if (slammedDomino) {
      const widthCells = slammedDomino.orientation === 'horizontal' ? 2 : 1;
      const heightCells = slammedDomino.orientation === 'vertical' ? 2 : 1;
      setHardSlamHandPlacement({
        left: boardSize / 2 + (slammedDomino.x + widthCells / 2) * GRID_CELL_SIZE,
        top: boardSize / 2 + (slammedDomino.y + heightCells / 2) * GRID_CELL_SIZE,
      });
    } else {
      // Fallback so animation is still visible if domino lookup is temporarily unavailable.
      setHardSlamHandPlacement({
        left: boardSize / 2,
        top: boardSize / 2,
      });
    }
    setHardSlamHandAnimKey((prev) => prev + 1);
    setShowHardSlamHand(true);

    const timer = setTimeout(() => {
      setShowHardSlamHand(false);
      setHardSlamHandPlacement(null);
    }, HARD_SLAM_HAND_ANIMATION_MS);

    return () => clearTimeout(timer);
  }, [
    gameState.triggerHardSlamAnimation,
    gameState.isHardSlamming,
    gameState.hardSlamAnimationProfile,
    gameState.hardSlamDominoId,
    gameState.dominoes,
    boardSize,
    GRID_CELL_SIZE,
    settings.shakeIntensity,
    stonePhysics,
    scatterBase,
  ]);

  const getBackgroundImage = (backgroundChoice?: string) => {
    const backgroundMap: { [key: string]: string } = {
      'domino-table-1': dominoTable1,
      'domino-table-2': dominoTable2,
      'curacao-flag-table': curacaoFlagTable,
      'premium-wood-table': premiumWoodTable
    };
    
    return backgroundMap[backgroundChoice || 'domino-table-2'] || dominoTable2;
  };

  const backgroundImage = getBackgroundImage(backgroundChoice);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.scrollTo({ left: 0, top: 0, behavior: 'auto' });
  }, [gameState.dominoes, legalMoves]);

  useEffect(() => {
    let cancelled = false;
    setIsGloveImageUnavailable(false);
    setProcessedGloveImageSrc(null);

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.referrerPolicy = 'no-referrer';
    image.decoding = 'async';
    image.src = versionedBaseGloveImageUrl;

    image.onload = () => {
      if (cancelled) return;
      try {
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;
        if (!width || !height) {
          setProcessedGloveImageSrc(null);
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          setProcessedGloveImageSrc(null);
          return;
        }

        ctx.drawImage(image, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const { data } = imageData;

        const maxDarkThreshold = 78;
        const visited = new Uint8Array(width * height);
        const queue: number[] = [];
        const isDarkPixel = (x: number, y: number): boolean => {
          const idx = (y * width + x) * 4;
          const alpha = data[idx + 3];
          if (alpha < 10) return true;
          const maxChannel = Math.max(data[idx], data[idx + 1], data[idx + 2]);
          return maxChannel <= maxDarkThreshold;
        };

        const enqueueIfDark = (x: number, y: number) => {
          const linear = y * width + x;
          if (visited[linear]) return;
          if (!isDarkPixel(x, y)) return;
          visited[linear] = 1;
          queue.push(linear);
        };

        for (let x = 0; x < width; x += 1) {
          enqueueIfDark(x, 0);
          enqueueIfDark(x, height - 1);
        }
        for (let y = 0; y < height; y += 1) {
          enqueueIfDark(0, y);
          enqueueIfDark(width - 1, y);
        }

        while (queue.length > 0) {
          const linear = queue.pop();
          if (linear === undefined) break;
          const x = linear % width;
          const y = Math.floor(linear / width);
          const neighbors = [
            [x + 1, y],
            [x - 1, y],
            [x, y + 1],
            [x, y - 1],
          ] as const;

          neighbors.forEach(([nx, ny]) => {
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) return;
            enqueueIfDark(nx, ny);
          });
        }

        for (let linear = 0; linear < visited.length; linear += 1) {
          if (!visited[linear]) continue;
          const idx = linear * 4;
          data[idx + 3] = 0;
        }

        ctx.putImageData(imageData, 0, 0);
        setProcessedGloveImageSrc(canvas.toDataURL('image/png'));
      } catch (error) {
        // Cross-origin images can block pixel reads; fallback handled in render.
        void error;
        setProcessedGloveImageSrc(null);
      }
    };

    image.onerror = () => {
      if (cancelled) return;
      setIsGloveImageUnavailable(true);
      setProcessedGloveImageSrc(null);
    };

    return () => {
      cancelled = true;
    };
  }, [versionedBaseGloveImageUrl]);

  const effectiveBaseGloveSrc = processedGloveImageSrc || versionedBaseGloveImageUrl;
  const finalBaseGloveSrc = !isGloveImageUnavailable ? effectiveBaseGloveSrc : null;

  useEffect(() => {
    if (!globalGloveAlwaysVisible) {
      setIsDraggingPersistentGlove(false);
      setPersistentGlovePreviewPos(null);
    }
  }, [globalGloveAlwaysVisible]);

  const clampPercent = (value: number) => Math.max(4, Math.min(96, value));
  const currentPersistentGlovePos = persistentGlovePreviewPos || {
    x: clampPercent(settings.glovePosX || 82),
    y: clampPercent(settings.glovePosY || 76),
  };

  const getPercentPositionFromClientPoint = (clientX: number, clientY: number) => {
    if (!containerRef.current) return currentPersistentGlovePos;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return currentPersistentGlovePos;
    const xPercent = ((clientX - rect.left) / rect.width) * 100;
    const yPercent = ((clientY - rect.top) / rect.height) * 100;
    return {
      x: clampPercent(xPercent),
      y: clampPercent(yPercent),
    };
  };

  const beginPersistentGloveDrag = (clientX: number, clientY: number) => {
    const nextPos = getPercentPositionFromClientPoint(clientX, clientY);
    persistentGlovePosRef.current = nextPos;
    setPersistentGlovePreviewPos(nextPos);
    setIsDraggingPersistentGlove(true);
  };

  useEffect(() => {
    if (!isDraggingPersistentGlove) return;

    const handleMouseMove = (event: MouseEvent) => {
      const nextPos = getPercentPositionFromClientPoint(event.clientX, event.clientY);
      persistentGlovePosRef.current = nextPos;
      setPersistentGlovePreviewPos(nextPos);
    };

    const handleTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      const nextPos = getPercentPositionFromClientPoint(touch.clientX, touch.clientY);
      persistentGlovePosRef.current = nextPos;
      setPersistentGlovePreviewPos(nextPos);
    };

    const finishDrag = () => {
      const finalPos = persistentGlovePosRef.current;
      updateGlovePosition(finalPos.x, finalPos.y);
      setIsDraggingPersistentGlove(false);
      setPersistentGlovePreviewPos(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', finishDrag);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', finishDrag);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', finishDrag);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', finishDrag);
    };
  }, [isDraggingPersistentGlove, updateGlovePosition]);

  const renderAnimatedHand = (scale: number, skinConfig?: PlayerGloveSkinConfig | null) => {
    if (!finalBaseGloveSrc) return null;
    return (
      <div className="relative" style={{ transform: `scale(${scale})` }}>
        <img
          src={finalBaseGloveSrc}
          alt="Glove hand"
          className="domino-hand-image fixed-glove-image"
          draggable={false}
          onLoad={() => {
            setIsGloveImageUnavailable(false);
          }}
          onError={() => {
            setIsGloveImageUnavailable(true);
          }}
        />
        {skinConfig?.imageUrl && skinConfig.showOverlay && (
          <span
            className="domino-hand-skin-mask"
            style={
              {
                '--glove-mask-image': `url("${finalBaseGloveSrc}")`,
              } as React.CSSProperties
            }
          >
            <img
              src={withCacheBuster(skinConfig.imageUrl, gloveAssetVersion)}
              alt="Glove skin overlay"
              className="domino-hand-skin-overlay"
              draggable={false}
              style={
                {
                  '--skin-overlay-x': `${skinConfig.overlayOffsetX}%`,
                  '--skin-overlay-y': `${skinConfig.overlayOffsetY}%`,
                  '--skin-overlay-scale': String(skinConfig.overlayScale),
                  '--skin-overlay-rotation': `${skinConfig.overlayRotation}deg`,
                } as React.CSSProperties
              }
            />
          </span>
        )}
      </div>
    );
  };

  const shouldShowPersistentGlove =
    globalGloveAlwaysVisible &&
    !showHardSlamHand &&
    !placeHandAnimation &&
    legalMoves.length === 0 &&
    // Niet over de geplaatste stenen blijven hangen — zodra er stenen op
    // tafel liggen is de glove al "geparkeerd" via de drag-ghost flow.
    Object.keys(gameState.dominoes).length === 0;

  // --- Drag & Drop helpers -------------------------------------------------
  const selectedDomino =
    gameState.selectedHandIndex !== null
      ? gameState.playerHand?.[gameState.selectedHandIndex] ?? null
      : null;

  const computeTargetGeometry = (move: LegalMove) => {
    const { end } = move;
    let { x, y } = end;
    if (typeof move.x === 'number') x = move.x;
    else if (move.orientation === 'horizontal' && end.fromDir === 'W') x -= 1;
    if (typeof move.y === 'number') y = move.y;
    else if (move.orientation === 'vertical' && end.fromDir === 'N') y -= 1;
    const size = move.orientation === 'horizontal' ? [2, 1] : [1, 2];
    const anchorCellKey = (() => {
      switch (end.fromDir) {
        case 'N': return `${end.x},${end.y + 1}`;
        case 'S': return `${end.x},${end.y - 1}`;
        case 'W': return `${end.x + 1},${end.y}`;
        case 'E': return `${end.x - 1},${end.y}`;
        default: return null;
      }
    })();
    const anchorId = anchorCellKey ? gameState.board[anchorCellKey]?.dominoId : undefined;
    const aOff = anchorId ? stonePhysics.getOffset(anchorId) : { dx: 0, dy: 0 };
    return {
      x,
      y,
      cxBoard: boardSize / 2 + x * GRID_CELL_SIZE + (size[0] * GRID_CELL_SIZE) / 2 + aOff.dx,
      cyBoard: boardSize / 2 + y * GRID_CELL_SIZE + (size[1] * GRID_CELL_SIZE) / 2 + aOff.dy,
      wBoard: size[0] * GRID_CELL_SIZE,
      hBoard: size[1] * GRID_CELL_SIZE,
      anchorOffset: aOff,
    };
  };

  const findNearestMoveAt = (
    clientX: number,
    clientY: number,
  ): { move: LegalMove; key: string; geom: ReturnType<typeof computeTargetGeometry> } | null => {
    if (!boardRef.current) return null;
    const rect = boardRef.current.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const scale = rect.width / boardSize;
    let best: { move: LegalMove; key: string; geom: ReturnType<typeof computeTargetGeometry>; dist: number } | null = null;
    legalMoves.forEach((move, idx) => {
      if (!move.end.forced && hasDifferentNeighbor(move.end.x, move.end.y)) return;
      if (!move.end.forced && gameState.forbiddens[`${move.end.x},${move.end.y}`]) return;
      const geom = computeTargetGeometry(move);
      const sx = rect.left + geom.cxBoard * scale;
      const sy = rect.top + geom.cyBoard * scale;
      const dist = Math.hypot(clientX - sx, clientY - sy);
      const maxDim = Math.max(geom.wBoard, geom.hBoard) * scale * 0.9;
      if (dist <= maxDim && (!best || dist < best.dist)) {
        best = { move, key: `${move.end.x}-${move.end.y}-${idx}`, geom, dist };
      }
    });
    return best ? { move: best.move, key: best.key, geom: best.geom } : null;
  };

  // Init / reset ghost position bij wisselen van geselecteerde steen
  useEffect(() => {
    if (!selectedDomino || !isMyTurn) {
      setDragGhostPos(null);
      setIsDraggingHandGhost(false);
      setHoverMoveKey(null);
      return;
    }
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    // Spawn de ghost vlak boven de hand (PlayerHand staat onder het bord),
    // gecentreerd horizontaal. Zo lijkt het of de steen net uit de hand
    // omhoog wordt gepakt — onafhankelijk van de glove-positie.
    setDragGhostPos({ x: rect.width / 2, y: rect.height * 0.9 });
    setHoverMoveKey(null);
  }, [gameState.selectedHandIndex, isMyTurn]);

  // Pointer-drag listeners
  useEffect(() => {
    if (!isDraggingHandGhost) return;
    const onMove = (e: PointerEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setDragGhostPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      const near = findNearestMoveAt(e.clientX, e.clientY);
      setHoverMoveKey((prev) => {
        const next = near?.key ?? null;
        // Haptic feedback bij het binnenkomen van een legal target (mobiel)
        if (next && next !== prev && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try { (navigator as any).vibrate?.(8); } catch {}
        }
        return next;
      });
    };
    const onUp = (e: PointerEvent) => {
      const near = findNearestMoveAt(e.clientX, e.clientY);
      setIsDraggingHandGhost(false);
      setHoverMoveKey(null);
      if (near) {
        const { geom, move } = near;
        if (physicsEnabled && (geom.anchorOffset.dx !== 0 || geom.anchorOffset.dy !== 0)) {
          stonePhysics.seedPlacementOffset(geom.x, geom.y, geom.anchorOffset.dx, geom.anchorOffset.dy);
        }
        onMoveExecute(move);
      } else if (containerRef.current) {
        // Geen legal target → ghost vliegt terug naar startpositie boven de hand
        const rect = containerRef.current.getBoundingClientRect();
        setDragGhostPos({ x: rect.width / 2, y: rect.height * 0.9 });
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [isDraggingHandGhost, legalMoves, gameState.board, gameState.forbiddens, physicsEnabled, boardSize, GRID_CELL_SIZE]);

  // Bij hover een target → ghost overneemt diens oriëntatie/flip voor preview
  const hoverMove = hoverMoveKey
    ? legalMoves.find((m, i) => `${m.end.x}-${m.end.y}-${i}` === hoverMoveKey) ?? null
    : null;
  const ghostOrientation: 'horizontal' | 'vertical' = hoverMove?.orientation
    ?? (selectedDomino && selectedDomino.value1 === selectedDomino.value2 ? 'vertical' : 'horizontal');
  const ghostFlipped = hoverMove?.flipped ?? false;
  // ------------------------------------------------------------------------

  return (
    <div className="relative w-full max-w-4xl mx-auto aspect-square" data-hard-slam-renderer="physics-wrapper">
      {shouldShowPersistentGlove && (
        <div className="pointer-events-none absolute inset-0 z-[95]">
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-grab active:cursor-grabbing select-none"
            style={{
              left: `${currentPersistentGlovePos.x}%`,
              top: `${currentPersistentGlovePos.y}%`,
            }}
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              beginPersistentGloveDrag(event.clientX, event.clientY);
            }}
            onTouchStart={(event) => {
              const touch = event.touches[0];
              if (!touch) return;
              event.stopPropagation();
              beginPersistentGloveDrag(touch.clientX, touch.clientY);
            }}
          >
            <div className="domino-persistent-glove flex h-14 w-14 items-center justify-center">
              {renderAnimatedHand(settings.gloveScale || 1, persistentGloveSkinConfig)}
            </div>
          </div>
        </div>
      )}

      <div 
        ref={containerRef}
        className="w-full h-full game-board overflow-hidden rounded-2xl shadow-2xl"
        style={{ 
          background: tableBackgroundUrl 
            ? `linear-gradient(
                45deg,
                rgba(101, 67, 33, 0.15) 0%,
                rgba(160, 82, 45, 0.05) 50%,
                rgba(139, 69, 19, 0.1) 100%
              ),
              url(${tableBackgroundUrl})`
            : `
              linear-gradient(
                45deg,
                rgba(101, 67, 33, 0.15) 0%,
                rgba(160, 82, 45, 0.05) 50%,
                rgba(139, 69, 19, 0.1) 100%
              ),
              url(${backgroundImage})
            `,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          boxShadow: `
            inset 0 2px 8px rgba(101, 67, 33, 0.4),
            inset 0 -2px 8px rgba(62, 39, 35, 0.4),
            0 12px 40px rgba(0, 0, 0, 0.5),
            0 4px 16px rgba(101, 67, 33, 0.3)
          `
        }}
      >
        <div 
          ref={boardRef}
          className="absolute"
          style={{ 
            left: '50%',
            top: '50%',
            width: boardSize, 
            height: boardSize,
            transform: `translate(-50%, -50%) translate(${-boardCameraOffset.x * dynamicScale}px, ${-boardCameraOffset.y * dynamicScale}px) scale(${dynamicScale})`,
            transformOrigin: 'center'
          }}
        >
          {/* Original PC domino rendering */}
          {Object.entries(gameState.dominoes).map(([id, domino]) => {
            const individualAngle = getStableAngleFromId(id);
            
            // Connect to actual animation state from useGameVisualSettings
            const shouldAnimate = isAnimating && animationMode === 'shake';
            const phys = stonePhysics.getOffset(id);
            const isH = domino.orientation === 'horizontal';
            const w = isH ? GRID_CELL_SIZE * 2 : GRID_CELL_SIZE;
            const h = isH ? GRID_CELL_SIZE : GRID_CELL_SIZE * 2;
            // 3D-DEPTH: opgetilde stenen worden iets groter en krijgen een
            // diepere slagschaduw zodat duidelijk wordt dat ze boven de tafel
            // hangen. Botsingen worden in de physics-laag al overgeslagen.
            const lift = phys.z || 0;
            const hardSlamLift = shouldAnimate ? hardSlamShakeFrame.env * hardSlamShakeFrame.intensity : 0;
            // Bouncing envelope: |sin(π·f·t)| * exp(-t·damping) → een paar
            // dempende op-en-neer sprongen. Vermenigvuldig met intensity zodat
            // de slider blijft doorwerken.
            const bounceT = hardSlamShakeFrame.elapsedTime / 1000;
            const bounceEnv = shouldAnimate && bounceFrequency > 0
              ? Math.abs(Math.sin(bounceT * Math.PI * bounceFrequency))
                  * Math.exp(-bounceT * bounceDamping)
                  * hardSlamShakeFrame.intensity
              : 0;
            const hardSlamShakeX = shouldAnimate ? (Math.random() - 0.5) * shakeAmp * hardSlamLift : 0;
            const hardSlamShakeY = shouldAnimate ? (Math.random() - 0.5) * shakeAmp * hardSlamLift : 0;
            const hardSlamJump = shouldAnimate ? -bounceEnv * jumpHeight : 0;
            // Per-tile deterministische draai-richting zodat elke steen tijdens
            // de bounce consistent één kant op kantelt (i.p.v. puur ruis).
            const bounceSign = individualAngle >= 0 ? 1 : -1;
            const hardSlamAngle = shouldAnimate
              ? (Math.random() - 0.5) * 5.7 * hardSlamLift + bounceEnv * 12 * bounceSign
              : 0;
            const physicsLiftScale = 1 + Math.min(lift, 2) * 0.06;
            const hardSlamPopScale = 1 + bounceEnv * popScaleAmount;
            const liftScale = physicsLiftScale * hardSlamPopScale;
            const liftShadow =
              lift > 0
                ? `0 ${6 + lift * 10}px ${10 + lift * 14}px rgba(0,0,0,${Math.min(0.55, 0.25 + lift * 0.15)})`
                : undefined;
            const hardSlamShadow =
              hardSlamLift > 0
                ? `${8 + bounceEnv * 30}px ${8 + bounceEnv * 30}px ${10 + bounceEnv * 30}px rgba(0,0,0,${Math.max(0.18, 0.45 - bounceEnv * 0.2)})`
                : undefined;

            return (
              <div
                key={id}
                className="absolute"
                style={{
                  left: boardSize / 2 + domino.x * GRID_CELL_SIZE,
                  top: boardSize / 2 + domino.y * GRID_CELL_SIZE,
                  width: w,
                  height: h,
                  transform: `translate3d(${phys.dx + hardSlamShakeX + hardSlamJump}px, ${phys.dy + hardSlamShakeY + hardSlamJump}px, 0) rotate(${(phys.angleDeg || 0) + hardSlamAngle}deg) scale(${liftScale})`,
                  transformOrigin: 'center center',
                  willChange: physicsEnabled || shouldAnimate ? 'transform, filter' : undefined,
                  filter: hardSlamShadow
                    ? `drop-shadow(${hardSlamShadow})`
                    : liftShadow
                      ? `drop-shadow(${liftShadow})`
                      : undefined,
                  zIndex: lift > 0 || hardSlamLift > 0 ? 50 + Math.round(Math.max(lift, hardSlamLift) * 10) : undefined,
                }}
              >
                <DominoTile
                  data={domino.data}
                  dominoId={id}
                  orientation={domino.orientation}
                  flipped={domino.flipped}
                  rotation={domino.rotation || 0}
                  rotateX={(domino.rotationX !== undefined ? domino.rotationX : 0)}
                  rotateY={(domino.rotationY !== undefined ? domino.rotationY : 0)}
                  rotateZ={(domino.rotationZ !== undefined ? domino.rotationZ : 0)}
                  isShaking={shouldAnimate}
                  onClick={undefined}
                  className={`domino-tile-board board-domino${shouldAnimate ? ' is-animating' : ''}`}
                  style={{
                    '--individual-angle': `${individualAngle}deg`,
                  } as React.CSSProperties}
                />
                {showCollisionDebug && (
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      left: 0,
                      top: 0,
                      width: w,
                      height: h,
                      transform: `rotate(${(domino.rotation || 0) + (phys.angleDeg || 0)}deg)`,
                      transformOrigin: 'center',
                      background: 'rgba(255, 80, 80, 0.18)',
                      border: '1px solid rgba(255, 80, 80, 0.7)',
                      borderRadius: 4,
                    }}
                  />
                )}
              </div>
            );
          })}

          {showHardSlamHand && hardSlamHandPlacement && (
            <div
              className="absolute pointer-events-none z-[95] -translate-x-1/2 -translate-y-1/2"
              style={{
                left: hardSlamHandPlacement.left,
                top: hardSlamHandPlacement.top,
              }}
            >
              <div key={hardSlamHandAnimKey} className="hard-slam-hand flex h-14 w-14 items-center justify-center">
                {renderAnimatedHand(settings.hardSlamGloveScale || settings.gloveScale || 1, hardSlamGloveSkinConfig)}
              </div>
            </div>
          )}

          {placeHandAnimation && !showHardSlamHand && (
            <div
              className="absolute pointer-events-none z-[90] -translate-x-1/2 -translate-y-1/2"
              style={{
                left: placeHandAnimation.left,
                top: placeHandAnimation.top,
              }}
            >
              <div className="domino-place-hand flex h-14 w-14 items-center justify-center">
                {renderAnimatedHand(settings.gloveScale || 1, placeAnimationGloveSkinConfig)}
              </div>
            </div>
          )}

          {/* Original PC placement target rendering */}
          {legalMoves.map((move, index) => {
            const { end } = move;
            
            if (!end.forced && hasDifferentNeighbor(end.x, end.y)) return null;
            if (!end.forced && gameState.forbiddens[`${end.x},${end.y}`]) return null;

            let { x, y } = end;
            const { orientation, dominoData } = move;
            const isDouble = dominoData.value1 === dominoData.value2;
            
            if (typeof move.x === 'number') x = move.x;
            else if (orientation === "horizontal" && end.fromDir === "W") x -= 1;
            if (typeof move.y === 'number') y = move.y;
            else if (orientation === "vertical" && end.fromDir === "N") y -= 1;

            const size = orientation === "horizontal" ? [2, 1] : [1, 2];
            const isInitialPlacement = Object.keys(gameState.dominoes).length === 0;
            const isWegaPlay = (gameState as GameState & { wegaPhase?: string }).wegaPhase === 'playing';

            // STAP 2: Anchor-based placement. De target hangt aan een bestaande
            // anker-steen (de buur in de tegenovergestelde richting van `fromDir`).
            // We passen de visuele physics-offset van die anker toe, zodat het
            // gele target meebeweegt als de anker verschoven is.
            const anchorCellKey = (() => {
              switch (end.fromDir) {
                case 'N': return `${end.x},${end.y + 1}`;
                case 'S': return `${end.x},${end.y - 1}`;
                case 'W': return `${end.x + 1},${end.y}`;
                case 'E': return `${end.x - 1},${end.y}`;
                default: return null;
              }
            })();
            const anchorId = anchorCellKey ? gameState.board[anchorCellKey]?.dominoId : undefined;
            const anchorOffset = anchorId ? stonePhysics.getOffset(anchorId) : { dx: 0, dy: 0 };

            return (
              <PlacementTarget
                key={`${end.x}-${end.y}-${index}`}
                x={x}
                y={y}
                width={size[0]}
                height={size[1]}
                orientation={orientation}
                isDouble={isDouble}
                isInitialPlacement={isInitialPlacement}
                disabled={!isMyTurn}
                className={hoverMoveKey === `${end.x}-${end.y}-${index}` ? 'placement-target--hover' : undefined}
                onClick={() => {
                  // STAP 2 — Anchor-based placement: seed de nieuwe steen
                  // met de huidige anker-offset zodat hij visueel naast de
                  // (verschoven) anker landt i.p.v. op de kale grid-positie.
                  if (physicsEnabled && (anchorOffset.dx !== 0 || anchorOffset.dy !== 0)) {
                    stonePhysics.seedPlacementOffset(x, y, anchorOffset.dx, anchorOffset.dy);
                  }
                  onMoveExecute(move);
                }}
                ghostTile={dominoData}
                ghostFlipped={move.flipped}
                style={{
                  // Position exactly on grid coordinates - like dominos, no centering
                  left: boardSize / 2 + x * GRID_CELL_SIZE,
                  top: boardSize / 2 + y * GRID_CELL_SIZE,
                  transform: `translate3d(${anchorOffset.dx}px, ${anchorOffset.dy}px, 0)`,
                }}
              />
            );
          })}
        </div>

        {/* Drag & drop ghost: volgt de cursor terwijl je een hand-steen sleept */}
        {selectedDomino && dragGhostPos && isMyTurn && (
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 z-[160] select-none animate-scale-in"
            style={{
              left: dragGhostPos.x,
              top: dragGhostPos.y,
              touchAction: 'none',
              cursor: isDraggingHandGhost ? 'grabbing' : 'grab',
              opacity: isDraggingHandGhost ? 0.85 : 0.95,
              filter: hoverMoveKey ? 'drop-shadow(0 0 8px hsl(var(--accent)))' : 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))',
              transition: isDraggingHandGhost
                ? 'none'
                : 'left 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), top 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease',
            }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!containerRef.current) return;
              const rect = containerRef.current.getBoundingClientRect();
              setDragGhostPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
              setIsDraggingHandGhost(true);
            }}
          >
            <div style={{ transform: `scale(${dynamicScale})`, transformOrigin: 'center' }}>
              <DominoTile
                data={selectedDomino}
                orientation={ghostOrientation}
                flipped={ghostFlipped}
                className="domino-tile-board pointer-events-none"
              />
            </div>
            {/* Glove zit BOVEN de steen zodat het lijkt of de hand hem vasthoudt */}
            {finalBaseGloveSrc && (
              <div
                className="absolute left-1/2 top-1/2 pointer-events-none"
                style={{
                  transform: 'translate(-30%, -70%)',
                  zIndex: 2,
                }}
              >
                <div className="domino-place-hand flex h-14 w-14 items-center justify-center">
                  {renderAnimatedHand(settings.gloveScale || 1, persistentGloveSkinConfig)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* STAP 1 — Physics debug-panel (OBB/SAT). Tijdelijk, voor testen. */}
      <div
        className="absolute top-2 right-2 z-[200] flex flex-col gap-1 rounded-md border border-white/20 bg-black/70 p-2 text-[11px] text-white shadow-lg backdrop-blur max-w-[90vw] max-h-[80vh] overflow-y-auto"
        style={{ width: physicsPanelOpen ? 'min(240px, 90vw)' : 'auto' }}
      >
        <button
          type="button"
          className="flex items-center justify-between gap-2 font-semibold tracking-wide text-left"
          onClick={() => setPhysicsPanelOpen((v) => !v)}
        >
          <span>Physics (OBB/SAT)</span>
          <span className="opacity-60">{physicsPanelOpen ? '▾' : '▸'}</span>
        </button>
        {physicsPanelOpen && (<>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={physicsEnabled}
            onChange={(e) => setPhysicsEnabled(e.target.checked)}
          />
          Actief
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showCollisionDebug}
            onChange={(e) => setShowCollisionDebug(e.target.checked)}
          />
          Collision-boxes
        </label>
        {/* Vergelijkings-modus */}
        <div className="flex items-center justify-between gap-2 rounded bg-white/5 px-2 py-1">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={comparisonMode}
              onChange={(e) => setComparisonMode(e.target.checked)}
            />
            Vergelijken (A/B)
          </label>
          {comparisonMode && (
            <div className="flex gap-1">
              {(['A', 'B'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`rounded px-2 py-0.5 text-[11px] ${activePreset === k ? 'bg-white/30' : 'bg-white/10 hover:bg-white/20'}`}
                  onClick={() => {
                    const p = k === 'A' ? presetA : presetB;
                    setActivePreset(k);
                    updateShakeIntensity(p.intensity);
                    updateShakeDuration(p.duration);
                    setAnchorStrength(p.anchor);
                  }}
                >
                  {k}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Test Slam knop: triggert lokaal een hard slam zonder steen te plaatsen */}
        <button
          type="button"
          className="rounded bg-orange-500/80 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-orange-500"
          onClick={() => {
            const random = Math.random;
            const intensity = Math.max(0.3, settings.shakeIntensity ?? 1);
            pendingHardSlamScatterRef.current = {
              eventId: `test-slam-${Date.now()}`,
              actions: Object.keys(gameState.dominoes).map((id) => {
                const dx = (random() - 0.5) * 2 * scatterBase * intensity;
                const dy = (random() - 0.5) * 2 * scatterBase * intensity;
                const daDeg = ((random() - 0.5) * 0.8 * intensity * 180) / Math.PI;
                const targetDaDeg = ((random() - 0.5) * 0.6 * intensity * 180) / Math.PI;
                return { id, dx, dy, daDeg, targetDaDeg };
              }),
            };
            startShakeAnimation();
          }}
        >
          Test Slam
        </button>
        {(() => {
          const applyIntensity = (v: number) => {
            updateShakeIntensity(v);
            if (comparisonMode) {
              (activePreset === 'A' ? setPresetA : setPresetB)((p) => ({ ...p, intensity: v }));
            }
          };
          const applyDuration = (v: number) => {
            updateShakeDuration(v);
            if (comparisonMode) {
              (activePreset === 'A' ? setPresetA : setPresetB)((p) => ({ ...p, duration: v }));
            }
          };
          const applyAnchor = (v: number) => {
            const clamped = Math.max(-1, Math.min(1, v));
            setAnchorStrength(clamped);
            if (comparisonMode) {
              (activePreset === 'A' ? setPresetA : setPresetB)((p) => ({ ...p, anchor: clamped }));
            }
          };
          return (
            <>
              <label className="flex flex-col gap-0.5">
                <span>Slam intensiteit: {settings.shakeIntensity.toFixed(1)}x</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    className="flex-1"
                    min={0.3}
                    max={2}
                    step={0.1}
                    value={settings.shakeIntensity}
                    onChange={(e) => applyIntensity(parseFloat(e.target.value))}
                  />
                  <input
                    type="number"
                    className="w-16 rounded bg-white/10 px-1 py-0.5 text-right"
                    min={0.1}
                    max={5}
                    step={0.1}
                    value={settings.shakeIntensity}
                    onChange={(e) => applyIntensity(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </label>
              <label className="flex flex-col gap-0.5">
                <span>Slam duur: {settings.shakeDuration.toFixed(1)}s</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    className="flex-1"
                    min={0.1}
                    max={5}
                    step={0.1}
                    value={settings.shakeDuration}
                    onChange={(e) => applyDuration(parseFloat(e.target.value))}
                  />
                  <input
                    type="number"
                    className="w-16 rounded bg-white/10 px-1 py-0.5 text-right"
                    min={0.1}
                    max={10}
                    step={0.1}
                    value={settings.shakeDuration}
                    onChange={(e) => applyDuration(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </label>
              <label className="flex flex-col gap-0.5">
                <span>Anker: {anchorStrength.toFixed(2)} (sterker = sneller stoppen)</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    className="flex-1"
                    min={-1}
                    max={1}
                    step={0.1}
                    value={anchorStrength}
                    onChange={(e) => applyAnchor(parseFloat(e.target.value))}
                  />
                  <input
                    type="number"
                    className="w-16 rounded bg-white/10 px-1 py-0.5 text-right"
                    min={-1}
                    max={1}
                    step={0.1}
                    value={anchorStrength}
                    onChange={(e) => applyAnchor(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </label>
              <label className="flex flex-col gap-0.5">
                <span>Scatter afstand: {scatterBase}px (hoe ver stenen wegspringen)</span>
                <div className="flex items-center gap-2">
                  <input type="range" className="flex-1" min={0} max={200} step={5}
                    value={scatterBase} onChange={(e) => setScatterBase(parseFloat(e.target.value))} />
                  <input type="number" className="w-16 rounded bg-white/10 px-1 py-0.5 text-right"
                    min={0} max={500} step={5}
                    value={scatterBase} onChange={(e) => setScatterBase(parseFloat(e.target.value) || 0)} />
                </div>
              </label>
              <label className="flex flex-col gap-0.5">
                <span>Jump hoogte: {jumpHeight}px (visuele "sprong" omhoog)</span>
                <div className="flex items-center gap-2">
                  <input type="range" className="flex-1" min={0} max={80} step={1}
                    value={jumpHeight} onChange={(e) => setJumpHeight(parseFloat(e.target.value))} />
                  <input type="number" className="w-16 rounded bg-white/10 px-1 py-0.5 text-right"
                    min={0} max={200} step={1}
                    value={jumpHeight} onChange={(e) => setJumpHeight(parseFloat(e.target.value) || 0)} />
                </div>
              </label>
              <label className="flex flex-col gap-0.5">
                <span>Pop-scale: {popScaleAmount.toFixed(2)} (extra vergroting op piek)</span>
                <div className="flex items-center gap-2">
                  <input type="range" className="flex-1" min={0} max={0.6} step={0.01}
                    value={popScaleAmount} onChange={(e) => setPopScaleAmount(parseFloat(e.target.value))} />
                  <input type="number" className="w-16 rounded bg-white/10 px-1 py-0.5 text-right"
                    min={0} max={1} step={0.01}
                    value={popScaleAmount} onChange={(e) => setPopScaleAmount(parseFloat(e.target.value) || 0)} />
                </div>
              </label>
              <label className="flex flex-col gap-0.5">
                <span>Trill-amplitude: {shakeAmp}px (per-frame jitter)</span>
                <div className="flex items-center gap-2">
                  <input type="range" className="flex-1" min={0} max={40} step={1}
                    value={shakeAmp} onChange={(e) => setShakeAmp(parseFloat(e.target.value))} />
                  <input type="number" className="w-16 rounded bg-white/10 px-1 py-0.5 text-right"
                    min={0} max={100} step={1}
                    value={shakeAmp} onChange={(e) => setShakeAmp(parseFloat(e.target.value) || 0)} />
                </div>
              </label>
              <label className="flex flex-col gap-0.5">
                <span>Bounces/sec: {bounceFrequency.toFixed(1)} (aantal op-en-neer sprongetjes)</span>
                <div className="flex items-center gap-2">
                  <input type="range" className="flex-1" min={0} max={15} step={0.5}
                    value={bounceFrequency} onChange={(e) => setBounceFrequency(parseFloat(e.target.value))} />
                  <input type="number" className="w-16 rounded bg-white/10 px-1 py-0.5 text-right"
                    min={0} max={30} step={0.5}
                    value={bounceFrequency} onChange={(e) => setBounceFrequency(parseFloat(e.target.value) || 0)} />
                </div>
              </label>
              <label className="flex flex-col gap-0.5">
                <span>Bounce demping: {bounceDamping.toFixed(1)} (hoger = sneller uitdempen)</span>
                <div className="flex items-center gap-2">
                  <input type="range" className="flex-1" min={0} max={10} step={0.1}
                    value={bounceDamping} onChange={(e) => setBounceDamping(parseFloat(e.target.value))} />
                  <input type="number" className="w-16 rounded bg-white/10 px-1 py-0.5 text-right"
                    min={0} max={20} step={0.1}
                    value={bounceDamping} onChange={(e) => setBounceDamping(parseFloat(e.target.value) || 0)} />
                </div>
              </label>
            </>
          );
        })()}
        <div className="flex gap-1">
          <button
            type="button"
            className="flex-1 rounded bg-white/10 px-2 py-1 hover:bg-white/20"
            onClick={() => {
              // Geef elke steen een willekeurige duw → goede test voor SAT
              for (const id of Object.keys(gameState.dominoes)) {
                const dx = (Math.random() - 0.5) * 60;
                const dy = (Math.random() - 0.5) * 60;
                stonePhysics.nudge(id, dx, dy);
              }
            }}
          >
            Nudge
          </button>
          <button
            type="button"
            className="flex-1 rounded bg-white/10 px-2 py-1 hover:bg-white/20"
            onClick={() => stonePhysics.resetAll()}
          >
            Reset
          </button>
        </div>
        <div className="mt-1 border-t border-white/10 pt-1">
          <div className="mb-1 text-[10px] uppercase tracking-wide opacity-70">
            Test: duw 1 steen
          </div>
          <div className="grid grid-cols-4 gap-1">
            <button
              type="button"
              className="rounded bg-white/10 px-1 py-1 hover:bg-white/20"
              onClick={() => {
                const id = Object.keys(gameState.dominoes)[0];
                if (id) stonePhysics.nudge(id, -8, 0);
              }}
              title="Duw eerste steen naar links"
            >
              ←
            </button>
            <button
              type="button"
              className="rounded bg-white/10 px-1 py-1 hover:bg-white/20"
              onClick={() => {
                const id = Object.keys(gameState.dominoes)[0];
                if (id) stonePhysics.nudge(id, 0, -8);
              }}
              title="Duw eerste steen naar boven"
            >
              ↑
            </button>
            <button
              type="button"
              className="rounded bg-white/10 px-1 py-1 hover:bg-white/20"
              onClick={() => {
                const id = Object.keys(gameState.dominoes)[0];
                if (id) stonePhysics.nudge(id, 0, 8);
              }}
              title="Duw eerste steen naar onderen"
            >
              ↓
            </button>
            <button
              type="button"
              className="rounded bg-white/10 px-1 py-1 hover:bg-white/20"
              onClick={() => {
                const id = Object.keys(gameState.dominoes)[0];
                if (id) stonePhysics.nudge(id, 8, 0);
              }}
              title="Duw eerste steen naar rechts"
            >
              →
            </button>
          </div>
          <div className="mt-1 text-[10px] opacity-60">
            Kleine duw van 8px per klik. Klik meerdere keren snel achter elkaar
            in dezelfde richting → je ziet d1 letterlijk wegschuiven i.p.v.
            dat d0 er dwars doorheen tunnelt.
          </div>
        </div>
        <div className="mt-1 border-t border-white/10 pt-1">
          <div className="mb-1 text-[10px] uppercase tracking-wide opacity-70">
            3D-Depth: til steen op
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              className="flex-1 rounded bg-white/10 px-2 py-1 hover:bg-white/20"
              onClick={() => {
                const id = Object.keys(gameState.dominoes)[0];
                if (id) stonePhysics.setLift(id, 1);
              }}
              title="Til de eerste steen op (z=1) — botst niet meer met andere"
            >
              Lift d0 ↑
            </button>
            <button
              type="button"
              className="flex-1 rounded bg-white/10 px-2 py-1 hover:bg-white/20"
              onClick={() => {
                const id = Object.keys(gameState.dominoes)[0];
                if (id) stonePhysics.setLift(id, 0);
              }}
              title="Zet de eerste steen terug op tafel"
            >
              Drop d0 ↓
            </button>
          </div>
          <div className="mt-1 text-[10px] opacity-60">
            Til d0 op, duw hem dan met de pijlen door een andere steen — hij
            mag er nu doorheen omdat hij op een andere laag zit.
          </div>
        </div>
        </>)}
      </div>
    </div>
  );
};