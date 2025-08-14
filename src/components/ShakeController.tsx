import React, { useEffect } from 'react';
import { useShakeAnimation } from '@/hooks/useShakeAnimation';
import { DominoTile } from './DominoTile';
import { GameState } from '@/types/domino';

interface ShakeControllerProps {
  gameState: GameState;
  children: React.ReactNode;
}

export const ShakeController: React.FC<ShakeControllerProps> = ({ gameState, children }) => {
  const { startShakeAnimation, rotations, isAnimating } = useShakeAnimation();

  // Listen for hard slam events
  useEffect(() => {
    const handleHardSlam = () => {
      if (gameState.isHardSlamming || gameState.hardSlamNextMove) {
        startShakeAnimation();
      }
    };

    // Listen for test 3D shake events
    const handleTest3DShake = () => {
      startShakeAnimation();
    };

    window.addEventListener('hardSlam', handleHardSlam);
    window.addEventListener('test3DShake', handleTest3DShake);

    return () => {
      window.removeEventListener('hardSlam', handleHardSlam);
      window.removeEventListener('test3DShake', handleTest3DShake);
    };
  }, [gameState.isHardSlamming, gameState.hardSlamNextMove, startShakeAnimation]);

  // Apply global shake rotations to all 3D dominoes
  useEffect(() => {
    if (isAnimating) {
      const rootElement = document.documentElement;
      rootElement.style.setProperty('--global-shake-x', `${rotations.rotateX}deg`);
      rootElement.style.setProperty('--global-shake-y', `${rotations.rotateY}deg`);
      rootElement.style.setProperty('--global-shake-z', `${rotations.rotateZ}deg`);
    } else {
      const rootElement = document.documentElement;
      rootElement.style.setProperty('--global-shake-x', '0deg');
      rootElement.style.setProperty('--global-shake-y', '0deg');
      rootElement.style.setProperty('--global-shake-z', '0deg');
    }
  }, [rotations, isAnimating]);

  return <>{children}</>;
};