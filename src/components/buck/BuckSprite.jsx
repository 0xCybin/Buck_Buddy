// src/components/buck/BuckSprite.jsx
// Animated Buck sprite: cycles through frame PNGs, renders equipped item overlays.
// Supports walking bounce, mood glow, and equipped accessory layers.

import React, { useState, useEffect, useRef } from 'react';
import { getMoodAnimation, getActionAnimation, getAnimationFrameUrl, getAssetUrl } from '../../config/shopCatalog';

const FRAME_COUNT = 4;
const FRAME_INTERVAL = 200;
const WALK_FRAME_INTERVAL = 150;

const BuckSprite = ({
  mood,
  activeAnimation,
  equippedItems,
  isOnVacation,
  isWalking,
  onClick,
  size = 100,
  flipX = false,
}) => {
  const [frameIndex, setFrameIndex] = useState(0);
  const [loadedFrames, setLoadedFrames] = useState({});
  const intervalRef = useRef(null);

  // Walking uses dancing animation for a bouncy look
  const walkAnim = isWalking ? 'special/dancing' : null;
  const resolvedAction = activeAnimation ? getActionAnimation(activeAnimation) : null;
  const currentAnim = walkAnim || resolvedAction || getMoodAnimation(isOnVacation ? 'sick' : mood);

  const interval = isWalking ? WALK_FRAME_INTERVAL : FRAME_INTERVAL;

  // Preload frames
  useEffect(() => {
    if (loadedFrames[currentAnim]) return;
    let loaded = 0;
    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = new Image();
      img.src = getAnimationFrameUrl(currentAnim, i);
      const done = () => { loaded++; if (loaded === FRAME_COUNT) setLoadedFrames(prev => ({ ...prev, [currentAnim]: true })); };
      img.onload = done;
      img.onerror = done;
    }
  }, [currentAnim]);

  // Frame cycle
  useEffect(() => {
    setFrameIndex(0);
    intervalRef.current = setInterval(() => {
      setFrameIndex(prev => (prev + 1) % FRAME_COUNT);
    }, interval);
    return () => clearInterval(intervalRef.current);
  }, [currentAnim, interval]);

  const frameUrl = getAnimationFrameUrl(currentAnim, frameIndex);

  // Mood-based glow color
  const glowColor = mood === 'love' ? 'rgba(255, 100, 150, 0.3)'
    : mood === 'sick' ? 'rgba(100, 200, 100, 0.25)'
    : mood === 'angry' ? 'rgba(255, 80, 80, 0.25)'
    : null;

  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        width: size,
        height: size,
        cursor: 'pointer',
        imageRendering: 'pixelated',
        transform: flipX ? 'scaleX(-1)' : 'none',
        animation: isWalking ? 'buckWalkBounce 0.3s ease-in-out infinite' : undefined,
        filter: glowColor ? `drop-shadow(0 0 6px ${glowColor})` : undefined,
        transition: 'filter 0.5s ease',
      }}
    >
      <img
        src={frameUrl}
        alt="Buck"
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          imageRendering: 'pixelated',
          display: 'block',
        }}
      />

      {/* Equipped overlays -- flip is inherited from parent transform */}
      {equippedItems?.outfit && (
        <img src={getAssetUrl(equippedItems.outfit.asset)} alt="" draggable={false}
          style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '80%', imageRendering: 'pixelated', pointerEvents: 'none' }} />
      )}
      {equippedItems?.hat && (
        <img src={getAssetUrl(equippedItems.hat.asset)} alt="" draggable={false}
          style={{ position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)', width: '55%', imageRendering: 'pixelated', pointerEvents: 'none' }} />
      )}
      {equippedItems?.eyewear && (
        <img src={getAssetUrl(equippedItems.eyewear.asset)} alt="" draggable={false}
          style={{ position: 'absolute', top: '28%', left: '50%', transform: 'translateX(-50%)', width: '45%', imageRendering: 'pixelated', pointerEvents: 'none' }} />
      )}
      {equippedItems?.held && (
        <img src={getAssetUrl(equippedItems.held.asset)} alt="" draggable={false}
          style={{ position: 'absolute', bottom: '10%', right: -6, width: '38%', imageRendering: 'pixelated', pointerEvents: 'none' }} />
      )}

      <style>{`
        @keyframes buckWalkBounce {
          0%, 100% { transform: ${flipX ? 'scaleX(-1) ' : ''}translateY(0); }
          50% { transform: ${flipX ? 'scaleX(-1) ' : ''}translateY(-4px); }
        }
      `}</style>
    </div>
  );
};

export default BuckSprite;
