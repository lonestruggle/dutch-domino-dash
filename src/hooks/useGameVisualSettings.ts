import { useState, useEffect } from 'react';
import { useDeviceType, DeviceType } from './useDeviceType';

export interface GameVisualSettings {
  frameSize: number; // 0.5 to 2.0 multiplier
  dominoScale: number; // 0.5 to 2.0 multiplier
}

export interface DeviceSpecificSettings {
  desktop: GameVisualSettings;
  tablet: GameVisualSettings;  
  mobile: GameVisualSettings;
}

const DEFAULT_SETTINGS: GameVisualSettings = {
  frameSize: 1.0,
  dominoScale: 1.0,
};

const DEFAULT_DEVICE_SETTINGS: DeviceSpecificSettings = {
  desktop: { frameSize: 1.0, dominoScale: 1.0 },
  tablet: { frameSize: 0.8, dominoScale: 0.9 },
  mobile: { frameSize: 0.7, dominoScale: 0.8 },
};

const STORAGE_KEY = 'domino-game-visual-settings-v2';

export const useGameVisualSettings = () => {
  const deviceType = useDeviceType();
  const [allSettings, setAllSettings] = useState<DeviceSpecificSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...DEFAULT_DEVICE_SETTINGS, ...JSON.parse(stored) } : DEFAULT_DEVICE_SETTINGS;
    } catch {
      return DEFAULT_DEVICE_SETTINGS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allSettings));
    } catch (error) {
      console.warn('Failed to save visual settings:', error);
    }
  }, [allSettings]);

  // Current device settings
  const settings = allSettings[deviceType];

  const updateFrameSize = (size: number, targetDevice?: DeviceType) => {
    const clampedSize = Math.max(0.5, Math.min(2.0, size));
    const device = targetDevice || deviceType;
    setAllSettings(prev => ({
      ...prev,
      [device]: { ...prev[device], frameSize: clampedSize }
    }));
  };

  const updateDominoScale = (scale: number, targetDevice?: DeviceType) => {
    const clampedScale = Math.max(0.5, Math.min(2.0, scale));
    const device = targetDevice || deviceType;
    setAllSettings(prev => ({
      ...prev,
      [device]: { ...prev[device], dominoScale: clampedScale }
    }));
  };

  const resetToDefaults = (targetDevice?: DeviceType) => {
    if (targetDevice) {
      setAllSettings(prev => ({
        ...prev,
        [targetDevice]: DEFAULT_DEVICE_SETTINGS[targetDevice]
      }));
    } else {
      setAllSettings(DEFAULT_DEVICE_SETTINGS);
    }
  };

  const getSettingsForDevice = (device: DeviceType) => allSettings[device];

  return {
    settings,
    allSettings,
    currentDeviceType: deviceType,
    updateFrameSize,
    updateDominoScale,
    resetToDefaults,
    getSettingsForDevice,
  };
};