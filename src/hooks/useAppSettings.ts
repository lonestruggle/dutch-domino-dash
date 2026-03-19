import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AppSetting {
  id: string;
  setting_key: string;
  setting_value: any;
  description?: string;
}

export const useAppSettings = () => {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*');

      if (error) throw error;

      const settingsMap = data.reduce((acc, setting) => {
        acc[setting.setting_key] = setting.setting_value;
        return acc;
      }, {} as Record<string, any>);

      setSettings(settingsMap);
    } catch (error) {
      console.error('Error loading app settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: string, value: any) => {
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert(
          {
            setting_key: key,
            setting_value: value,
          },
          { onConflict: 'setting_key' }
        );

      if (error) throw error;

      setSettings(prev => ({ ...prev, [key]: value }));
      return { success: true };
    } catch (error) {
      console.error('Error updating setting:', error);
      return { success: false, error };
    }
  };

  const getSetting = (key: string, defaultValue: any = null) => {
    return settings[key] ?? defaultValue;
  };

  return {
    settings,
    loading,
    updateSetting,
    getSetting,
    loadSettings
  };
};