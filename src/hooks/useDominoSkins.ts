import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DominoSkin {
  id: string;
  name: string;
  image_url: string | null;
  css_background: string | null;
  is_builtin: boolean;
  is_active: boolean;
}

export function useDominoSkins() {
  const [skins, setSkins] = useState<DominoSkin[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSkins = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('domino_skins')
      .select('*')
      .eq('is_active', true)
      .order('is_builtin', { ascending: false })
      .order('name', { ascending: true });
    if (!error && data) setSkins(data as DominoSkin[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchSkins();
  }, []);

  return { skins, loading, refetch: fetchSkins };
}

export function skinBackgroundStyle(skin?: { image_url?: string | null; css_background?: string | null } | null): React.CSSProperties {
  if (!skin) {
    return { background: 'linear-gradient(135deg,#1f2937 0%,#0f172a 100%)' };
  }
  if (skin.image_url) {
    return {
      backgroundImage: `url('${skin.image_url}')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }
  if (skin.css_background) {
    return { background: skin.css_background };
  }
  return { background: 'linear-gradient(135deg,#1f2937 0%,#0f172a 100%)' };
}