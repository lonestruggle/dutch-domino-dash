import { useState, useEffect, useRef } from 'react';
import { useDeviceType, DeviceType } from './useDeviceType';
import { useAuth } from './useAuth';

// Personal settings (per user)
export interface PersonalSettings {
  dominoScale: number; // 0.5 to 2.0 multiplier for board dominoes
  handDominoScale: number; // 0.5 to 2.0 multiplier for hand dominoes
  durationAdjustment: number; // -5 to +5, each step = 0.5s
  speedAdjustment: number; // -300 to +300ms, each step = 10ms
}

// Global settings (same for everyone)
export interface GlobalSettings {
  // 3D Rotation settings - GLOBAL FOR EVERYONE
  rotateX: number; // -90 to 90 degrees
  rotateY: number; // -90 to 90 degrees  
  rotateZ: number; // -90 to 90 degrees
  // Animation settings - GLOBAL FOR EVERYONE
  rotationSpeed: number; // 0.1 to 10x speed
  rotationAmplitudeX: number; // -500 to 500 degrees
  rotationAmplitudeY: number; // -500 to 500 degrees
  rotationAmplitudeZ: number; // -500 to 500 degrees
  animationDuration: number; // 0.1 to 10 seconds
  // Shake settings - GLOBAL FOR EVERYONE
  shakeIntensity: number; // 0.1 to 2.0 intensity multiplier
  shakeDuration: number; // 0.5 to 5.0 seconds
  // Domino dimensions - GLOBAL FOR EVERYONE
  dominoWidth: number; // 40 to 120 pixels
  dominoHeight: number; // 20 to 60 pixels  
  dominoThickness: number; // 4 to 16 pixels
}

// Combined interface for easy access
export interface GameVisualSettings extends PersonalSettings, GlobalSettings {}

export interface DeviceSpecificPersonalSettings {
  desktop: PersonalSettings;
  tablet: PersonalSettings;  
  mobile: PersonalSettings;
}

export interface DeviceSpecificGlobalSettings {
  desktop: GlobalSettings;
  tablet: GlobalSettings;  
  mobile: GlobalSettings;
}

export interface DeviceSpecificSettings {
  desktop: GameVisualSettings;
  tablet: GameVisualSettings;  
  mobile: GameVisualSettings;
}

const DEFAULT_PERSONAL_SETTINGS: PersonalSettings = {
  dominoScale: 1.0,
  handDominoScale: 1.0,
  durationAdjustment: 0,
  speedAdjustment: 0,
};

const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  rotateX: 0,
  rotateY: 0,
  rotateZ: 0,
  rotationSpeed: 5,
  rotationAmplitudeX: 45,
  rotationAmplitudeY: 45,
  rotationAmplitudeZ: 0,
  animationDuration: 2,
  shakeIntensity: 1.0,
  shakeDuration: 1.5,
  dominoWidth: 64,
  dominoHeight: 32,
  dominoThickness: 8,
};

const DEFAULT_SETTINGS: GameVisualSettings = {
  ...DEFAULT_PERSONAL_SETTINGS,
  ...DEFAULT_GLOBAL_SETTINGS,
};

const DEFAULT_DEVICE_PERSONAL_SETTINGS: DeviceSpecificPersonalSettings = {
  desktop: { dominoScale: 1.0, handDominoScale: 1.0, durationAdjustment: 0, speedAdjustment: 0 },
  tablet: { dominoScale: 0.9, handDominoScale: 0.9, durationAdjustment: 0, speedAdjustment: 0 },
  mobile: { dominoScale: 1.2, handDominoScale: 1.2, durationAdjustment: 0, speedAdjustment: 0 },
};

const DEFAULT_DEVICE_GLOBAL_SETTINGS: DeviceSpecificGlobalSettings = {
  desktop: { ...DEFAULT_GLOBAL_SETTINGS },
  tablet: { ...DEFAULT_GLOBAL_SETTINGS },
  mobile: { ...DEFAULT_GLOBAL_SETTINGS },
};

