import { useState, useEffect, useRef } from 'react';
import { useDeviceType, DeviceType } from './useDeviceType';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

// Personal settings (per user)
export interface PersonalSettings {
  dominoScale: number; // 0.5 to 2.0 multiplier for board dominoes
  handDominoScale: number; // 0.5 to 2.0 multiplier for hand dominoes
  durationAdjustment: number; // -5 to +5, each step = 0.5s
  speedAdjustment: number; // -300 to +300ms, each step = 10ms
}

// Truly global settings (SAME for ALL devices and users - stored once)
export interface TrulyGlobalSettings {
  // Hard slam amplitude settings - SAME FOR ALL DEVICES
  rotationAmplitudeX: number; // -500 to 500 degrees
  rotationAmplitudeY: number; // -500 to 500 degrees
  rotationAmplitudeZ: number; // -500 to 500 degrees
}

// Global settings (same for everyone but per device)
export interface GlobalSettings {
  // 3D Rotation settings - GLOBAL FOR EVERYONE
  rotateX: number; // -90 to 90 degrees
  rotateY: number; // -90 to 90 degrees  
  rotateZ: number; // -90 to 90 degrees
  // Animation settings - GLOBAL FOR EVERYONE
  rotationSpeed: number; // 0.1 to 10x speed
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
export interface GameVisualSettings extends PersonalSettings, GlobalSettings, TrulyGlobalSettings {}

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

const DEFAULT_TRULY_GLOBAL_SETTINGS: TrulyGlobalSettings = {
  rotationAmplitudeX: 200, // Higher default for better visibility on all devices
  rotationAmplitudeY: 200, // Higher default for better visibility on all devices
  rotationAmplitudeZ: 100, // Add Z rotation for more dramatic effect
};

const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  rotateX: 0,
  rotateY: 0,
  rotateZ: 0,
  rotationSpeed: 5,
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
  ...DEFAULT_TRULY_GLOBAL_SETTINGS,
};

const DEFAULT_DEVICE_PERSONAL_SETTINGS: DeviceSpecificPersonalSettings = {
  desktop: { dominoScale: 1.0, handDominoScale: 0.6, durationAdjustment: 0, speedAdjustment: 0 },
  tablet: { dominoScale: 0.9, handDominoScale: 0.5, durationAdjustment: 0, speedAdjustment: 0 },
  mobile: { dominoScale: 1.2, handDominoScale: 0.4, durationAdjustment: 0, speedAdjustment: 0 },
};

const DEFAULT_DEVICE_GLOBAL_SETTINGS: DeviceSpecificGlobalSettings = {
  desktop: { ...DEFAULT_GLOBAL_SETTINGS },
  tablet: { ...DEFAULT_GLOBAL_SETTINGS },
  mobile: { ...DEFAULT_GLOBAL_SETTINGS },
};

type GlobalAnimationPatch = Partial<Pick<GlobalSettings, 'rotateX' | 'rotateY' | 'rotateZ' | 'rotationSpeed' | 'animationDuration' | 'shakeIntensity' | 'shakeDuration'>>;

const normalizeGlobalAnimationSettings = (settings: DeviceSpecificGlobalSettings): DeviceSpecificGlobalSettings => {
  const source = settings.desktop || DEFAULT_DEVICE_GLOBAL_SETTINGS.desktop;
  const sharedAnimationValues: GlobalAnimationPatch = {
    rotateX: source.rotateX,
    rotateY: source.rotateY,
    rotateZ: source.rotateZ,
    rotationSpeed: source.rotationSpeed,
    animationDuration: source.animationDuration,
    shakeIntensity: source.shakeIntensity,
    shakeDuration: source.shakeDuration,
  };

  return {
    desktop: { ...settings.desktop, ...sharedAnimationValues },
    tablet: { ...settings.tablet, ...sharedAnimationValues },
    mobile: { ...settings.mobile, ...sharedAnimationValues },
  };
};

