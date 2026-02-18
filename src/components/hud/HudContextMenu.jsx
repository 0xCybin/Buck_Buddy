/**
 * HudContextMenu.jsx -- Right-click context menu for HUD panels and bar items.
 *
 * Renders a fixed-position dropdown at the click coordinates. Closes on
 * any mousedown outside the menu. Position is clamped to keep the menu
 * within the viewport.
 */
import React, { useEffect, useRef } from 'react';

const HudContextMenu = ({ x, y, actions, onClose }) => {
  const ref = useRef(null);

  // Close the menu when clicking anywhere outside it.
  // Uses setTimeout(0) so the originating right-click event doesn't
  // immediately trigger the outside-click handler.
  useEffect(() => {
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        onClose();
      }
    };
    const id = setTimeout(() => {
      document.addEventListener('mousedown', handle);
    }, 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener('mousedown', handle);
    };
  }, [onClose]);

  // Clamp to viewport so the menu doesn't overflow off-screen
  const adjustedX = Math.min(x, window.innerWidth - 160);
  const adjustedY = Math.min(y, window.innerHeight - actions.length * 32 - 8);

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: `${adjustedX}px`,
        top: `${adjustedY}px`,
        minWidth: '140px',
        borderRadius: '8px',
        backgroundColor: 'var(--card-bg)',
        border: '1px solid var(--border-primary)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
        padding: '4px',
        zIndex: 9999999,
        pointerEvents: 'auto',
      }}
    >
      {actions.map((action, i) => (
        <button
          key={i}
          onClick={(e) => {
            e.stopPropagation();
            action.onClick();
            onClose();
          }}
          style={{
            display: 'block',
            width: '100%',
            padding: '6px 12px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            fontSize: '12px',
            fontWeight: 500,
            color: action.danger ? 'var(--error-color)' : 'var(--text-primary)',
            borderRadius: '4px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
};

export default HudContextMenu;
