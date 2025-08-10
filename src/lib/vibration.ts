import { GameVisualSettings } from '@/hooks/useGameVisualSettings';

// Helper: get the latest settings (prefer param, then global window store)
const getLatestSettings = (settings?: GameVisualSettings): GameVisualSettings | null => {
  if (settings) return settings;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const globalSettings = (window as any).__dominoVibrationSettings as GameVisualSettings | undefined;
    if (globalSettings) return globalSettings;
  } catch {}
  return null;
};

// Applies the same vibration logic used by the Test Trillingen button to all
// board domino elements ('.domino-tile-board'). Automatically stops after the
// adjusted duration derived from the settings. If no settings passed, it will
// try the latest settings from window.__dominoVibrationSettings.
export const applyBoardVibration = (maybeSettings?: GameVisualSettings) => {
  try {
    const settings = getLatestSettings(maybeSettings);
    if (!settings) {
      console.warn('applyBoardVibration: no settings available');
      return;
    }

    const adjustedDuration = settings.hardSlamDuration + (settings.durationAdjustment * 0.5);
    const adjustedSpeed = settings.hardSlamSpeed + (settings.speedAdjustment * 0.01);

    const dominoes = document.querySelectorAll<HTMLElement>('.domino-tile-board');

    const enabledAnimations: string[] = [];
    if (settings.enableHorizontalVibration) enabledAnimations.push('dominoVibrate_horizontal');
    if (settings.enableLeftDiagonalVibration) enabledAnimations.push('dominoVibrate_left_diagonal');
    if (settings.enableRightDiagonalVibration) enabledAnimations.push('dominoVibrate_right_diagonal');
    if (settings.enableVerticalVibration) enabledAnimations.push('dominoVibrate_vertical');
    if (settings.enableSubtleVibration) enabledAnimations.push('dominoVibrate_subtle');
    if (settings.enableShakeVibration) enabledAnimations.push('dominoVibrate_shake');

    if (enabledAnimations.length === 0) {
      console.log('🧪 Geen trillingen actief - alle instellingen uit');
      return;
    }

    console.log(`💥 Applying board vibration to ${dominoes.length} dominoes. duration=${adjustedDuration}s speed=${adjustedSpeed}s`);

    dominoes.forEach((el) => {
      const randomAnimation = enabledAnimations[Math.floor(Math.random() * enabledAnimations.length)];
      // Direct inline animation, same as Test Trillingen
      el.style.animationName = randomAnimation;
      el.style.animationDuration = `${adjustedSpeed}s`;
      el.style.animationIterationCount = 'infinite';
      el.style.animationDirection = 'alternate';
      el.style.animationTimingFunction = 'ease-in-out';
    });

    // Auto stop after adjusted duration
    setTimeout(() => {
      dominoes.forEach((el) => {
        el.style.animation = '';
      });
      console.log('✅ Board vibration stopped');
    }, Math.max(50, adjustedDuration * 1000));
  } catch (e) {
    console.warn('Vibration apply failed:', e);
  }
};
