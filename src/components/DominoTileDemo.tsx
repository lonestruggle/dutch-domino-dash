import React, { useState, useRef, useEffect } from 'react';
import { RefreshCw, RotateCw, Hand, Square, Minus, Plus, Save, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useGameVisualSettings } from '@/hooks/useGameVisualSettings';

/**
 * The DominoTile component.
 * Creates a visually appealing domino with customizable properties in 3D.
 *
 * @param {object} props - The component's props.
 * @param {number} props.leftDots - The number of dots on the left half.
 * @param {number} props.rightDots - The number of dots on the right half.
 * @param {boolean} [props.isSelected=false] - Indicates whether the tile is selected.
 * @param {boolean} [props.isPlayable=true] - Indicates whether the tile is playable.
 * @param {'horizontal' | 'vertical'} [props.orientation='horizontal'] - The orientation of the tile.
 * @param {'small' | 'medium' | 'large'} [props.size='medium'] - The size of the tile.
 * @param {() => void} [props.onClick] - The click handler.
 * @param {(e) => void} [props.onDragStart] - The drag-start handler.
 * @param {string} [props.className] - Additional Tailwind classes.
 * @param {number} [props.rotateX=0] - Rotation around the X-axis for 3D effect.
 * @param {number} props.rotateY=0] - Rotation around the Y-axis for 3D effect.
 * @param {number} props.rotateZ=0] - Rotation around the Z-axis for 3D effect.
 */
