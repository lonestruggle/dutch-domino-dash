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
      {/* Domino tile background - dark border */}
      <rect
        x="3"
        y="7"
        width="18"
        height="10"
        rx="1.5"
        ry="1.5"
        fill="#1f2937"
        stroke="#1f2937"
        strokeWidth="1"
      />
      
      {/* Inner white background */}
      <rect
        x="4"
        y="8"
        width="16"
        height="8"
        rx="1"
        ry="1"
        fill="white"
      />
      
      {/* Divider line in the middle */}
      <line
        x1="12"
        y1="8"
        x2="12"
        y2="16"
        stroke="#1f2937"
        strokeWidth="1"
      />
      
      {/* Left side - 3 dots */}
      <circle cx="7.5" cy="9.5" r="1" fill="#1f2937" />
      <circle cx="7.5" cy="12" r="1" fill="#1f2937" />
      <circle cx="7.5" cy="14.5" r="1" fill="#1f2937" />
      
      {/* Right side - 2 dots */}
      <circle cx="16.5" cy="10.5" r="1" fill="#1f2937" />
      <circle cx="16.5" cy="13.5" r="1" fill="#1f2937" />
    </svg>
  );
};