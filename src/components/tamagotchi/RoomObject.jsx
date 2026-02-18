// src/components/tamagotchi/RoomObject.jsx
// A single positioned sprite in the room scene.
// Async-loads and removes black background, then renders with pixelated scaling.

import React, { useState, useEffect } from 'react';
import { removeBlackBackground } from '../../utils/spriteProcessor';

const RoomObject = ({
  src,
  displayWidth,
  displayHeight,
  left, top, right, bottom,
  zIndex = 1,
  title,
  onClick,
  style: extraStyle = {},
}) => {
  const [processedSrc, setProcessedSrc] = useState(null);

  useEffect(() => {
    if (!src) return;
    removeBlackBackground(src).then(setProcessedSrc);
  }, [src]);

  if (!processedSrc) return null;

  const position = {};
  if (left !== undefined) position.left = left;
  if (top !== undefined) position.top = top;
  if (right !== undefined) position.right = right;
  if (bottom !== undefined) position.bottom = bottom;

  return (
    <img
      src={processedSrc}
      alt={title || ''}
      draggable={false}
      onClick={onClick}
      style={{
        position: 'absolute',
        width: displayWidth,
        height: displayHeight,
        imageRendering: 'pixelated',
        zIndex,
        pointerEvents: onClick ? 'auto' : 'none',
        cursor: onClick ? 'pointer' : 'default',
        ...position,
        ...extraStyle,
      }}
    />
  );
};

export default RoomObject;
