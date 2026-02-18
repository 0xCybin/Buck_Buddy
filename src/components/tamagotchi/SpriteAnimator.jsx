// src/components/tamagotchi/SpriteAnimator.jsx
// Renders a single frame from a horizontal sprite sheet strip.
// Cycles through frames with configurable FPS using CSS background-position.

import React, { useState, useEffect, useRef } from 'react';

const SpriteAnimator = ({
  src,           // Processed sprite sheet URL (transparent background)
  frameWidth,    // Width of one frame in pixels
  frameHeight,   // Height of one frame in pixels
  frameCount,    // Total frames in the strip
  fps = 7,
  scale = 1,
  playing = true,
  loop = true,
  startFrame = 0,
  onAnimationEnd,
  style: extraStyle = {},
}) => {
  const [frame, setFrame] = useState(startFrame);
  const intervalRef = useRef(null);

  // Reset frame when sprite source or startFrame changes
  useEffect(() => {
    setFrame(startFrame);
  }, [src, startFrame]);

  // Frame cycling
  useEffect(() => {
    if (!playing || !src) return;

    intervalRef.current = setInterval(() => {
      setFrame(prev => {
        const next = prev + 1;
        if (next >= frameCount) {
          if (!loop) {
            clearInterval(intervalRef.current);
            onAnimationEnd?.();
            return prev;
          }
          return 0;
        }
        return next;
      });
    }, 1000 / fps);

    return () => clearInterval(intervalRef.current);
  }, [src, playing, frameCount, fps, loop, onAnimationEnd]);

  if (!src) return null;

  const displayW = Math.round(frameWidth * scale);
  const displayH = Math.round(frameHeight * scale);
  const sheetW = Math.round(frameWidth * frameCount * scale);

  return (
    <div
      style={{
        width: displayW,
        height: displayH,
        backgroundImage: `url(${src})`,
        backgroundSize: `${sheetW}px ${displayH}px`,
        backgroundPosition: `-${frame * displayW}px 0`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
        ...extraStyle,
      }}
    />
  );
};

export default SpriteAnimator;
