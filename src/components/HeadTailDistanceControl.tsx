import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

interface HeadTailDistanceControlProps {
  distance: number;
  onDistanceChange: (distance: number) => void;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  currentOpenEnds: number;
  totalDominoes: number;
}

export const HeadTailDistanceControl: React.FC<HeadTailDistanceControlProps> = ({
  distance,
  onDistanceChange,
  enabled,
  onEnabledChange,
  currentOpenEnds,
  totalDominoes
}) => {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center justify-between">
          Kop-Staart Afstand
          <Badge variant={enabled ? "default" : "secondary"}>
            {enabled ? "Actief" : "Uit"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor="head-tail-toggle" className="text-sm font-medium">
            Kop-Staart Bescherming
          </Label>
          <Switch
            id="head-tail-toggle"
            checked={enabled}
            onCheckedChange={onEnabledChange}
          />
        </div>

        {/* Distance Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              Minimum Afstand (grids)
            </Label>
            <Badge variant="outline" className="font-mono">
              {distance}
            </Badge>
          </div>
          <Slider
            value={[distance]}
            onValueChange={(value) => onDistanceChange(value[0])}
            max={10}
            min={1}
            step={1}
            disabled={!enabled}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1</span>
            <span>5</span>
            <span>10</span>
          </div>
        </div>

        {/* Current Game Status */}
        <div className="pt-4 border-t space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Stenen op bord:</span>
            <Badge variant="outline">{totalDominoes}</Badge>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Open uiteinden:</span>
            <Badge variant={currentOpenEnds === 2 ? "destructive" : "default"}>
              {currentOpenEnds}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            {currentOpenEnds === 2 ? 
              "⚠️ Kop-Staart detectie actief" : 
              "✅ Normaal spel mogelijk"
            }
          </div>
        </div>

        {/* Help Text */}
        <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
          <strong>Uitleg:</strong>
          <ul className="mt-1 space-y-1">
            <li>• Voorkomt dat kop en staart te dicht bij elkaar komen</li>
            <li>• Eerste 3 stenen zijn altijd toegestaan</li>
            <li>• Dubbele stenen hebben altijd voorrang</li>
            <li>• Lagere waarde = strengere beperking</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};