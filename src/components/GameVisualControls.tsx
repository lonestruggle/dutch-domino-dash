import React, { useState } from 'react';
import { Settings, Minus, Plus, RotateCcw, Monitor, Tablet, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useGameVisualSettings } from '@/hooks/useGameVisualSettings';
import { DeviceType } from '@/hooks/useDeviceType';

const deviceIcons = {
  desktop: Monitor,
  tablet: Tablet,
  mobile: Smartphone,
};

const deviceLabels = {
  desktop: 'Desktop',
  tablet: 'Tablet', 
  mobile: 'Mobile',
};

export const GameVisualControls: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { currentDeviceType, getSettingsForDevice, updateDominoScale, updateHandDominoScale, updateHardSlamDuration, updateHardSlamSpeed, resetToDefaults } = useGameVisualSettings();
  const [activeTab, setActiveTab] = useState<DeviceType>(currentDeviceType);

  const handleDominoScaleChange = (values: number[], device: DeviceType) => {
    updateDominoScale(values[0], device);
  };

  const handleHandDominoScaleChange = (values: number[], device: DeviceType) => {
    updateHandDominoScale(values[0], device);
  };

  const adjustDominoScale = (delta: number, device: DeviceType) => {
    const currentSettings = getSettingsForDevice(device);
    updateDominoScale(currentSettings.dominoScale + delta, device);
  };

  const adjustHandDominoScale = (delta: number, device: DeviceType) => {
    const currentSettings = getSettingsForDevice(device);
    updateHandDominoScale(currentSettings.handDominoScale + delta, device);
  };

  const handleHardSlamDurationChange = (values: number[], device: DeviceType) => {
    updateHardSlamDuration(values[0], device);
  };

  const handleHardSlamSpeedChange = (values: number[], device: DeviceType) => {
    updateHardSlamSpeed(values[0], device);
  };

  const adjustHardSlamDuration = (delta: number, device: DeviceType) => {
    const currentSettings = getSettingsForDevice(device);
    updateHardSlamDuration(currentSettings.hardSlamDuration + delta, device);
  };

  const adjustHardSlamSpeed = (delta: number, device: DeviceType) => {
    const currentSettings = getSettingsForDevice(device);
    updateHardSlamSpeed(currentSettings.hardSlamSpeed + delta, device);
  };

  const renderDeviceControls = (device: DeviceType) => {
    const settings = getSettingsForDevice(device);
    const IconComponent = deviceIcons[device];
    
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <IconComponent className="h-4 w-4" />
          Instellingen voor {deviceLabels[device]}
          {device === currentDeviceType && (
            <span className="ml-2 px-2 py-1 bg-primary/20 text-primary rounded-md text-xs font-medium">
              Actief
            </span>
          )}
        </div>
        
        {/* Board Domino Grootte */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Bord Domino Grootte ({Math.round(settings.dominoScale * 100)}%)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => adjustDominoScale(-0.1, device)}
                disabled={settings.dominoScale <= 0.5}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <div className="flex-1">
                <Slider
                  value={[settings.dominoScale]}
                  onValueChange={(values) => handleDominoScaleChange(values, device)}
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
                onClick={() => adjustDominoScale(0.1, device)}
                disabled={settings.dominoScale >= 2.0}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Hand Domino Grootte */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Hand Domino Grootte ({Math.round(settings.handDominoScale * 100)}%)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => adjustHandDominoScale(-0.1, device)}
                disabled={settings.handDominoScale <= 0.5}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <div className="flex-1">
                <Slider
                  value={[settings.handDominoScale]}
                  onValueChange={(values) => handleHandDominoScaleChange(values, device)}
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
                onClick={() => adjustHandDominoScale(0.1, device)}
                disabled={settings.handDominoScale >= 2.0}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Hard Slam Trilbeweging */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Hard Slam Trilbeweging</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Trillingsduur */}
            <div>
              <div className="text-xs text-muted-foreground mb-2">
                Duur ({settings.hardSlamDuration.toFixed(1)}s)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => adjustHardSlamDuration(-0.1, device)}
                  disabled={settings.hardSlamDuration <= 0.5}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <div className="flex-1">
                  <Slider
                    value={[settings.hardSlamDuration]}
                    onValueChange={(values) => handleHardSlamDurationChange(values, device)}
                    min={0.5}
                    max={3.0}
                    step={0.1}
                    className="w-full"
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => adjustHardSlamDuration(0.1, device)}
                  disabled={settings.hardSlamDuration >= 3.0}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Trilsnelheid */}
            <div>
              <div className="text-xs text-muted-foreground mb-2">
                Snelheid ({(settings.hardSlamSpeed * 1000).toFixed(0)}ms per trilling)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => adjustHardSlamSpeed(-0.01, device)}
                  disabled={settings.hardSlamSpeed <= 0.1}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <div className="flex-1">
                  <Slider
                    value={[settings.hardSlamSpeed]}
                    onValueChange={(values) => handleHardSlamSpeedChange(values, device)}
                    min={0.1}
                    max={0.3}
                    step={0.01}
                    className="w-full"
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => adjustHardSlamSpeed(0.01, device)}
                  disabled={settings.hardSlamSpeed >= 0.3}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reset knop per device */}
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={() => resetToDefaults(device)}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset {deviceLabels[device]}
          </Button>
        </div>
      </div>
    );
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Visuele Instellingen
          </DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DeviceType)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="desktop" className="flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              Desktop
            </TabsTrigger>
            <TabsTrigger value="tablet" className="flex items-center gap-2">
              <Tablet className="h-4 w-4" />
              Tablet
            </TabsTrigger>
            <TabsTrigger value="mobile" className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              Mobile
            </TabsTrigger>
          </TabsList>

          <TabsContent value="desktop" className="mt-6">
            {renderDeviceControls('desktop')}
          </TabsContent>

          <TabsContent value="tablet" className="mt-6">
            {renderDeviceControls('tablet')}
          </TabsContent>

          <TabsContent value="mobile" className="mt-6">
            {renderDeviceControls('mobile')}
          </TabsContent>
        </Tabs>

        {/* Global reset knop */}
        <div className="flex justify-center pt-4 border-t">
          <Button
            variant="destructive"
            onClick={() => resetToDefaults()}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset Alles
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};