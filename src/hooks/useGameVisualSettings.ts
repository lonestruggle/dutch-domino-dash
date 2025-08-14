import { useState, useEffect } from 'react';
import { useDeviceType, DeviceType } from './useDeviceType';
import { useAuth } from './useAuth';

export interface GameVisualSettings {
  dominoScale: number; // 0.5 to 2.0 multiplier for board dominoes
  handDominoScale: number; // 0.5 to 2.0 multiplier for hand dominoes
  // Duration and speed adjustments (-5 to +5 range)
  durationAdjustment: number; // -5 to +5, each step = 0.5s
  speedAdjustment: number; // -300 to +300ms, each step = 10ms
}

export interface DeviceSpecificSettings {
  desktop: GameVisualSettings;
  tablet: GameVisualSettings;  
  mobile: GameVisualSettings;
}

const DEFAULT_SETTINGS: GameVisualSettings = {
  dominoScale: 1.0,
  handDominoScale: 1.0,
  durationAdjustment: 0,
  speedAdjustment: 0,
};

const DEFAULT_DEVICE_SETTINGS: DeviceSpecificSettings = {
  desktop: { 
    dominoScale: 1.0, handDominoScale: 1.0,
    durationAdjustment: 0, speedAdjustment: 0
  },
  tablet: { 
    dominoScale: 0.9, handDominoScale: 0.9,
    durationAdjustment: 0, speedAdjustment: 0
  },
  mobile: { 
    dominoScale: 0.8, handDominoScale: 0.8,
    durationAdjustment: 0, speedAdjustment: 0
  },
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

  // Broadcast and apply live visual settings globally on any change
  useEffect(() => {
    const currentSettings = allSettings[deviceType];
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__dominoSettings = currentSettings;
    } catch {}

    // Notify listeners (GameBoard, PlayerHand, etc.)
    window.dispatchEvent(new CustomEvent('visualSettingsUpdated', {
      detail: { settings: currentSettings, deviceType }
    }));
  }, [allSettings, deviceType]);

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



  const updateDurationAdjustment = (adjustment: number, targetDevice?: DeviceType) => {
    const clampedAdjustment = Math.max(-5, Math.min(5, adjustment));
    const device = targetDevice || deviceType;
    setAllSettings(prev => ({
      ...prev,
      [device]: { ...prev[device], durationAdjustment: clampedAdjustment }
    }));
  };

  const updateSpeedAdjustment = (adjustment: number, targetDevice?: DeviceType) => {
    const clampedAdjustment = Math.max(-30, Math.min(30, adjustment)); // -300ms to +300ms in 10ms steps
    const device = targetDevice || deviceType;
    setAllSettings(prev => ({
      ...prev,
      [device]: { ...prev[device], speedAdjustment: clampedAdjustment }
    }));
  };

  const applyLiveUpdate = () => {
    // Trigger a re-render event
    const currentSettings = allSettings[deviceType];
    window.dispatchEvent(new CustomEvent('settingsUpdated', { 
      detail: { settings: currentSettings }
    }));
  };

  const getSettingsForDevice = (device: DeviceType) => allSettings[device];


  return {
    settings,
    allSettings,
    currentDeviceType: deviceType,
    updateDominoScale,
    updateHandDominoScale,
    updateDurationAdjustment,
    updateSpeedAdjustment,
    applyLiveUpdate,
    resetToDefaults,
    getSettingsForDevice,
  };
};