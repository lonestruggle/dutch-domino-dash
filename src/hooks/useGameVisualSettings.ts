import { useState, useEffect, useRef } from 'react';
import { useDeviceType, DeviceType } from './useDeviceType';
import { useAuth } from './useAuth';

export interface GameVisualSettings {
  dominoScale: number; // 0.5 to 2.0 multiplier for board dominoes
  handDominoScale: number; // 0.5 to 2.0 multiplier for hand dominoes
  // Duration and speed adjustments (-5 to +5 range)
  durationAdjustment: number; // -5 to +5, each step = 0.5s
  speedAdjustment: number; // -300 to +300ms, each step = 10ms
  // 3D Rotation settings
  rotateX: number; // -90 to 90 degrees
  rotateY: number; // -90 to 90 degrees  
  rotateZ: number; // -90 to 90 degrees
  // Animation settings
  rotationSpeed: number; // 0.1 to 10x speed
  rotationAmplitudeX: number; // -500 to 500 degrees
  rotationAmplitudeY: number; // -500 to 500 degrees
  rotationAmplitudeZ: number; // -500 to 500 degrees
  animationDuration: number; // 0.1 to 10 seconds
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
  rotateX: 0,
  rotateY: 0,
  rotateZ: 0,
  rotationSpeed: 5,
  rotationAmplitudeX: 45,
  rotationAmplitudeY: 45,
  rotationAmplitudeZ: 0,
  animationDuration: 2,
};

