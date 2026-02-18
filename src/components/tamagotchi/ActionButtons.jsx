// src/components/tamagotchi/ActionButtons.jsx
// Feed / Sleep / Play / Clean buttons below the scene.

import React, { useState } from 'react';
import { getActionIcon } from '../../utils/assetManifest';

const ACTIONS = [
  { key: 'feed',  emoji: '\uD83C\uDF54', label: 'Feed' },
  { key: 'sleep', emoji: '\uD83D\uDCA4', label: 'Sleep' },
  { key: 'play',  emoji: '\uD83C\uDFAE', label: 'Play' },
  { key: 'clean', emoji: '\uD83E\uDDF9', label: 'Clean' },
];

const ActionButtons = ({ onAction, disabled = {} }) => {
  const [hoveredKey, setHoveredKey] = useState(null);
  const [pressedKey, setPressedKey] = useState(null);

  const handleClick = (key) => {
    if (disabled[key]) return;
    setPressedKey(key);
    onAction?.(key);
    setTimeout(() => setPressedKey(null), 300);
  };

  return (
    <div style={{
      display: 'flex',
      gap: 8,
      justifyContent: 'center',
      width: '100%',
      padding: '4px 0',
    }}>
      {ACTIONS.map(({ key, emoji, label }) => {
        const isDisabled = disabled[key];
        const isHovered = hoveredKey === key && !isDisabled;
        const isPressed = pressedKey === key;
        const iconUrl = getActionIcon(key);

        return (
          <button
            key={key}
            onClick={() => handleClick(key)}
            onMouseEnter={() => setHoveredKey(key)}
            onMouseLeave={() => setHoveredKey(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 10px',
              border: '2px solid rgba(255,255,255,0.15)',
              borderRadius: 8,
              background: isDisabled
                ? 'rgba(255,255,255,0.03)'
                : isPressed
                  ? 'rgba(255,255,255,0.18)'
                  : isHovered
                    ? 'rgba(255,255,255,0.12)'
                    : 'rgba(255,255,255,0.07)',
              color: isDisabled ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.85)',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              fontSize: 11,
              fontWeight: 600,
              fontFamily: 'monospace',
              transition: 'all 0.15s ease',
              transform: isPressed ? 'scale(0.93)' : isHovered ? 'scale(1.04)' : 'scale(1)',
              outline: 'none',
            }}
          >
            {iconUrl ? (
              <img src={iconUrl} alt="" style={{ width: 14, height: 14, imageRendering: 'pixelated' }} />
            ) : (
              <span style={{ fontSize: 13, lineHeight: 1 }}>{emoji}</span>
            )}
            {label}
          </button>
        );
      })}
    </div>
  );
};

export default ActionButtons;
