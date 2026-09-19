import React from 'react';
import logoAsset from '@/assets/wegidomino-logo.png.asset.json';

interface DominoIconProps {
  className?: string;
  size?: number;
}

export const DominoIcon: React.FC<DominoIconProps> = ({ className = "", size = 24 }) => {
  return (
    <img
      src={logoAsset.url}
      alt="Wegi Domino Logo"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain' }}
    />
  );
};