const DEFAULT_DEVICE_SETTINGS: DeviceSpecificSettings = {
  desktop: { ...DEFAULT_DEVICE_PERSONAL_SETTINGS.desktop, ...DEFAULT_DEVICE_GLOBAL_SETTINGS.desktop },
  tablet: { ...DEFAULT_DEVICE_PERSONAL_SETTINGS.tablet, ...DEFAULT_DEVICE_GLOBAL_SETTINGS.tablet },
  mobile: { ...DEFAULT_DEVICE_PERSONAL_SETTINGS.mobile, ...DEFAULT_DEVICE_GLOBAL_SETTINGS.mobile },
};

export const useGameVisualSettings = () => {
  const deviceType = useDeviceType();
  const { user } = useAuth();
  
  // Separate storage for personal and global settings
  const getPersonalStorageKey = () => {
    const userId = user?.id || 'anonymous';
    return `domino-personal-settings-v3-${userId}`;
  };
  
  const getGlobalStorageKey = () => {
    return `domino-global-settings-v3`; // No user ID - same for everyone
  };
  
  const loadPersonalSettingsFromStorage = (): DeviceSpecificPersonalSettings => {
    try {
      const storageKey = getPersonalStorageKey();
      console.log('🔧 Loading personal settings with key:', storageKey, 'user:', user?.id);
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        const merged = {
          desktop: { ...DEFAULT_DEVICE_PERSONAL_SETTINGS.desktop, ...parsed.desktop },
          tablet: { ...DEFAULT_DEVICE_PERSONAL_SETTINGS.tablet, ...parsed.tablet },
          mobile: { ...DEFAULT_DEVICE_PERSONAL_SETTINGS.mobile, ...parsed.mobile },
        };
        console.log('🔧 Loaded personal settings:', merged);
        return merged;
      }
      console.log('🔧 No personal settings found, using defaults');
      return DEFAULT_DEVICE_PERSONAL_SETTINGS;
    } catch {
      console.log('🔧 Error loading personal settings, using defaults');
      return DEFAULT_DEVICE_PERSONAL_SETTINGS;
    }
  };
  
  const loadGlobalSettingsFromStorage = (): DeviceSpecificGlobalSettings => {
    try {
      const storageKey = getGlobalStorageKey();
      console.log('🌍 Loading GLOBAL settings with key:', storageKey);
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        const merged = {
          desktop: { ...DEFAULT_DEVICE_GLOBAL_SETTINGS.desktop, ...parsed.desktop },
          tablet: { ...DEFAULT_DEVICE_GLOBAL_SETTINGS.tablet, ...parsed.tablet },
          mobile: { ...DEFAULT_DEVICE_GLOBAL_SETTINGS.mobile, ...parsed.mobile },
        };
        console.log('🌍 Loaded GLOBAL settings:', merged);
        return merged;
      }
      console.log('🌍 No global settings found, using defaults');
      return DEFAULT_DEVICE_GLOBAL_SETTINGS;
    } catch {
      console.log('🌍 Error loading global settings, using defaults');
      return DEFAULT_DEVICE_GLOBAL_SETTINGS;
    }
  };
  
  const combineSettings = (personal: DeviceSpecificPersonalSettings, global: DeviceSpecificGlobalSettings): DeviceSpecificSettings => {
    return {
      desktop: { ...personal.desktop, ...global.desktop },
      tablet: { ...personal.tablet, ...global.tablet },
      mobile: { ...personal.mobile, ...global.mobile },
    };
  };
  
  const [personalSettings, setPersonalSettings] = useState<DeviceSpecificPersonalSettings>(loadPersonalSettingsFromStorage);
  const [globalSettings, setGlobalSettings] = useState<DeviceSpecificGlobalSettings>(loadGlobalSettingsFromStorage);
  
  // Combine personal and global settings
  const allSettings = combineSettings(personalSettings, globalSettings);
  
  // Reload personal settings when user changes
  useEffect(() => {
    const newPersonalSettings = loadPersonalSettingsFromStorage();
    setPersonalSettings(newPersonalSettings);
  }, [user?.id]);
  
  // Load global settings once (same for everyone)
  useEffect(() => {
    const newGlobalSettings = loadGlobalSettingsFromStorage();
    setGlobalSettings(newGlobalSettings);
  }, []);

  // Animation state - moved after initial settings
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationMode, setAnimationMode] = useState<'shake' | 'rotate' | null>(null);
  const [pendingShake, setPendingShake] = useState(false); // NEW: Track pending shake
  const animationRef = useRef<{ current: number | null; stopFunction?: (() => void) | null }>({ current: null });
  const startTimeRef = useRef<number | null>(null);
  const baseRotationRef = useRef({ X: 0, Y: 0, Z: 0 });
  const randomSeedsRef = useRef<number[]>([]); // Store random seeds for each domino

  // Save personal settings
  useEffect(() => {
    try {
      const storageKey = getPersonalStorageKey();
      localStorage.setItem(storageKey, JSON.stringify(personalSettings));
      console.log('💾 Saved personal settings:', personalSettings);
    } catch (error) {
      console.warn('Failed to save personal settings:', error);
    }
  }, [personalSettings, user?.id]);
  
  // Save global settings
  useEffect(() => {
    try {
      const storageKey = getGlobalStorageKey();
      localStorage.setItem(storageKey, JSON.stringify(globalSettings));
      console.log('🌍💾 Saved GLOBAL settings:', globalSettings);
    } catch (error) {
      console.warn('Failed to save global settings:', error);
    }
  }, [globalSettings]);

  // Listen for force save events
  useEffect(() => {
    const handleForceSave = (event: CustomEvent) => {
      console.log('🔧 Force save triggered:', event.detail);
      try {
        // Force save current personal settings
        const personalKey = getPersonalStorageKey();
        localStorage.setItem(personalKey, JSON.stringify(personalSettings));
        
        // Force save current global settings
        const globalKey = getGlobalStorageKey();
        localStorage.setItem(globalKey, JSON.stringify(globalSettings));
        
        console.log('💾 Force saved all settings to localStorage');
      } catch (error) {
        console.error('Failed to force save settings:', error);
      }
    };

    window.addEventListener('forceSettingsSave', handleForceSave as EventListener);
    return () => {
      window.removeEventListener('forceSettingsSave', handleForceSave as EventListener);
    };
  }, [personalSettings, globalSettings, user?.id]);

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
    setPersonalSettings(prev => ({
      ...prev,
      [device]: { ...prev[device], dominoScale: clampedScale }
    }));
  };

  const updateHandDominoScale = (scale: number, targetDevice?: DeviceType) => {
    const clampedScale = Math.max(0.5, Math.min(2.0, scale));
    const device = targetDevice || deviceType;
    setPersonalSettings(prev => ({
      ...prev,
      [device]: { ...prev[device], handDominoScale: clampedScale }
    }));
  };

  const resetToDefaults = (targetDevice?: DeviceType) => {
    if (targetDevice) {
      setPersonalSettings(prev => ({
        ...prev,
        [targetDevice]: DEFAULT_DEVICE_PERSONAL_SETTINGS[targetDevice]
      }));
      setGlobalSettings(prev => ({
        ...prev,
        [targetDevice]: DEFAULT_DEVICE_GLOBAL_SETTINGS[targetDevice]
      }));
    } else {
      setPersonalSettings(DEFAULT_DEVICE_PERSONAL_SETTINGS);
      setGlobalSettings(DEFAULT_DEVICE_GLOBAL_SETTINGS);
    }
  };



  const updateDurationAdjustment = (adjustment: number, targetDevice?: DeviceType) => {
    const clampedAdjustment = Math.max(-5, Math.min(5, adjustment));
    const device = targetDevice || deviceType;
    setPersonalSettings(prev => ({
      ...prev,
      [device]: { ...prev[device], durationAdjustment: clampedAdjustment }
    }));
  };

  const updateSpeedAdjustment = (adjustment: number, targetDevice?: DeviceType) => {
    const clampedAdjustment = Math.max(-30, Math.min(30, adjustment)); // -300ms to +300ms in 10ms steps
    const device = targetDevice || deviceType;
    setPersonalSettings(prev => ({
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

  const getSettingsForDevice = (device: DeviceType) => {
    // ✅ FIX: Always load fresh settings from localStorage to avoid race conditions
    // Load both personal and global settings fresh from localStorage
    const freshPersonalSettings = loadPersonalSettingsFromStorage();
    const freshGlobalSettings = loadGlobalSettingsFromStorage();
    
    // Combine them just like allSettings does
    const combined = {
      ...freshPersonalSettings[device],
      ...freshGlobalSettings[device]
    };
    
    return combined || DEFAULT_DEVICE_SETTINGS[device];
  };

  // Animation functions met exacte logica uit DominoTileDemo
  const forceStopAnimation = () => {
    console.log('🎬 🛑 Force stopping animation');
    
    // Force clear all animation references
    if (animationRef.current.current) {
      cancelAnimationFrame(animationRef.current.current);
      animationRef.current.current = null;
    }
    
    // Call any stored stop function
    if (animationRef.current.stopFunction) {
      animationRef.current.stopFunction();
      animationRef.current.stopFunction = null;
    }
    
    // Reset all states explicitly
    setIsAnimating(false);
    setAnimationMode(null);
    startTimeRef.current = null;
    
    // Clear random seeds
    randomSeedsRef.current = [];
    
    console.log('🎬 ✅ Animation force stopped and cleaned up');
  };

  // Queue shake to execute after domino placement
  const queueShakeAnimation = () => {
    console.log('🎬 🚨 🎯 Queueing shake animation for after next domino placement');
    console.log('🎬 🚨 🎯 Setting pendingShake to true');
    setPendingShake(true);
    return { success: true, message: "Shake ingepland na volgende zet" };
  };

  // Execute pending shake (called after domino placement)
  const executePendingShake = () => {
    if (!pendingShake) return;
    
    console.log('🎬 ⚡ Executing pending shake animation');
    setPendingShake(false);
    
    // Use the direct shake execution logic
    return startShakeAnimationDirect();
  };

  const startShakeAnimation = () => {
    // Get stack trace to see which button called this
    const stack = new Error().stack;
    const caller = stack?.split('\n')[2]?.trim() || 'unknown';
    
    console.log('🎬 SHAKE BUTTON DEBUG: Called from:', caller);
    
    // In game context, queue the shake instead of executing immediately
    if (caller.includes('DominoGame') || caller.includes('onClick')) {
      return queueShakeAnimation();
    }
    
    // Direct execution for other contexts (like settings)
    return startShakeAnimationDirect();
  };

  const startShakeAnimationDirect = () => {
    console.log('🎬 startShakeAnimationDirect called!');
    console.log('🎬 Current animation state:', { 
      isAnimating, 
      animationMode, 
      hasActiveRef: !!animationRef.current.current,
      hasStopFunction: !!animationRef.current.stopFunction 
    });
    
    // ✅ FIX: Use getSettingsForDevice() for consistent settings retrieval
    const currentSettings = getSettingsForDevice(deviceType);
    console.log('🎬 SHAKE BUTTON DEBUG: Current device:', deviceType);
    console.log('🎬 SHAKE BUTTON DEBUG: Current settings amplitude X/Y/Z:', {
      X: currentSettings.rotationAmplitudeX,
      Y: currentSettings.rotationAmplitudeY, 
      Z: currentSettings.rotationAmplitudeZ
    });
    console.log('🎬 SHAKE BUTTON DEBUG: Settings from getSettingsForDevice():', currentSettings);
    
    if (currentSettings.rotationAmplitudeX === 0 && currentSettings.rotationAmplitudeY === 0 && currentSettings.rotationAmplitudeZ === 0) {
      console.log('🎬 ❌ All amplitudes are 0, cannot shake');
      return { success: false, message: "De rotatie-amplitude voor alle assen is 0°. Stel een waarde in om de steen te laten bewegen." };
    }
    
    console.log('🎬 Starting shake animation with settings:', currentSettings);
    
    // Check if we can find board dominoes - DEBUGGING
    const boardDominoesOld = document.querySelectorAll('.domino-tile.board-domino');
    const boardDominoesNew = document.querySelectorAll('.domino-tile-board.board-domino');
    const boardDominoesAny = document.querySelectorAll('.board-domino');
    const allDominoes = document.querySelectorAll('.domino-tile');
    const allDominoesBoard = document.querySelectorAll('.domino-tile-board');
    
    console.log('🎬 DEBUGGING SELECTORS:');
    console.log('🎬 .domino-tile.board-domino:', boardDominoesOld.length);
    console.log('🎬 .domino-tile-board.board-domino:', boardDominoesNew.length);
    console.log('🎬 .board-domino:', boardDominoesAny.length);
    console.log('🎬 .domino-tile:', allDominoes.length);
    console.log('🎬 .domino-tile-board:', allDominoesBoard.length);
    
    // Use the correct selector
    const boardDominoes = document.querySelectorAll('.domino-tile-board.board-domino');
    console.log('🎬 Found board dominoes (correct selector):', boardDominoes.length);
    if (boardDominoes.length === 0) {
      console.log('🎬 ❌ No board dominoes found to shake!');
      return { success: false, message: "Geen domino's op het bord gevonden om te schudden." };
    }
    
    // Force stop any existing animation first
    forceStopAnimation();
    
    // Small delay to ensure cleanup is complete
    setTimeout(() => {
      console.log('🎬 ⏰ Starting animation after cleanup delay');
    
      // Generate new random seeds for each domino
      const allBoardDominoes = document.querySelectorAll('.domino-tile-board.board-domino');
      randomSeedsRef.current = Array.from({ length: allBoardDominoes.length }, () => Math.random() * 10000);
      
      setIsAnimating(true);
      setAnimationMode('shake');
      
      console.log('🎬 ✅ Animation state set:', { isAnimating: true, animationMode: 'shake' });
    
    // Store base rotation values
    baseRotationRef.current = {
      X: currentSettings.rotateX,
      Y: currentSettings.rotateY,
      Z: currentSettings.rotateZ
    };
    
    startTimeRef.current = performance.now();
    const durationInMs = currentSettings.shakeDuration * 1000; // Use shake duration setting
    let shouldContinue = true; // Local variable voor animatie controle
    
    const animate = (timestamp: number) => {
      if (!startTimeRef.current || !shouldContinue) return;
      
      const elapsedTime = timestamp - startTimeRef.current;
      const progress = elapsedTime / durationInMs;
      
      if (progress < 1) {
        const wave = Math.cos(elapsedTime * currentSettings.rotationSpeed * Math.PI / 1000);
        const decayFactor = Math.pow(1 - progress, 1.5);
        
        // Apply animation on top of base rotation with shake intensity
        const shakeIntensity = currentSettings.shakeIntensity;
        const newX = baseRotationRef.current.X + (currentSettings.rotationAmplitudeX * wave * decayFactor * shakeIntensity);
        const newY = baseRotationRef.current.Y + (currentSettings.rotationAmplitudeY * wave * decayFactor * shakeIntensity);
        const newZ = baseRotationRef.current.Z + (currentSettings.rotationAmplitudeZ * wave * decayFactor * shakeIntensity);
        
        console.log('🎯 Shaking:', { newX, newY, newZ, wave, decayFactor, progress });
        
        // Apply individual random animation to each existing board domino
        const animatedDominoes = document.querySelectorAll('.domino-tile-board.board-domino');
        animatedDominoes.forEach((domino: Element, index: number) => {
          const htmlDomino = domino as HTMLElement;
          
          // Use stored random seed for this domino to maintain consistency during animation
          const seed = randomSeedsRef.current[index] || (index * 1000);
          const randomPhaseX = Math.sin(seed * 0.001) * 2 * Math.PI;
          const randomPhaseY = Math.cos(seed * 0.001) * 2 * Math.PI;
          const randomPhaseZ = Math.sin(seed * 0.002) * 2 * Math.PI;
          
          const waveX = Math.cos(elapsedTime * currentSettings.rotationSpeed * Math.PI / 1000 + randomPhaseX);
          const waveY = Math.cos(elapsedTime * currentSettings.rotationSpeed * Math.PI / 1000 + randomPhaseY);
          const waveZ = Math.cos(elapsedTime * currentSettings.rotationSpeed * Math.PI / 1000 + randomPhaseZ);
          
          // Individual random amplitude multipliers based on stored seed (0.5 to 1.5)
          const amplitudeMultX = 0.5 + Math.sin(seed * 0.003);
          const amplitudeMultY = 0.5 + Math.cos(seed * 0.003);
          const amplitudeMultZ = 0.5 + Math.sin(seed * 0.004);
          
          // Get the original domino rotation from the data attribute or rotation prop
          const originalRotationZ = parseFloat(htmlDomino.dataset.originalRotation || '0');
          
          const shakeIntensity = currentSettings.shakeIntensity;
          const individualX = baseRotationRef.current.X + (currentSettings.rotationAmplitudeX * waveX * decayFactor * amplitudeMultX * shakeIntensity);
          const individualY = baseRotationRef.current.Y + (currentSettings.rotationAmplitudeY * waveY * decayFactor * amplitudeMultY * shakeIntensity);
          const individualZ = baseRotationRef.current.Z + originalRotationZ + (currentSettings.rotationAmplitudeZ * waveZ * decayFactor * amplitudeMultZ * shakeIntensity);
          
          // Keep only non-rotation transforms (like translate, scale) and add our complete rotation
          const currentTransform = htmlDomino.style.transform || '';
          const baseTransform = currentTransform.replace(/rotateX\([^)]*\)|rotateY\([^)]*\)|rotateZ\([^)]*\)/g, '').trim();
          htmlDomino.style.transform = `${baseTransform} rotateX(${individualX}deg) rotateY(${individualY}deg) rotateZ(${individualZ}deg)`.trim();
        });
        
        animationRef.current.current = requestAnimationFrame(animate);
      } else {
        // Return to base rotation - reset only board dominoes but keep their original rotation
        const boardDominoes = document.querySelectorAll('.domino-tile-board.board-domino');
        boardDominoes.forEach((domino: Element) => {
          const htmlDomino = domino as HTMLElement;
          const originalRotationZ = parseFloat(htmlDomino.dataset.originalRotation || '0');
          const currentTransform = htmlDomino.style.transform || '';
          const baseTransform = currentTransform.replace(/rotateX\([^)]*\)|rotateY\([^)]*\)|rotateZ\([^)]*\)/g, '').trim();
          htmlDomino.style.transform = `${baseTransform} rotateX(${baseRotationRef.current.X}deg) rotateY(${baseRotationRef.current.Y}deg) rotateZ(${baseRotationRef.current.Z + originalRotationZ}deg)`.trim();
        });
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
      console.log('🎬 ✅ Shake animation started successfully');
    }, 50); // 50ms delay for cleanup
    
    return { success: true, message: "De dominostenen schudden..." };
  };

  const startContinuousRotate = () => {
    // ✅ FIX: Use getSettingsForDevice() for consistent settings retrieval  
    const currentSettings = getSettingsForDevice(deviceType);
    if (currentSettings.rotationAmplitudeX === 0 && currentSettings.rotationAmplitudeY === 0 && currentSettings.rotationAmplitudeZ === 0) {
      return { success: false, message: "De rotatie-amplitude voor alle assen is 0°. Stel een waarde in om de steen te laten bewegen." };
    }
    
    console.log('🎬 Starting continuous rotate with settings:', currentSettings);
    
    // Stop any existing animation first
    if (animationRef.current.current) {
      cancelAnimationFrame(animationRef.current.current);
    }
    
    // Generate new random seeds for each domino
    const boardDominoes = document.querySelectorAll('.domino-tile-board.board-domino');
    randomSeedsRef.current = Array.from({ length: boardDominoes.length }, () => Math.random() * 10000);
    
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
      
        // Apply individual random animation to each existing board domino
        const boardDominoes = document.querySelectorAll('.domino-tile-board.board-domino');
        boardDominoes.forEach((domino: Element, index: number) => {
          const htmlDomino = domino as HTMLElement;
          
          // Use stored random seed for this domino to maintain consistency during animation
          const seed = randomSeedsRef.current[index] || (index * 1000);
          const randomPhaseX = Math.sin(seed * 0.001) * 2 * Math.PI;
          const randomPhaseY = Math.cos(seed * 0.001) * 2 * Math.PI;
          const randomPhaseZ = Math.sin(seed * 0.002) * 2 * Math.PI;
          
          const waveX = Math.sin(angle + randomPhaseX);
          const waveY = Math.sin(angle + randomPhaseY);
          const waveZ = Math.sin(angle + randomPhaseZ);
          
          // Individual random amplitude multipliers based on stored seed (0.5 to 1.5)
          const amplitudeMultX = 0.5 + Math.sin(seed * 0.003);
          const amplitudeMultY = 0.5 + Math.cos(seed * 0.003);
          const amplitudeMultZ = 0.5 + Math.sin(seed * 0.004);
          
          // Get the original domino rotation from the data attribute or rotation prop
          const originalRotationZ = parseFloat(htmlDomino.dataset.originalRotation || '0');
          
          const individualX = baseRotationRef.current.X + (currentSettings.rotationAmplitudeX * waveX * amplitudeMultX);
          const individualY = baseRotationRef.current.Y + (currentSettings.rotationAmplitudeY * waveY * amplitudeMultY);
          const individualZ = baseRotationRef.current.Z + originalRotationZ + (currentSettings.rotationAmplitudeZ * waveZ * amplitudeMultZ);
          
          // Keep only non-rotation transforms (like translate, scale) and add our complete rotation
          const currentTransform = htmlDomino.style.transform || '';
          const baseTransform = currentTransform.replace(/rotateX\([^)]*\)|rotateY\([^)]*\)|rotateZ\([^)]*\)/g, '').trim();
          htmlDomino.style.transform = `${baseTransform} rotateX(${individualX}deg) rotateY(${individualY}deg) rotateZ(${individualZ}deg)`.trim();
        });
      
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
    
        // Return to base rotation - reset only board dominoes but keep their original rotation
        const boardDominoes = document.querySelectorAll('.domino-tile-board.board-domino');
        boardDominoes.forEach((domino: Element) => {
          const htmlDomino = domino as HTMLElement;
          const originalRotationZ = parseFloat(htmlDomino.dataset.originalRotation || '0');
          const currentTransform = htmlDomino.style.transform || '';
          const baseTransform = currentTransform.replace(/rotateX\([^)]*\)|rotateY\([^)]*\)|rotateZ\([^)]*\)/g, '').trim();
          htmlDomino.style.transform = `${baseTransform} rotateX(${baseRotationRef.current.X}deg) rotateY(${baseRotationRef.current.Y}deg) rotateZ(${baseRotationRef.current.Z + originalRotationZ}deg)`.trim();
        });
    
    setIsAnimating(false);
    setAnimationMode(null);
    return { success: true, message: "Animatie gestopt." };
  };

  // Function to apply original rotations without animation 
  const applyOriginalRotations = () => {
    const currentSettings = allSettings[deviceType];
    const boardDominoes = document.querySelectorAll('.domino-tile-board.board-domino');
    boardDominoes.forEach((domino: Element) => {
      const htmlDomino = domino as HTMLElement;
      const originalRotationZ = parseFloat(htmlDomino.dataset.originalRotation || '0');
      const currentTransform = htmlDomino.style.transform || '';
      const baseTransform = currentTransform.replace(/rotateX\([^)]*\)|rotateY\([^)]*\)|rotateZ\([^)]*\)/g, '').trim();
      htmlDomino.style.transform = `${baseTransform} rotateX(${currentSettings.rotateX}deg) rotateY(${currentSettings.rotateY}deg) rotateZ(${currentSettings.rotateZ + originalRotationZ}deg)`.trim();
    });
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
    const property = `rotate${axis}` as keyof GlobalSettings;
    
    setGlobalSettings(prev => ({
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
    setGlobalSettings(prev => ({
      ...prev,
      [device]: { ...prev[device], rotationSpeed: clampedSpeed }
    }));
  };

  const updateRotationAmplitude = (axis: 'X' | 'Y' | 'Z', value: number, targetDevice?: DeviceType) => {
    const clampedValue = Math.max(-1000, Math.min(1000, value));
    const device = targetDevice || deviceType;
    const property = `rotationAmplitude${axis}` as keyof GlobalSettings;
    setGlobalSettings(prev => ({
      ...prev,
      [device]: { ...prev[device], [property]: clampedValue }
    }));
  };

  const updateAnimationDuration = (duration: number, targetDevice?: DeviceType) => {
    const clampedDuration = Math.max(0.1, Math.min(10, duration));
    const device = targetDevice || deviceType;
    setGlobalSettings(prev => ({
      ...prev,
      [device]: { ...prev[device], animationDuration: clampedDuration }
    }));
  };

  const updateShakeIntensity = (intensity: number, targetDevice?: DeviceType) => {
    const clampedIntensity = Math.max(0.1, Math.min(2.0, intensity));
    const device = targetDevice || deviceType;
    setGlobalSettings(prev => ({
      ...prev,
      [device]: { ...prev[device], shakeIntensity: clampedIntensity }
    }));
  };

  const updateShakeDuration = (duration: number, targetDevice?: DeviceType) => {
    const clampedDuration = Math.max(0.5, Math.min(5.0, duration));
    const device = targetDevice || deviceType;
    setGlobalSettings(prev => ({
      ...prev,
      [device]: { ...prev[device], shakeDuration: clampedDuration }
    }));
  };

  // Domino dimension update functions
  const updateDominoWidth = (width: number, targetDevice?: DeviceType) => {
    const clampedWidth = Math.max(40, Math.min(120, width));
    const device = targetDevice || deviceType;
    setGlobalSettings(prev => ({
      ...prev,
      [device]: { ...prev[device], dominoWidth: clampedWidth }
    }));
  };

  const updateDominoHeight = (height: number, targetDevice?: DeviceType) => {
    const clampedHeight = Math.max(20, Math.min(60, height));
    const device = targetDevice || deviceType;
    setGlobalSettings(prev => ({
      ...prev,
      [device]: { ...prev[device], dominoHeight: clampedHeight }
    }));
  };

  const updateDominoThickness = (thickness: number, targetDevice?: DeviceType) => {
    const clampedThickness = Math.max(4, Math.min(16, thickness));
    const device = targetDevice || deviceType;
    setGlobalSettings(prev => ({
      ...prev,
      [device]: { ...prev[device], dominoThickness: clampedThickness }
    }));
  };

  // Hard slam mode state
  const [hardSlamMode, setHardSlamMode] = useState(false);
  const hardSlamRef = useRef(false);

  // Toggle hard slam mode
  const toggleHardSlamMode = () => {
    setHardSlamMode(prev => {
      const newValue = !prev;
      hardSlamRef.current = newValue; // Update ref immediately
      console.log('🔥 toggleHardSlamMode called - changing from', prev, 'to', newValue);
      return newValue;
    });
  };

  // Disarm hard slam mode (only turn off, don't toggle)
  const disarmHardSlam = () => {
    console.log('🔥 disarmHardSlam called - setting to false');
    setHardSlamMode(false);
    hardSlamRef.current = false; // Update ref immediately
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
    updateShakeIntensity,
    updateShakeDuration,
    updateDominoWidth,
    updateDominoHeight,
    updateDominoThickness,
    applyLiveUpdate,
    resetToDefaults,
    getSettingsForDevice,
    // Animation controls
    isAnimating,
    animationMode,
    pendingShake,
    hardSlamMode,
    hardSlamRef, // Export the ref so it can be accessed
    toggleHardSlamMode,
    disarmHardSlam,
    startShakeAnimation,
    queueShakeAnimation,
    executePendingShake,
    startContinuousRotate,
    stopAnimation,
    applyOriginalRotations,
  };
};