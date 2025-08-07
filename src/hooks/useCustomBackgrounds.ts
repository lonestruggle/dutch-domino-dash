import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CustomBackground {
  id: string;
  name: string;
  description: string | null;
  image_url: string;
  permission_level: 'admin' | 'moderator' | 'user';
  is_active: boolean;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export const useCustomBackgrounds = () => {
  console.log('useCustomBackgrounds hook starting...');
  const [backgrounds, setBackgrounds] = useState<CustomBackground[]>([]);
  const [loading, setLoading] = useState(true);
  
  console.log('useCustomBackgrounds initial state set');

  const fetchBackgrounds = async () => {
    console.log('fetchBackgrounds called');
    try {
      const { data, error } = await supabase
        .from('custom_backgrounds')
        .select('*')
        .order('created_at', { ascending: false });

      console.log('Backgrounds fetch result:', { data, error });

      if (error) throw error;

      setBackgrounds((data || []).map(bg => ({
        ...bg,
        permission_level: bg.permission_level as 'admin' | 'moderator' | 'user'
      })));
    } catch (error) {
      console.error('Error fetching custom backgrounds:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackgrounds();
  }, []);

  const refetch = () => {
    setLoading(true);
    fetchBackgrounds();
  };

  return {
    backgrounds,
    loading,
    refetch
  };
};