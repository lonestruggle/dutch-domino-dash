import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { useCustomBackgrounds } from '@/hooks/useCustomBackgrounds';
import { useUserRoles } from '@/hooks/useUserRoles';
import dominoTable1 from '@/assets/domino-table-1.webp';
import dominoTable2 from '@/assets/domino-table-2.webp';
import dominoTable3 from '@/assets/domino-table-3.webp';
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
  { id: 'domino-table-3', name: 'Eiken Tafel', image: dominoTable3 },
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
  const [allBackgrounds, setAllBackgrounds] = useState<BackgroundOption[]>(defaultBackgroundOptions);

  useEffect(() => {
    if (loading) return;

    // Filter custom backgrounds based on user permissions
    const availableCustomBackgrounds = customBackgrounds
      .filter(bg => {
        if (!bg.is_active) return false;
        
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
            <Button
              key={option.id}
              variant="outline"
              className={`relative h-20 p-2 overflow-hidden ${
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
          ))}
        </div>
      </CardContent>
    </Card>
  );
};