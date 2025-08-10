import React, { useState, useRef, useEffect } from 'react';
import { Settings, Minus, Plus, RotateCcw, Monitor, Tablet, Smartphone, RefreshCw, Check, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
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
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { applyBoardVibration } from '@/lib/vibration';

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
  const [isUpdating, setIsUpdating] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const dialogRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { 
    currentDeviceType, 
    getSettingsForDevice, 
    updateDominoScale, 
    updateHandDominoScale, 
    updateHardSlamDuration, 
    updateHardSlamSpeed,
    updateVibrationToggle,
    updateDurationAdjustment,
    updateSpeedAdjustment,
    applyLiveUpdate,
    getAdjustedDuration,
    getAdjustedSpeed,
    resetToDefaults 
  } = useGameVisualSettings();
  const [activeTab, setActiveTab] = useState<DeviceType>(currentDeviceType);
  
  // Get current settings for the active device
  const settings = getSettingsForDevice(activeTab);
  
  // Expose latest settings globally so other modules (Hard Slam) always read fresh values
  useEffect(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__dominoVibrationSettings = settings;
    } catch {}
  }, [settings]);

  // Drag functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragStart.x;
        const newY = e.clientY - dragStart.y;
        
        // Keep within viewport bounds
        const maxX = window.innerWidth - 400; // dialog width
        const maxY = window.innerHeight - 600; // dialog height
        
        setPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY))
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  const handleLiveUpdate = async () => {
    setIsUpdating(true);
    applyLiveUpdate();
    
    // Show success state briefly
    setTimeout(() => {
      setIsUpdating(false);
      toast({
        title: "Instellingen bijgewerkt",
        description: "De trillingsinstellingen zijn toegepast.",
      });
      // Close dialog after showing success
      setTimeout(() => {
        setIsOpen(false);
      }, 500);
    }, 300);
  };

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
            {/* Trillingstypen */}
            <div>
              <div className="text-xs text-muted-foreground mb-3">Trillingstypen</div>
              <div className="grid grid-cols-1 gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Horizontaal</span>
                  <Switch
                    checked={settings.enableHorizontalVibration}
                    onCheckedChange={(checked) => updateVibrationToggle('enableHorizontalVibration', checked, device)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Links Diagonaal</span>
                  <Switch
                    checked={settings.enableLeftDiagonalVibration}
                    onCheckedChange={(checked) => updateVibrationToggle('enableLeftDiagonalVibration', checked, device)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Rechts Diagonaal</span>
                  <Switch
                    checked={settings.enableRightDiagonalVibration}
                    onCheckedChange={(checked) => updateVibrationToggle('enableRightDiagonalVibration', checked, device)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Verticaal</span>
                  <Switch
                    checked={settings.enableVerticalVibration}
                    onCheckedChange={(checked) => updateVibrationToggle('enableVerticalVibration', checked, device)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Subtiel</span>
                  <Switch
                    checked={settings.enableSubtleVibration}
                    onCheckedChange={(checked) => updateVibrationToggle('enableSubtleVibration', checked, device)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Schudden</span>
                  <Switch
                    checked={settings.enableShakeVibration}
                    onCheckedChange={(checked) => updateVibrationToggle('enableShakeVibration', checked, device)}
                  />
                </div>
              </div>
            </div>

            {/* Duur aanpassing */}
            <div>
              <div className="text-xs text-muted-foreground mb-2">
                Duur Aanpassing ({settings.durationAdjustment > 0 ? '+' : ''}{settings.durationAdjustment}) 
                → {getAdjustedDuration(device).toFixed(1)}s
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => updateDurationAdjustment(settings.durationAdjustment - 1, device)}
                  disabled={settings.durationAdjustment <= -5}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <div className="flex-1">
                  <Slider
                    value={[settings.durationAdjustment]}
                    onValueChange={(values) => updateDurationAdjustment(values[0], device)}
                    min={-5}
                    max={5}
                    step={1}
                    className="w-full"
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => updateDurationAdjustment(settings.durationAdjustment + 1, device)}
                  disabled={settings.durationAdjustment >= 5}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Snelheid aanpassing */}
            <div>
              <div className="text-xs text-muted-foreground mb-2">
                Snelheid Aanpassing ({settings.speedAdjustment > 0 ? '+' : ''}{settings.speedAdjustment * 10}ms)
                → {(getAdjustedSpeed(device) * 1000).toFixed(0)}ms
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => updateSpeedAdjustment(settings.speedAdjustment - 1, device)}
                  disabled={settings.speedAdjustment <= -30}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <div className="flex-1">
                  <Slider
                    value={[settings.speedAdjustment]}
                    onValueChange={(values) => updateSpeedAdjustment(values[0], device)}
                    min={-30}
                    max={30}
                    step={1}
                    className="w-full"
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => updateSpeedAdjustment(settings.speedAdjustment + 1, device)}
                  disabled={settings.speedAdjustment >= 30}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Live Update knop */}
            <div className="pt-2 space-y-2">
              <Button
                onClick={handleLiveUpdate}
                disabled={isUpdating}
                className="w-full flex items-center gap-2"
                variant="secondary"
              >
                {isUpdating ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {isUpdating ? 'Toegepast!' : 'Live Update Toepassen'}
              </Button>
              
              {/* Test trillingen knop */}
              <Button
                onClick={() => {
                  console.log('🧪 Test Trillingen via util');
                  applyBoardVibration(settings);
                }}
                className="w-full flex items-center gap-2"
                variant="outline"
                size="sm"
              >
                🧪 Test Trillingen
              </Button>
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
      <DialogContent 
        ref={dialogRef}
        className="max-w-lg max-h-[90vh] overflow-y-auto"
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          transform: 'none',
          margin: 0
        }}
      >
        <DialogHeader 
          className={cn(
            "cursor-move flex flex-row items-center gap-2 border-b pb-3",
            isDragging && "cursor-grabbing"
          )}
          onMouseDown={handleMouseDown}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <DialogTitle className="flex items-center gap-2 flex-1">
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