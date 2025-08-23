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
      {/* Gradient definities voor 3D effect */}
      <defs>
        <linearGradient id="dominoGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e2e8f0" />
          <stop offset="50%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>
        <linearGradient id="dominoGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f1f5f9" />
          <stop offset="50%" stopColor="#e2e8f0" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>
        <linearGradient id="dominoGradient3" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="50%" stopColor="#f1f5f9" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </linearGradient>
      </defs>

      {/* Achterste domino (onderaan) */}
      <g transform="rotate(25 12 12)">
        <rect
          x="6"
          y="8"
          width="12"
          height="8"
          rx="1.5"
          fill="url(#dominoGradient1)"
          stroke="#64748b"
          strokeWidth="0.5"
        />
        <line x1="12" y1="9" x2="12" y2="15" stroke="#64748b" strokeWidth="0.5" />
        {/* 3 stippen links, 5 stippen rechts */}
        <circle cx="9" cy="10.5" r="0.7" fill="#475569" />
        <circle cx="9" cy="12" r="0.7" fill="#475569" />
        <circle cx="9" cy="13.5" r="0.7" fill="#475569" />
        <circle cx="14" cy="10" r="0.7" fill="#475569" />
        <circle cx="16" cy="10" r="0.7" fill="#475569" />
        <circle cx="15" cy="12" r="0.7" fill="#475569" />
        <circle cx="14" cy="14" r="0.7" fill="#475569" />
        <circle cx="16" cy="14" r="0.7" fill="#475569" />
      </g>

      {/* Middelste domino */}
      <g transform="rotate(-10 12 12)">
        <rect
          x="5"
          y="7"
          width="14"
          height="10"
          rx="1.5"
          fill="url(#dominoGradient2)"
          stroke="#64748b"
          strokeWidth="0.5"
        />
        <line x1="12" y1="8" x2="12" y2="16" stroke="#64748b" strokeWidth="0.5" />
        {/* 6 stippen links, 2 stippen rechts */}
        <circle cx="7.5" cy="9" r="0.7" fill="#475569" />
        <circle cx="10.5" cy="9" r="0.7" fill="#475569" />
        <circle cx="7.5" cy="11.5" r="0.7" fill="#475569" />
        <circle cx="10.5" cy="11.5" r="0.7" fill="#475569" />
        <circle cx="7.5" cy="14" r="0.7" fill="#475569" />
        <circle cx="10.5" cy="14" r="0.7" fill="#475569" />
        <circle cx="14.5" cy="10" r="0.7" fill="#475569" />
        <circle cx="16.5" cy="13" r="0.7" fill="#475569" />
      </g>

      {/* Voorste domino (bovenop) */}
      <g transform="rotate(15 12 12)">
        <rect
          x="7"
          y="6"
          width="10"
          height="12"
          rx="1.5"
          fill="url(#dominoGradient3)"
          stroke="#475569"
          strokeWidth="0.8"
        />
        <line x1="12" y1="7" x2="12" y2="17" stroke="#475569" strokeWidth="0.8" />
        {/* 4 stippen links, 1 stip rechts */}
        <circle cx="9" cy="9" r="0.8" fill="#334155" />
        <circle cx="11" cy="9" r="0.8" fill="#334155" />
        <circle cx="9" cy="15" r="0.8" fill="#334155" />
        <circle cx="11" cy="15" r="0.8" fill="#334155" />
        <circle cx="14.5" cy="12" r="0.8" fill="#334155" />
      </g>
    </svg>
  );
};