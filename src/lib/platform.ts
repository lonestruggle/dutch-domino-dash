// Detectie of de app in de desktop-versie (Electron) draait.
// De Electron user agent bevat "Electron/<versie>".
export const IS_DESKTOP =
  typeof window !== 'undefined' && /Electron/i.test(navigator.userAgent || '');

// Actueel online/offline moment (navigator.onLine kan wisselen tijdens het spel).
export const isOfflineNow = (): boolean =>
  typeof navigator !== 'undefined' && navigator.onLine === false;
