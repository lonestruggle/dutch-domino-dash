import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import dominoTable1 from '@/assets/domino-table-1.webp';
import dominoTable2 from '@/assets/domino-table-2.webp';
import dominoTable3 from '@/assets/domino-table-3.webp';

interface BackgroundOption {
  id: string;
  name: string;
  image: string;
}

const backgroundOptions: BackgroundOption[] = [
  { id: 'domino-table-1', name: 'Mahonie Tafel', image: dominoTable1 },
  { id: 'domino-table-2', name: 'Walnoot Tafel', image: dominoTable2 },
  { id: 'domino-table-3', name: 'Eiken Tafel', image: dominoTable3 },
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
          {backgroundOptions.map((option) => (
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