import React, { useState, useRef, useEffect } from 'react';
import { Settings, Minus, Plus, RotateCcw, Monitor, Tablet, Smartphone, RefreshCw, Check, GripVertical, RotateCw, Hand, Square } from 'lucide-react';
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
    updateDurationAdjustment,
    updateSpeedAdjustment,
    updateRotation,
    updateRotationSpeed,
    updateRotationAmplitude,
    updateAnimationDuration,
    applyLiveUpdate,
    resetToDefaults 
  } = useGameVisualSettings();
  const [activeTab, setActiveTab] = useState<DeviceType>(currentDeviceType);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationMode, setAnimationMode] = useState<'shake' | 'rotate' | null>(null);
  const [animationMessage, setAnimationMessage] = useState('');
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  
  // Get current settings for the active device
  const settings = getSettingsForDevice(activeTab);

  // Animation functions
  const startShakeAnimation = () => {
    if (settings.rotationAmplitudeX === 0 && settings.rotationAmplitudeY === 0 && settings.rotationAmplitudeZ === 0) {
      setAnimationMessage("De rotatie-amplitude voor alle assen is 0°. Stel een waarde in om de steen te laten bewegen.");
      return;
    }
    setAnimationMessage("De dominostenen schudden...");
    
    setIsAnimating(true);
    setAnimationMode('shake');
    
    startTimeRef.current = performance.now();
    const durationInMs = settings.animationDuration * 1000;
    
    const animate = (timestamp: number) => {
      if (!startTimeRef.current) return;
      const elapsedTime = timestamp - startTimeRef.current;
      const progress = elapsedTime / durationInMs;
      
      if (progress < 1) {
        const wave = Math.cos(elapsedTime * settings.rotationSpeed * Math.PI / 1000);
        const decayFactor = Math.pow(1 - progress, 1.5);
        updateRotation('X', settings.rotationAmplitudeX * wave * decayFactor, activeTab);
        updateRotation('Y', settings.rotationAmplitudeY * wave * decayFactor, activeTab);
        updateRotation('Z', settings.rotationAmplitudeZ * wave * decayFactor, activeTab);
        animationRef.current = requestAnimationFrame(animate);
      } else {
        updateRotation('X', 0, activeTab);
        updateRotation('Y', 0, activeTab);
        updateRotation('Z', 0, activeTab);
        setIsAnimating(false);
        setAnimationMode(null);
        setAnimationMessage("Klaar met schudden.");
      }
    };
    animationRef.current = requestAnimationFrame(animate);
  };

  const startContinuousRotate = () => {
    if (settings.rotationAmplitudeX === 0 && settings.rotationAmplitudeY === 0 && settings.rotationAmplitudeZ === 0) {
      setAnimationMessage("De rotatie-amplitude voor alle assen is 0°. Stel een waarde in om de steen te laten bewegen.");
      return;
    }
    setIsAnimating(true);
    setAnimationMode('rotate');
    setAnimationMessage("De dominostenen roteren continu...");
    
    const initialTime = performance.now();

    const animate = (timestamp: number) => {
      const elapsedMilliseconds = timestamp - initialTime;
      const angle = (elapsedMilliseconds / 1000) * settings.rotationSpeed * Math.PI;
      const wave = Math.sin(angle);
      
      updateRotation('X', settings.rotationAmplitudeX * wave, activeTab);
      updateRotation('Y', settings.rotationAmplitudeY * wave, activeTab);
      updateRotation('Z', settings.rotationAmplitudeZ * wave, activeTab);
      
      animationRef.current = requestAnimationFrame(animate);
    };
    animationRef.current = requestAnimationFrame(animate);
  };

  const stopAnimation = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setIsAnimating(false);
    setAnimationMode(null);
    updateRotation('X', 0, activeTab);
    updateRotation('Y', 0, activeTab);
    updateRotation('Z', 0, activeTab);
    setAnimationMessage("Animatie gestopt.");
  };

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);
  
  // Get current settings for the active device
  const deviceSettings = getSettingsForDevice(activeTab);
  
  // Expose latest settings globally so other modules (Hard Slam) always read fresh values
  useEffect(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__dominoSettings = settings;
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


  const renderDeviceControls = (device: DeviceType) => {
    const deviceSettings = getSettingsForDevice(device);
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
              Bord Domino Grootte ({Math.round(deviceSettings.dominoScale * 100)}%)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => adjustDominoScale(-0.1, device)}
                disabled={deviceSettings.dominoScale <= 0.5}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <div className="flex-1">
                <Slider
                  value={[deviceSettings.dominoScale]}
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
                disabled={deviceSettings.dominoScale >= 2.0}
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
              Hand Domino Grootte ({Math.round(deviceSettings.handDominoScale * 100)}%)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => adjustHandDominoScale(-0.1, device)}
                disabled={deviceSettings.handDominoScale <= 0.5}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <div className="flex-1">
                <Slider
                  value={[deviceSettings.handDominoScale]}
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
                disabled={deviceSettings.handDominoScale >= 2.0}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 3D Rotation Controls */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <RotateCw className="h-4 w-4" />
              3D Rotatie Instellingen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Animation Message */}
            {animationMessage && device === activeTab && (
              <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                {animationMessage}
              </div>
            )}

            {/* Animation Controls */}
            {device === activeTab && (
              <div className="flex gap-2">
                {animationMode === 'rotate' ? (
                  <Button
                    onClick={stopAnimation}
                    variant="destructive"
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    <Square className="h-3 w-3" /> Stop Rotatie
                  </Button>
                ) : (
                  <Button
                    onClick={startContinuousRotate}
                    variant="outline"
                    size="sm"
                    disabled={isAnimating}
                    className="flex items-center gap-1"
                  >
                    <Hand className="h-3 w-3" /> Continue Rotatie
                  </Button>
                )}
                
                {animationMode === 'shake' ? (
                  <Button
                    onClick={stopAnimation}
                    variant="destructive"
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    <Square className="h-3 w-3" /> Stop Schudden
                  </Button>
                ) : (
                  <Button
                    onClick={startShakeAnimation}
                    variant="outline"
                    size="sm"
                    disabled={isAnimating}
                    className="flex items-center gap-1"
                  >
                    <Hand className="h-3 w-3" /> Schudden
                  </Button>
                )}
              </div>
            )}

            {/* Manual Rotation Controls */}
            <div className="space-y-3">
              <div>
                <div className="text-xs font-medium mb-1">
                  Rotatie X-as: {deviceSettings.rotateX.toFixed(1)}°
                </div>
                <Slider
                  min={-90}
                  max={90}
                  step={0.1}
                  value={[deviceSettings.rotateX]}
                  onValueChange={([value]) => updateRotation('X', value, device)}
                  disabled={isAnimating && device === activeTab}
                  className="w-full"
                />
              </div>

              <div>
                <div className="text-xs font-medium mb-1">
                  Rotatie Y-as: {deviceSettings.rotateY.toFixed(1)}°
                </div>
                <Slider
                  min={-90}
                  max={90}
                  step={0.1}
                  value={[deviceSettings.rotateY]}
                  onValueChange={([value]) => updateRotation('Y', value, device)}
                  disabled={isAnimating && device === activeTab}
                  className="w-full"
                />
              </div>

              <div>
                <div className="text-xs font-medium mb-1">
                  Rotatie Z-as: {deviceSettings.rotateZ.toFixed(1)}°
                </div>
                <Slider
                  min={-90}
                  max={90}
                  step={0.1}
                  value={[deviceSettings.rotateZ]}
                  onValueChange={([value]) => updateRotation('Z', value, device)}
                  disabled={isAnimating && device === activeTab}
                  className="w-full"
                />
              </div>
            </div>

            {/* Animation Settings */}
            <div className="space-y-3">
              <div>
                <div className="text-xs font-medium mb-1">
                  Animatie Duur: {deviceSettings.animationDuration.toFixed(1)}s
                </div>
                <Slider
                  min={0.1}
                  max={10}
                  step={0.1}
                  value={[deviceSettings.animationDuration]}
                  onValueChange={([value]) => updateAnimationDuration(value, device)}
                  disabled={isAnimating && device === activeTab}
                  className="w-full"
                />
              </div>

              <div>
                <div className="text-xs font-medium mb-1">
                  Rotatie Snelheid: {deviceSettings.rotationSpeed.toFixed(1)}x
                </div>
                <Slider
                  min={0.1}
                  max={10}
                  step={0.1}
                  value={[deviceSettings.rotationSpeed]}
                  onValueChange={([value]) => updateRotationSpeed(value, device)}
                  disabled={isAnimating && device === activeTab}
                  className="w-full"
                />
              </div>

              <div>
                <div className="text-xs font-medium mb-1">
                  Amplitude X-as: {deviceSettings.rotationAmplitudeX.toFixed(1)}°
                </div>
                <Slider
                  min={-500}
                  max={500}
                  step={0.1}
                  value={[deviceSettings.rotationAmplitudeX]}
                  onValueChange={([value]) => updateRotationAmplitude('X', value, device)}
                  disabled={isAnimating && device === activeTab}
                  className="w-full"
                />
              </div>

              <div>
                <div className="text-xs font-medium mb-1">
                  Amplitude Y-as: {deviceSettings.rotationAmplitudeY.toFixed(1)}°
                </div>
                <Slider
                  min={-500}
                  max={500}
                  step={0.1}
                  value={[deviceSettings.rotationAmplitudeY]}
                  onValueChange={([value]) => updateRotationAmplitude('Y', value, device)}
                  disabled={isAnimating && device === activeTab}
                  className="w-full"
                />
              </div>

              <div>
                <div className="text-xs font-medium mb-1">
                  Amplitude Z-as: {deviceSettings.rotationAmplitudeZ.toFixed(1)}°
                </div>
                <Slider
                  min={-500}
                  max={500}
                  step={0.1}
                  value={[deviceSettings.rotationAmplitudeZ]}
                  onValueChange={([value]) => updateRotationAmplitude('Z', value, device)}
                  disabled={isAnimating && device === activeTab}
                  className="w-full"
                />
              </div>
            </div>
          </CardContent>
        </Card>

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
        </div>

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