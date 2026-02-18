// Widget pill wrapper around the Clock component with configurable mode
import React, { useState, useEffect } from 'react';
import Clock from '../../clock/Clock';

const ClockWidget = () => {
  const [mode, setMode] = useState('full-12h');

  useEffect(() => {
    const load = async () => {
      try {
        const result = await chrome.storage.local.get('clockMode');
        if (result.clockMode) setMode(result.clockMode);
      } catch (e) {
        // Default mode is fine
      }
    };
    load();

    // Live-update when settings change
    const listener = (changes) => {
      if (changes.clockMode?.newValue) setMode(changes.clockMode.newValue);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: '10px',
        fontSize: '11px',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        flexShrink: 0,
      }}
    >
      <Clock mode={mode} />
    </div>
  );
};

export default ClockWidget;
