import { useEffect, useState } from 'react';

interface LMPSettingsState {
  enabled: boolean; // toggle LMP overlays on/off
  showEnds: boolean; // show regenerateOpenEnds overlays regardless of hand
}

const STORAGE_KEY = 'domino-lmp-settings-v1';

export function useLMPSettings() {
  const [settings, setSettings] = useState<LMPSettingsState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    // Default: LMP enabled and open-ends visible
    return { enabled: true, showEnds: true };
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  const toggleEnabled = () => setSettings((s) => ({ ...s, enabled: !s.enabled }));
  const toggleShowEnds = () => setSettings((s) => ({ ...s, showEnds: !s.showEnds }));

  return {
    enabled: settings.enabled,
    showEnds: settings.showEnds,
    toggleEnabled,
    toggleShowEnds,
    setEnabled: (val: boolean) => setSettings((s) => ({ ...s, enabled: val })),
    setShowEnds: (val: boolean) => setSettings((s) => ({ ...s, showEnds: val })),
  };
}
