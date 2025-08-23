import React from 'react';

interface DominoIconProps {
  className?: string;
  size?: number;
}

export const DominoIcon: React.FC<DominoIconProps> = ({ className = "", size = 24 }) => {
  return (
    <img
      src="/lovable-uploads/dce7c997-6bdd-401f-9c33-2c71d6bbde3e.png"
      alt="Domino Logo"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain' }}
    />
  );
};