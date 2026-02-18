// src/components/tamagotchi/RoomBackground.jsx
// CSS-drawn room: purple/mauve wall (top 60%) + dark carpet floor (bottom 40%)
// with a baseboard divider. No pre-rendered images, just layered gradients.

import React from 'react';

const WALL_TOP = '#7F6F8F';
const WALL_BOTTOM = '#6B5B7B';
const FLOOR_TOP = '#3D3D4D';
const FLOOR_BOTTOM = '#32323F';
const BASEBOARD = '#4A3A5A';

const RoomBackground = ({ width, height }) => {
  const wallH = Math.round(height * 0.6);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
      {/* Wall */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: wallH,
        background: `linear-gradient(180deg, ${WALL_TOP} 0%, ${WALL_BOTTOM} 100%)`,
      }}>
        {/* Subtle horizontal texture */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `repeating-linear-gradient(
            0deg,
            transparent, transparent 19px,
            rgba(255,255,255,0.025) 19px, rgba(255,255,255,0.025) 20px
          )`,
        }} />
      </div>

      {/* Baseboard */}
      <div style={{
        position: 'absolute',
        top: wallH - 2, left: 0, right: 0,
        height: 4,
        background: BASEBOARD,
        boxShadow: '0 1px 0 rgba(0,0,0,0.3)',
        zIndex: 1,
      }} />

      {/* Floor */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: height - wallH,
        background: `linear-gradient(180deg, ${FLOOR_TOP} 0%, ${FLOOR_BOTTOM} 100%)`,
      }}>
        {/* Subtle carpet grain */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `repeating-linear-gradient(
            90deg,
            transparent, transparent 3px,
            rgba(255,255,255,0.012) 3px, rgba(255,255,255,0.012) 4px
          )`,
        }} />
      </div>
    </div>
  );
};

export default RoomBackground;
