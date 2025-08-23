import React from 'react';

interface DominoIconProps {
  className?: string;
  size?: number;
}

export const DominoIcon: React.FC<DominoIconProps> = ({ className = "", size = 24 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Modern domino tile with rounded corners */}
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="3"
        ry="3"
        fill="hsl(var(--primary))"
        stroke="hsl(var(--border))"
        strokeWidth="2"
      />
      
      {/* Top section with dots pattern */}
      <rect
        x="6"
        y="6"
        width="12"
        height="5"
        rx="1"
        fill="hsl(var(--background))"
      />
      
      {/* Bottom section with dots pattern */}
      <rect
        x="6"
        y="13"
        width="12"
        height="5"
        rx="1"
        fill="hsl(var(--background))"
      />
      
      {/* Top dots - 6 pattern */}
      <circle cx="8.5" cy="7.5" r="0.8" fill="hsl(var(--primary))" />
      <circle cx="12" cy="7.5" r="0.8" fill="hsl(var(--primary))" />
      <circle cx="15.5" cy="7.5" r="0.8" fill="hsl(var(--primary))" />
      <circle cx="8.5" cy="9.5" r="0.8" fill="hsl(var(--primary))" />
      <circle cx="12" cy="9.5" r="0.8" fill="hsl(var(--primary))" />
      <circle cx="15.5" cy="9.5" r="0.8" fill="hsl(var(--primary))" />
      
      {/* Bottom dots - 4 pattern */}
      <circle cx="9" cy="14.5" r="0.8" fill="hsl(var(--primary))" />
      <circle cx="15" cy="14.5" r="0.8" fill="hsl(var(--primary))" />
      <circle cx="9" cy="16.5" r="0.8" fill="hsl(var(--primary))" />
      <circle cx="15" cy="16.5" r="0.8" fill="hsl(var(--primary))" />
    </svg>
  );
};