import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

interface FavoriteTableBackground {
  id: string;
  user_id: string;
  background_url: string | null;
  created_at: string;
  updated_at: string;
}

export const useFavoriteTableBackground = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [favoriteBackground, setFavoriteBackground] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchFavoriteBackground = async () => {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError || !userData.user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_favorite_table_backgrounds')
        .select('*')
        .eq('user_id', userData.user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching favorite table background:', error);
        return;
      }

      setFavoriteBackground(data?.background_url || null);
    } catch (error) {
      console.error('Error in fetchFavoriteBackground:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFavoriteBackground();
  }, []);

  const setFavoriteTableBackground = async (backgroundUrl: string | null) => {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError || !userData.user) {
        toast({
          title: t('common.error'),
          description: t('favorites.loginRequired'),
          variant: "destructive",
        });
        return;
      }

      // Check if user already has a favorite
      const { data: existingFavorite } = await supabase
        .from('user_favorite_table_backgrounds')
        .select('id')
        .eq('user_id', userData.user.id)
        .maybeSingle();

      if (existingFavorite) {
        // Update existing favorite
        const { error } = await supabase
          .from('user_favorite_table_backgrounds')
          .update({ background_url: backgroundUrl })
          .eq('user_id', userData.user.id);

        if (error) throw error;
      } else {
        // Insert new favorite
        const { error } = await supabase
          .from('user_favorite_table_backgrounds')
          .insert({
            user_id: userData.user.id,
            background_url: backgroundUrl
          });

        if (error) throw error;
      }

      setFavoriteBackground(backgroundUrl);
      
      toast({
        title: t('common.success'),
        description: backgroundUrl 
          ? t('favorites.tableBackgroundSet')
          : t('favorites.tableBackgroundRemoved'),
      });

    } catch (error) {
      console.error('Error setting favorite table background:', error);
      toast({
        title: t('common.error'),
        description: t('favorites.setFailed'),
        variant: "destructive",
      });
    }
  };

  return {
    favoriteBackground,
    loading,
    setFavoriteTableBackground,
    refetch: fetchFavoriteBackground
  };
};