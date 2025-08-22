import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Heart, HeartOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCustomBackgrounds } from '@/hooks/useCustomBackgrounds';
import { useUserRoles } from '@/hooks/useUserRoles';
import { useFavoriteBackground } from '@/hooks/useFavoriteBackground';
import dominoTable1 from '@/assets/domino-table-1.webp';
import dominoTable2 from '@/assets/domino-table-2.webp';
const curacaoFlagTable = '/lovable-uploads/f85e0ba4-a21e-4716-b54c-d9c55efc9496.png';
const premiumWoodTable = '/lovable-uploads/06c1799a-c59e-44f8-8d9c-3cc8d671f4c2.png';

interface BackgroundOption {
  id: string;
  name: string;
  image: string;
}

const defaultBackgroundOptions: BackgroundOption[] = [
  { id: 'domino-table-1', name: 'Mahonie Tafel', image: dominoTable1 },
  { id: 'domino-table-2', name: 'Walnoot Tafel', image: dominoTable2 },
  { id: 'curacao-flag-table', name: 'Antiliaanse Vlag', image: curacaoFlagTable },
  { id: 'premium-wood-table', name: 'Premium Hout Tafel', image: premiumWoodTable },
];

interface BackgroundSelectorProps {
  selectedBackground: string;
  onBackgroundChange: (backgroundId: string) => void;
  disabled?: boolean;
}

export const BackgroundSelector: React.FC<BackgroundSelectorProps> = ({
  selectedBackground,
  onBackgroundChange,
  disabled = false
}) => {
  const { backgrounds: customBackgrounds, loading } = useCustomBackgrounds();
  const { isAdmin, isModerator } = useUserRoles();
  const { favoriteBackground, setFavoriteBackground } = useFavoriteBackground();
  const [allBackgrounds, setAllBackgrounds] = useState<BackgroundOption[]>(defaultBackgroundOptions);

  // Set the selected background to favorite on load if no background is selected
  useEffect(() => {
    if (favoriteBackground && !selectedBackground) {
      onBackgroundChange(favoriteBackground);
    }
  }, [favoriteBackground, selectedBackground, onBackgroundChange]);

  const handleFavoriteToggle = async (backgroundId: string) => {
    if (favoriteBackground === backgroundId) {
      await setFavoriteBackground(null);
    } else {
      await setFavoriteBackground(backgroundId);
    }
  };

  useEffect(() => {
    if (loading) return;

    const checkPermissions = async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      // Get user-specific permissions
      const { data: permissions, error: permError } = await supabase
        .from('background_user_permissions')
        .select('background_id, can_use')
        .eq('user_id', user.user.id);

      if (permError) {
        console.error('Error fetching permissions:', permError);
      }

      const permissionsMap = new Map(
        permissions?.map(p => [p.background_id, p.can_use]) || []
      );

      // Filter custom backgrounds based on user permissions
      const availableCustomBackgrounds = customBackgrounds
        .filter(bg => {
          if (!bg.is_active) return false;
          
          // Check user-specific permissions first
          const userPermission = permissionsMap.get(bg.id);
          if (userPermission !== undefined) {
            return userPermission; // Use explicit permission
          }
          
          // Fall back to role-based permissions
          if (bg.permission_level === 'user') return true;
          if (bg.permission_level === 'moderator') return isModerator || isAdmin;
          if (bg.permission_level === 'admin') return isAdmin;
          
          return false;
        })
        .map(bg => ({
          id: bg.id,
          name: bg.name,
          image: bg.image_url
        }));

      setAllBackgrounds([...defaultBackgroundOptions, ...availableCustomBackgrounds]);
    };

    checkPermissions();
  }, [customBackgrounds, loading, isAdmin, isModerator]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Tafelblad Achtergrond</CardTitle>
        <p className="text-sm text-muted-foreground">
          Kies de achtergrond voor het spelbord
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {allBackgrounds.map((option) => (
            <div key={option.id} className="relative">
              <Button
                variant="outline"
                className={`relative h-20 p-2 overflow-hidden w-full ${
                  selectedBackground === option.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => !disabled && onBackgroundChange(option.id)}
                disabled={disabled}
              >
                <div 
                  className="absolute inset-2 rounded bg-cover bg-center opacity-70"
                  style={{ 
                    backgroundImage: `url(${option.image})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                />
                <div className="relative z-10 flex flex-col items-center justify-center h-full bg-black/40 rounded text-white text-xs font-medium">
                  <span>{option.name}</span>
                  {selectedBackground === option.id && (
                    <Check className="h-4 w-4 mt-1" />
                  )}
                </div>
              </Button>
              
              {/* Favorite Toggle Button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 p-0 bg-black/50 hover:bg-black/70 text-white z-20"
                onClick={(e) => {
                  e.stopPropagation();
                  handleFavoriteToggle(option.id);
                }}
                disabled={disabled}
              >
                {favoriteBackground === option.id ? (
                  <Heart className="h-3 w-3 fill-red-500 text-red-500" />
                ) : (
                  <HeartOff className="h-3 w-3" />
                )}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};