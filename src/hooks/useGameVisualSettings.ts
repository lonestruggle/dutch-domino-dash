import { useState, useEffect } from 'react';

export interface GameVisualSettings {
  frameSize: number; // 0.5 to 2.0 multiplier
  dominoScale: number; // 0.5 to 2.0 multiplier
}

const DEFAULT_SETTINGS: GameVisualSettings = {
  frameSize: 1.0,
  dominoScale: 1.0,
};

const STORAGE_KEY = 'domino-game-visual-settings';

export const useGameVisualSettings = () => {
  const [settings, setSettings] = useState<GameVisualSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.warn('Failed to save visual settings:', error);
    }
  }, [settings]);

  const updateFrameSize = (size: number) => {
    const clampedSize = Math.max(0.5, Math.min(2.0, size));
    setSettings(prev => ({ ...prev, frameSize: clampedSize }));
  };

  const updateDominoScale = (scale: number) => {
    const clampedScale = Math.max(0.5, Math.min(2.0, scale));
    setSettings(prev => ({ ...prev, dominoScale: clampedScale }));
  };

  const resetToDefaults = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  return {
    settings,
    updateFrameSize,
    updateDominoScale,
    resetToDefaults,
  };
};