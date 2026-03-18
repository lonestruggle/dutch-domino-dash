import React, { useRef, useEffect, useState } from 'react';
import { DominoTile } from './DominoTile';
import { PlacementTarget } from './PlacementTarget';
import { GameState, LegalMove } from '@/types/domino';
import { useIsMobile } from '@/hooks/use-mobile';
import { useGameVisualSettings } from '@/hooks/useGameVisualSettings';
import dominoTable1 from '@/assets/domino-table-1.webp';
import dominoTable2 from '@/assets/domino-table-2.webp';
const curacaoFlagTable = '/lovable-uploads/f85e0ba4-a21e-4716-b54c-d9c55efc9496.png';
const premiumWoodTable = '/lovable-uploads/06c1799a-c59e-44f8-8d9c-3cc8d671f4c2.png';
const DEFAULT_GLOVE_IMAGE = '/glove-hand.svg';

interface GameBoardProps {
  gameState: GameState;
  legalMoves: LegalMove[];
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

interface PlaceHandAnimationState {
  dominoId: string;
  left: number;
  top: number;
}

export const GameBoard: React.FC<GameBoardProps> = ({ 
  gameState, 
  legalMoves, 
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
  const { settings, applyOriginalRotations, isAnimating, animationMode, updateGlovePosition } = useGameVisualSettings();
  const [placeHandAnimation, setPlaceHandAnimation] = useState<PlaceHandAnimationState | null>(null);
  const [showHardSlamHand, setShowHardSlamHand] = useState(false);
  const [hardSlamHandAnimKey, setHardSlamHandAnimKey] = useState(0);
  const [isGloveImageUnavailable, setIsGloveImageUnavailable] = useState(false);
  const [processedGloveImageSrc, setProcessedGloveImageSrc] = useState<string | null>(null);
  const [isDraggingPersistentGlove, setIsDraggingPersistentGlove] = useState(false);
  const [persistentGlovePreviewPos, setPersistentGlovePreviewPos] = useState<{ x: number; y: number } | null>(null);
  const persistentGlovePosRef = useRef<{ x: number; y: number }>({
    x: settings.glovePosX || 82,
    y: settings.glovePosY || 76,
  });
  const gloveImageSrc = (settings.gloveImageUrl || '').trim() || DEFAULT_GLOVE_IMAGE;
  const [defaultGloveUnavailable, setDefaultGloveUnavailable] = useState(false);
  const prevDominoCountRef = useRef(Object.keys(gameState.dominoes).length);
  const lastAnimatedDominoIdRef = useRef<string | null>(null);
  const lastHardSlamEventRef = useRef<string | null>(null);
  
  // Dynamic grid cell size based on settings - each domino = 2 grid cells
  const GRID_CELL_SIZE = settings.dominoWidth / 2;


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

  useEffect(() => {
    const dominoEntries = Object.entries(gameState.dominoes);
    const dominoCount = dominoEntries.length;
    const previousCount = prevDominoCountRef.current;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    if (dominoCount < previousCount) {
      lastAnimatedDominoIdRef.current = null;
      setPlaceHandAnimation(null);
    } else if (dominoCount > previousCount) {
      let newestId: string | null = null;
      let newestDomino: (typeof gameState.dominoes)[string] | null = null;
      let newestNumericId = -1;

      dominoEntries.forEach(([id, domino]) => {
        const numericId = getDominoNumericId(id);
        if (numericId > newestNumericId) {
          newestNumericId = numericId;
          newestId = id;
          newestDomino = domino;
        }
      });

      if (newestId && newestDomino && newestId !== lastAnimatedDominoIdRef.current) {
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

    prevDominoCountRef.current = dominoCount;
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
    if (lastHardSlamEventRef.current === eventId) return;

    lastHardSlamEventRef.current = eventId;
    setHardSlamHandAnimKey((prev) => prev + 1);
    setShowHardSlamHand(true);

    const timer = setTimeout(() => {
      setShowHardSlamHand(false);
    }, 760);

    return () => clearTimeout(timer);
  }, [
    gameState.triggerHardSlamAnimation,
    gameState.isHardSlamming,
    gameState.hardSlamAnimationProfile,
    gameState.hardSlamDominoId,
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

  // Original PC auto-center logic
  useEffect(() => {
    if (!containerRef.current || Object.keys(gameState.dominoes).length === 0) return;
    
    const checkIfRecenterNeeded = () => {
      const containerRect = containerRef.current!.getBoundingClientRect();
      const currentScale = dynamicScale;
      const boardSize = calculateBoardSize();
      
      const dominoes = Object.values(gameState.dominoes);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      
      dominoes.forEach(domino => {
        const dominoWidth = domino.orientation === 'horizontal' ? 2 : 1;
        const dominoHeight = domino.orientation === 'vertical' ? 2 : 1;
        
        minX = Math.min(minX, domino.x);
        maxX = Math.max(maxX, domino.x + dominoWidth - 1);
        minY = Math.min(minY, domino.y);
        maxY = Math.max(maxY, domino.y + dominoHeight - 1);
      });
      
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      
      const pixelCenterX = boardSize / 2 + centerX * GRID_CELL_SIZE * currentScale;
      const pixelCenterY = boardSize / 2 + centerY * GRID_CELL_SIZE * currentScale;
      
      const optimalScrollX = pixelCenterX - containerRect.width / 2;
      const optimalScrollY = pixelCenterY - containerRect.height / 2;
      
      containerRef.current!.scrollTo({
        left: Math.max(0, optimalScrollX),
        top: Math.max(0, optimalScrollY),
        behavior: 'smooth'
      });
    };
    
    const timer = setTimeout(checkIfRecenterNeeded, 100);
    return () => clearTimeout(timer);
  }, [gameState.dominoes, dynamicScale]);

  // Original PC initial center logic
  useEffect(() => {
    if (containerRef.current && Object.keys(gameState.dominoes).length === 1) {
      const firstDomino = Object.values(gameState.dominoes)[0];
      const firstDominoX = firstDomino.x * GRID_CELL_SIZE * dynamicScale;
      const firstDominoY = firstDomino.y * GRID_CELL_SIZE * dynamicScale;
      
      setTimeout(() => {
        containerRef.current?.scrollTo({
          left: boardSize / 2 + firstDominoX - containerRef.current.clientWidth / 2,
          top: boardSize / 2 + firstDominoY - containerRef.current.clientHeight / 2,
          behavior: 'smooth'
        });
      }, 100);
    }
  }, [gameState.dominoes, dynamicScale, boardSize]);

  useEffect(() => {
    let cancelled = false;
    setIsGloveImageUnavailable(false);
    setDefaultGloveUnavailable(false);
    setProcessedGloveImageSrc(null);

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.referrerPolicy = 'no-referrer';
    image.decoding = 'async';
    image.src = gloveImageSrc;

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
  }, [gloveImageSrc]);

  const effectiveGloveSrc = processedGloveImageSrc || gloveImageSrc;
  const finalGloveSrc =
    !isGloveImageUnavailable
      ? effectiveGloveSrc
      : (!defaultGloveUnavailable ? DEFAULT_GLOVE_IMAGE : null);

  useEffect(() => {
    if (!settings.gloveAlwaysVisible) {
      setIsDraggingPersistentGlove(false);
      setPersistentGlovePreviewPos(null);
    }
  }, [settings.gloveAlwaysVisible]);

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

  const renderAnimatedHand = (scale: number) => {
    if (!finalGloveSrc) return null;
    return (
      <img
        src={finalGloveSrc}
        alt="Glove hand"
        className={`domino-hand-image ${processedGloveImageSrc ? '' : 'remove-black-bg'} fixed-glove-image`}
        style={{ transform: `scale(${scale})` }}
        draggable={false}
        onLoad={() => {
          setIsGloveImageUnavailable(false);
        }}
        onError={() => {
          if (finalGloveSrc === DEFAULT_GLOVE_IMAGE) {
            setDefaultGloveUnavailable(true);
          } else {
            setIsGloveImageUnavailable(true);
          }
        }}
      />
    );
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto aspect-square">
      {showHardSlamHand && (
        <div className="pointer-events-none absolute inset-0 z-[100]">
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={
              settings.gloveAlwaysVisible
                ? { left: `${currentPersistentGlovePos.x}%`, top: `${currentPersistentGlovePos.y}%` }
                : { left: '50%', top: '45%' }
            }
          >
            <div key={hardSlamHandAnimKey} className="hard-slam-hand flex h-20 w-20 items-center justify-center rounded-full bg-red-500/90 text-white shadow-2xl">
              {renderAnimatedHand(settings.hardSlamGloveScale || 1)}
            </div>
          </div>
        </div>
      )}

      {settings.gloveAlwaysVisible && !showHardSlamHand && (
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
            <div className="domino-persistent-glove flex h-14 w-14 items-center justify-center rounded-full bg-black/45 text-white shadow-xl">
              {renderAnimatedHand(settings.gloveScale || 1)}
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
          className="relative w-full h-full"
          style={{ 
            width: boardSize, 
            height: boardSize,
            transform: `scale(${dynamicScale})`,
            transformOrigin: 'center'
          }}
        >
          {/* Original PC domino rendering */}
          {Object.entries(gameState.dominoes).map(([id, domino]) => {
            const individualAngle = getStableAngleFromId(id);
            
            // Connect to actual animation state from useGameVisualSettings
            const shouldAnimate = isAnimating && animationMode === 'shake';
            
            return (
              <div
                key={id}
                className="absolute"
                style={{
                  left: boardSize / 2 + domino.x * GRID_CELL_SIZE,
                  top: boardSize / 2 + domino.y * GRID_CELL_SIZE,
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
              </div>
            );
          })}

          {placeHandAnimation && (
            <div
              className="absolute pointer-events-none z-[90] -translate-x-1/2 -translate-y-1/2"
              style={{
                left: placeHandAnimation.left,
                top: placeHandAnimation.top,
              }}
            >
              <div className="domino-place-hand flex h-12 w-12 items-center justify-center rounded-full bg-amber-300/95 text-amber-950 shadow-2xl">
                {renderAnimatedHand(settings.gloveScale || 1)}
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
            
            if (orientation === "horizontal" && end.fromDir === "W") x -= 1;
            if (orientation === "vertical" && end.fromDir === "N") y -= 1;

            const size = orientation === "horizontal" ? [2, 1] : [1, 2];
            const isInitialPlacement = Object.keys(gameState.dominoes).length === 0;

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
                onClick={() => onMoveExecute(move)}
                style={{
                  // Position exactly on grid coordinates - like dominos, no centering
                  left: boardSize / 2 + x * GRID_CELL_SIZE,
                  top: boardSize / 2 + y * GRID_CELL_SIZE,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};