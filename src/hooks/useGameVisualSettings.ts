import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useDeviceType, DeviceType } from './useDeviceType';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { ShakeAnimationProfile } from '@/types/domino';

// Personal settings (per user)
export interface PersonalSettings {
  dominoScale: number; // 0.5 to 2.0 multiplier for board dominoes
  handDominoScale: number; // 0.5 to 2.0 multiplier for hand dominoes
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
  // Shake settings - GLOBAL FOR EVERYONE
  shakeIntensity: number; // 0.1 to 2.0 intensity multiplier
  shakeDuration: number; // 0.5 to 5.0 seconds
  // Domino dimensions - GLOBAL FOR EVERYONE
  dominoWidth: number; // 40 to 120 pixels
  dominoHeight: number; // 20 to 60 pixels  
  dominoThickness: number; // 4 to 16 pixels
  gloveScale: number; // 0.4 to 2.5 multiplier for place-hand animation
  hardSlamGloveScale: number; // 0.4 to 2.5 multiplier for hard-slam hand animation
  gloveImageUrl: string; // URL/path for glove image used in board hand animations
  gloveAlwaysVisible: boolean; // Keep glove visible on board
  glovePosX: number; // Persistent glove X position in percentages
  glovePosY: number; // Persistent glove Y position in percentages
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
};

const DEFAULT_TRULY_GLOBAL_SETTINGS: TrulyGlobalSettings = {
  rotationAmplitudeX: -10.6,
  rotationAmplitudeY: 84.7,
  rotationAmplitudeZ: 68.8,
};

const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  rotateX: -15.6,
  rotateY: 9.8,
  rotateZ: 65.5,
  rotationSpeed: 5,
  shakeIntensity: 0.6,
  shakeDuration: 0.6,
  dominoWidth: 64,
  dominoHeight: 32,
  dominoThickness: 8,
  gloveScale: 1.0,
  hardSlamGloveScale: 1.1,
  gloveImageUrl: '/glove-hand.svg',
  gloveAlwaysVisible: false,
  glovePosX: 82,
  glovePosY: 76,
};

const DEFAULT_SETTINGS: GameVisualSettings = {
  ...DEFAULT_PERSONAL_SETTINGS,
  ...DEFAULT_GLOBAL_SETTINGS,
  ...DEFAULT_TRULY_GLOBAL_SETTINGS,
};

const DEFAULT_DEVICE_PERSONAL_SETTINGS: DeviceSpecificPersonalSettings = {
  desktop: { dominoScale: 1.0, handDominoScale: 0.6 },
  tablet: { dominoScale: 0.9, handDominoScale: 0.5 },
  mobile: { dominoScale: 1.2, handDominoScale: 0.4 },
};

const DEFAULT_DEVICE_GLOBAL_SETTINGS: DeviceSpecificGlobalSettings = {
  desktop: { ...DEFAULT_GLOBAL_SETTINGS },
  tablet: { ...DEFAULT_GLOBAL_SETTINGS },
  mobile: { ...DEFAULT_GLOBAL_SETTINGS },
};

const normalizeSharedGloveImageUrl = (settings: DeviceSpecificGlobalSettings): DeviceSpecificGlobalSettings => {
  const desktopUrl = (settings.desktop?.gloveImageUrl || '').trim();
  const tabletUrl = (settings.tablet?.gloveImageUrl || '').trim();
  const mobileUrl = (settings.mobile?.gloveImageUrl || '').trim();
  const sharedGloveImageUrl =
    desktopUrl || tabletUrl || mobileUrl || DEFAULT_GLOBAL_SETTINGS.gloveImageUrl;

  return {
    desktop: { ...settings.desktop, gloveImageUrl: sharedGloveImageUrl },
    tablet: { ...settings.tablet, gloveImageUrl: sharedGloveImageUrl },
    mobile: { ...settings.mobile, gloveImageUrl: sharedGloveImageUrl },
  };
};