const DEFAULT_DEVICE_SETTINGS: DeviceSpecificSettings = {
  desktop: { ...DEFAULT_DEVICE_PERSONAL_SETTINGS.desktop, ...DEFAULT_DEVICE_GLOBAL_SETTINGS.desktop, ...DEFAULT_TRULY_GLOBAL_SETTINGS },
  tablet: { ...DEFAULT_DEVICE_PERSONAL_SETTINGS.tablet, ...DEFAULT_DEVICE_GLOBAL_SETTINGS.tablet, ...DEFAULT_TRULY_GLOBAL_SETTINGS },
  mobile: { ...DEFAULT_DEVICE_PERSONAL_SETTINGS.mobile, ...DEFAULT_DEVICE_GLOBAL_SETTINGS.mobile, ...DEFAULT_TRULY_GLOBAL_SETTINGS },
};

export const useGameVisualSettings = () => {
  const deviceType = useDeviceType();
  const { user } = useAuth();
  
  // Separate storage for personal, global and truly global settings
  const getPersonalStorageKey = () => {
    const userId = user?.id || 'anonymous';
    return `domino-personal-settings-v3-${userId}`;
  };
  
  const getGlobalStorageKey = () => {
    return `domino-global-settings-v3`; // No user ID - same for everyone
  };

  const getTrulyGlobalStorageKey = () => {
    return `domino-truly-global-settings-v1`; // SAME for ALL devices and users
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
        const merged = normalizeGlobalAnimationSettings({
          desktop: { ...DEFAULT_DEVICE_GLOBAL_SETTINGS.desktop, ...parsed.desktop },
          tablet: { ...DEFAULT_DEVICE_GLOBAL_SETTINGS.tablet, ...parsed.tablet },
          mobile: { ...DEFAULT_DEVICE_GLOBAL_SETTINGS.mobile, ...parsed.mobile },
        });
        console.log('🌍 Loaded GLOBAL settings:', merged);
        return merged;
      }
      console.log('🌍 No global settings found, using defaults');
      return normalizeGlobalAnimationSettings(DEFAULT_DEVICE_GLOBAL_SETTINGS);
    } catch {
      console.log('🌍 Error loading global settings, using defaults');
      return normalizeGlobalAnimationSettings(DEFAULT_DEVICE_GLOBAL_SETTINGS);
    }
  };

  const loadTrulyGlobalSettingsFromStorage = (): TrulyGlobalSettings => {
    try {
      const storageKey = getTrulyGlobalStorageKey();
      console.log('🌎 Loading TRULY GLOBAL settings with key:', storageKey);
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        const merged = { ...DEFAULT_TRULY_GLOBAL_SETTINGS, ...parsed };
        console.log('🌎 Loaded TRULY GLOBAL settings:', merged);
        return merged;
      }
      console.log('🌎 No truly global settings found, using defaults');
      return DEFAULT_TRULY_GLOBAL_SETTINGS;
    } catch {
      console.log('🌎 Error loading truly global settings, using defaults');
      return DEFAULT_TRULY_GLOBAL_SETTINGS;
    }
  };
  
  const combineSettings = (personal: DeviceSpecificPersonalSettings, global: DeviceSpecificGlobalSettings, trulyGlobal: TrulyGlobalSettings): DeviceSpecificSettings => {
    return {
      desktop: { ...personal.desktop, ...global.desktop, ...trulyGlobal },
      tablet: { ...personal.tablet, ...global.tablet, ...trulyGlobal },
      mobile: { ...personal.mobile, ...global.mobile, ...trulyGlobal },
    };
  };
  
  const [personalSettings, setPersonalSettings] = useState<DeviceSpecificPersonalSettings>(loadPersonalSettingsFromStorage);
  const [globalSettings, setGlobalSettings] = useState<DeviceSpecificGlobalSettings>(loadGlobalSettingsFromStorage);
  const [trulyGlobalSettings, setTrulyGlobalSettings] = useState<TrulyGlobalSettings>(loadTrulyGlobalSettingsFromStorage);
  
  // Combine personal, global and truly global settings
  const allSettings = combineSettings(personalSettings, globalSettings, trulyGlobalSettings);
  
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

  // Load truly global settings once (same for ALL devices and users)
  useEffect(() => {
    const newTrulyGlobalSettings = loadTrulyGlobalSettingsFromStorage();
    setTrulyGlobalSettings(newTrulyGlobalSettings);
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

  // Save truly global settings
  useEffect(() => {
    try {
      const storageKey = getTrulyGlobalStorageKey();
      localStorage.setItem(storageKey, JSON.stringify(trulyGlobalSettings));
      console.log('🌎💾 Saved TRULY GLOBAL settings:', trulyGlobalSettings);
    } catch (error) {
      console.warn('Failed to save truly global settings:', error);
    }
  }, [trulyGlobalSettings]);

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
        
        // Force save current truly global settings
        const trulyGlobalKey = getTrulyGlobalStorageKey();
        localStorage.setItem(trulyGlobalKey, JSON.stringify(trulyGlobalSettings));
        
        console.log('💾 Force saved all settings to localStorage');
      } catch (error) {
        console.error('Failed to force save settings:', error);
      }
    };

    window.addEventListener('forceSettingsSave', handleForceSave as EventListener);
    return () => {
      window.removeEventListener('forceSettingsSave', handleForceSave as EventListener);
    };
  }, [personalSettings, globalSettings, trulyGlobalSettings, user?.id]);

  // Broadcast and apply live visual settings globally on any change
  useEffect(() => {
    const currentSettings = allSettings[deviceType];
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__dominoSettings = currentSettings;
    } catch (error) {
      void error;
    }

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
      setGlobalSettings(prev => normalizeGlobalAnimationSettings({
        ...prev,
        [targetDevice]: DEFAULT_DEVICE_GLOBAL_SETTINGS[targetDevice]
      }));
    } else {
      setPersonalSettings(DEFAULT_DEVICE_PERSONAL_SETTINGS);
      setGlobalSettings(normalizeGlobalAnimationSettings(DEFAULT_DEVICE_GLOBAL_SETTINGS));
      setTrulyGlobalSettings(DEFAULT_TRULY_GLOBAL_SETTINGS);
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
    return allSettings[device] || DEFAULT_DEVICE_SETTINGS[device];
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

  const getBoardDominoElements = () => {
    let boardDominoes = document.querySelectorAll('.domino-tile-board');
    if (boardDominoes.length === 0) boardDominoes = document.querySelectorAll('.board-domino');
    if (boardDominoes.length === 0) boardDominoes = document.querySelectorAll('.domino-tile');
    return boardDominoes;
  };

  const getSharedAnimationSettings = () => {
    const currentSettings = getSettingsForDevice(deviceType);
    return {
      intensity: currentSettings.shakeIntensity,
      duration: currentSettings.shakeDuration,
      rotationAmplitudeX: currentSettings.rotationAmplitudeX,
      rotationAmplitudeY: currentSettings.rotationAmplitudeY,
      rotationAmplitudeZ: currentSettings.rotationAmplitudeZ,
      rotationSpeed: currentSettings.rotationSpeed,
    };
  };

  // Queue shake to execute after domino placement
  const queueShakeAnimation = () => {
    setPendingShake(true);
    return { success: true, message: "Shake ingepland na volgende zet" };
  };

  // Execute pending shake (called after domino placement)
  const executePendingShake = () => {
    if (!pendingShake) {
      return { success: false, message: "Geen ingeplande shake om uit te voeren." };
    }

    setPendingShake(false);
    return startShakeAnimationDirectWithSettings();
  };

  const startShakeAnimation = (isOtherPlayerHardSlam = false) => {
    // Hard Slam from another player should always play, regardless of local permissions.
    return startShakeAnimationDirectWithSettings(undefined, undefined, isOtherPlayerHardSlam);
  };

  const startShakeAnimationDirectWithSettings = async (
    forcedIntensity?: number,
    forcedDuration?: number,
    skipPermissionCheck = false
  ) => {
    if (isAnimating) {
      forceStopAnimation();
    }

    if (!skipPermissionCheck && user?.id) {
      try {
        const { data: permissions } = await supabase
          .from('user_permissions')
          .select('can_hard_slam')
          .eq('user_id', user.id)
          .maybeSingle();

        if (permissions && !permissions.can_hard_slam) {
          return { success: false, message: "Je hebt geen toestemming om te schudden. Neem contact op met een beheerder." };
        }
      } catch (error) {
        console.error('Error checking permissions:', error);
      }
    }

    const sharedSettings = getSharedAnimationSettings();
    const shakeSettings = {
      intensity: forcedIntensity ?? sharedSettings.intensity,
      duration: forcedDuration ?? sharedSettings.duration,
      rotationAmplitudeX: sharedSettings.rotationAmplitudeX,
      rotationAmplitudeY: sharedSettings.rotationAmplitudeY,
      rotationAmplitudeZ: sharedSettings.rotationAmplitudeZ,
      rotationSpeed: sharedSettings.rotationSpeed,
    };

    if (
      shakeSettings.rotationAmplitudeX === 0 &&
      shakeSettings.rotationAmplitudeY === 0 &&
      shakeSettings.rotationAmplitudeZ === 0
    ) {
      return { success: false, message: "Schud-amplitude staat op 0°. Verhoog amplitude om Hard Slam zichtbaar te maken." };
    }

    const boardDominoes = getBoardDominoElements();
    if (boardDominoes.length === 0) {
      setPendingShake(false);
      return { success: false, message: "Geen domino's op het bord gevonden om te schudden." };
    }

    forceStopAnimation();

    setTimeout(() => {
      const allBoardDominoes = getBoardDominoElements();
      randomSeedsRef.current = Array.from({ length: allBoardDominoes.length }, () => Math.random() * 10000);

      setIsAnimating(true);
      setAnimationMode('shake');

      baseRotationRef.current = { X: 0, Y: 0, Z: 0 };
      startTimeRef.current = performance.now();
      const durationInMs = Math.max(0.1, shakeSettings.duration) * 1000;
      const speedMultiplier = Math.max(0.1, shakeSettings.rotationSpeed);
      let shouldContinue = true;

      const animate = (timestamp: number) => {
        if (!startTimeRef.current || !shouldContinue) return;

        const elapsedTime = timestamp - startTimeRef.current;
        const progress = elapsedTime / durationInMs;

        if (progress < 1) {
          const wave = Math.cos(elapsedTime * speedMultiplier * Math.PI / 1000);
          const decayFactor = Math.pow(1 - progress, 1.5);

          const animatedDominoes = getBoardDominoElements();
          animatedDominoes.forEach((domino: Element, index: number) => {
            const htmlDomino = domino as HTMLElement;
            const seed = randomSeedsRef.current[index] || (index * 1000);
            const randomPhaseX = Math.sin(seed * 0.001) * 2 * Math.PI;
            const randomPhaseY = Math.cos(seed * 0.001) * 2 * Math.PI;
            const randomPhaseZ = Math.sin(seed * 0.002) * 2 * Math.PI;

            const waveX = Math.cos(elapsedTime * speedMultiplier * Math.PI / 1000 + randomPhaseX);
            const waveY = Math.cos(elapsedTime * speedMultiplier * Math.PI / 1000 + randomPhaseY);
            const waveZ = Math.cos(elapsedTime * speedMultiplier * Math.PI / 1000 + randomPhaseZ);

            const amplitudeMultX = 0.5 + Math.sin(seed * 0.003);
            const amplitudeMultY = 0.5 + Math.cos(seed * 0.003);
            const amplitudeMultZ = 0.5 + Math.sin(seed * 0.004);

            const originalRotationZ = parseFloat(htmlDomino.dataset.originalRotation || '0');
            const individualX = baseRotationRef.current.X + (shakeSettings.rotationAmplitudeX * waveX * decayFactor * amplitudeMultX * shakeSettings.intensity);
            const individualY = baseRotationRef.current.Y + (shakeSettings.rotationAmplitudeY * waveY * decayFactor * amplitudeMultY * shakeSettings.intensity);
            const individualZ = baseRotationRef.current.Z + originalRotationZ + (shakeSettings.rotationAmplitudeZ * waveZ * decayFactor * amplitudeMultZ * shakeSettings.intensity);

            const currentTransform = htmlDomino.style.transform || '';
            const baseTransform = currentTransform.replace(/rotateX\([^)]*\)|rotateY\([^)]*\)|rotateZ\([^)]*\)/g, '').trim();
            htmlDomino.style.transform = `${baseTransform} rotateX(${individualX}deg) rotateY(${individualY}deg) rotateZ(${individualZ}deg)`.trim();
          });

          animationRef.current.current = requestAnimationFrame(animate);
          return;
        }

        setIsAnimating(false);
        setAnimationMode(null);
      };

      animationRef.current.stopFunction = () => {
        shouldContinue = false;
        setIsAnimating(false);
        setAnimationMode(null);
      };

      animationRef.current.current = requestAnimationFrame(animate);
    }, 50);

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
    const boardDominoes = document.querySelectorAll('.domino-tile-board');
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
        let boardDominoes = document.querySelectorAll('.domino-tile-board');
        if (boardDominoes.length === 0) {
          console.log('🔍 No .domino-tile-board found, trying .board-domino');
          boardDominoes = document.querySelectorAll('.board-domino');
        }
        if (boardDominoes.length === 0) {
          console.log('🔍 No .board-domino found, trying .domino-tile');
          boardDominoes = document.querySelectorAll('.domino-tile');
        }
        if (boardDominoes.length === 0) {
          console.log('🔍 No domino tiles found, trying [class*="domino"]');
          boardDominoes = document.querySelectorAll('[class*="domino"]');
        }
        console.log(`🎯 Found ${boardDominoes.length} domino elements for animation`);
        
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
        let boardDominoes = document.querySelectorAll('.domino-tile-board');
        if (boardDominoes.length === 0) {
          boardDominoes = document.querySelectorAll('.board-domino');
        }
        if (boardDominoes.length === 0) {
          boardDominoes = document.querySelectorAll('.domino-tile');
        }
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
    // Don't apply rotations if we're animating or just finished animating
    if (isAnimating) {
      console.log('🚫 Skipping applyOriginalRotations - animation in progress');
      return;
    }
    
    const currentSettings = allSettings[deviceType];
    let boardDominoes = document.querySelectorAll('.domino-tile-board');
    if (boardDominoes.length === 0) {
      boardDominoes = document.querySelectorAll('.board-domino');
    }
    if (boardDominoes.length === 0) {
      boardDominoes = document.querySelectorAll('.domino-tile');
    }
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

  const applyGlobalAnimationPatch = (patch: GlobalAnimationPatch) => {
    setGlobalSettings(prev => ({
      desktop: { ...prev.desktop, ...patch },
      tablet: { ...prev.tablet, ...patch },
      mobile: { ...prev.mobile, ...patch },
    }));
  };

  const updateRotation = (axis: 'X' | 'Y' | 'Z', value: number, _targetDevice?: DeviceType) => {
    // Don't allow manual rotation during animation
    if (isAnimating) return;
    
    const clampedValue = Math.max(-90, Math.min(90, value));
    const property = `rotate${axis}` as 'rotateX' | 'rotateY' | 'rotateZ';
    
    applyGlobalAnimationPatch({ [property]: clampedValue });
    baseRotationRef.current[axis] = clampedValue;
  };

  const updateRotationSpeed = (speed: number, _targetDevice?: DeviceType) => {
    const clampedSpeed = Math.max(0.1, Math.min(10, speed));
    applyGlobalAnimationPatch({ rotationSpeed: clampedSpeed });
  };

  const updateRotationAmplitude = (axis: 'X' | 'Y' | 'Z', value: number) => {
    // ✅ NEW: Update truly global settings for ALL devices
    const clampedValue = Math.max(-1000, Math.min(1000, value));
    const property = `rotationAmplitude${axis}` as keyof TrulyGlobalSettings;
    
    console.log(`🌎 Updating ${property} to ${clampedValue} for ALL devices`);
    
    setTrulyGlobalSettings(prev => ({
      ...prev,
      [property]: clampedValue
    }));
  };

  const updateAnimationDuration = (duration: number, _targetDevice?: DeviceType) => {
    const clampedDuration = Math.max(0.1, Math.min(10, duration));
    applyGlobalAnimationPatch({ animationDuration: clampedDuration });
  };

  const updateShakeIntensity = (intensity: number, _targetDevice?: DeviceType) => {
    const clampedIntensity = Math.max(0.1, Math.min(2.0, intensity));
    applyGlobalAnimationPatch({ shakeIntensity: clampedIntensity });
  };

  const updateShakeDuration = (duration: number, _targetDevice?: DeviceType) => {
    const clampedDuration = Math.max(0.5, Math.min(5.0, duration));
    applyGlobalAnimationPatch({ shakeDuration: clampedDuration });
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
    console.log('🔥 disarmHardSlam called - resetting all shake states');
    setHardSlamMode(false);
    setPendingShake(false); // Also reset pending shake
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