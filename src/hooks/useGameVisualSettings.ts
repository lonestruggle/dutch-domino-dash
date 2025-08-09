import { useState, useEffect } from 'react';
import { useDeviceType, DeviceType } from './useDeviceType';
import { useAuth } from './useAuth';

export interface GameVisualSettings {
  dominoScale: number; // 0.5 to 2.0 multiplier for board dominoes
  handDominoScale: number; // 0.5 to 2.0 multiplier for hand dominoes
  hardSlamDuration: number; // 0.5 to 3.0 seconds
  hardSlamSpeed: number; // 0.1 to 0.3 seconds per vibration
}

export interface DeviceSpecificSettings {
  desktop: GameVisualSettings;
  tablet: GameVisualSettings;  
  mobile: GameVisualSettings;
}

const DEFAULT_SETTINGS: GameVisualSettings = {
  dominoScale: 1.0,
  handDominoScale: 1.0,
  hardSlamDuration: 1.5,
  hardSlamSpeed: 0.2,
};

const DEFAULT_DEVICE_SETTINGS: DeviceSpecificSettings = {
  desktop: { dominoScale: 1.0, handDominoScale: 1.0, hardSlamDuration: 1.5, hardSlamSpeed: 0.2 },
  tablet: { dominoScale: 0.9, handDominoScale: 0.9, hardSlamDuration: 1.5, hardSlamSpeed: 0.2 },
  mobile: { dominoScale: 0.8, handDominoScale: 0.8, hardSlamDuration: 1.5, hardSlamSpeed: 0.2 },
};

export const useGameVisualSettings = () => {
  const deviceType = useDeviceType();
  const { user } = useAuth();
  
  // Make settings personal per user
  const getStorageKey = () => {
    const userId = user?.id || 'anonymous';
    return `domino-game-visual-settings-v2-${userId}`;
  };
  const [allSettings, setAllSettings] = useState<DeviceSpecificSettings>(() => {
    try {
      const storageKey = getStorageKey();
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Ensure all properties exist by merging with defaults
        const merged = {
          desktop: { ...DEFAULT_DEVICE_SETTINGS.desktop, ...parsed.desktop },
          tablet: { ...DEFAULT_DEVICE_SETTINGS.tablet, ...parsed.tablet },
          mobile: { ...DEFAULT_DEVICE_SETTINGS.mobile, ...parsed.mobile },
        };
        return merged;
      }
      return DEFAULT_DEVICE_SETTINGS;
    } catch {
      return DEFAULT_DEVICE_SETTINGS;
    }
  });

  useEffect(() => {
    try {
      const storageKey = getStorageKey();
      localStorage.setItem(storageKey, JSON.stringify(allSettings));
    } catch (error) {
      console.warn('Failed to save visual settings:', error);
    }
  }, [allSettings, user?.id]);

  // Current device settings
  const settings = allSettings[deviceType];

  const updateDominoScale = (scale: number, targetDevice?: DeviceType) => {
    const clampedScale = Math.max(0.5, Math.min(2.0, scale));
    const device = targetDevice || deviceType;
    setAllSettings(prev => ({
      ...prev,
      [device]: { ...prev[device], dominoScale: clampedScale }
    }));
  };

  const updateHandDominoScale = (scale: number, targetDevice?: DeviceType) => {
    const clampedScale = Math.max(0.5, Math.min(2.0, scale));
    const device = targetDevice || deviceType;
    setAllSettings(prev => ({
      ...prev,
      [device]: { ...prev[device], handDominoScale: clampedScale }
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

  const updateHardSlamDuration = (duration: number, targetDevice?: DeviceType) => {
    const clampedDuration = Math.max(0.5, Math.min(3.0, duration));
    const device = targetDevice || deviceType;
    setAllSettings(prev => ({
      ...prev,
      [device]: { ...prev[device], hardSlamDuration: clampedDuration }
    }));
  };

  const updateHardSlamSpeed = (speed: number, targetDevice?: DeviceType) => {
    const clampedSpeed = Math.max(0.1, Math.min(0.3, speed));
    const device = targetDevice || deviceType;
    setAllSettings(prev => ({
      ...prev,
      [device]: { ...prev[device], hardSlamSpeed: clampedSpeed }
    }));
  };

  const getSettingsForDevice = (device: DeviceType) => allSettings[device];

  return {
    settings,
    allSettings,
    currentDeviceType: deviceType,
    updateDominoScale,
    updateHandDominoScale,
    updateHardSlamDuration,
    updateHardSlamSpeed,
    resetToDefaults,
    getSettingsForDevice,
  };
};