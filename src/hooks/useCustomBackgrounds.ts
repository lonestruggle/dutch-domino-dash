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
  const [backgrounds, setBackgrounds] = useState<CustomBackground[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBackgrounds = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('custom_backgrounds')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setBackgrounds(data || []);
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