const DEFAULT_DEVICE_SETTINGS: DeviceSpecificSettings = {
  desktop: { 
    dominoScale: 1.0, handDominoScale: 1.0,
    durationAdjustment: 0, speedAdjustment: 0,
    rotateX: 0, rotateY: 0, rotateZ: 0,
    rotationSpeed: 5, rotationAmplitudeX: 45, rotationAmplitudeY: 45, rotationAmplitudeZ: 0,
    animationDuration: 2
  },
  tablet: { 
    dominoScale: 0.9, handDominoScale: 0.9,
    durationAdjustment: 0, speedAdjustment: 0,
    rotateX: 0, rotateY: 0, rotateZ: 0,
    rotationSpeed: 5, rotationAmplitudeX: 45, rotationAmplitudeY: 45, rotationAmplitudeZ: 0,
    animationDuration: 2
  },
  mobile: { 
    dominoScale: 0.8, handDominoScale: 0.8,
    durationAdjustment: 0, speedAdjustment: 0,
    rotateX: 0, rotateY: 0, rotateZ: 0,
    rotationSpeed: 5, rotationAmplitudeX: 45, rotationAmplitudeY: 45, rotationAmplitudeZ: 0,
    animationDuration: 2
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

  // Animation state - moved after initial settings
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationMode, setAnimationMode] = useState<'shake' | 'rotate' | null>(null);
  const animationRef = useRef<{ current: number | null; stopFunction?: (() => void) | null }>({ current: null });
  const startTimeRef = useRef<number | null>(null);
  const baseRotationRef = useRef({ X: 0, Y: 0, Z: 0 });

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

  // Animation functions met exacte logica uit DominoTileDemo
  const startShakeAnimation = () => {
    const currentSettings = allSettings[deviceType];
    if (currentSettings.rotationAmplitudeX === 0 && currentSettings.rotationAmplitudeY === 0 && currentSettings.rotationAmplitudeZ === 0) {
      return { success: false, message: "De rotatie-amplitude voor alle assen is 0°. Stel een waarde in om de steen te laten bewegen." };
    }
    
    console.log('🎬 Starting shake animation with settings:', currentSettings);
    
    // Stop any existing animation first
    if (animationRef.current.current) {
      cancelAnimationFrame(animationRef.current.current);
    }
    
    setIsAnimating(true);
    setAnimationMode('shake');
    
    // Store base rotation values
    baseRotationRef.current = {
      X: currentSettings.rotateX,
      Y: currentSettings.rotateY,
      Z: currentSettings.rotateZ
    };
    
    startTimeRef.current = performance.now();
    const durationInMs = currentSettings.animationDuration * 1000;
    let shouldContinue = true; // Local variable voor animatie controle
    
    const animate = (timestamp: number) => {
      if (!startTimeRef.current || !shouldContinue) return;
      
      const elapsedTime = timestamp - startTimeRef.current;
      const progress = elapsedTime / durationInMs;
      
      if (progress < 1) {
        const wave = Math.cos(elapsedTime * currentSettings.rotationSpeed * Math.PI / 1000);
        const decayFactor = Math.pow(1 - progress, 1.5);
        
        // Apply animation on top of base rotation
        const newX = baseRotationRef.current.X + (currentSettings.rotationAmplitudeX * wave * decayFactor);
        const newY = baseRotationRef.current.Y + (currentSettings.rotationAmplitudeY * wave * decayFactor);
        const newZ = baseRotationRef.current.Z + (currentSettings.rotationAmplitudeZ * wave * decayFactor);
        
        console.log('🎯 Shaking:', { newX, newY, newZ, wave, decayFactor, progress });
        
        // Direct DOM manipulation for immediate effect
        document.documentElement.style.setProperty('--current-rotate-x', `${newX}deg`);
        document.documentElement.style.setProperty('--current-rotate-y', `${newY}deg`);
        document.documentElement.style.setProperty('--current-rotate-z', `${newZ}deg`);
        
        animationRef.current.current = requestAnimationFrame(animate);
      } else {
        // Return to base rotation and finish
        document.documentElement.style.setProperty('--current-rotate-x', `${baseRotationRef.current.X}deg`);
        document.documentElement.style.setProperty('--current-rotate-y', `${baseRotationRef.current.Y}deg`);
        document.documentElement.style.setProperty('--current-rotate-z', `${baseRotationRef.current.Z}deg`);
        setIsAnimating(false);
        setAnimationMode(null);
        console.log('🎬 Shake animation completed');
      }
    };
    
    // Store the stop function to cancel the animation
    animationRef.current.stopFunction = () => {
      shouldContinue = false;
      setIsAnimating(false);
      setAnimationMode(null);
    };
    
    animationRef.current.current = requestAnimationFrame(animate);
    return { success: true, message: "De dominostenen schudden..." };
  };

  const startContinuousRotate = () => {
    const currentSettings = allSettings[deviceType];
    if (currentSettings.rotationAmplitudeX === 0 && currentSettings.rotationAmplitudeY === 0 && currentSettings.rotationAmplitudeZ === 0) {
      return { success: false, message: "De rotatie-amplitude voor alle assen is 0°. Stel een waarde in om de steen te laten bewegen." };
    }
    
    console.log('🎬 Starting continuous rotate with settings:', currentSettings);
    
    // Stop any existing animation first
    if (animationRef.current.current) {
      cancelAnimationFrame(animationRef.current.current);
    }
    
    // Set state - maar vertrouw niet op deze waarden in de animatie loop
    setIsAnimating(true);
    setAnimationMode('rotate');
    
    // Store base rotation values
    baseRotationRef.current = {
      X: currentSettings.rotateX,
      Y: currentSettings.rotateY,
      Z: currentSettings.rotateZ
    };
    
    const initialTime = performance.now();
    let shouldContinue = true; // Local variable voor animatie controle

    const animate = (timestamp: number) => {
      // Use local variable instead of React state to avoid race conditions
      if (!shouldContinue) {
        console.log('🎬 Animation stopped via local flag');
        return;
      }
      
      const elapsedMilliseconds = timestamp - initialTime;
      const angle = (elapsedMilliseconds / 1000) * currentSettings.rotationSpeed * Math.PI;
      const wave = Math.sin(angle);
      
      // Apply animation on top of base rotation
      const newX = baseRotationRef.current.X + (currentSettings.rotationAmplitudeX * wave);
      const newY = baseRotationRef.current.Y + (currentSettings.rotationAmplitudeY * wave);
      const newZ = baseRotationRef.current.Z + (currentSettings.rotationAmplitudeZ * wave);
      
      console.log('🎯 Animating:', { newX, newY, newZ, wave });
      
      // Direct DOM manipulation for immediate effect
      document.documentElement.style.setProperty('--current-rotate-x', `${newX}deg`);
      document.documentElement.style.setProperty('--current-rotate-y', `${newY}deg`);
      document.documentElement.style.setProperty('--current-rotate-z', `${newZ}deg`);
      
      animationRef.current.current = requestAnimationFrame(animate);
    };
    
    // Store the stop function to cancel the animation
    animationRef.current.stopFunction = () => {
      shouldContinue = false;
      setIsAnimating(false);
      setAnimationMode(null);
    };
    
    animationRef.current.current = requestAnimationFrame(animate);
    return { success: true, message: "De dominostenen roteren continu..." };
  };

  const stopAnimation = () => {
    console.log('🛑 Stopping animation');
    
    if (animationRef.current.current) {
      cancelAnimationFrame(animationRef.current.current);
    }
    
    // Call custom stop function if it exists
    if (animationRef.current.stopFunction) {
      animationRef.current.stopFunction();
      animationRef.current.stopFunction = null;
    }
    
    // Return to base rotation
    document.documentElement.style.setProperty('--current-rotate-x', `${baseRotationRef.current.X}deg`);
    document.documentElement.style.setProperty('--current-rotate-y', `${baseRotationRef.current.Y}deg`);
    document.documentElement.style.setProperty('--current-rotate-z', `${baseRotationRef.current.Z}deg`);
    
    setIsAnimating(false);
    setAnimationMode(null);
    return { success: true, message: "Animatie gestopt." };
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current.current) {
        cancelAnimationFrame(animationRef.current.current);
      }
    };
  }, []);

  const updateRotation = (axis: 'X' | 'Y' | 'Z', value: number, targetDevice?: DeviceType) => {
    // Don't allow manual rotation during animation
    if (isAnimating) return;
    
    const clampedValue = Math.max(-90, Math.min(90, value));
    const device = targetDevice || deviceType;
    const property = `rotate${axis}` as keyof GameVisualSettings;
    
    setAllSettings(prev => ({
      ...prev,
      [device]: { ...prev[device], [property]: clampedValue }
    }));
    
    // Update base rotation reference for current device
    if (device === deviceType) {
      baseRotationRef.current[axis] = clampedValue;
    }
  };

  const updateRotationSpeed = (speed: number, targetDevice?: DeviceType) => {
    const clampedSpeed = Math.max(0.1, Math.min(10, speed));
    const device = targetDevice || deviceType;
    setAllSettings(prev => ({
      ...prev,
      [device]: { ...prev[device], rotationSpeed: clampedSpeed }
    }));
  };

  const updateRotationAmplitude = (axis: 'X' | 'Y' | 'Z', value: number, targetDevice?: DeviceType) => {
    const clampedValue = Math.max(-500, Math.min(500, value));
    const device = targetDevice || deviceType;
    const property = `rotationAmplitude${axis}` as keyof GameVisualSettings;
    setAllSettings(prev => ({
      ...prev,
      [device]: { ...prev[device], [property]: clampedValue }
    }));
  };

  const updateAnimationDuration = (duration: number, targetDevice?: DeviceType) => {
    const clampedDuration = Math.max(0.1, Math.min(10, duration));
    const device = targetDevice || deviceType;
    setAllSettings(prev => ({
      ...prev,
      [device]: { ...prev[device], animationDuration: clampedDuration }
    }));
  };

  return {
    settings,
    allSettings,
    currentDeviceType: deviceType,
    updateDominoScale,
    updateHandDominoScale,
    updateDurationAdjustment,
    updateSpeedAdjustment,
    updateRotation,
    updateRotationSpeed,
    updateRotationAmplitude,
    updateAnimationDuration,
    applyLiveUpdate,
    resetToDefaults,
    getSettingsForDevice,
    // Animation controls
    isAnimating,
    animationMode,
    startShakeAnimation,
    startContinuousRotate,
    stopAnimation,
  };
};