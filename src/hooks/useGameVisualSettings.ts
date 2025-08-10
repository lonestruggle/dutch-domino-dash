import { useState, useEffect } from 'react';
import { useDeviceType, DeviceType } from './useDeviceType';
import { useAuth } from './useAuth';

export interface GameVisualSettings {
  dominoScale: number; // 0.5 to 2.0 multiplier for board dominoes
  handDominoScale: number; // 0.5 to 2.0 multiplier for hand dominoes
  hardSlamDuration: number; // 0.5 to 3.0 seconds
  hardSlamSpeed: number; // 0.1 to 0.3 seconds per vibration
  // Individual vibration toggles
  enableHorizontalVibration: boolean;
  enableLeftDiagonalVibration: boolean;
  enableRightDiagonalVibration: boolean;
  enableVerticalVibration: boolean;
  enableSubtleVibration: boolean;
  enableShakeVibration: boolean;
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
  hardSlamDuration: 1.5,
  hardSlamSpeed: 0.2,
  enableHorizontalVibration: true,
  enableLeftDiagonalVibration: true,
  enableRightDiagonalVibration: true,
  enableVerticalVibration: true,
  enableSubtleVibration: true,
  enableShakeVibration: true,
  durationAdjustment: 0,
  speedAdjustment: 0,
};

const DEFAULT_DEVICE_SETTINGS: DeviceSpecificSettings = {
  desktop: { 
    dominoScale: 1.0, handDominoScale: 1.0, hardSlamDuration: 1.5, hardSlamSpeed: 0.2,
    enableHorizontalVibration: true, enableLeftDiagonalVibration: true, enableRightDiagonalVibration: true,
    enableVerticalVibration: true, enableSubtleVibration: true, enableShakeVibration: true,
    durationAdjustment: 0, speedAdjustment: 0
  },
  tablet: { 
    dominoScale: 0.9, handDominoScale: 0.9, hardSlamDuration: 1.5, hardSlamSpeed: 0.2,
    enableHorizontalVibration: true, enableLeftDiagonalVibration: true, enableRightDiagonalVibration: true,
    enableVerticalVibration: true, enableSubtleVibration: true, enableShakeVibration: true,
    durationAdjustment: 0, speedAdjustment: 0
  },
  mobile: { 
    dominoScale: 0.8, handDominoScale: 0.8, hardSlamDuration: 1.5, hardSlamSpeed: 0.2,
    enableHorizontalVibration: true, enableLeftDiagonalVibration: true, enableRightDiagonalVibration: true,
    enableVerticalVibration: true, enableSubtleVibration: true, enableShakeVibration: true,
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

  const updateVibrationToggle = (vibrationType: keyof Pick<GameVisualSettings, 'enableHorizontalVibration' | 'enableLeftDiagonalVibration' | 'enableRightDiagonalVibration' | 'enableVerticalVibration' | 'enableSubtleVibration' | 'enableShakeVibration'>, enabled: boolean, targetDevice?: DeviceType) => {
    const device = targetDevice || deviceType;
    setAllSettings(prev => ({
      ...prev,
      [device]: { ...prev[device], [vibrationType]: enabled }
    }));
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
    // Force a re-render by updating CSS variables
    const rootElement = document.documentElement;
    const currentSettings = allSettings[deviceType];
    
    // Calculate adjusted values
    const adjustedDuration = currentSettings.hardSlamDuration + (currentSettings.durationAdjustment * 0.5);
    const adjustedSpeed = currentSettings.hardSlamSpeed + (currentSettings.speedAdjustment * 0.01);
    
    rootElement.style.setProperty('--hard-slam-duration', `${adjustedDuration}s`);
    rootElement.style.setProperty('--hard-slam-speed', `${adjustedSpeed}s`);
    
    // Trigger a re-render event
    window.dispatchEvent(new CustomEvent('vibrationSettingsUpdated', { 
      detail: { 
        enabledVibrations: {
          horizontal: currentSettings.enableHorizontalVibration,
          leftDiagonal: currentSettings.enableLeftDiagonalVibration,
          rightDiagonal: currentSettings.enableRightDiagonalVibration,
          vertical: currentSettings.enableVerticalVibration,
          subtle: currentSettings.enableSubtleVibration,
          shake: currentSettings.enableShakeVibration,
        },
        adjustedDuration,
        adjustedSpeed
      }
    }));
  };

  const getSettingsForDevice = (device: DeviceType) => allSettings[device];

  const getAdjustedDuration = (device?: DeviceType) => {
    const deviceSettings = device ? allSettings[device] : settings;
    return deviceSettings.hardSlamDuration + (deviceSettings.durationAdjustment * 0.5);
  };

  const getAdjustedSpeed = (device?: DeviceType) => {
    const deviceSettings = device ? allSettings[device] : settings;
    return deviceSettings.hardSlamSpeed + (deviceSettings.speedAdjustment * 0.01);
  };

  return {
    settings,
    allSettings,
    currentDeviceType: deviceType,
    updateDominoScale,
    updateHandDominoScale,
    updateHardSlamDuration,
    updateHardSlamSpeed,
    updateVibrationToggle,
    updateDurationAdjustment,
    updateSpeedAdjustment,
    applyLiveUpdate,
    getAdjustedDuration,
    getAdjustedSpeed,
    resetToDefaults,
    getSettingsForDevice,
  };
};