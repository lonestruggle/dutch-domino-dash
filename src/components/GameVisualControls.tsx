import React, { useState, useRef, useEffect } from 'react';
import { Settings, Minus, Plus, RotateCcw, Monitor, Tablet, Smartphone, RefreshCw, Check, GripVertical, RotateCw, Hand, Square, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
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
import { useUserRoles } from '@/hooks/useUserRoles';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';


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

const DEFAULT_GLOVE_IMAGE = '/glove-hand.svg';

export const GameVisualControls: React.FC = () => {
  const { user } = useAuth();
  const { isAdmin, loading } = useUserRoles();
  const canAccessVisualControls = isAdmin;
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const dialogRef = useRef<HTMLDivElement>(null);
  const gloveUploadInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { 
    currentDeviceType, 
    getSettingsForDevice, 
    updateDominoScale, 
    updateHandDominoScale, 
    updateRotation,
    updateRotationSpeed,
    updateRotationAmplitude,
    updateShakeIntensity,
    updateShakeDuration,
    updateDominoWidth,
    updateDominoHeight,
    updateDominoThickness,
    updateGloveScale,
    updateHardSlamGloveScale,
    updateGloveImageUrl,
    updateGloveAlwaysVisible,
    updateGlovePosition,
    applyLiveUpdate,
    resetToDefaults,
    // Animation controls from hook
    isAnimating,
    animationMode,
    startShakeAnimation,
    startContinuousRotate,
    stopAnimation,
  } = useGameVisualSettings();
  const [activeTab, setActiveTab] = useState<DeviceType>(currentDeviceType);
  const [animationMessage, setAnimationMessage] = useState('');
  
  // Get current settings for the active device
  const settings = getSettingsForDevice(activeTab);

  // Handle animation button clicks
  const handleShakeAnimation = async () => {
    const result = await startShakeAnimation();
    setAnimationMessage(result.message);
  };

  const handleContinuousRotate = () => {
    const result = startContinuousRotate();
    setAnimationMessage(result.message);
  };

  const handleStopAnimation = () => {
    const result = stopAnimation();
    setAnimationMessage(result.message);
  };
  
  // Get current settings for the active device
  const deviceSettings = getSettingsForDevice(activeTab);
  
  // Expose latest settings globally so other modules (Hard Slam) always read fresh values
  useEffect(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__dominoSettings = settings;
    } catch (error) {
      void error;
    }
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
        title: "Instellingen toegepast",
        description: "De visuele instellingen zijn direct toegepast.",
      });
      // Don't close dialog - keep it open for more adjustments
    }, 300);
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    
    try {
      // Force save all current settings by triggering the localStorage save
      // Get all current settings for all devices
      const currentSettings = {
        desktop: getSettingsForDevice('desktop'),
        tablet: getSettingsForDevice('tablet'),
        mobile: getSettingsForDevice('mobile')
      };
      
      // Force save to localStorage by dispatching update event
      window.dispatchEvent(new CustomEvent('forceSettingsSave', { 
        detail: currentSettings 
      }));
      
      // Show success state briefly
      setTimeout(() => {
        setIsSaving(false);
        toast({
          title: "Instellingen opgeslagen",
          description: "Alle visuele instellingen zijn permanent opgeslagen in localStorage.",
        });
      }, 300);
    } catch (error) {
      setIsSaving(false);
      toast({
        title: "Fout bij opslaan",
        description: "Er is een probleem opgetreden bij het opslaan van de instellingen.",
        variant: "destructive",
      });
    }
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

  const adjustGloveScale = (delta: number, device: DeviceType) => {
    const currentSettings = getSettingsForDevice(device);
    updateGloveScale(currentSettings.gloveScale + delta, device);
  };

  const adjustHardSlamGloveScale = (delta: number, device: DeviceType) => {
    const currentSettings = getSettingsForDevice(device);
    updateHardSlamGloveScale(currentSettings.hardSlamGloveScale + delta, device);
  };

  const handleGloveUpload = (event: React.ChangeEvent<HTMLInputElement>, device: DeviceType) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Ongeldig bestand',
        description: 'Upload een afbeeldingsbestand voor de handschoen.',
        variant: 'destructive',
      });
      event.target.value = '';
      return;
    }

    // Keep data URL small enough for localStorage reliability.
    const maxBytes = 1_200_000;
    if (file.size > maxBytes) {
      toast({
        title: 'Afbeelding te groot',
        description: 'Gebruik een bestand kleiner dan ~1.2MB.',
        variant: 'destructive',
      });
      event.target.value = '';
      return;
    }

    const uploadToSupabaseOrLocal = async () => {
      try {
        const fileExt = file.name.split('.').pop() || 'png';
        const owner = user?.id || 'anonymous';
        const fileName = `gloves/${owner}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('table-backgrounds')
          .upload(fileName, file, { upsert: false });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('table-backgrounds')
          .getPublicUrl(fileName);

        updateGloveImageUrl(publicUrl, device);
        toast({
          title: 'Handschoen geupload',
          description: 'Opgeslagen in Supabase Storage (table-backgrounds).',
        });
        return;
      } catch (storageError) {
        console.warn('Glove upload to Supabase failed, falling back to localStorage:', storageError);
      }

      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        if (!result) return;
        updateGloveImageUrl(result, device);
        toast({
          title: 'Handschoen lokaal opgeslagen',
          description: 'Supabase upload lukte niet; opgeslagen in localStorage op dit device/browser.',
        });
      };
      reader.onerror = () => {
        toast({
          title: 'Upload mislukt',
          description: 'Kon de afbeelding niet lezen.',
          variant: 'destructive',
        });
      };
      reader.readAsDataURL(file);
    };

    void uploadToSupabaseOrLocal();
    event.target.value = '';
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

        {/* Domino Afmetingen - GLOBAL */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              🌍 Domino Afmetingen (Globaal)
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Deze instellingen gelden voor alle spelers en worden gedeeld
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-xs font-medium mb-1">
                Breedte: {deviceSettings.dominoWidth}px
              </div>
              <Slider
                min={40}
                max={120}
                step={1}
                value={[deviceSettings.dominoWidth]}
                onValueChange={([value]) => updateDominoWidth(value, device)}
                className="w-full"
              />
            </div>

            <div>
              <div className="text-xs font-medium mb-1">
                Hoogte: {deviceSettings.dominoHeight}px
              </div>
              <Slider
                min={20}
                max={60}
                step={1}
                value={[deviceSettings.dominoHeight]}
                onValueChange={([value]) => updateDominoHeight(value, device)}
                className="w-full"
              />
            </div>

            <div>
              <div className="text-xs font-medium mb-1">
                Dikte: {deviceSettings.dominoThickness}px
              </div>
              <Slider
                min={4}
                max={16}
                step={1}
                value={[deviceSettings.dominoThickness]}
                onValueChange={([value]) => updateDominoThickness(value, device)}
                className="w-full"
              />
            </div>
          </CardContent>
        </Card>

        {/* Handschoen Instellingen - admin/dev only via this panel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              🧤 Handschoen Animatie
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Pas handschoen-grootte en afbeelding aan voor dit device-profiel.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-xs font-medium mb-1">
                Plaats-handschoen grootte: {deviceSettings.gloveScale.toFixed(2)}x
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => adjustGloveScale(-0.1, device)}
                  disabled={deviceSettings.gloveScale <= 0.4}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <div className="flex-1">
                  <Slider
                    value={[deviceSettings.gloveScale]}
                    onValueChange={([value]) => updateGloveScale(value, device)}
                    min={0.4}
                    max={2.5}
                    step={0.05}
                    className="w-full"
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => adjustGloveScale(0.1, device)}
                  disabled={deviceSettings.gloveScale >= 2.5}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div>
              <div className="text-xs font-medium mb-1">
                Hard Slam handschoen grootte: {deviceSettings.hardSlamGloveScale.toFixed(2)}x
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => adjustHardSlamGloveScale(-0.1, device)}
                  disabled={deviceSettings.hardSlamGloveScale <= 0.4}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <div className="flex-1">
                  <Slider
                    value={[deviceSettings.hardSlamGloveScale]}
                    onValueChange={([value]) => updateHardSlamGloveScale(value, device)}
                    min={0.4}
                    max={2.5}
                    step={0.05}
                    className="w-full"
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => adjustHardSlamGloveScale(0.1, device)}
                  disabled={deviceSettings.hardSlamGloveScale >= 2.5}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium">Handschoen afbeelding URL/pad</div>
              <Input
                value={deviceSettings.gloveImageUrl}
                onChange={(event) => updateGloveImageUrl(event.target.value, device)}
                placeholder="/glove-hand.svg of https://..."
              />
              <div className="flex items-center justify-between gap-2">
                <Input
                  ref={gloveUploadInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => handleGloveUpload(event, device)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => gloveUploadInputRef.current?.click()}
                >
                  Upload handschoen
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateGloveImageUrl(DEFAULT_GLOVE_IMAGE, device)}
                >
                  Reset handschoen
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Uploads worden lokaal opgeslagen in je browser (localStorage), niet in Supabase.
              </p>
            </div>

            <div className="space-y-2 rounded border border-border/60 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Handschoen altijd zichtbaar</span>
                <Switch
                  checked={Boolean(deviceSettings.gloveAlwaysVisible)}
                  onCheckedChange={(checked) => updateGloveAlwaysVisible(checked, device)}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateGlovePosition(82, 76, device)}
                >
                  Reset positie
                </Button>
                <span className="text-[11px] text-muted-foreground">
                  Sleep de handschoen op het bord om positie te wijzigen.
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3D Rotation Controls - GLOBAL */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <RotateCw className="h-4 w-4" />
              🌍 3D Rotatie Instellingen (Globaal)
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Deze instellingen gelden voor alle spelers en worden gedeeld
            </p>
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
                    onClick={handleStopAnimation}
                    variant="destructive"
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    <Square className="h-3 w-3" /> Stop Rotatie
                  </Button>
                ) : (
                  <Button
                    onClick={handleContinuousRotate}
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
                    onClick={handleStopAnimation}
                    variant="destructive"
                    size="sm"
                    className="flex items-center gap-1"
                  >
                    <Square className="h-3 w-3" /> Stop Schudden
                  </Button>
                ) : (
                  <Button
                    onClick={handleShakeAnimation}
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
                  disabled={isAnimating}
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
                  disabled={isAnimating}
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
                  disabled={isAnimating}
                  className="w-full"
                />
              </div>
            </div>

            {/* Animation Settings */}
            <div className="space-y-3">
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
                  disabled={isAnimating}
                  className="w-full"
                />
              </div>

              <div className="border border-primary/20 p-3 rounded-lg bg-primary/5">
                <div className="text-xs font-medium mb-2 text-primary flex items-center gap-1">
                  🌎 Amplitude X-as: {deviceSettings.rotationAmplitudeX.toFixed(1)}° (Alle Devices)
                </div>
                 <Slider
                   min={-1000}
                   max={1000}
                   step={0.1}
                   value={[deviceSettings.rotationAmplitudeX]}
                   onValueChange={([value]) => updateRotationAmplitude('X', value)}
                   disabled={isAnimating}
                   className="w-full"
                 />
              </div>

              <div className="border border-primary/20 p-3 rounded-lg bg-primary/5">
                <div className="text-xs font-medium mb-2 text-primary flex items-center gap-1">
                  🌎 Amplitude Y-as: {deviceSettings.rotationAmplitudeY.toFixed(1)}° (Alle Devices)
                </div>
                 <Slider
                   min={-1000}
                   max={1000}
                   step={0.1}
                   value={[deviceSettings.rotationAmplitudeY]}
                   onValueChange={([value]) => updateRotationAmplitude('Y', value)}
                   disabled={isAnimating}
                   className="w-full"
                 />
              </div>

              <div className="border border-primary/20 p-3 rounded-lg bg-primary/5">
                <div className="text-xs font-medium mb-2 text-primary flex items-center gap-1">
                  🌎 Amplitude Z-as: {deviceSettings.rotationAmplitudeZ.toFixed(1)}° (Alle Devices)
                </div>
                 <Slider
                   min={-1000}
                   max={1000}
                   step={0.1}
                   value={[deviceSettings.rotationAmplitudeZ]}
                   onValueChange={([value]) => updateRotationAmplitude('Z', value)}
                   disabled={isAnimating}
                   className="w-full"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

        {/* Schud Instellingen - GLOBAL */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Hand className="h-4 w-4" />
              🌍 Schud Instellingen (Globaal)
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Deze instellingen gelden voor alle spelers en worden gedeeld
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-xs font-medium mb-1">
                Schud Intensiteit: {deviceSettings.shakeIntensity.toFixed(1)}x
              </div>
              <Slider
                min={0.1}
                max={2.0}
                step={0.1}
                value={[deviceSettings.shakeIntensity]}
                onValueChange={([value]) => updateShakeIntensity(value, device)}
                disabled={isAnimating}
                className="w-full"
              />
            </div>

            <div>
              <div className="text-xs font-medium mb-1">
                Schud Duur: {deviceSettings.shakeDuration.toFixed(1)}s
              </div>
              <Slider
                min={0.5}
                max={5.0}
                step={0.1}
                value={[deviceSettings.shakeDuration]}
                onValueChange={([value]) => updateShakeDuration(value, device)}
                disabled={isAnimating}
                className="w-full"
              />
            </div>
          </CardContent>
        </Card>

        {/* Live Update en Opslaan knoppen */}
        <div className="pt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={handleLiveUpdate}
              disabled={isUpdating}
              className="flex items-center gap-2"
              variant="secondary"
            >
              {isUpdating ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {isUpdating ? 'Toegepast!' : 'Live Update'}
            </Button>
            
            <Button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="flex items-center gap-2"
              variant="default"
            >
              {isSaving ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isSaving ? 'Opgeslagen!' : 'Opslaan'}
            </Button>
          </div>
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

  // In production these controls are admin-only; in local dev we expose them for iteration/debugging.
  if (loading && !isDevMode) return null;
  if (!canAccessVisualControls) return null;

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
            {isDevMode && (
              <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                DEV MODE
              </span>
            )}
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