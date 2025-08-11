import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { useLMPSettings } from '@/hooks/useLMPSettings';

export const LMPToggle: React.FC = () => {
  const { enabled, toggleEnabled } = useLMPSettings();

  return (
    <Card
      className="absolute left-[-3.5rem] top-1/2 -translate-y-1/2 z-40 p-2 shadow-md backdrop-blur-sm bg-background/90 border"
      role="region"
      aria-label="Legal Move Preview schakelaar"
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium">LMP</span>
        <Switch checked={enabled} onCheckedChange={toggleEnabled} aria-label="LMP aan/uit" />
      </div>
    </Card>
  );
};
