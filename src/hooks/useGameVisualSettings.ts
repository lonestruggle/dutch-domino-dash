import { useState, useEffect } from 'react';
import { useDeviceType, DeviceType } from './useDeviceType';

export interface GameVisualSettings {
  dominoScale: number; // 0.5 to 2.0 multiplier
}

export interface DeviceSpecificSettings {
  desktop: GameVisualSettings;
  tablet: GameVisualSettings;  
  mobile: GameVisualSettings;
}

const DEFAULT_SETTINGS: GameVisualSettings = {
  dominoScale: 1.0,
};

const DEFAULT_DEVICE_SETTINGS: DeviceSpecificSettings = {
  desktop: { dominoScale: 1.0 },
  tablet: { dominoScale: 0.9 },
  mobile: { dominoScale: 0.8 },
};

const STORAGE_KEY = 'domino-game-visual-settings-v2';

export const useGameVisualSettings = () => {
  const deviceType = useDeviceType();
  const [allSettings, setAllSettings] = useState<DeviceSpecificSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allSettings));
    } catch (error) {
      console.warn('Failed to save visual settings:', error);
    }
  }, [allSettings]);

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
    updateDominoScale,
    resetToDefaults,
    getSettingsForDevice,
  };
};