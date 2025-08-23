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
      {/* Gouden domino steen achtergrond */}
      <rect
        x="3"
        y="6"
        width="18"
        height="12"
        rx="2"
        ry="2"
        fill="#F4D03F"
        stroke="#B7950B"
        strokeWidth="1.5"
      />
      
      {/* Schaduw effect */}
      <rect
        x="3.5"
        y="6.5"
        width="17"
        height="11"
        rx="1.5"
        ry="1.5"
        fill="none"
        stroke="#D4AF37"
        strokeWidth="0.5"
      />
      
      {/* Middenlijn */}
      <line
        x1="12"
        y1="7"
        x2="12"
        y2="17"
        stroke="#B7950B"
        strokeWidth="1"
      />
      
      {/* Linker kant - 6 stippen patroon */}
      <circle cx="6.5" cy="8.5" r="0.8" fill="#2C3E50" />
      <circle cx="9.5" cy="8.5" r="0.8" fill="#2C3E50" />
      <circle cx="6.5" cy="12" r="0.8" fill="#2C3E50" />
      <circle cx="9.5" cy="12" r="0.8" fill="#2C3E50" />
      <circle cx="6.5" cy="15.5" r="0.8" fill="#2C3E50" />
      <circle cx="9.5" cy="15.5" r="0.8" fill="#2C3E50" />
      
      {/* Rechter kant - 3 stippen patroon */}
      <circle cx="14.5" cy="9" r="0.8" fill="#2C3E50" />
      <circle cx="16.5" cy="12" r="0.8" fill="#2C3E50" />
      <circle cx="14.5" cy="15" r="0.8" fill="#2C3E50" />
    </svg>
  );
};