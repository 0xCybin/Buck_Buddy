/**
 * HudBar.jsx -- A grouped toolbar containing multiple HUD buttons.
 *
 * Created when two standalone pills are dragged onto each other. Renders
 * as a compact row of pill buttons when collapsed, or as a tabbed panel
 * (with content area) when one of its items is expanded. Draggable as a
 * unit; individual items can be detached or removed via context menu.
 */
import React, { useState, useRef, useCallback } from 'react';
import { Minus } from 'lucide-react';

// Minimum mouse movement (px) before a click becomes a drag
const DRAG_THRESHOLD = 4;

const HudBar = ({
  bar,              // { id, items: string[] }
  position,         // { x, y }
  onPositionChange, // (barId, pos) => void
  isLocked,
  hudItemsMap,      // { [id]: { title, icon } }
  expanded,         // { [id]: boolean }
  onToggle,         // (itemId) => void
  onContextMenu,    // (e, itemId, barId) => void
  renderContent,    // (itemId) => React element
  getLockProps,      // (itemId) => { icon, title } | null
}) => {
  const [pos, setPos] = useState(position || { x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const barRef = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });   // Cursor offset from element origin
  const hasMoved = useRef(false);                // Distinguishes click from drag

  // Sets up document-level mousemove/mouseup listeners for drag.
  // Clamps position to viewport bounds during movement.
  const startDrag = useCallback(
    (e) => {
      if (e.button !== 0) return; // Left-click only
      e.preventDefault();
      if (isLocked) return;

      const startX = e.clientX;
      const startY = e.clientY;
      hasMoved.current = false;

      const rect = barRef.current.getBoundingClientRect();
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
          const bw = barRef.current?.offsetWidth || 200;
          const bh = barRef.current?.offsetHeight || 32;
          const newX = Math.max(0, Math.min(moveE.clientX - dragOffset.current.x, window.innerWidth - bw));
          const newY = Math.max(0, Math.min(moveE.clientY - dragOffset.current.y, window.innerHeight - bh));
          setPos({ x: newX, y: newY });
        }
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        if (hasMoved.current) {
          setPos((p) => {
            onPositionChange?.(bar.id, p);
            return p;
          });
        }
        setIsDragging(false);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [bar.id, isLocked, onPositionChange]
  );

  // Resolve display props -- lock button has dynamic icon/title
  const getItemDisplay = (itemId) => {
    const lockProps = getLockProps?.(itemId);
    if (lockProps) return lockProps;
    const item = hudItemsMap[itemId];
    return item ? { icon: item.icon, title: item.title } : null;
  };

  // At most one item in the bar can be expanded at a time
  const expandedItemId = bar.items.find((id) => expanded[id]);

  // Collapsed state: compact horizontal row of icon+label pills
  if (!expandedItemId) {
    return (
      <div
        ref={barRef}
        onMouseDown={startDrag}
        style={{
          position: 'fixed',
          left: `${pos.x}px`,
          top: `${pos.y}px`,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '2px',
          padding: '4px',
          borderRadius: '20px',
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--border-primary)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          zIndex: isDragging ? 999999 : 999998,
          pointerEvents: 'auto',
          cursor: isLocked ? 'default' : 'grab',
          userSelect: 'none',
          transition: isDragging ? 'none' : 'box-shadow 0.15s ease',
          whiteSpace: 'nowrap',
        }}
      >
        {bar.items.map((itemId) => {
          const display = getItemDisplay(itemId);
          if (!display) return null;
          const { icon: Icon, title } = display;
          return (
            <div
              key={itemId}
              onClick={() => {
                if (!hasMoved.current) onToggle(itemId);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onContextMenu(e, itemId, bar.id);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '16px',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {Icon && (
                <Icon
                  style={{
                    width: '14px',
                    height: '14px',
                    color: 'var(--brand-primary)',
                    flexShrink: 0,
                  }}
                />
              )}
              <span>{title}</span>
            </div>
          );
        })}
      </div>
    );
  }

  // Expanded state: tabbed header (all items as tabs) + active panel content
  return (
    <div
      ref={barRef}
      style={{
        position: 'fixed',
        left: `${pos.x}px`,
        top: `${pos.y}px`,
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
      {/* Header: button tabs + drag handle */}
      <div
        onMouseDown={startDrag}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 6px',
          backgroundColor: 'var(--card-bg)',
          borderBottom: '1px solid var(--border-primary)',
          cursor: isLocked ? 'default' : 'grab',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            flex: 1,
            flexWrap: 'wrap',
          }}
        >
          {bar.items.map((itemId) => {
            const display = getItemDisplay(itemId);
            if (!display) return null;
            const { icon: Icon, title } = display;
            const isActive = itemId === expandedItemId;
            return (
              <div
                key={itemId}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(itemId);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onContextMenu(e, itemId, bar.id);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: isActive ? 'var(--brand-primary)' : 'var(--text-secondary)',
                  backgroundColor: isActive ? 'var(--bg-secondary)' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                {Icon && (
                  <Icon style={{ width: '12px', height: '12px', flexShrink: 0 }} />
                )}
                <span>{title}</span>
              </div>
            );
          })}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle(expandedItemId);
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px',
            color: 'var(--text-tertiary)',
            display: 'flex',
            flexShrink: 0,
          }}
        >
          <Minus style={{ width: '14px', height: '14px' }} />
        </button>
      </div>

      {/* Panel content */}
      <div style={{ maxHeight: '450px', overflowY: 'auto', padding: '8px' }}>
        {renderContent(expandedItemId)}
      </div>
    </div>
  );
};

export default HudBar;
