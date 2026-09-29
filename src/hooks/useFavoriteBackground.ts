import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

export const useFavoriteBackground = () => {
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
        .from('user_favorite_backgrounds')
        .select('*')
        .eq('user_id', userData.user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching favorite background:', error);
        return;
      }

      setFavoriteBackground(data?.background_id || null);
    } catch (error) {
      console.error('Error in fetchFavoriteBackground:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFavoriteBackground();
  }, []);

  const setFavoriteBackgroundId = async (backgroundId: string | null) => {
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
        .from('user_favorite_backgrounds')
        .select('id')
        .eq('user_id', userData.user.id)
        .maybeSingle();

      if (existingFavorite) {
        if (backgroundId === null) {
          // Delete favorite
          const { error } = await supabase
            .from('user_favorite_backgrounds')
            .delete()
            .eq('user_id', userData.user.id);

          if (error) throw error;
        } else {
          // Update existing favorite
          const { error } = await supabase
            .from('user_favorite_backgrounds')
            .update({ background_id: backgroundId })
            .eq('user_id', userData.user.id);

          if (error) throw error;
        }
      } else if (backgroundId !== null) {
        // Insert new favorite
        const { error } = await supabase
          .from('user_favorite_backgrounds')
          .insert({
            user_id: userData.user.id,
            background_id: backgroundId
          });

        if (error) throw error;
      }

      setFavoriteBackground(backgroundId);
      
      toast({
        title: t('common.success'),
        description: backgroundId 
          ? t('favorites.backgroundSet')
          : t('favorites.backgroundRemoved'),
      });

    } catch (error) {
      console.error('Error setting favorite background:', error);
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
    setFavoriteBackground: setFavoriteBackgroundId,
    refetch: fetchFavoriteBackground
  };
};