type GlobalAnimationPatch = Partial<Pick<GlobalSettings, 'rotateX' | 'rotateY' | 'rotateZ' | 'rotationSpeed' | 'shakeIntensity' | 'shakeDuration'>>;
type GloveVisualPatch = Partial<Pick<GlobalSettings, 'gloveScale' | 'hardSlamGloveScale' | 'gloveImageUrl' | 'gloveAlwaysVisible' | 'glovePosX' | 'glovePosY'>>;
type StartShakeOptions = boolean | {
  isOtherPlayerHardSlam?: boolean;
  profile?: ShakeAnimationProfile;
};

const createSeededRandom = (seed: number) => {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const normalizeGlobalAnimationSettings = (settings: DeviceSpecificGlobalSettings): DeviceSpecificGlobalSettings => {
  const source = settings.desktop || DEFAULT_DEVICE_GLOBAL_SETTINGS.desktop;
  const sharedAnimationValues: GlobalAnimationPatch = {
    rotateX: source.rotateX,
    rotateY: source.rotateY,
    rotateZ: source.rotateZ,
    rotationSpeed: source.rotationSpeed,
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

const clampNumber = (value: unknown, min: number, max: number, fallback: number): number => {
  const raw = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(min, Math.min(max, raw));
};

const normalizePersonalSettings = (input?: Partial<DeviceSpecificPersonalSettings> | null): DeviceSpecificPersonalSettings => {
  const normalizeDevice = (device: DeviceType): PersonalSettings => {
    const fallback = DEFAULT_DEVICE_PERSONAL_SETTINGS[device];
    const source = input?.[device] || {};
    return {
      dominoScale: clampNumber(source.dominoScale, 0.5, 2.0, fallback.dominoScale),
      handDominoScale: clampNumber(source.handDominoScale, 0.35, 1.2, fallback.handDominoScale),
    };
  };

  return {
    desktop: normalizeDevice('desktop'),
    tablet: normalizeDevice('tablet'),
    mobile: normalizeDevice('mobile'),
  };
};

const useGameVisualSettingsState = () => {
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
        const merged = normalizePersonalSettings({
          desktop: { ...DEFAULT_DEVICE_PERSONAL_SETTINGS.desktop, ...parsed.desktop },
          tablet: { ...DEFAULT_DEVICE_PERSONAL_SETTINGS.tablet, ...parsed.tablet },
          mobile: { ...DEFAULT_DEVICE_PERSONAL_SETTINGS.mobile, ...parsed.mobile },
        });
        console.log('🔧 Loaded personal settings:', merged);
        return merged;
      }
      console.log('🔧 No personal settings found, using defaults');
      return normalizePersonalSettings(DEFAULT_DEVICE_PERSONAL_SETTINGS);
    } catch {
      console.log('🔧 Error loading personal settings, using defaults');
      return normalizePersonalSettings(DEFAULT_DEVICE_PERSONAL_SETTINGS);
    }
  };
  
  const loadGlobalSettingsFromStorage = (): DeviceSpecificGlobalSettings => {
    try {
      const storageKey = getGlobalStorageKey();
      console.log('🌍 Loading GLOBAL settings with key:', storageKey);
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        const merged = normalizeGlobalSettings({
          desktop: { ...DEFAULT_DEVICE_GLOBAL_SETTINGS.desktop, ...parsed.desktop },
          tablet: { ...DEFAULT_DEVICE_GLOBAL_SETTINGS.tablet, ...parsed.tablet },
          mobile: { ...DEFAULT_DEVICE_GLOBAL_SETTINGS.mobile, ...parsed.mobile },
        });
        console.log('🌍 Loaded GLOBAL settings:', merged);
        return merged;
      }
      console.log('🌍 No global settings found, using defaults');
      return normalizeGlobalSettings(DEFAULT_DEVICE_GLOBAL_SETTINGS);
    } catch {
      console.log('🌍 Error loading global settings, using defaults');
      return normalizeGlobalSettings(DEFAULT_DEVICE_GLOBAL_SETTINGS);
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
    const clampedScale = Math.max(0.35, Math.min(1.2, scale));
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
        [targetDevice]: normalizePersonalSettings({
          ...prev,
          [targetDevice]: DEFAULT_DEVICE_PERSONAL_SETTINGS[targetDevice],
        })[targetDevice]
      }));
      setGlobalSettings(prev => normalizeGlobalAnimationSettings({
        ...prev,
        [targetDevice]: DEFAULT_DEVICE_GLOBAL_SETTINGS[targetDevice]
      }) as DeviceSpecificGlobalSettings);
    } else {
      setPersonalSettings(normalizePersonalSettings(DEFAULT_DEVICE_PERSONAL_SETTINGS));
      setGlobalSettings(normalizeGlobalSettings(DEFAULT_DEVICE_GLOBAL_SETTINGS));
      setTrulyGlobalSettings(DEFAULT_TRULY_GLOBAL_SETTINGS);
    }
  };
  const applyLiveUpdate = () => {
    // Trigger a re-render event
    const currentSettings = allSettings[deviceType];
    window.dispatchEvent(new CustomEvent('settingsUpdated', { 
      detail: { settings: currentSettings }
    }));
  };

  const getSettingsForDevice = (device: DeviceType) => {
    const raw = allSettings[device] || DEFAULT_DEVICE_SETTINGS[device];
    const normalizedPersonal = normalizePersonalSettings({
      [device]: {
        dominoScale: raw.dominoScale,
        handDominoScale: raw.handDominoScale,
      },
    } as Partial<DeviceSpecificPersonalSettings>)[device];
    const normalizedGlobal = normalizeGlobalSettings({
      [device]: raw as GlobalSettings,
    } as Partial<DeviceSpecificGlobalSettings>)[device];
    return { ...raw, ...normalizedPersonal, ...normalizedGlobal };
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

    restoreBoardDominoTransforms();
    
    console.log('🎬 ✅ Animation force stopped and cleaned up');
  };

  const getBoardDominoElements = (): HTMLElement[] => {
    let boardDominoes = Array.from(document.querySelectorAll<HTMLElement>('.domino-tile-board'));
    if (boardDominoes.length === 0) {
      boardDominoes = Array.from(document.querySelectorAll<HTMLElement>('.board-domino'));
    }

    return boardDominoes.sort((a, b) => {
      const aId = a.dataset.dominoId || '';
      const bId = b.dataset.dominoId || '';
      const aMatch = aId.match(/^d(\d+)$/);
      const bMatch = bId.match(/^d(\d+)$/);

      if (aMatch && bMatch) {
        return Number(aMatch[1]) - Number(bMatch[1]);
      }

      return aId.localeCompare(bId);
    });
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

  const restoreBoardDominoTransforms = () => {
    const boardDominoes = getBoardDominoElements();
    boardDominoes.forEach((domino: Element) => {
      const htmlDomino = domino as HTMLElement;
      const originalRotationZ = parseFloat(htmlDomino.dataset.originalRotation || '0');
      const currentTransform = htmlDomino.style.transform || '';
      const baseTransform = currentTransform.replace(/translate3d\([^)]*\)|rotateX\([^)]*\)|rotateY\([^)]*\)|rotateZ\([^)]*\)/g, '').trim();
      htmlDomino.style.transform = `${baseTransform} rotateX(0deg) rotateY(0deg) rotateZ(${originalRotationZ}deg)`.trim();
    });
  };

  const startShakeAnimation = (options?: StartShakeOptions) => {
    const normalizedOptions = typeof options === 'boolean'
      ? { isOtherPlayerHardSlam: options }
      : options;

    return startShakeAnimationDirectWithSettings(
      undefined,
      undefined,
      Boolean(normalizedOptions?.isOtherPlayerHardSlam),
      normalizedOptions?.profile
    );
  };

  const startShakeAnimationDirectWithSettings = async (
    forcedIntensity?: number,
    forcedDuration?: number,
    skipPermissionCheck = false,
    profile?: ShakeAnimationProfile
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
      intensity: forcedIntensity ?? profile?.intensity ?? sharedSettings.intensity,
      duration: forcedDuration ?? profile?.duration ?? sharedSettings.duration,
      rotationAmplitudeX: profile?.rotationAmplitudeX ?? sharedSettings.rotationAmplitudeX,
      rotationAmplitudeY: profile?.rotationAmplitudeY ?? sharedSettings.rotationAmplitudeY,
      rotationAmplitudeZ: profile?.rotationAmplitudeZ ?? sharedSettings.rotationAmplitudeZ,
      rotationSpeed: profile?.rotationSpeed ?? sharedSettings.rotationSpeed,
    };

    const boardDominoes = getBoardDominoElements();
    if (boardDominoes.length === 0) {
      return { success: false, message: "Geen domino's op het bord gevonden om te schudden." };
    }

    forceStopAnimation();

    setTimeout(() => {
      const allBoardDominoes = getBoardDominoElements();
      const randomSource = profile ? createSeededRandom(profile.seed) : Math.random;
      randomSeedsRef.current = Array.from({ length: allBoardDominoes.length }, () => randomSource() * 10000);

      setIsAnimating(true);
      setAnimationMode('shake');

      baseRotationRef.current = { X: 0, Y: 0, Z: 0 };
      const durationInMs = Math.max(0.1, shakeSettings.duration) * 1000;
      const syncedElapsedMs = profile?.startedAtMs ? Math.max(0, Date.now() - profile.startedAtMs) : 0;
      const initialElapsedMs = Math.min(syncedElapsedMs, durationInMs);
      startTimeRef.current = performance.now() - initialElapsedMs;
      const speedMultiplier = Math.max(0.1, shakeSettings.rotationSpeed);
      let shouldContinue = true;

      const animate = (timestamp: number) => {
        if (!startTimeRef.current || !shouldContinue) return;

        const elapsedTime = timestamp - startTimeRef.current;
        const progress = elapsedTime / durationInMs;

        if (progress < 1) {
          const decayFactor = Math.pow(1 - progress, 1.5);
          const animatedDominoes = getBoardDominoElements();

          animatedDominoes.forEach((domino: Element, index: number) => {
            const htmlDomino = domino as HTMLElement;
            const seed = randomSeedsRef.current[index] || (index * 1000);
            const phaseX = Math.sin(seed * 0.001) * 2 * Math.PI;
            const phaseY = Math.cos(seed * 0.001) * 2 * Math.PI;
            const phaseZ = Math.sin(seed * 0.002) * 2 * Math.PI;

            const waveX = Math.cos(elapsedTime * speedMultiplier * Math.PI / 1000 + phaseX);
            const waveY = Math.cos(elapsedTime * speedMultiplier * Math.PI / 1000 + phaseY);
            const waveZ = Math.cos(elapsedTime * speedMultiplier * Math.PI / 1000 + phaseZ);

            const amplitudeMultX = 0.5 + Math.sin(seed * 0.003);
            const amplitudeMultY = 0.5 + Math.cos(seed * 0.003);
            const amplitudeMultZ = 0.5 + Math.sin(seed * 0.004);

            const originalRotationZ = parseFloat(htmlDomino.dataset.originalRotation || '0');

            const rotateX = shakeSettings.rotationAmplitudeX * waveX * decayFactor * amplitudeMultX * shakeSettings.intensity;
            const rotateY = shakeSettings.rotationAmplitudeY * waveY * decayFactor * amplitudeMultY * shakeSettings.intensity;
            const rotateZ = originalRotationZ + (shakeSettings.rotationAmplitudeZ * waveZ * decayFactor * amplitudeMultZ * shakeSettings.intensity);

            const jitterX = (shakeSettings.intensity * 2.5) * Math.sin(elapsedTime * speedMultiplier * 0.015 + phaseX);
            const jitterY = (shakeSettings.intensity * 2.5) * Math.cos(elapsedTime * speedMultiplier * 0.015 + phaseY);

            const currentTransform = htmlDomino.style.transform || '';
            const baseTransform = currentTransform.replace(/translate3d\([^)]*\)|rotateX\([^)]*\)|rotateY\([^)]*\)|rotateZ\([^)]*\)/g, '').trim();
            htmlDomino.style.transform = `${baseTransform} translate3d(${jitterX}px, ${jitterY}px, 0) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg)`.trim();
          });

          animationRef.current.current = requestAnimationFrame(animate);
          return;
        }

        restoreBoardDominoTransforms();
        setIsAnimating(false);
        setAnimationMode(null);
      };

      animationRef.current.stopFunction = () => {
        shouldContinue = false;
        restoreBoardDominoTransforms();
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
    restoreBoardDominoTransforms();
    
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
    
    restoreBoardDominoTransforms();
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
    setGlobalSettings(prev => normalizeGlobalAnimationSettings({
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
    
    // Update base rotation reference for current device
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

  const applyGloveVisualPatch = (patch: GloveVisualPatch, targetDevice?: DeviceType) => {
    const device = targetDevice || deviceType;
    setGlobalSettings(prev => ({
      ...prev,
      [device]: { ...prev[device], ...patch },
    }));
  };

  const updateGloveScale = (scale: number, targetDevice?: DeviceType) => {
    const clampedScale = Math.max(0.4, Math.min(2.5, scale));
    applyGloveVisualPatch({ gloveScale: clampedScale }, targetDevice);
  };

  const updateHardSlamGloveScale = (scale: number, targetDevice?: DeviceType) => {
    const clampedScale = Math.max(0.4, Math.min(2.5, scale));
    applyGloveVisualPatch({ hardSlamGloveScale: clampedScale }, targetDevice);
  };

  const updateGloveImageUrl = (url: string, targetDevice?: DeviceType) => {
    const sanitized = (url || '').trim() || DEFAULT_GLOBAL_SETTINGS.gloveImageUrl;
    void targetDevice;
    setGlobalSettings(prev => normalizeSharedGloveImageUrl({
      desktop: { ...prev.desktop, gloveImageUrl: sanitized },
      tablet: { ...prev.tablet, gloveImageUrl: sanitized },
      mobile: { ...prev.mobile, gloveImageUrl: sanitized },
    }));
  };

  const updateGloveAlwaysVisible = (alwaysVisible: boolean, targetDevice?: DeviceType) => {
    applyGloveVisualPatch({ gloveAlwaysVisible: Boolean(alwaysVisible) }, targetDevice);
  };

  const updateGlovePosition = (xPercent: number, yPercent: number, targetDevice?: DeviceType) => {
    const clampedX = Math.max(0, Math.min(100, Number.isFinite(xPercent) ? xPercent : DEFAULT_GLOBAL_SETTINGS.glovePosX));
    const clampedY = Math.max(0, Math.min(100, Number.isFinite(yPercent) ? yPercent : DEFAULT_GLOBAL_SETTINGS.glovePosY));
    applyGloveVisualPatch({ glovePosX: clampedX, glovePosY: clampedY }, targetDevice);
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
    hardSlamRef.current = false; // Update ref immediately
  };

  return {
    settings,
    allSettings,
    currentDeviceType: deviceType,
    updateDominoScale,
    updateHandDominoScale,
    updateRotation,
    updateRotationSpeed,
    updateRotationAmplitude,
    updateShakeIntensity,
    updateShakeDuration,
    updateDominoWidth,
    updateDominoHeight,
    updateDominoThickness,
    updateGloveScale,
    updateHardSlamGloveScale,
    updateGloveImageUrl,
    updateGloveAlwaysVisible,
    updateGlovePosition,
    applyLiveUpdate,
    resetToDefaults,
    getSettingsForDevice,
    // Animation controls
    isAnimating,
    animationMode,
    hardSlamMode,
    hardSlamRef, // Export the ref so it can be accessed
    toggleHardSlamMode,
    disarmHardSlam,
    startShakeAnimation,
    startContinuousRotate,
    stopAnimation,
    applyOriginalRotations,
  };
};

type GameVisualSettingsContextValue = ReturnType<typeof useGameVisualSettingsState>;

const GameVisualSettingsContext = createContext<GameVisualSettingsContextValue | null>(null);

export const GameVisualSettingsProvider = ({ children }: { children: React.ReactNode }) => {
  const value = useGameVisualSettingsState();
  return React.createElement(GameVisualSettingsContext.Provider, { value }, children);
};

export const useGameVisualSettings = () => {
  const context = useContext(GameVisualSettingsContext);
  if (!context) {
    throw new Error('useGameVisualSettings must be used within GameVisualSettingsProvider');
  }
  return context;
};