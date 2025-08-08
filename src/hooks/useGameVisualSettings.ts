import { useState, useEffect } from 'react';
import { useDeviceType, DeviceType } from './useDeviceType';

export interface GameVisualSettings {
  frameSize: number; // 0.5 to 2.0 multiplier
  dominoScale: number; // 0.5 to 2.0 multiplier
  frameVisible: boolean; // show/hide frame
}

export interface DeviceSpecificSettings {
  desktop: GameVisualSettings;
  tablet: GameVisualSettings;  
  mobile: GameVisualSettings;
}

const DEFAULT_SETTINGS: GameVisualSettings = {
  frameSize: 1.0,
  dominoScale: 1.0,
  frameVisible: true,
};

const DEFAULT_DEVICE_SETTINGS: DeviceSpecificSettings = {
  desktop: { frameSize: 1.0, dominoScale: 1.0, frameVisible: true },
  tablet: { frameSize: 0.8, dominoScale: 0.9, frameVisible: true },
  mobile: { frameSize: 0.7, dominoScale: 0.8, frameVisible: true },
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

  const updateFrameSize = (size: number, targetDevice?: DeviceType) => {
    const clampedSize = Math.max(0.5, Math.min(2.0, size));
    const device = targetDevice || deviceType;
    console.log('Updating frame size:', { size: clampedSize, device, targetDevice });
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

  const updateFrameVisible = (visible: boolean, targetDevice?: DeviceType) => {
    const device = targetDevice || deviceType;
    console.log('Updating frame visibility:', { visible, device, targetDevice });
    setAllSettings(prev => ({
      ...prev,
      [device]: { ...prev[device], frameVisible: visible }
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
    updateFrameVisible,
    resetToDefaults,
    getSettingsForDevice,
  };
};