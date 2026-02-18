// src/components/tamagotchi/StatusBar.jsx
// Semi-transparent bar at the bottom of the scene showing Buck's current activity.

import React from 'react';

const StatusBar = ({ text = 'Hanging out' }) => (
  <div style={{
    position: 'absolute',
    bottom: 4,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,0.55)',
    borderRadius: 6,
    padding: '2px 12px',
    zIndex: 10,
    backdropFilter: 'blur(2px)',
    border: '1px solid rgba(255,255,255,0.08)',
  }}>
    <span style={{
      fontSize: 10,
      fontWeight: 500,
      color: 'rgba(255,255,255,0.75)',
      whiteSpace: 'nowrap',
      fontFamily: 'monospace',
      letterSpacing: 0.5,
    }}>
      {text}
    </span>
  </div>
);

export default StatusBar;
