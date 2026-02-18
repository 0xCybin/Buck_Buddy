/**
 * HudOverlay.jsx -- Root HUD component injected into the webpage.
 *
 * Manages all floating panels (standalone and grouped into bars), their
 * positions, expand/collapse state, locking, and persistence to
 * chrome.storage.local. Panels can be dragged and snapped together into
 * HudBars via overlap detection on drag-end.
 *
 * BUG: renderContent useCallback is missing `isLocked` in its dependency
 * array, which could cause stale closures if lock state affects content.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  BarChart3,
  Unlock,
} from 'lucide-react';
import {
  FileText,
  Search,
  Bell,
  Settings,
  Lock,
} from '../../icons';
import HudPanel from './HudPanel';
import HudBar from './HudBar';
import HudContextMenu from './HudContextMenu';
import DataGroup from '../dataDisplay/DataGroup';
import TemplatesPage from '../templates/TemplatesPage';
import StatsDashboard from '../stats/StatsDashboard';
import BuckTamagotchi from '../buck/BuckTamagotchi';
import HudNotesContent from './HudNotesContent';
import HudRemindersContent from './HudRemindersContent';
import HudSettingsContent from './HudSettingsContent';
import carrierDetector from '../../services/tracking/carrierDetector';

// Schema for extracted ticket data fields shown in the Data panel
const DATA_GROUPS = [
  { key: 'customerName', title: 'Customer Name', type: 'customer', isSingle: true },
  { key: 'tickets', title: 'Ticket Numbers', type: 'ticket' },
  { key: 'orderNumbers', title: 'Order Numbers', type: 'order' },
  { key: 'storeNumbers', title: 'Store Numbers', type: 'store' },
  { key: 'giftCards', title: 'Gift Cards', type: 'giftCard' },
  { key: 'purNumbers', title: 'PowerUp Rewards', type: 'pur' },
  { key: 'phones', title: 'Phone Numbers', type: 'phone' },
  { key: 'skus', title: 'SKUs', type: 'sku' },
  { key: 'emails', title: 'Email Addresses', type: 'email' },
  { key: 'trackingNumbers', title: 'Tracking Numbers', type: 'tracking' },
  { key: 'totalAmounts', title: 'Total Amounts', type: 'amount' },
];

// Custom SVG icons for HUD items that lack a lucide-react equivalent
const PawIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
  </svg>
);

const PackageIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
    <line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
);

// Registry of all HUD buttons. "lock" is special -- it toggles drag-lock
// rather than opening a panel.
const HUD_ITEMS = [
  { id: 'data', title: 'Data', icon: Database },
  { id: 'templates', title: 'Templates', icon: FileText },
  { id: 'stats', title: 'Stats', icon: BarChart3 },
  { id: 'buck', title: 'Buck', icon: PawIcon },
  { id: 'track', title: 'Track', icon: PackageIcon },
  { id: 'sku', title: 'SKU', icon: Search },
  { id: 'notes', title: 'Notes', icon: FileText },
  { id: 'reminders', title: 'Remind', icon: Bell },
  { id: 'settings', title: 'Settings', icon: Settings },
  { id: 'lock', title: 'Lock', icon: Lock },
];

// O(1) lookup by item id, passed to HudBar for icon/title resolution
const HUD_ITEMS_MAP = {};
HUD_ITEMS.forEach((item) => {
  HUD_ITEMS_MAP[item.id] = item;
});

// Stack all buttons vertically near the right edge of the viewport
const getDefaultPositions = () => {
  const x = Math.max(20, window.innerWidth - 100);
  return {
    data: { x, y: 20 },
    templates: { x, y: 60 },
    stats: { x, y: 100 },
    buck: { x, y: 140 },
    track: { x, y: 180 },
    sku: { x, y: 220 },
    notes: { x, y: 260 },
    reminders: { x, y: 300 },
    settings: { x, y: 340 },
    lock: { x, y: 380 },
  };
};

// Pixel proximity thresholds for snapping two pills into a bar on drag-end
const OVERLAP_X = 80;
const OVERLAP_Y = 40;

// Lightweight inline panel: detects carrier from tracking number and opens
// the carrier's tracking URL in a new tab.
const TrackContent = () => {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [error, setError] = useState(null);

  const handleTrack = () => {
    if (!trackingNumber.trim()) { setError('Enter a tracking number'); return; }
    const carrier = carrierDetector.detectCarrier(trackingNumber);
    if (!carrier) { setError('Invalid tracking number'); return; }
    window.open(carrier.getUrl(trackingNumber), '_blank');
    setTrackingNumber('');
    setError(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <input
        type="text"
        value={trackingNumber}
        onChange={(e) => { setTrackingNumber(e.target.value); setError(null); }}
        onKeyDown={(e) => e.key === 'Enter' && handleTrack()}
        placeholder="Enter tracking number"
        className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
        style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)' }}
      />
      {error && <div style={{ fontSize: '11px', color: 'var(--error-color)' }}>{error}</div>}
      <button
        onClick={handleTrack}
        className="w-full py-2 rounded-lg text-sm font-medium text-white"
        style={{ backgroundColor: 'var(--brand-primary)', border: 'none', cursor: 'pointer' }}
      >
        Track Package
      </button>
    </div>
  );
};

// Lightweight inline panel: opens GameStop product search for the given SKU.
const SkuContent = () => {
  const [sku, setSku] = useState('');
  const [error, setError] = useState(null);

  const handleLookup = () => {
    if (!sku.trim()) { setError('Enter a SKU number'); return; }
    window.open(`https://www.gamestop.com/search/?q=${sku}&type=product`, '_blank');
    setSku('');
    setError(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <input
        type="text"
        value={sku}
        onChange={(e) => { setSku(e.target.value); setError(null); }}
        onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
        placeholder="Enter SKU number"
        className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
        style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)' }}
      />
      {error && <div style={{ fontSize: '11px', color: 'var(--error-color)' }}>{error}</div>}
      <button
        onClick={handleLookup}
        className="w-full py-2 rounded-lg text-sm font-medium text-white"
        style={{ backgroundColor: 'var(--brand-primary)', border: 'none', cursor: 'pointer' }}
      >
        Search SKU
      </button>
    </div>
  );
};

const HudOverlay = () => {
  // -- Core UI state --
  const [positions, setPositions] = useState(getDefaultPositions); // {[panelId]: {x,y}}
  const [expanded, setExpanded] = useState({});    // {[panelId]: boolean}
  const [isLocked, setIsLocked] = useState(false); // Prevents dragging when true
  const [ticketData, setTicketData] = useState(null);
  const [lastTicketId, setLastTicketId] = useState(null);
  const [quickTemplates, setQuickTemplates] = useState([]);
  const [hiddenButtons, setHiddenButtons] = useState([]); // IDs removed via context menu
  const [bars, setBars] = useState([]);            // Grouped pill bars [{id, items:[]}]
  const [contextMenu, setContextMenu] = useState(null);   // {x, y, actions[]} or null

  // Hydrate all state from chrome.storage.local on mount
  useEffect(() => {
    const load = async () => {
      try {
        const result = await chrome.storage.local.get([
          'hudPositions',
          'hudExpanded',
          'hudLocked',
          'lastTicketData',
          'lastTicketId',
          'quickTemplates',
          'hudHiddenButtons',
          'hudBars',
        ]);
        if (result.hudPositions) setPositions((prev) => ({ ...prev, ...result.hudPositions }));
        if (result.hudExpanded) setExpanded(result.hudExpanded);
        if (result.hudLocked) setIsLocked(result.hudLocked);
        if (result.lastTicketData) setTicketData(result.lastTicketData);
        if (result.lastTicketId) setLastTicketId(result.lastTicketId);
        if (result.quickTemplates) setQuickTemplates(result.quickTemplates);
        if (result.hudHiddenButtons) setHiddenButtons(result.hudHiddenButtons);
        if (result.hudBars) setBars(result.hudBars);
      } catch (e) {
        console.error('[Buck Buddy HUD] Failed to load data:', e);
      }
    };
    load();
  }, []);

  // Keep state in sync when other tabs/popup modify storage
  useEffect(() => {
    const handler = (changes, area) => {
      if (area !== 'local') return;
      if (changes.lastTicketData?.newValue) setTicketData(changes.lastTicketData.newValue);
      if (changes.lastTicketId?.newValue) setLastTicketId(changes.lastTicketId.newValue);
      if (changes.quickTemplates?.newValue) setQuickTemplates(changes.quickTemplates.newValue);
      if (changes.hudHiddenButtons) setHiddenButtons(changes.hudHiddenButtons.newValue || []);
      if (changes.hudBars) setBars(changes.hudBars.newValue || []);
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, []);

  // Items already grouped into a bar should not render as standalone pills
  const barItemIds = new Set(bars.flatMap((b) => b.items));

  const standaloneItems = HUD_ITEMS.filter(
    (item) => !hiddenButtons.includes(item.id) && !barItemIds.has(item.id)
  );

  // Persist position changes to storage so they survive page reload
  const handlePositionChange = useCallback((panelId, pos) => {
    setPositions((prev) => {
      const updated = { ...prev, [panelId]: pos };
      chrome.storage.local.set({ hudPositions: updated }).catch(() => {});
      return updated;
    });
  }, []);

  // Toggle a panel between pill (collapsed) and full panel (expanded)
  const togglePanel = useCallback((panelId) => {
    setExpanded((prev) => {
      const updated = { ...prev, [panelId]: !prev[panelId] };
      chrome.storage.local.set({ hudExpanded: updated }).catch(() => {});
      return updated;
    });
  }, []);

  // Lock/unlock all panel dragging
  const toggleLock = useCallback(() => {
    setIsLocked((prev) => {
      const next = !prev;
      chrome.storage.local.set({ hudLocked: next }).catch(() => {});
      return next;
    });
  }, []);

  // Unified handler: "lock" toggles drag-lock; everything else toggles panel
  const handleToggle = useCallback(
    (itemId) => {
      if (itemId === 'lock') {
        toggleLock();
      } else {
        togglePanel(itemId);
      }
    },
    [toggleLock, togglePanel]
  );

  // Accepts either a new value or an updater function (like setState)
  const handleSetQuickTemplates = useCallback(
    (fn) => {
      const value = typeof fn === 'function' ? fn(quickTemplates) : fn;
      setQuickTemplates(value);
      chrome.storage.local.set({ quickTemplates: value }).catch(() => {});
    },
    [quickTemplates]
  );

  // Remove a button from the HUD entirely (recoverable via settings)
  const hideButton = useCallback((itemId) => {
    // Collapse first so the panel doesn't stay visible
    setExpanded((prev) => {
      if (prev[itemId]) {
        const updated = { ...prev, [itemId]: false };
        chrome.storage.local.set({ hudExpanded: updated }).catch(() => {});
        return updated;
      }
      return prev;
    });
    // Add to hidden
    setHiddenButtons((prev) => {
      const updated = [...prev, itemId];
      chrome.storage.local.set({ hudHiddenButtons: updated }).catch(() => {});
      return updated;
    });
  }, []);

  // Remove a single item from a bar. If only 1 item remains, dissolve the bar.
  const detachFromBar = useCallback(
    (itemId, barId) => {
      console.log('[Buck Buddy HUD] Detaching', itemId, 'from bar', barId);

      // Collapse if expanded
      setExpanded((prev) => {
        if (prev[itemId]) {
          const updated = { ...prev, [itemId]: false };
          chrome.storage.local.set({ hudExpanded: updated }).catch(() => {});
          return updated;
        }
        return prev;
      });

      // Get bar info before removal
      const targetBar = bars.find((b) => b.id === barId);
      if (!targetBar) {
        console.warn('[Buck Buddy HUD] Bar not found:', barId);
        return;
      }

      const barPos = positions[barId] || { x: 100, y: 100 };
      const remainingItems = targetBar.items.filter((id) => id !== itemId);

      console.log('[Buck Buddy HUD] Remaining items:', remainingItems);

      // Place detached item near the bar
      setPositions((prev) => {
        const updated = { ...prev, [itemId]: { x: barPos.x, y: barPos.y + 50 } };

        // If bar will dissolve, also position the remaining item
        if (remainingItems.length === 1) {
          updated[remainingItems[0]] = { x: barPos.x, y: barPos.y + 100 };
          console.log('[Buck Buddy HUD] Dissolving bar, positioning remaining item:', remainingItems[0]);
        }

        chrome.storage.local.set({ hudPositions: updated }).catch(() => {});
        return updated;
      });

      // Remove from bar, dissolve bars with < 2 items
      setBars((prev) => {
        let updated = prev.map((b) => {
          if (b.id !== barId) return b;
          return { ...b, items: b.items.filter((id) => id !== itemId) };
        });
        // Dissolve bars with fewer than 2 items
        const beforeCount = updated.length;
        updated = updated.filter((b) => b.items.length >= 2);
        console.log('[Buck Buddy HUD] Dissolved', beforeCount - updated.length, 'bar(s)');
        chrome.storage.local.set({ hudBars: updated }).catch(() => {});
        return updated;
      });
    },
    [positions, bars]
  );

  // After a pill is dropped, check if it overlaps another pill (create new bar)
  // or an existing bar (append to it, max 4 items per bar).
  const handleDragEnd = useCallback(
    (itemId, finalPos) => {
      const currentBarItemIds = new Set(bars.flatMap((b) => b.items));
      const currentStandalone = HUD_ITEMS.filter(
        (item) => !hiddenButtons.includes(item.id) && !currentBarItemIds.has(item.id)
      );

      // Check overlap with other standalone pills
      for (const item of currentStandalone) {
        if (item.id === itemId) continue;
        const otherPos = positions[item.id];
        if (!otherPos) continue;
        if (
          Math.abs(finalPos.x - otherPos.x) < OVERLAP_X &&
          Math.abs(finalPos.y - otherPos.y) < OVERLAP_Y
        ) {
          // Create new bar from two pills
          const barId = `bar_${Date.now()}`;
          const newBar = { id: barId, items: [item.id, itemId] };
          setBars((prev) => {
            const updated = [...prev, newBar];
            chrome.storage.local.set({ hudBars: updated }).catch(() => {});
            return updated;
          });
          // Bar position = midpoint
          setPositions((prev) => {
            const updated = {
              ...prev,
              [barId]: {
                x: Math.round((finalPos.x + otherPos.x) / 2),
                y: Math.round((finalPos.y + otherPos.y) / 2),
              },
            };
            chrome.storage.local.set({ hudPositions: updated }).catch(() => {});
            return updated;
          });
          return;
        }
      }

      // Check overlap with existing bars
      for (const bar of bars) {
        if (bar.items.includes(itemId)) continue;
        if (bar.items.length >= 4) continue;
        const barPos = positions[bar.id];
        if (!barPos) continue;
        // Use wider threshold for bars (they're wider)
        if (
          Math.abs(finalPos.x - barPos.x) < OVERLAP_X + 60 &&
          Math.abs(finalPos.y - barPos.y) < OVERLAP_Y
        ) {
          // Add to existing bar
          setBars((prev) => {
            const updated = prev.map((b) =>
              b.id === bar.id ? { ...b, items: [...b.items, itemId] } : b
            );
            chrome.storage.local.set({ hudBars: updated }).catch(() => {});
            return updated;
          });
          return;
        }
      }

      // No overlap — position update already handled by onPositionChange
    },
    [bars, hiddenButtons, positions]
  );

  // Right-click on a standalone pill: only option is "Remove"
  const handleStandaloneContextMenu = useCallback(
    (e, itemId) => {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        actions: [
          { label: 'Remove', onClick: () => hideButton(itemId), danger: true },
        ],
      });
    },
    [hideButton]
  );

  // Right-click on a bar item: can detach from bar or remove entirely
  const handleBarContextMenu = useCallback(
    (e, itemId, barId) => {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        actions: [
          { label: 'Detach from bar', onClick: () => detachFromBar(itemId, barId) },
          { label: 'Remove', onClick: () => hideButton(itemId), danger: true },
        ],
      });
    },
    [detachFromBar, hideButton]
  );

  // Swap the lock icon/title based on current lock state
  const getLockProps = useCallback(
    (itemId) => {
      if (itemId !== 'lock') return null;
      return {
        icon: isLocked ? Lock : Unlock,
        title: isLocked ? 'Locked' : 'Unlocked',
      };
    },
    [isLocked]
  );

  // Maps panel ID to its React content. Shared between standalone panels and bars.
  // BUG: `isLocked` is not in the dependency array -- if any panel content
  // depended on lock state, it would render stale values.
  const renderContent = useCallback(
    (panelId) => {
      switch (panelId) {
        case 'data':
          if (!ticketData) {
            return (
              <div style={{ padding: '8px', color: 'var(--text-tertiary)', fontSize: '12px', textAlign: 'center' }}>
                No ticket data yet — open a ticket and click the extension to extract.
              </div>
            );
          }
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {DATA_GROUPS.map(({ key, title, type, isSingle }) => {
                if (isSingle && ticketData[key]) {
                  return <DataGroup key={key} title={title} items={[ticketData[key]]} type={type} />;
                }
                if (!isSingle && ticketData[key]?.length > 0) {
                  return <DataGroup key={key} title={title} items={ticketData[key]} type={type} />;
                }
                return null;
              })}
            </div>
          );
        case 'templates':
          return (
            <TemplatesPage
              quickTemplates={quickTemplates}
              setQuickTemplates={handleSetQuickTemplates}
              ticketData={ticketData}
            />
          );
        case 'stats':
          return <StatsDashboard ticketId={lastTicketId} />;
        case 'buck':
          return <BuckTamagotchi />;
        case 'track':
          return <TrackContent />;
        case 'sku':
          return <SkuContent />;
        case 'notes':
          return <HudNotesContent />;
        case 'reminders':
          return <HudRemindersContent />;
        case 'settings':
          return <HudSettingsContent />;
        default:
          return null;
      }
    },
    [ticketData, quickTemplates, handleSetQuickTemplates, lastTicketId, isLocked]
  );

  return (
    <>
      {/* ─── Standalone panels ─── */}
      {standaloneItems.map((item) => {
        const lockProps = getLockProps(item.id);
        return (
          <HudPanel
            key={item.id}
            id={item.id}
            title={lockProps ? lockProps.title : item.title}
            icon={lockProps ? lockProps.icon : item.icon}
            defaultPosition={positions[item.id]}
            onPositionChange={handlePositionChange}
            onDragEnd={handleDragEnd}
            onContextMenu={handleStandaloneContextMenu}
            isExpanded={item.id === 'lock' ? false : !!expanded[item.id]}
            onToggle={() => handleToggle(item.id)}
            isLocked={item.id === 'lock' ? false : isLocked}
          >
            {item.id !== 'lock' ? renderContent(item.id) : null}
          </HudPanel>
        );
      })}

      {/* ─── Bars (grouped buttons) ─── */}
      {bars.map((bar) => {
        // Filter out hidden items for display
        const visibleItems = bar.items.filter((id) => !hiddenButtons.includes(id));
        if (visibleItems.length === 0) return null;
        return (
          <HudBar
            key={bar.id}
            bar={{ ...bar, items: visibleItems }}
            position={positions[bar.id]}
            onPositionChange={handlePositionChange}
            isLocked={isLocked}
            hudItemsMap={HUD_ITEMS_MAP}
            expanded={expanded}
            onToggle={handleToggle}
            onContextMenu={handleBarContextMenu}
            renderContent={renderContent}
            getLockProps={getLockProps}
          />
        );
      })}

      {/* ─── Context menu ─── */}
      {contextMenu && (
        <HudContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={contextMenu.actions}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
};

export default HudOverlay;
