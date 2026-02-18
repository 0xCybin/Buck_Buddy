// src/components/tamagotchi/CoinDisplay.jsx
// Animated GME coin badge in the top-right corner of the scene.

import React, { useState, useEffect } from 'react';
import { getCoinFrameUrl } from '../../utils/assetManifest';

const FRAME_COUNT = 4;
const FRAME_INTERVAL = 250;

const CoinDisplay = ({ balance = 0 }) => {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame(prev => (prev + 1) % FRAME_COUNT);
    }, FRAME_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{
      position: 'absolute',
      top: 6, right: 8,
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      background: 'rgba(0,0,0,0.6)',
      borderRadius: 8,
      padding: '3px 8px',
      zIndex: 10,
      backdropFilter: 'blur(2px)',
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      <img
        src={getCoinFrameUrl(frame)}
        alt=""
        style={{ width: 14, height: 14, imageRendering: 'pixelated' }}
      />
      <span style={{
        fontSize: 12,
        fontWeight: 700,
        color: '#eab308',
        fontFamily: 'monospace',
      }}>
        {balance}
      </span>
    </div>
  );
};

export default CoinDisplay;
