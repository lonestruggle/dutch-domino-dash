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
        x="2"
        y="6"
        width="20"
        height="12"
        rx="2"
        ry="2"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1"
      />
      
      {/* Divider line in the middle */}
      <line
        x1="12"
        y1="6"
        x2="12"
        y2="18"
        stroke="white"
        strokeWidth="1"
        opacity="0.3"
      />
      
      {/* Left side - 3 dots */}
      <circle cx="7" cy="10" r="1" fill="white" />
      <circle cx="7" cy="12" r="1" fill="white" />
      <circle cx="7" cy="14" r="1" fill="white" />
      
      {/* Right side - 2 dots */}
      <circle cx="17" cy="10.5" r="1" fill="white" />
      <circle cx="17" cy="13.5" r="1" fill="white" />
    </svg>
  );
};