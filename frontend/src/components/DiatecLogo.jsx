import React from 'react';

// variant: 'color' (light backgrounds) | 'white' (dark backgrounds like sidebar)
export default function DiatecLogo({ variant = 'color', iconSize = 40 }) {
  const isWhite = variant === 'white';
  const gap = Math.round(iconSize * 0.28);
  const fontSize = Math.round(iconSize * 0.72);
  const iconW = Math.round(iconSize * 0.68);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap }}>
      {/* The "d" shape — no box, just the letter form with gradient */}
      <svg
        width={iconW}
        height={iconSize}
        viewBox="0 0 34 50"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {!isWhite && (
          <defs>
            <linearGradient id="diatecGrad" x1="0.4" y1="0" x2="0.6" y2="1">
              <stop offset="0%" stopColor="#5B9BD5" />
              <stop offset="100%" stopColor="#1A3C7A" />
            </linearGradient>
          </defs>
        )}
        {/*
          "d" path:
          - Stem: x 22–30, y 2–47
          - Bowl: arc from (22,22) CCW large arc to (22,43), center ≈ (13,32.5), r≈13
        */}
        <path
          d="M 22 2 L 22 22 A 13 13 0 1 0 22 43 L 22 47 L 30 47 L 30 2 Z"
          fill={isWhite ? 'white' : 'url(#diatecGrad)'}
        />
      </svg>

      {/* "diatec" text: "dia" dark, "tec" blue */}
      <span
        style={{
          fontSize,
          fontWeight: 600,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
          lineHeight: 1,
          letterSpacing: '-0.3px',
        }}
      >
        <span style={{ color: isWhite ? 'white' : '#2D3B52' }}>dia</span>
        <span style={{ color: isWhite ? 'rgba(255,255,255,0.65)' : '#4A8AC4' }}>tec</span>
      </span>
    </div>
  );
}
