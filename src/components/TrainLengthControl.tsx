import React from 'react';
import { Button } from '@/components/ui/button';
import { Train, Minus, Plus } from 'lucide-react';

interface TrainLengthControlProps {
  trainLength: number;
  onTrainLengthChange: (length: number) => void;
  className?: string;
}

export const TrainLengthControl: React.FC<TrainLengthControlProps> = ({
  trainLength,
  onTrainLengthChange,
  className = ''
}) => {
  return (
    <div className={`flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-lg p-2 border ${className}`}>
      <Train className="h-4 w-4 text-primary" />
      <span className="text-sm font-medium">Trein:</span>
      
      <Button
        variant="outline"
        size="sm"
        onClick={() => onTrainLengthChange(Math.max(1, trainLength - 1))}
        disabled={trainLength <= 1}
        className="h-6 w-6 p-0"
      >
        <Minus className="h-3 w-3" />
      </Button>
      
      <span className="text-sm font-bold min-w-[20px] text-center">
        {trainLength}
      </span>
      
      <Button
        variant="outline"
        size="sm"
        onClick={() => onTrainLengthChange(Math.min(10, trainLength + 1))}
        disabled={trainLength >= 10}
        className="h-6 w-6 p-0"
      >
        <Plus className="h-3 w-3" />
      </Button>
      
      <span className="text-xs text-muted-foreground">stenen</span>
    </div>
  );
};