const DominoTile = ({
  leftDots,
  rightDots,
  isSelected = false,
  isPlayable = true,
  orientation = 'horizontal',
  size = 'medium',
  onClick,
  onDragStart,
  className,
  rotateX = 0,
  rotateY = 0,
  rotateZ = 0
}: {
  leftDots: number;
  rightDots: number;
  isSelected?: boolean;
  isPlayable?: boolean;
  orientation?: 'horizontal' | 'vertical';
  size?: 'small' | 'medium' | 'large';
  onClick?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  className?: string;
  rotateX?: number;
  rotateY?: number;
  rotateZ?: number;
}) => {
  const handleDragStart = (e: React.DragEvent) => {
    // Slaat de gegevens van de tegel op voor de drag-and-drop functionaliteit.
    const tileData = JSON.stringify({ leftDots, rightDots, orientation });
    e.dataTransfer.setData('text/plain', tileData);
    onDragStart?.(e);
  };

  const renderDots = (dots: number) => {
    // Deze array definieert de posities van de stippen voor elk nummer (0-6).
    const dotPositions = {
      0: [],
      1: [4], // midden
      2: [0, 8], // linksboven, rechtsonder
      3: [0, 4, 8], // linksboven, midden, rechtsonder
      4: [0, 2, 6, 8], // hoeken
      5: [0, 2, 4, 6, 8], // hoeken + midden
      6: [0, 1, 2, 6, 7, 8] // twee kolommen
    };

    const positions = dotPositions[dots as keyof typeof dotPositions] || [];
    
    return (
      // De stippen worden weergegeven in een 3x3 raster.
      <div className="relative w-full h-full grid grid-cols-3 grid-rows-3 gap-[2px] p-1">
        {Array.from({ length: 9 }, (_, i) => (
          <div
            key={i}
            className={cn(
              "rounded-full transition-all duration-200",
              positions.includes(i)
                ? "bg-[hsl(var(--domino-dot))] shadow-sm"
                : "",
              size === 'small' && positions.includes(i) && "w-1 h-1",
              size === 'medium' && positions.includes(i) && "w-1.5 h-1.5",
              size === 'large' && positions.includes(i) && "w-2 h-2"
            )}
          />
        ))}
      </div>
    );
  };

  const sizeMetrics = {
    small: { width: '48px', height: '24px', thickness: '6px' },
    medium: { width: '64px', height: '32px', thickness: '8px' },
    large: { width: '80px', height: '40px', thickness: '10px' },
  };

  const { width, height, thickness } = sizeMetrics[size];
  const isHorizontal = orientation === 'horizontal';

  // De grootte van de tegel wordt dynamisch berekend op basis van de oriëntatie
  const tileWidth = isHorizontal ? width : height;
  const tileHeight = isHorizontal ? height : width;

  return (
    <div
      className={cn(
        "relative flex cursor-pointer select-none transition-all duration-200 preserve-3d",
        isSelected && "ring-2 ring-blue-500 scale-105 shadow-[var(--shadow-domino-hover)]",
        isPlayable && "hover:scale-105 hover:shadow-[var(--shadow-domino-hover)]",
        !isPlayable && "opacity-50 cursor-not-allowed",
        "rounded-sm",
        className
      )}
      onClick={isPlayable ? onClick : undefined}
      onDragStart={isPlayable ? handleDragStart : undefined}
      draggable={isPlayable}
      style={{
        transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg)`,
        width: tileWidth,
        height: tileHeight,
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Voorkant */}
      <div className={cn(
        "absolute inset-0 rounded-sm backface-hidden",
        "flex",
        isHorizontal ? "flex-row" : "flex-col",
        "bg-gradient-to-br from-[hsl(var(--domino-highlight))] via-[hsl(var(--domino-face))] to-[hsl(var(--domino-lowlight))]",
        "shadow-[var(--shadow-domino)]",
      )}
      style={{
        transform: `translateZ(calc(${thickness} / 2))`,
        border: '1px solid hsl(var(--domino-edge))'
      }}
      >
        <div className={cn(
          "flex-1 flex items-center justify-center relative",
          isHorizontal ? "border-r border-[hsl(var(--domino-edge))]" : "border-b border-[hsl(var(--domino-edge))]"
        )}>
          {renderDots(leftDots)}
        </div>
        <div className="flex-1 flex items-center justify-center relative">
          {renderDots(rightDots)}
        </div>
        <div className={cn(
          "absolute bg-[hsl(var(--domino-highlight))] pointer-events-none",
          isHorizontal ? "top-0 left-1/2 h-full w-[1px] -translate-x-0.5" : "left-0 top-1/2 w-full h-[1px] -translate-y-0.5"
        )} />
      </div>

      {/* Achterkant */}
      <div className="absolute inset-0 bg-[hsl(var(--domino-back))] rounded-sm backface-hidden"
            style={{ transform: `rotateY(180deg) translateZ(calc(${thickness} / 2))` }}
      />
      
      {/* Bovenkant */}
      <div className="absolute top-0 left-0 w-full rounded-t-sm bg-[hsl(var(--domino-side))] origin-top backface-hidden"
            style={{
              height: thickness,
              transform: `rotateX(90deg) translateY(calc(${thickness} / -2))`
            }}
      />
      
      {/* Onderkant */}
      <div className="absolute bottom-0 left-0 w-full rounded-b-sm bg-[hsl(var(--domino-side))] origin-bottom backface-hidden"
            style={{
              height: thickness,
              transform: `rotateX(-90deg) translateY(calc(${thickness} / 2))`
            }}
      />

      {/* Linkerkant */}
      <div className="absolute top-0 left-0 h-full rounded-l-sm bg-[hsl(var(--domino-side))] origin-left backface-hidden"
            style={{
              width: thickness,
              transform: `rotateY(-90deg) translateX(calc(${thickness} / -2))`
            }}
      />

      {/* Rechterkant */}
      <div className="absolute top-0 right-0 h-full rounded-r-sm bg-[hsl(var(--domino-side))] origin-right backface-hidden"
            style={{
              width: thickness,
              transform: `rotateY(90deg) translateX(calc(${thickness} / 2))`
            }}
      />
      
    </div>
  );
};

// De hoofdcomponent van de applicatie die de dominostenen weergeeft.
const DominoTileDemo = () => {
  const [selectedTile, setSelectedTile] = useState({ leftDots: 2, rightDots: 4 });
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [droppedTile, setDroppedTile] = useState<{ leftDots: number; rightDots: number; orientation: string } | null>(null);
  const [animationMessage, setAnimationMessage] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  
  const { 
    currentDeviceType, 
    getSettingsForDevice, 
    updateRotation,
    updateRotationSpeed,
    updateRotationAmplitude,
    updateAnimationDuration,
    updateShakeIntensity,
    updateShakeDuration,
    applyLiveUpdate,
    resetToDefaults,
    // Animation controls from hook
    isAnimating,
    animationMode,
    startShakeAnimation: hookStartShakeAnimation,
    startContinuousRotate: hookStartContinuousRotate,
    stopAnimation: hookStopAnimation,
  } = useGameVisualSettings();
  
  const settings = getSettingsForDevice(currentDeviceType);
  
  console.log('DominoTileDemo settings:', settings);

  // Save function
  const handleSave = () => {
    // Apply live update to broadcast changes to all components
    applyLiveUpdate();
    setSaveMessage('Instellingen opgeslagen!');
    setTimeout(() => setSaveMessage(''), 2000);
  };

  const handleTileClick = (left: number, right: number) => {
    setSelectedTile({ leftDots: left, rightDots: right });
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('text/plain');
    if (data) {
      try {
        const tileData = JSON.parse(data);
        setDroppedTile(tileData);
      } catch (error) {
        console.error("Failed to parse dropped data:", error);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const resetDroppedTile = () => {
    setDroppedTile(null);
  };
  
  const toggleOrientation = () => {
    setOrientation(currentOrientation => currentOrientation === 'horizontal' ? 'vertical' : 'horizontal');
  };

  // Gebruik hook animaties in plaats van lokale animaties
  const startShakeAnimation = () => {
    if (settings.rotationAmplitudeX === 0 && settings.rotationAmplitudeY === 0 && settings.rotationAmplitudeZ === 0) {
        setAnimationMessage("De rotatie-amplitude voor alle assen is 0°. Stel een waarde in om de steen te laten bewegen.");
        return;
    }
    setAnimationMessage("De dominosteen schudt...");
    hookStartShakeAnimation(); // Gebruik hook functie
  };

  const startContinuousRotate = () => {
    if (settings.rotationAmplitudeX === 0 && settings.rotationAmplitudeY === 0 && settings.rotationAmplitudeZ === 0) {
      setAnimationMessage("De rotatie-amplitude voor alle assen is 0°. Stel een waarde in om de steen te laten bewegen.");
      return;
    }
    setAnimationMessage("De dominosteen roteert continu...");
    hookStartContinuousRotate(); // Gebruik hook functie
  };

  const stopAnimation = () => {
    hookStopAnimation(); // Gebruik hook functie
    setAnimationMessage("Animatie gestopt.");
  };
  
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const mainButtonClass = "p-3 rounded-md shadow-md transition-colors flex items-center gap-2";
  const activeMainButtonClass = (mode: 'shake' | 'rotate') => cn(
    mainButtonClass,
    animationMode === mode ? "bg-blue-600 text-white" : "bg-gray-700 text-white hover:bg-gray-600",
    isAnimating && animationMode !== mode && "opacity-50 cursor-not-allowed"
  );
  
  const buttonClass = "p-3 bg-gray-700 text-white rounded-md shadow-md hover:bg-gray-600 transition-colors flex items-center gap-2 disabled:bg-gray-700 disabled:cursor-not-allowed";
  const buttonClassRoteren = animationMode === 'rotate' ? "bg-indigo-600 text-white" : "bg-gray-700 text-white hover:bg-gray-600";
  const buttonClassSchudden = animationMode === 'shake' ? "bg-indigo-600 text-white" : "bg-gray-700 text-white hover:bg-gray-600";
  
  return (
    <div className="bg-gray-800 p-8 min-h-screen flex flex-col items-center justify-start font-sans text-white">
      <style>
        {`
          :root {
            --domino-face: 220 50% 90%;
            --domino-highlight: 220 50% 95%;
            --domino-lowlight: 220 50% 80%;
            --domino-dot: 220 20% 20%;
            --domino-edge: 220 20% 30%;
            --domino-side: 220 30% 70%;
            --domino-back: 220 30% 60%;
            --shadow-domino: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
            --shadow-domino-hover: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
          }
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');
          body {
            font-family: 'Inter', sans-serif;
            perspective: 1000px;
          }
          .preserve-3d {
            transform-style: preserve-3d;
          }
          .backface-hidden {
            backface-visibility: hidden;
          }
        `}
      </style>
      <h1 className="text-3xl font-bold mb-4">Dominostenen Demo</h1>
      <p className="text-sm mb-8 text-center text-gray-400 max-w-lg">
        Dit is een demonstratie van de <strong>DominoTile</strong> component. Klik op een tegel om deze te selecteren. De interactieve tegel hieronder kun je roteren of in de dropzone slepen.
      </p>
      
      <div className="flex flex-wrap gap-12 items-center justify-center mb-8">
        <DominoTile leftDots={5} rightDots={3} size="large" onClick={() => handleTileClick(5, 3)} isSelected={selectedTile.leftDots === 5 && selectedTile.rightDots === 3}/>
        <DominoTile leftDots={6} rightDots={6} orientation="vertical" onClick={() => handleTileClick(6, 6)} isSelected={selectedTile.leftDots === 6 && selectedTile.rightDots === 6} />
        <DominoTile leftDots={1} rightDots={0} isPlayable={false} size="small" />
        <DominoTile leftDots={2} rightDots={4} onClick={() => handleTileClick(2, 4)} isSelected={selectedTile.leftDots === 2 && selectedTile.rightDots === 4} />
      </div>
      
      <div className="flex flex-col items-center justify-center gap-4">
        <h2 className="text-2xl font-bold mt-4 mb-2">Interactieve tegel</h2>
        <DominoTile
          leftDots={selectedTile.leftDots}
          rightDots={selectedTile.rightDots}
          orientation={orientation}
          size="large"
          rotateX={settings.rotateX}
          rotateY={settings.rotateY}
          rotateZ={settings.rotateZ}
        />
        
        <div className="flex flex-col items-center gap-4 mt-4">
          <p className="text-white text-sm text-center min-h-[2rem]">{animationMessage}</p>
          <div className="flex gap-4">
            <button
              onClick={toggleOrientation}
              className={buttonClass}
              disabled={isAnimating}
            >
              <RotateCw size={16} /> Roteren
            </button>
            {animationMode === 'rotate' ? (
                <button
                    onClick={stopAnimation}
                    className={cn(mainButtonClass, "bg-red-600 text-white hover:bg-red-500")}
                >
                    <Hand size={16} /> Stop Rotatie
                </button>
            ) : (
                <button
                    onClick={startContinuousRotate}
                    className={cn(mainButtonClass, buttonClassRoteren)}
                    disabled={isAnimating}
                >
                    <Hand size={16} /> Continue Rotatie
                </button>
            )}
            {animationMode === 'shake' ? (
                <button
                    onClick={stopAnimation}
                    className={cn(mainButtonClass, "bg-red-600 text-white hover:bg-red-500")}
                >
                    <Hand size={16} /> Stop Schudden
                </button>
            ) : (
                <button
                    onClick={startShakeAnimation}
                    className={cn(mainButtonClass, buttonClassSchudden)}
                    disabled={isAnimating}
                >
                    <Hand size={16} /> Schudden
                </button>
            )}
          </div>
        </div>
      </div>
      
      <div className="w-full max-w-lg mt-8">
        <h2 className="text-2xl font-bold mb-2">Dropzone</h2>
        <p className="text-sm mb-4 text-gray-400">Sleep een van de tegels hierheen.</p>
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="relative w-full h-40 border-2 border-dashed border-gray-600 rounded-lg flex items-center justify-center bg-gray-900 transition-colors hover:bg-gray-700"
        >
          {droppedTile ? (
            <div className="flex flex-col items-center gap-2">
              <DominoTile
                leftDots={droppedTile.leftDots}
                rightDots={droppedTile.rightDots}
                orientation={droppedTile.orientation as 'horizontal' | 'vertical'}
                size="medium"
              />
              <button
                onClick={resetDroppedTile}
                className="mt-2 p-2 bg-red-600 text-white rounded-full shadow-md hover:bg-red-500 transition-colors"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          ) : (
            <p className="text-gray-500">Laat een tegel hier vallen</p>
          )}
        </div>
      </div>
      
      {/* Visuele Instellingen */}
      <div className="bg-gray-700 border border-gray-600 rounded-lg p-6 space-y-6 max-w-4xl w-full mt-8">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold">Visuele Instellingen</h3>
          <div className="flex items-center gap-3">
            {saveMessage && (
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <CheckCircle size={16} />
                {saveMessage}
              </div>
            )}
            <Button
              onClick={handleSave}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              size="sm"
            >
              <Save size={16} />
              Opslaan
            </Button>
            <Button
              onClick={() => resetToDefaults()}
              variant="outline"
              size="sm"
              className="text-gray-300 border-gray-500 hover:bg-gray-600"
            >
              Reset
            </Button>
          </div>
        </div>
        
        <div className="flex flex-col gap-6 w-full max-w-md">
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-medium">Animatie Duur:</label>
              <span className="text-sm text-gray-400">{settings.animationDuration.toFixed(1)}s</span>
            </div>
            <Slider
              value={[settings.animationDuration]}
              onValueChange={(value) => updateAnimationDuration(value[0])}
              min={0.5}
              max={5}
              step={0.1}
              className="w-full [&>div]:bg-blue-600 [&_[role=slider]]:border-blue-600 [&_[role=slider]]:bg-blue-600"
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-medium">Rotatie Snelheid:</label>
              <span className="text-sm text-gray-400">{settings.rotationSpeed.toFixed(1)}x</span>
            </div>
            <Slider
              value={[settings.rotationSpeed]}
              onValueChange={(value) => updateRotationSpeed(value[0])}
              min={0.5}
              max={10}
              step={0.1}
              className="w-full [&>div]:bg-blue-600 [&_[role=slider]]:border-blue-600 [&_[role=slider]]:bg-blue-600"
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-medium">Rotatie-amplitude X-as:</label>
              <span className="text-sm text-gray-400">{settings.rotationAmplitudeX.toFixed(1)}°</span>
            </div>
            <Slider
              value={[settings.rotationAmplitudeX]}
              onValueChange={(value) => updateRotationAmplitude('X', value[0])}
              min={0}
              max={500}
              step={1}
              className="w-full [&>div]:bg-blue-600 [&_[role=slider]]:border-blue-600 [&_[role=slider]]:bg-blue-600"
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-medium">Rotatie-amplitude Y-as:</label>
              <span className="text-sm text-gray-400">{settings.rotationAmplitudeY.toFixed(1)}°</span>
            </div>
            <Slider
              value={[settings.rotationAmplitudeY]}
              onValueChange={(value) => updateRotationAmplitude('Y', value[0])}
              min={0}
              max={500}
              step={1}
              className="w-full [&>div]:bg-blue-600 [&_[role=slider]]:border-blue-600 [&_[role=slider]]:bg-blue-600"
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-medium">Rotatie-amplitude Z-as:</label>
              <span className="text-sm text-gray-400">{settings.rotationAmplitudeZ.toFixed(1)}°</span>
            </div>
            <Slider
              value={[settings.rotationAmplitudeZ]}
              onValueChange={(value) => updateRotationAmplitude('Z', value[0])}
              min={0}
              max={500}
              step={1}
              className="w-full [&>div]:bg-blue-600 [&_[role=slider]]:border-blue-600 [&_[role=slider]]:bg-blue-600"
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-medium">Rotatie X-as:</label>
              <span className="text-sm text-gray-400">{settings.rotateX.toFixed(1)}°</span>
            </div>
            <Slider
              value={[settings.rotateX]}
              onValueChange={(value) => updateRotation('X', value[0])}
              min={-90}
              max={90}
              step={1}
              className="w-full [&>div]:bg-blue-600 [&_[role=slider]]:border-blue-600 [&_[role=slider]]:bg-blue-600"
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-medium">Rotatie Y-as:</label>
              <span className="text-sm text-gray-400">{settings.rotateY.toFixed(1)}°</span>
            </div>
            <Slider
              value={[settings.rotateY]}
              onValueChange={(value) => updateRotation('Y', value[0])}
              min={-90}
              max={90}
              step={1}
              className="w-full [&>div]:bg-blue-600 [&_[role=slider]]:border-blue-600 [&_[role=slider]]:bg-blue-600"
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-sm font-medium">Rotatie Z-as:</label>
              <span className="text-sm text-gray-400">{settings.rotateZ.toFixed(1)}°</span>
            </div>
            <Slider
              value={[settings.rotateZ]}
              onValueChange={(value) => updateRotation('Z', value[0])}
              min={-90}
              max={90}
              step={1}
              className="w-full [&>div]:bg-blue-600 [&_[role=slider]]:border-blue-600 [&_[role=slider]]:bg-blue-600"
            />
          </div>
        </div>
      </div>
      
    </div>
  );
};

export default DominoTileDemo;