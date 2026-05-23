import { useUserRoles } from '@/hooks/useUserRoles';
import { useGameVersion, type GameVersion } from '@/hooks/useGameVersion';
import { useAppSettings } from '@/hooks/useAppSettings';
import { cn } from '@/lib/utils';

/**
 * Kleine floating toggle rechtsboven om tussen stable (backup) en beta
 * (huidige physics-experimenten) te schakelen. Alleen zichtbaar voor
 * admin/dev. Keuze wordt in localStorage opgeslagen.
 */
export const GameVersionToggle = () => {
  const { canAccessDevTools, loading } = useUserRoles();
  const { version, setVersion } = useGameVersion();
  const { getSetting, loading: settingsLoading } = useAppSettings();

  if (loading || settingsLoading) return null;
  const betaForPlayers = getSetting('beta_available_to_players') === true;
  if (!canAccessDevTools && !betaForPlayers) return null;

  const choose = (v: GameVersion) => {
    if (v === version) return;
    setVersion(v);
    // Hard reload om alle state schoon te herstarten.
    window.location.reload();
  };

  return (
    <div className="fixed top-2 right-2 z-[9999] flex items-center gap-1 rounded-md border border-border bg-background/90 px-2 py-1 text-xs shadow-md backdrop-blur">
      <span className="text-muted-foreground mr-1">Versie:</span>
      {(['stable', 'beta'] as GameVersion[]).map((v) => (
        <button
          key={v}
          onClick={() => choose(v)}
          className={cn(
            'rounded px-2 py-0.5 font-medium transition-colors',
            version === v
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/70'
          )}
        >
          {v}
        </button>
      ))}
    </div>
  );
};