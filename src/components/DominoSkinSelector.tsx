import { useDominoSkins, skinBackgroundStyle } from '@/hooks/useDominoSkins';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface DominoSkinSelectorProps {
  selectedSkinId: string | null;
  onSelect: (skinId: string | null) => void;
}

export function DominoSkinSelector({ selectedSkinId, onSelect }: DominoSkinSelectorProps) {
  const { skins, loading } = useDominoSkins();

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-white/90">Domino skin (achterkant)</div>
      {loading ? (
        <div className="flex items-center gap-2 text-white/70 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Skins laden...
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {skins.map((skin) => {
            const active = selectedSkinId === skin.id;
            return (
              <button
                key={skin.id}
                type="button"
                onClick={() => onSelect(active ? null : skin.id)}
                className={cn(
                  'group flex flex-col items-center gap-1 p-2 rounded-lg border transition-all',
                  active
                    ? 'border-yellow-400 ring-2 ring-yellow-400 bg-white/10'
                    : 'border-white/20 hover:border-white/50 bg-white/5',
                )}
                aria-pressed={active}
              >
                <div
                  className="w-full h-10 rounded-md border border-black/40 overflow-hidden"
                  style={{
                    ...skinBackgroundStyle(skin),
                    boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.15), inset 0 -2px 3px rgba(0,0,0,0.35)',
                  }}
                />
                <span className="text-[11px] text-white/80 truncate max-w-full">{skin.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}