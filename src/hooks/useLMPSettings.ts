import { useEffect, useState } from 'react';

interface LMPSettingsState {
  enabled: boolean; // toggle LMP overlays on/off
}

const STORAGE_KEY = 'domino-lmp-settings-v1';

export function useLMPSettings() {
  const [settings, setSettings] = useState<LMPSettingsState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    // Default: LMP enabled and always visible behavior handled by consumer
    return { enabled: true };
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  const toggleEnabled = () => setSettings((s) => ({ ...s, enabled: !s.enabled }));

  return {
    enabled: settings.enabled,
    toggleEnabled,
    setEnabled: (val: boolean) => setSettings((s) => ({ ...s, enabled: val })),
  };
}
