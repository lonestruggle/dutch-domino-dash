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
      {/* Domino steen achtergrond */}
      <rect
        x="4"
        y="6"
        width="16"
        height="12"
        rx="2"
        ry="2"
        fill="white"
        stroke="#2c3e50"
        strokeWidth="2"
      />
      
      {/* Middenlijn */}
      <line
        x1="12"
        y1="7"
        x2="12"
        y2="17"
        stroke="#2c3e50"
        strokeWidth="1.5"
      />
      
      {/* Linker helft - 6 stippen */}
      <circle cx="7" cy="9" r="1" fill="#2c3e50" />
      <circle cx="11" cy="9" r="1" fill="#2c3e50" />
      <circle cx="7" cy="12" r="1" fill="#2c3e50" />
      <circle cx="11" cy="12" r="1" fill="#2c3e50" />
      <circle cx="7" cy="15" r="1" fill="#2c3e50" />
      <circle cx="11" cy="15" r="1" fill="#2c3e50" />
      
      {/* Rechter helft - 1 stip */}
      <circle cx="16" cy="12" r="1" fill="#2c3e50" />
    </svg>
  );
};