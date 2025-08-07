import React, { useState } from 'react';
import { Settings, Minus, Plus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useGameVisualSettings } from '@/hooks/useGameVisualSettings';

export const GameVisualControls: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { settings, updateFrameSize, updateDominoScale, resetToDefaults } = useGameVisualSettings();

  const handleFrameSizeChange = (values: number[]) => {
    updateFrameSize(values[0]);
  };

  const handleDominoScaleChange = (values: number[]) => {
    updateDominoScale(values[0]);
  };

  const adjustFrameSize = (delta: number) => {
    updateFrameSize(settings.frameSize + delta);
  };

  const adjustDominoScale = (delta: number) => {
    updateDominoScale(settings.dominoScale + delta);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="fixed top-4 right-4 z-50 bg-background/80 backdrop-blur-sm hover:bg-background/90 transition-all"
          title="Visuele instellingen"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Visuele Instellingen
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {/* Frame Grootte */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Frame Grootte ({Math.round(settings.frameSize * 100)}%)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => adjustFrameSize(-0.1)}
                  disabled={settings.frameSize <= 0.5}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <div className="flex-1">
                  <Slider
                    value={[settings.frameSize]}
                    onValueChange={handleFrameSizeChange}
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    className="w-full"
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => adjustFrameSize(0.1)}
                  disabled={settings.frameSize >= 2.0}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <div className="text-xs text-muted-foreground text-center">
                Pas de dikte van het tafel frame aan
              </div>
            </CardContent>
          </Card>

          {/* Domino Grootte */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Domino Grootte ({Math.round(settings.dominoScale * 100)}%)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => adjustDominoScale(-0.1)}
                  disabled={settings.dominoScale <= 0.5}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <div className="flex-1">
                  <Slider
                    value={[settings.dominoScale]}
                    onValueChange={handleDominoScaleChange}
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    className="w-full"
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => adjustDominoScale(0.1)}
                  disabled={settings.dominoScale >= 2.0}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <div className="text-xs text-muted-foreground text-center">
                Pas de grootte van dominostenen op tafel aan
              </div>
            </CardContent>
          </Card>

          {/* Reset knop */}
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              onClick={resetToDefaults}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Standaard instellingen
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};