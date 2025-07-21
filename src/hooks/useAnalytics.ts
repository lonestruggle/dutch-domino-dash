import { useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export const useAnalytics = () => {
  const { user } = useAuth();

  const trackEvent = useCallback(async (
    eventType: string, 
    eventData?: any,
    skipUserCheck = false
  ) => {
    // Don't track events if user is not logged in (unless specifically allowed)
    if (!skipUserCheck && !user) return;

    try {
      const { error } = await supabase
        .from('analytics')
        .insert({
          user_id: user?.id || null,
          event_type: eventType,
          event_data: eventData ? JSON.stringify(eventData) : null,
          ip_address: null, // We could add IP tracking later if needed
          user_agent: navigator.userAgent,
        });

      if (error) {
        console.error('Analytics tracking error:', error);
      }
    } catch (error) {
      console.error('Analytics error:', error);
    }
  }, [user]);

  const trackPageView = useCallback((pageName: string) => {
    trackEvent('page_view', { page: pageName }, true); // Allow tracking even without user
  }, [trackEvent]);

  const trackGameEvent = useCallback((gameEvent: string, gameData?: any) => {
    trackEvent(`game_${gameEvent}`, gameData);
  }, [trackEvent]);

  const trackUserAction = useCallback((action: string, actionData?: any) => {
    trackEvent(`user_${action}`, actionData);
  }, [trackEvent]);

  return {
    trackEvent,
    trackPageView,
    trackGameEvent,
    trackUserAction,
  };
};