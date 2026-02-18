/**
 * HudPanel.jsx -- A single standalone HUD panel (pill button + expandable content).
 *
 * When collapsed, renders as a small draggable pill showing icon + title.
 * When expanded, renders a 320px-wide panel with a title bar (drag handle)
 * and scrollable content area. Supports drag-to-move, click-to-toggle,
 * right-click context menu, and position locking.
 */
import React, { useState, useRef, useCallback } from 'react';
import { Minus } from 'lucide-react';

// Minimum mouse movement (px) before a click becomes a drag
const DRAG_THRESHOLD = 4;

const HudPanel = ({
  id,
  title,
  icon: Icon,
  children,
  defaultPosition,
  onPositionChange,
  onDragEnd,         // Called after drag ends; used by parent for overlap detection
  onContextMenu,
  isExpanded,
  onToggle,
  isLocked,          // When true, dragging is disabled (click-through only)
}) => {
  const [position, setPosition] = useState(defaultPosition || { x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const panelRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);

  // Handles both click and drag via mousedown. If locked, immediately fires
  // the click callback. Otherwise, attaches document-level listeners and
  // uses DRAG_THRESHOLD to distinguish click from drag.
  const startDrag = useCallback(
    (e, onClickCallback) => {
      if (e.button !== 0) return; // Left-click only
      e.preventDefault();

      // Locked panels are not draggable -- treat as plain click
      if (isLocked) {
        onClickCallback?.();
        return;
      }

      const startX = e.clientX;
      const startY = e.clientY;
      hasMoved.current = false;

      const rect = panelRef.current.getBoundingClientRect();
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      const handleMouseMove = (moveE) => {
        if (!hasMoved.current) {
          const dx = Math.abs(moveE.clientX - startX);
          const dy = Math.abs(moveE.clientY - startY);
          if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
            hasMoved.current = true;
            setIsDragging(true);
          }
        }
        if (hasMoved.current) {
          const pw = panelRef.current?.offsetWidth || 80;
          const ph = panelRef.current?.offsetHeight || 32;
          const newX = Math.max(0, Math.min(moveE.clientX - dragOffset.current.x, window.innerWidth - pw));
          const newY = Math.max(0, Math.min(moveE.clientY - dragOffset.current.y, window.innerHeight - ph));
          setPosition({ x: newX, y: newY });
        }
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        if (!hasMoved.current) {
          // No movement past threshold -- treat as a click
          onClickCallback?.();
        } else {
          // Drag complete -- persist position and notify parent for overlap checks
          setPosition((pos) => {
            onPositionChange?.(id, pos);
            onDragEnd?.(id, pos);
            return pos;
          });
        }
        setIsDragging(false);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [id, isLocked, onPositionChange, onDragEnd]
  );

  const handleContextMenu = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      onContextMenu?.(e, id);
    },
    [onContextMenu, id]
  );

  // Collapsed state: small rounded pill, click to expand, drag to reposition
  if (!isExpanded) {
    return (
      <div
        ref={panelRef}
        onMouseDown={(e) => startDrag(e, onToggle)}
        onContextMenu={handleContextMenu}
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: '20px',
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--border-primary)',
          color: 'var(--text-secondary)',
          fontSize: '11px',
          fontWeight: 600,
          cursor: isLocked ? 'pointer' : 'grab',
          userSelect: 'none',
          pointerEvents: 'auto',
          zIndex: isDragging ? 999999 : 999998,
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          transition: isDragging ? 'none' : 'box-shadow 0.15s ease, background-color 0.15s ease',
          whiteSpace: 'nowrap',
        }}
      >
        {Icon && <Icon style={{ width: '14px', height: '14px', color: 'var(--brand-primary)', flexShrink: 0 }} />}
        <span>{title}</span>
      </div>
    );
  }

  // Expanded state: 320px panel with drag-handle title bar and scrollable content
  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '320px',
        zIndex: isDragging ? 999999 : 999998,
        borderRadius: '10px',
        overflow: 'hidden',
        border: '1px solid var(--border-primary)',
        backgroundColor: 'var(--bg-primary)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
        pointerEvents: 'auto',
        transition: isDragging ? 'none' : 'box-shadow 0.15s ease',
      }}
    >
      {/* Title bar — drag handle */}
      <div
        onMouseDown={(e) => startDrag(e, null)}
        onContextMenu={handleContextMenu}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          backgroundColor: 'var(--card-bg)',
          borderBottom: '1px solid var(--border-primary)',
          cursor: isLocked ? 'default' : 'grab',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {Icon && <Icon style={{ width: '14px', height: '14px', color: 'var(--brand-primary)' }} />}
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {title}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle?.();
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px',
            color: 'var(--text-tertiary)',
            display: 'flex',
          }}
        >
          <Minus style={{ width: '14px', height: '14px' }} />
        </button>
      </div>

      {/* Content */}
      <div style={{ maxHeight: '450px', overflowY: 'auto', padding: '8px' }}>
        {children}
      </div>
    </div>
  );
};

export default HudPanel;
