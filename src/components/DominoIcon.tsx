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
      {/* Domino tile background */}
      <rect
        x="3"
        y="7"
        width="18"
        height="10"
        rx="1.5"
        ry="1.5"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="0.5"
      />
      
      {/* Inner white background */}
      <rect
        x="3.5"
        y="7.5"
        width="17"
        height="9"
        rx="1"
        ry="1"
        fill="white"
      />
      
      {/* Divider line in the middle */}
      <line
        x1="12"
        y1="7.5"
        x2="12"
        y2="16.5"
        stroke="currentColor"
        strokeWidth="0.5"
      />
      
      {/* Left side - 3 dots */}
      <circle cx="7.5" cy="9.5" r="0.8" fill="currentColor" />
      <circle cx="7.5" cy="12" r="0.8" fill="currentColor" />
      <circle cx="7.5" cy="14.5" r="0.8" fill="currentColor" />
      
      {/* Right side - 2 dots */}
      <circle cx="16.5" cy="10.5" r="0.8" fill="currentColor" />
      <circle cx="16.5" cy="13.5" r="0.8" fill="currentColor" />
    </svg>
  );
};