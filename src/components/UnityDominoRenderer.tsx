import React, { useEffect, useRef } from 'react';
import { DominoData, DominoState } from '@/types/domino';

interface UnityDominoRendererProps {
  dominoes: Record<string, DominoState>;
  playerHand: DominoData[];
  onDominoClick?: (index: number) => void;
  onPlacementClick?: (x: number, y: number) => void;
}

declare global {
  interface Window {
    Unity?: {
      call: (gameObject: string, method: string, ...args: any[]) => void;
    };
    unityInstance?: any;
    createUnityInstance?: (container: HTMLElement | null, config: any) => Promise<any>;
  }
}

export const UnityDominoRenderer: React.FC<UnityDominoRendererProps> = ({
  dominoes,
  playerHand,
  onDominoClick,
  onPlacementClick
}) => {
  const unityContainerRef = useRef<HTMLDivElement>(null);
  const isUnityLoaded = useRef(false);

  useEffect(() => {
    // Load Unity WebGL build
    const script = document.createElement('script');
    script.src = '/unity/Build/dominoes.loader.js';
    script.onload = () => {
      // Initialize Unity
      if (window.createUnityInstance) {
        window.createUnityInstance(unityContainerRef.current, {
          dataUrl: '/unity/Build/dominoes.data',
          frameworkUrl: '/unity/Build/dominoes.framework.js',
          codeUrl: '/unity/Build/dominoes.wasm',
        }).then((unityInstance: any) => {
          window.unityInstance = unityInstance;
          isUnityLoaded.current = true;
          
          // Setup communication callbacks
          setupUnityCallbacks();
        });
      }
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const setupUnityCallbacks = () => {
    // Setup global functions that Unity can call
    (window as any).onUnityDominoClick = (index: number) => {
      onDominoClick?.(index);
    };

    (window as any).onUnityPlacementClick = (x: number, y: number) => {
      onPlacementClick?.(x, y);
    };
  };

  // Send domino updates to Unity
  useEffect(() => {
    if (!isUnityLoaded.current || !window.Unity) return;

    const dominoArray = Object.entries(dominoes).map(([id, state]) => ({
      id,
      ...state
    }));

    window.Unity.call('DominoManager', 'UpdateBoardDominoes', JSON.stringify(dominoArray));
  }, [dominoes]);

  // Send hand updates to Unity
  useEffect(() => {
    if (!isUnityLoaded.current || !window.Unity) return;

    window.Unity.call('DominoManager', 'UpdatePlayerHand', JSON.stringify(playerHand));
  }, [playerHand]);

  // Unity methods we can call
  const triggerChangaAnimation = () => {
    if (window.Unity) {
      window.Unity.call('DominoManager', 'TriggerChangaAnimation');
    }
  };

  const showPlacementTargets = (targets: Array<{x: number, y: number, orientation: string}>) => {
    if (window.Unity) {
      window.Unity.call('DominoManager', 'ShowPlacementTargets', JSON.stringify(targets));
    }
  };

  const hidePlacementTargets = () => {
    if (window.Unity) {
      window.Unity.call('DominoManager', 'HidePlacementTargets');
    }
  };

  // Expose methods for parent components
  useEffect(() => {
    (window as any).unityDominoRenderer = {
      triggerChangaAnimation,
      showPlacementTargets,
      hidePlacementTargets
    };
  }, []);

  return (
    <div 
      ref={unityContainerRef}
      className="unity-container w-full h-full"
      style={{ width: '100%', height: '600px' }}
    />
  );
};