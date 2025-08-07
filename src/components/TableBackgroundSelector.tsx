import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface TableBackground {
  id: string;
  name: string;
  background_url: string;
  is_active: boolean;
  created_at: string;
}

interface TableBackgroundSelectorProps {
  selectedTableBackground: string | null;
  onTableBackgroundChange: (backgroundUrl: string | null) => void;
  disabled?: boolean;
}

export const TableBackgroundSelector: React.FC<TableBackgroundSelectorProps> = ({
  selectedTableBackground,
  onTableBackgroundChange,
  disabled = false
}) => {
  const [backgrounds, setBackgrounds] = useState<TableBackground[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTableBackgrounds = async () => {
      try {
        const { data, error } = await supabase
          .from('table_background_settings')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setBackgrounds(data || []);
      } catch (error) {
        console.error('Error fetching table backgrounds:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTableBackgrounds();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tafel Achtergrond</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Laden...</p>
        </CardContent>
      </Card>
    );
  }

  if (backgrounds.length === 0) {
    return null; // Don't show if no backgrounds available
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Tafel Achtergrond</CardTitle>
        <p className="text-sm text-muted-foreground">
          Kies een speciale achtergrond voor achter de tafel (optioneel)
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {/* Default - geen speciale achtergrond */}
          <Button
            variant={selectedTableBackground === null ? "default" : "outline"}
            onClick={() => onTableBackgroundChange(null)}
            disabled={disabled}
            className="h-20 p-2 text-xs relative"
          >
            <div className="flex flex-col items-center gap-1">
              <div className="text-xs">Standaard</div>
              {selectedTableBackground === null && (
                <Check className="h-4 w-4 absolute top-1 right-1" />
              )}
            </div>
          </Button>

          {/* Custom backgrounds */}
          {backgrounds.map((background) => (
            <Button
              key={background.id}
              variant={selectedTableBackground === background.background_url ? "default" : "outline"}
              onClick={() => onTableBackgroundChange(background.background_url)}
              disabled={disabled}
              className="h-20 p-2 text-xs relative overflow-hidden"
              style={{
                backgroundImage: `url(${background.background_url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              <div className="absolute inset-0 bg-black/40" />
              <div className="relative z-10 flex flex-col items-center gap-1">
                <div className="text-xs text-white font-medium">
                  {background.name}
                </div>
                {selectedTableBackground === background.background_url && (
                  <Check className="h-4 w-4 text-white absolute top-1 right-1" />
                )}
              </div>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};