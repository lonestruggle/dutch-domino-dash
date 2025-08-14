import { useState, useRef, useEffect, useCallback } from 'react';
import { useGameVisualSettings } from './useGameVisualSettings';

export interface ShakeRotations {
  rotateX: number;
  rotateY: number;
  rotateZ: number;
}

export interface ShakeSettings {
  shakeAmplitudeX: number;
  shakeAmplitudeY: number;
  shakeAmplitudeZ: number;
  shakeSpeed: number;
  shakeDuration: number;
  enableShakeDecay: boolean;
  enableContinuousRotation: boolean;
}

export type ShakeMode = 'shake' | 'continuous' | null;

export const useShakeAnimation = () => {
  const [rotations, setRotations] = useState<ShakeRotations>({ rotateX: 0, rotateY: 0, rotateZ: 0 });
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationMode, setAnimationMode] = useState<ShakeMode>(null);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const { settings } = useGameVisualSettings();

  // Get shake settings from visual settings
  const getShakeSettings = useCallback((): ShakeSettings => ({
    shakeAmplitudeX: settings.shakeAmplitudeX || 45,
    shakeAmplitudeY: settings.shakeAmplitudeY || 45,
    shakeAmplitudeZ: settings.shakeAmplitudeZ || 0,
    shakeSpeed: settings.shakeSpeed || 5,
    shakeDuration: settings.shakeDuration || 2,
    enableShakeDecay: settings.enableShakeDecay !== false,
    enableContinuousRotation: settings.enableContinuousRotation || false,
  }), [settings]);

  const stopAnimation = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setIsAnimating(false);
    setAnimationMode(null);
    setRotations({ rotateX: 0, rotateY: 0, rotateZ: 0 });
  }, []);

  const startShakeAnimation = useCallback(() => {
    const shakeSettings = getShakeSettings();
    
    if (shakeSettings.shakeAmplitudeX === 0 && shakeSettings.shakeAmplitudeY === 0 && shakeSettings.shakeAmplitudeZ === 0) {
      return;
    }

    setIsAnimating(true);
    setAnimationMode('shake');
    
    startTimeRef.current = performance.now();
    const durationInMs = shakeSettings.shakeDuration * 1000;
    
    const animate = (timestamp: number) => {
      const elapsedTime = timestamp - startTimeRef.current;
      const progress = elapsedTime / durationInMs;
      
      if (progress < 1) {
        const wave = Math.cos(elapsedTime * shakeSettings.shakeSpeed * Math.PI / 1000);
        const decayFactor = shakeSettings.enableShakeDecay ? Math.pow(1 - progress, 1.5) : 1;
        
        setRotations({
          rotateX: shakeSettings.shakeAmplitudeX * wave * decayFactor,
          rotateY: shakeSettings.shakeAmplitudeY * wave * decayFactor,
          rotateZ: shakeSettings.shakeAmplitudeZ * wave * decayFactor,
        });
        
        animationRef.current = requestAnimationFrame(animate);
      } else {
        stopAnimation();
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
  }, [getShakeSettings, stopAnimation]);

  const startContinuousRotation = useCallback(() => {
    const shakeSettings = getShakeSettings();
    
    if (shakeSettings.shakeAmplitudeX === 0 && shakeSettings.shakeAmplitudeY === 0 && shakeSettings.shakeAmplitudeZ === 0) {
      return;
    }

    setIsAnimating(true);
    setAnimationMode('continuous');
    
    const initialTime = performance.now();

    const animate = (timestamp: number) => {
      const elapsedMilliseconds = timestamp - initialTime;
      const angle = (elapsedMilliseconds * (shakeSettings.shakeSpeed / 10)) % 360;
      const wave = Math.sin(angle * Math.PI / 180);
      
      setRotations({
        rotateX: shakeSettings.shakeAmplitudeX * wave,
        rotateY: shakeSettings.shakeAmplitudeY * wave,
        rotateZ: shakeSettings.shakeAmplitudeZ * wave,
      });
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
  }, [getShakeSettings]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return {
    rotations,
    isAnimating,
    animationMode,
    startShakeAnimation,
    startContinuousRotation,
    stopAnimation,
    getShakeSettings,
  };
};