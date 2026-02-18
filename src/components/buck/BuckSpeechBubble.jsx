// src/components/buck/BuckSpeechBubble.jsx
// Speech bubble with typewriter text animation, positioned above the sprite.

import React, { useState, useEffect, useRef } from 'react';

const BuckSpeechBubble = ({ text }) => {
  const [displayText, setDisplayText] = useState('');
  const textRef = useRef(text);
  const timerRef = useRef(null);

  useEffect(() => {
    textRef.current = text;
    setDisplayText('');
    let i = 0;

    const tick = () => {
      if (i < text.length) {
        i++;
        setDisplayText(text.slice(0, i));
        timerRef.current = setTimeout(tick, 22 + Math.random() * 18);
      }
    };

    timerRef.current = setTimeout(tick, 100);
    return () => clearTimeout(timerRef.current);
  }, [text]);

  if (!text) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      marginBottom: 6,
      zIndex: 10,
      animation: 'buckBubbleIn 0.25s ease-out',
    }}>
      <div style={{
        background: 'var(--bg-secondary)',
        border: '2px solid var(--border-secondary)',
        borderRadius: 12,
        padding: '6px 10px',
        maxWidth: 180,
        minWidth: 70,
        textAlign: 'center',
        position: 'relative',
        boxShadow: '0 3px 12px rgba(0,0,0,0.35)',
      }}>
        <span style={{
          fontSize: 11,
          fontWeight: 500,
          color: 'var(--text-primary)',
          lineHeight: 1.3,
          display: 'block',
          minHeight: '1.3em',
        }}>
          {displayText}
          {displayText.length < text.length && (
            <span style={{
              display: 'inline-block',
              width: 4,
              height: 11,
              background: 'var(--text-primary)',
              marginLeft: 1,
              animation: 'buckCursorBlink 0.5s step-end infinite',
              verticalAlign: 'text-bottom',
            }} />
          )}
        </span>
        {/* Triangle pointer */}
        <div style={{
          position: 'absolute',
          bottom: -8,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 0, height: 0,
          borderLeft: '6px solid transparent',
          borderRight: '6px solid transparent',
          borderTop: '8px solid var(--border-secondary)',
        }} />
        <div style={{
          position: 'absolute',
          bottom: -5,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 0, height: 0,
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: '6px solid var(--bg-secondary)',
        }} />
      </div>
      <style>{`
        @keyframes buckCursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes buckBubbleIn {
          0% { opacity: 0; transform: translateX(-50%) translateY(4px) scale(0.9); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
};

export default BuckSpeechBubble;
