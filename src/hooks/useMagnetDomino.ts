import { useState, useCallback, useRef } from 'react';
import { DominoData, DominoState, GameState } from '@/types/domino';

export interface DraggedChain {
  dominoIds: string[];
  originalPositions: Array<{ x: number; y: number }>;
  leadDominoId: string;
  isHead: boolean; // true if dragging from head, false if from tail
}

export interface SnapZone {
  x: number;
  y: number;
  value: number;
  orientation: 'horizontal' | 'vertical';
  flipped: boolean;
  targetChainId?: string;
}

export const useMagnetDomino = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedChain, setDraggedChain] = useState<DraggedChain | null>(null);
  const [snapZones, setSnapZones] = useState<SnapZone[]>([]);
  const [trainLength, setTrainLength] = useState(3); // Default train length
  const [magnetEnabled, setMagnetEnabled] = useState(true); // Toggle for magnet mode
  
  const dragOffset = useRef({ x: 0, y: 0 });
  
  // Find domino chains - connected sequences of dominoes
  const findDominoChains = useCallback((gameState: GameState): Array<string[]> => {
    const visited = new Set<string>();
    const chains: Array<string[]> = [];
    
    const findConnectedDominoes = (dominoId: string, chain: string[] = []): string[] => {
      if (visited.has(dominoId)) return chain;
      
      visited.add(dominoId);
      chain.push(dominoId);
      
      const domino = gameState.dominoes[dominoId];
      if (!domino) return chain;
      
      // Find adjacent dominoes by checking board positions
      const positions = domino.orientation === 'horizontal' 
        ? [`${domino.x},${domino.y}`, `${domino.x + 1},${domino.y}`]
        : [`${domino.x},${domino.y}`, `${domino.x},${domino.y + 1}`];
      
      // Check all 4 directions around the domino for connections
      const checkPositions = domino.orientation === 'horizontal'
        ? [
            { x: domino.x - 1, y: domino.y }, // Left
            { x: domino.x + 2, y: domino.y }, // Right
          ]
        : [
            { x: domino.x, y: domino.y - 1 }, // Top
            { x: domino.x, y: domino.y + 2 }, // Bottom
          ];
      
      for (const pos of checkPositions) {
        const boardCell = gameState.board[`${pos.x},${pos.y}`];
        if (boardCell && boardCell.dominoId !== dominoId && !visited.has(boardCell.dominoId)) {
          findConnectedDominoes(boardCell.dominoId, chain);
        }
      }
      
      return chain;
    };
    
    // Find all chains
    for (const dominoId of Object.keys(gameState.dominoes)) {
      if (!visited.has(dominoId)) {
        const chain = findConnectedDominoes(dominoId);
        if (chain.length > 0) {
          chains.push(chain);
        }
      }
    }
    
    return chains;
  }, []);
  
  // Find head and tail dominoes of a chain
  const findChainEnds = useCallback((chainIds: string[], gameState: GameState): { head: string | null, tail: string | null } => {
    if (chainIds.length === 0) return { head: null, tail: null };
    if (chainIds.length === 1) return { head: chainIds[0], tail: chainIds[0] };
    
    const connectionCounts = new Map<string, number>();
    
    // Count connections for each domino
    for (const dominoId of chainIds) {
      const domino = gameState.dominoes[dominoId];
      if (!domino) continue;
      
      let connections = 0;
      const checkPositions = domino.orientation === 'horizontal'
        ? [
            { x: domino.x - 1, y: domino.y },
            { x: domino.x + 2, y: domino.y },
          ]
        : [
            { x: domino.x, y: domino.y - 1 },
            { x: domino.x, y: domino.y + 2 },
          ];
      
      for (const pos of checkPositions) {
        const boardCell = gameState.board[`${pos.x},${pos.y}`];
        if (boardCell && chainIds.includes(boardCell.dominoId)) {
          connections++;
        }
      }
      
      connectionCounts.set(dominoId, connections);
    }
    
    // Find dominoes with only 1 connection (ends)
    const ends = Array.from(connectionCounts.entries())
      .filter(([_, count]) => count <= 1)
      .map(([id]) => id);
    
    return { 
      head: ends[0] || chainIds[0], 
      tail: ends[1] || chainIds[chainIds.length - 1] 
    };
  }, []);
  
  // Check if a domino is a head or tail of its chain
  const isDominoChainEnd = useCallback((dominoId: string, gameState: GameState): { isEnd: boolean, isHead: boolean } => {
    const chains = findDominoChains(gameState);
    const chain = chains.find(c => c.includes(dominoId));
    
    if (!chain) return { isEnd: false, isHead: false };
    
    const { head, tail } = findChainEnds(chain, gameState);
    
    const result = {
      isEnd: dominoId === head || dominoId === tail,
      isHead: dominoId === head
    };
    
    return result;
  }, [findDominoChains, findChainEnds]);
  
  // Get the train of dominoes that should move with the dragged domino
  const getTrainDominoes = useCallback((leadDominoId: string, isHead: boolean, gameState: GameState): string[] => {
    const chains = findDominoChains(gameState);
    const chain = chains.find(c => c.includes(leadDominoId));
    
    if (!chain) return [leadDominoId];
    
    const leadIndex = chain.indexOf(leadDominoId);
    if (leadIndex === -1) return [leadDominoId];
    
    // Get up to trainLength dominoes following the lead domino
    let trainDominoes: string[];
    
    if (isHead) {
      // If dragging head, take dominoes after it
      trainDominoes = chain.slice(leadIndex, leadIndex + trainLength);
    } else {
      // If dragging tail, take dominoes before it
      const startIndex = Math.max(0, leadIndex - trainLength + 1);
      trainDominoes = chain.slice(startIndex, leadIndex + 1);
    }
    
    return trainDominoes;
  }, [findDominoChains, trainLength]);
  
  // Calculate snap zones - where the train can connect
  const calculateSnapZones = useCallback((gameState: GameState, excludeChainIds: string[] = []): SnapZone[] => {
    const zones: SnapZone[] = [];
    
    // Find all open ends that aren't part of the dragged chain
    for (const openEnd of gameState.openEnds) {
      // Check if this open end belongs to the dragged chain
      const boardCell = gameState.board[`${openEnd.x},${openEnd.y}`];
      if (boardCell && excludeChainIds.includes(boardCell.dominoId)) {
        continue; // Skip this open end
      }
      
      // Create snap zones for different orientations
      const orientations: Array<{ orientation: 'horizontal' | 'vertical', flipped: boolean }> = [
        { orientation: 'horizontal', flipped: false },
        { orientation: 'horizontal', flipped: true },
        { orientation: 'vertical', flipped: false },
        { orientation: 'vertical', flipped: true },
      ];
      
      for (const { orientation, flipped } of orientations) {
        zones.push({
          x: openEnd.x,
          y: openEnd.y,
          value: openEnd.value,
          orientation,
          flipped
        });
      }
    }
    
    return zones;
  }, []);
  
  const startDrag = useCallback((dominoId: string, gameState: GameState, event: { clientX: number, clientY: number }) => {
    const { isEnd, isHead } = isDominoChainEnd(dominoId, gameState);
    
    if (!magnetEnabled || !isEnd) {
      return false; // Only allow dragging end dominoes in magnet mode
    }
    
    const trainDominoes = getTrainDominoes(dominoId, isHead, gameState);
    const originalPositions = trainDominoes.map(id => {
      const domino = gameState.dominoes[id];
      return { x: domino.x, y: domino.y };
    });
    
    setIsDragging(true);
    setDraggedChain({
      dominoIds: trainDominoes,
      originalPositions,
      leadDominoId: dominoId,
      isHead
    });
    
    // Calculate snap zones (exclude the dragged chain)
    const chains = findDominoChains(gameState);
    const draggedChainIds = chains.find(c => c.includes(dominoId)) || [];
    setSnapZones(calculateSnapZones(gameState, draggedChainIds));
    
    return true;
  }, [magnetEnabled, isDominoChainEnd, getTrainDominoes, findDominoChains, calculateSnapZones]);
  
  const endDrag = useCallback(() => {
    setIsDragging(false);
    setDraggedChain(null);
    setSnapZones([]);
  }, []);
  
  const findNearestSnapZone = useCallback((x: number, y: number, dominoValue: number): SnapZone | null => {
    const SNAP_DISTANCE = 1.5; // Distance in grid cells
    
    let nearestZone: SnapZone | null = null;
    let nearestDistance = Infinity;
    
    for (const zone of snapZones) {
      // Check if values can connect
      if (zone.value !== dominoValue) continue;
      
      const distance = Math.sqrt((zone.x - x) ** 2 + (zone.y - y) ** 2);
      if (distance <= SNAP_DISTANCE && distance < nearestDistance) {
        nearestDistance = distance;
        nearestZone = zone;
      }
    }
    
    return nearestZone;
  }, [snapZones]);
  
  return {
    // State
    isDragging,
    draggedChain,
    snapZones,
    trainLength,
    magnetEnabled,
    
    // Actions
    setTrainLength,
    setMagnetEnabled,
    startDrag,
    endDrag,
    findNearestSnapZone,
    
    // Utilities
    isDominoChainEnd,
    findDominoChains,
  };
};