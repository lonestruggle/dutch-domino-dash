import { useEffect, useState, useCallback } from 'react';

export type GameVersion = 'stable' | 'beta';
const STORAGE_KEY = 'gameVersion';

const readInitial = (): GameVersion => {
  if (typeof window === 'undefined') return 'stable';
  try {
    const url = new URL(window.location.href);
    const param = url.searchParams.get('v');
    if (param === 'beta' || param === 'stable') {
      localStorage.setItem(STORAGE_KEY, param);
      return param;
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'beta' || stored === 'stable') return stored;
  } catch { /* ignore */ }
  return 'stable';
};

export const useGameVersion = () => {
  const [version, setVersionState] = useState<GameVersion>(readInitial);

  const setVersion = useCallback((v: GameVersion) => {
    try { localStorage.setItem(STORAGE_KEY, v); } catch { /* ignore */ }
    setVersionState(v);
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'beta' || e.newValue === 'stable')) {
        setVersionState(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return { version, setVersion };
};