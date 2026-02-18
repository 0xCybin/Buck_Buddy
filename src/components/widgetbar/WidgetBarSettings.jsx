// Widget config popover: toggle visibility, drag-reorder, and per-widget sub-settings
import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { X } from '../../icons';

const WIDGET_LABELS = {
  clock: 'Clock',
  timer: 'Timer',
  weather: 'Weather',
  tickets: 'Ticket Count',
  gme: 'GME Stock',
};

// Clock display presets shown as sub-options
const CLOCK_MODES = [
  { id: 'full-12h', label: '12h + Date',  example: '10:30 AM · Mon, Feb 18' },
  { id: 'full-24h', label: '24h + Date',  example: '22:30 · Mon, Feb 18' },
  { id: 'time-12h', label: '12h Only',    example: '10:30 AM' },
  { id: 'time-24h', label: '24h Only',    example: '22:30' },
  { id: 'date',     label: 'Date Only',   example: 'Mon, Feb 18' },
];

const WidgetBarSettings = ({ widgets, onUpdate, onClose }) => {
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [expandedWidget, setExpandedWidget] = useState(null);
  const [clockMode, setClockMode] = useState('full-12h');
  const popoverRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Load clock mode from storage
  useEffect(() => {
    const load = async () => {
      try {
        const result = await chrome.storage.local.get('clockMode');
        if (result.clockMode) setClockMode(result.clockMode);
      } catch (e) {
        // Default is fine
      }
    };
    load();
  }, []);

  const handleToggle = (id) => {
    const updated = widgets.map((w) =>
      w.id === id ? { ...w, enabled: !w.enabled } : w
    );
    onUpdate(updated);
  };

  const handleClockModeChange = async (modeId) => {
    setClockMode(modeId);
    try {
      await chrome.storage.local.set({ clockMode: modeId });
    } catch (e) {
      console.error('Failed to save clock mode:', e);
    }
  };

  const handleDragStart = (e, id) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) setDragOverIndex(index);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (!draggedId) return;

    const dragIndex = widgets.findIndex((w) => w.id === draggedId);
    if (dragIndex === -1 || dragIndex === dropIndex) {
      setDraggedId(null);
      setDragOverIndex(null);
      return;
    }

    const updated = [...widgets];
    updated.splice(dragIndex, 1);
    updated.splice(dropIndex, 0, widgets[dragIndex]);
    onUpdate(updated);
    setDraggedId(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverIndex(null);
  };

  // Check if a widget has sub-settings
  const hasSubSettings = (id) => id === 'clock';

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'absolute',
        bottom: '100%',
        right: 0,
        marginBottom: '4px',
        width: '220px',
        backgroundColor: 'var(--card-bg)',
        border: '1px solid var(--border-primary)',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        zIndex: 40,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 10px',
          borderBottom: '1px solid var(--border-primary)',
        }}
      >
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
          Widgets
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px',
            color: 'var(--text-tertiary)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Widget list */}
      <div style={{ padding: '4px 0' }}>
        {widgets.map((widget, index) => {
          const isDragging = draggedId === widget.id;
          const isDragOver = dragOverIndex === index && draggedId && draggedId !== widget.id;
          const isExpanded = expandedWidget === widget.id;
          const hasSub = hasSubSettings(widget.id);

          return (
            <div key={widget.id}>
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, widget.id)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 10px',
                  cursor: 'grab',
                  opacity: isDragging ? 0.4 : 1,
                  backgroundColor: isDragOver ? 'var(--bg-tertiary)' : 'transparent',
                  transition: 'background-color 0.1s ease',
                }}
              >
                {/* Drag handle */}
                <span style={{ color: 'var(--text-tertiary)', fontSize: '12px', cursor: 'grab', userSelect: 'none' }}>
                  ≡
                </span>

                {/* Toggle checkbox */}
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flex: 1,
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    userSelect: 'none',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={widget.enabled}
                    onChange={() => handleToggle(widget.id)}
                    style={{ accentColor: 'var(--brand-primary)', cursor: 'pointer' }}
                  />
                  {WIDGET_LABELS[widget.id] || widget.id}
                </label>

                {/* Expand chevron for widgets with sub-settings */}
                {hasSub && widget.enabled && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedWidget(isExpanded ? null : widget.id);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '2px',
                      color: 'var(--text-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {isExpanded
                      ? <ChevronDown className="w-3.5 h-3.5" />
                      : <ChevronRight className="w-3.5 h-3.5" />
                    }
                  </button>
                )}
              </div>

              {/* Clock sub-settings */}
              {widget.id === 'clock' && isExpanded && widget.enabled && (
                <div
                  style={{
                    padding: '4px 10px 6px 34px',
                    borderTop: '1px solid var(--border-primary)',
                    borderBottom: '1px solid var(--border-primary)',
                    backgroundColor: 'var(--bg-secondary)',
                  }}
                >
                  {CLOCK_MODES.map((m) => (
                    <label
                      key={m.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 0',
                        cursor: 'pointer',
                        fontSize: '11px',
                        userSelect: 'none',
                      }}
                    >
                      <input
                        type="radio"
                        name="clockMode"
                        checked={clockMode === m.id}
                        onChange={() => handleClockModeChange(m.id)}
                        style={{ accentColor: 'var(--brand-primary)', cursor: 'pointer', margin: 0 }}
                      />
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                        {m.label}
                      </span>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: '10px', marginLeft: 'auto' }}>
                        {m.example}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WidgetBarSettings;
