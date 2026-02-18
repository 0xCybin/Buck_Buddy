// WidgetBar -- configurable pill bar at the bottom of the popup.
// Renders enabled widgets in saved order, plus a gear to configure them.
import React, { useState, useEffect } from 'react';
import { LayoutGrid } from 'lucide-react';
import SoundButton from '../common/SoundButton';
import WidgetBarSettings from './WidgetBarSettings';
import ClockWidget from './widgets/ClockWidget';
import TimerWidget from './widgets/TimerWidget';
import WeatherWidget from './widgets/WeatherWidget';
import TicketCountWidget from './widgets/TicketCountWidget';
import GmeStockWidget from './widgets/GmeStockWidget';

const DEFAULT_WIDGETS = [
  { id: 'clock', enabled: true },
  { id: 'timer', enabled: false },
  { id: 'weather', enabled: false },
  { id: 'tickets', enabled: false },
  { id: 'gme', enabled: false },
];

const WidgetBar = ({ ticketElapsed, lastTicketId }) => {
  const [widgets, setWidgets] = useState(DEFAULT_WIDGETS);
  const [showWidgetSettings, setShowWidgetSettings] = useState(false);

  // Load widget config from storage, migrating any new widget types
  useEffect(() => {
    const load = async () => {
      try {
        const result = await chrome.storage.local.get('widgetBarConfig');
        if (result.widgetBarConfig?.widgets) {
          const saved = result.widgetBarConfig.widgets;
          const savedIds = new Set(saved.map((w) => w.id));

          // Append any new default widgets not in saved config
          const migrated = [...saved];
          for (const dw of DEFAULT_WIDGETS) {
            if (!savedIds.has(dw.id)) migrated.push({ ...dw });
          }

          // Filter out any widgets that no longer exist
          const validIds = new Set(DEFAULT_WIDGETS.map((w) => w.id));
          const filtered = migrated.filter((w) => validIds.has(w.id));

          setWidgets(filtered);
        }
      } catch (e) {
        console.error('Failed to load widget config:', e);
      }
    };
    load();
  }, []);

  // Persist config changes
  const updateWidgets = async (newWidgets) => {
    setWidgets(newWidgets);
    try {
      await chrome.storage.local.set({ widgetBarConfig: { widgets: newWidgets } });
    } catch (e) {
      console.error('Failed to save widget config:', e);
    }
  };

  // Render the right component for each widget ID
  const renderWidget = (widget) => {
    if (!widget.enabled) return null;

    switch (widget.id) {
      case 'clock':
        return <ClockWidget key={widget.id} />;
      case 'timer':
        return <TimerWidget key={widget.id} ticketElapsed={ticketElapsed} lastTicketId={lastTicketId} />;
      case 'weather':
        return <WeatherWidget key={widget.id} />;
      case 'tickets':
        return <TicketCountWidget key={widget.id} />;
      case 'gme':
        return <GmeStockWidget key={widget.id} />;
      default:
        return null;
    }
  };

  return (
    <div
      className="flex-none"
      style={{ backgroundColor: 'var(--card-bg)', borderTop: '1px solid var(--border-primary)' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '4px 8px',
          minHeight: '32px',
          gap: '6px',
        }}
      >
        {/* Configurable widget pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0, overflow: 'hidden' }}>
          {widgets.map(renderWidget)}
        </div>

        {/* Widget config gear */}
        <div style={{ flexShrink: 0, position: 'relative' }}>
          <SoundButton
            onClick={() => setShowWidgetSettings(!showWidgetSettings)}
            className="p-1 rounded-lg transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
            title="Configure widgets"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </SoundButton>

          {showWidgetSettings && (
            <WidgetBarSettings
              widgets={widgets}
              onUpdate={updateWidgets}
              onClose={() => setShowWidgetSettings(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default WidgetBar;
