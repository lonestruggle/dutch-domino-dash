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
      {/* Achterste domino steen (wit met zwarte stippen) */}
      <rect
        x="8"
        y="2"
        width="12"
        height="18"
        rx="3"
        ry="3"
        fill="white"
        stroke="#1f2937"
        strokeWidth="2"
        transform="rotate(15 14 11)"
      />
      
      {/* Middenlijn achterste steen */}
      <line
        x1="12"
        y1="4"
        x2="16"
        y2="18"
        stroke="#1f2937"
        strokeWidth="1.5"
        transform="rotate(15 14 11)"
      />
      
      {/* Stippen achterste steen - boven (1 stip) */}
      <circle cx="14" cy="7" r="1.2" fill="#1f2937" transform="rotate(15 14 11)" />
      
      {/* Stippen achterste steen - onder (2 stippen) */}
      <circle cx="12.5" cy="15" r="1.2" fill="#1f2937" transform="rotate(15 14 11)" />
      <circle cx="15.5" cy="15" r="1.2" fill="#1f2937" transform="rotate(15 14 11)" />
      
      {/* Voorste domino steen (zwart met witte stippen) */}
      <rect
        x="2"
        y="4"
        width="12"
        height="18"
        rx="3"
        ry="3"
        fill="#1f2937"
        stroke="#1f2937"
        strokeWidth="2"
      />
      
      {/* Middenlijn voorste steen */}
      <line
        x1="8"
        y1="6"
        x2="8"
        y2="20"
        stroke="white"
        strokeWidth="1.5"
      />
      
      {/* Stippen voorste steen - boven (6 stippen) */}
      <circle cx="5.5" cy="8" r="1" fill="white" />
      <circle cx="10.5" cy="8" r="1" fill="white" />
      <circle cx="5.5" cy="10.5" r="1" fill="white" />
      <circle cx="10.5" cy="10.5" r="1" fill="white" />
      <circle cx="5.5" cy="13" r="1" fill="white" />
      <circle cx="10.5" cy="13" r="1" fill="white" />
      
      {/* Stippen voorste steen - onder (4 stippen) */}
      <circle cx="5.5" cy="16" r="1" fill="white" />
      <circle cx="10.5" cy="16" r="1" fill="white" />
      <circle cx="5.5" cy="19" r="1" fill="white" />
      <circle cx="10.5" cy="19" r="1" fill="white" />
    </svg>
  );
};