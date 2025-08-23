import React from 'react';

interface DominoIconProps {
  className?: string;
  size?: number;
}

export const DominoIcon: React.FC<DominoIconProps> = ({ className = "", size = 24 }) => {
  return (
    <img
      src="/lovable-uploads/1e198cd8-a84d-4a5e-be9d-e088b01c3d54.png"
      alt="Domino Logo"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain' }}
    />
  );
};