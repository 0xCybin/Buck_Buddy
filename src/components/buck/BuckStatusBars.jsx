// src/components/buck/BuckStatusBars.jsx
// Hunger and happiness stat bars with pixel art icons, color gradients, and low-value pulse.

import React from 'react';

const StatusBar = ({ label, value, color, lowColor, iconUrl }) => {
  const isLow = value < 25;
  const isCritical = value < 10;
  const barColor = isLow ? lowColor : color;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
      <img
        src={iconUrl}
        alt={label}
        style={{
          width: 18, height: 18,
          imageRendering: 'pixelated',
          animation: isCritical ? 'buckBarIconPulse 0.8s ease-in-out infinite' : undefined,
        }}
      />
      <div style={{ flex: 1, position: 'relative' }}>
        <div style={{
          width: '100%',
          height: 10,
          background: 'var(--bg-tertiary)',
          borderRadius: 5,
          overflow: 'hidden',
          border: '1px solid var(--border-primary)',
          boxShadow: isLow ? `inset 0 0 4px ${lowColor}33` : undefined,
        }}>
          <div style={{
            width: `${Math.max(0, Math.min(100, value))}%`,
            height: '100%',
            background: isLow
              ? `linear-gradient(90deg, ${lowColor}, ${lowColor}cc)`
              : `linear-gradient(90deg, ${color}cc, ${color})`,
            borderRadius: 5,
            transition: 'width 0.6s ease, background 0.4s ease',
            boxShadow: isLow ? `0 0 8px ${lowColor}88` : `0 1px 3px ${color}44`,
            animation: isCritical ? 'buckBarPulse 1s ease-in-out infinite' : undefined,
          }} />
        </div>
      </div>
      <span style={{
        fontSize: 10,
        fontWeight: 700,
        color: isCritical ? lowColor : isLow ? lowColor : 'var(--text-secondary)',
        minWidth: 30,
        textAlign: 'right',
        fontFamily: 'monospace',
        animation: isCritical ? 'buckBarTextPulse 1s ease-in-out infinite' : undefined,
      }}>
        {Math.round(value)}%
      </span>
    </div>
  );
};

const BuckStatusBars = ({ hunger, happiness }) => {
  const hungerIcon = chrome.runtime.getURL('assets/tamagotchi/ui/bars/bar_hunger.png');
  const happinessIcon = chrome.runtime.getURL('assets/tamagotchi/ui/bars/bar_happiness.png');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', padding: '0 8px' }}>
      <StatusBar
        label="Hunger"
        value={hunger}
        color="#22c55e"
        lowColor="#ef4444"
        iconUrl={hungerIcon}
      />
      <StatusBar
        label="Happiness"
        value={happiness}
        color="#eab308"
        lowColor="#f97316"
        iconUrl={happinessIcon}
      />
      <style>{`
        @keyframes buckBarPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes buckBarIconPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        @keyframes buckBarTextPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default BuckStatusBars;
