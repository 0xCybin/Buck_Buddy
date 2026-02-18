// src/components/navigation/DraggableTabs.jsx
// Drag-and-drop reorderable tab bar using native HTML5 drag events.
// Tab order is persisted to chrome.storage.local and migrated on load
// (e.g. "chat" renamed to "buck", "stats" tab backfilled).
// Locked mode disables dragging but keeps click navigation.
//
// ACCESSIBILITY: Missing role="tablist" on the container and
// role="tab" / aria-selected on individual tabs.

import React, { useState, useEffect, useRef } from 'react';
import { useSoundEffect } from '../../utils/soundUtils';
import { achievementTriggers } from '../../utils/achievementTriggers';

const DEFAULT_TAB_ORDER = ['data', 'templates', 'stats', 'buck'];

const TAB_LABELS = {
  data: 'Data',
  templates: 'Templates',
  stats: 'Stats',
  buck: 'Buck',
};

const DraggableTabs = ({ activeTab, onTabChange, isLocked }) => {
  const [tabOrder, setTabOrder] = useState(DEFAULT_TAB_ORDER);
  const [draggedTab, setDraggedTab] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const sounds = useSoundEffect();
  const didDrag = useRef(false);

  // Load persisted tab order on mount, applying migrations for renamed/added tabs
  useEffect(() => {
    const loadSavedOrder = async () => {
      try {
        const result = await chrome.storage.local.get('tabOrder');
        if (result.tabOrder && Array.isArray(result.tabOrder)) {
          let migrated = [...result.tabOrder];
          if (!migrated.includes('stats')) {
            const buckIdx = migrated.indexOf('buck');
            migrated.splice(buckIdx >= 0 ? buckIdx : migrated.length, 0, 'stats');
          }
          // Deduplicate and ensure all tabs present
          const seen = new Set();
          const deduped = migrated.filter((t) => {
            if (seen.has(t) || !TAB_LABELS[t]) return false;
            seen.add(t);
            return true;
          });
          // Add any missing tabs
          for (const tab of DEFAULT_TAB_ORDER) {
            if (!deduped.includes(tab)) deduped.push(tab);
          }
          setTabOrder(deduped);
        }
      } catch (error) {
        console.error('Failed to load tab order:', error);
      }
    };

    loadSavedOrder();
  }, []);

  // Persist new tab order and fire the drag achievement trigger
  const saveOrder = async (newOrder) => {
    try {
      await chrome.storage.local.set({ tabOrder: newOrder });
      await achievementTriggers.onDragUsed();
    } catch (error) {
      console.error('Failed to save tab order:', error);
    }
  };

  const handleDragStart = (e, tabId) => {
    if (isLocked) {
      e.preventDefault();
      return;
    }
    didDrag.current = false;
    setDraggedTab(tabId);
    e.dataTransfer.effectAllowed = 'move';
    // Make the drag ghost semi-transparent
    if (e.target) {
      e.dataTransfer.setDragImage(e.target, e.target.offsetWidth / 2, e.target.offsetHeight / 2);
    }
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (!draggedTab || isLocked) return;

    const dragIndex = tabOrder.indexOf(draggedTab);
    if (dragIndex === -1 || dragIndex === dropIndex) {
      setDraggedTab(null);
      setDragOverIndex(null);
      return;
    }

    didDrag.current = true;
    const newOrder = [...tabOrder];
    newOrder.splice(dragIndex, 1);
    newOrder.splice(dropIndex, 0, draggedTab);

    setTabOrder(newOrder);
    setDraggedTab(null);
    setDragOverIndex(null);
    saveOrder(newOrder);
  };

  const handleDragEnd = () => {
    setDraggedTab(null);
    setDragOverIndex(null);
  };

  // Ignore click if it was actually the end of a drag gesture
  const handleTabClick = (tabId) => {
    if (didDrag.current) {
      didDrag.current = false;
      return;
    }
    if (tabId !== activeTab) {
      sounds.playPageTransition(tabId);
      onTabChange(tabId);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 4px' }}>
      {tabOrder.map((tabId, index) => {
        const isActive = activeTab === tabId;
        const isDragging = draggedTab === tabId;
        const isDragOver = dragOverIndex === index && draggedTab && draggedTab !== tabId;

        return (
          <div
            key={tabId}
            data-onboarding={`tab-${tabId}`}
            draggable={!isLocked}
            onDragStart={(e) => handleDragStart(e, tabId)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            onClick={() => handleTabClick(tabId)}
            style={{
              width: '92px',
              margin: '0 2px',
              padding: '8px 0',
              textAlign: 'center',
              fontSize: '14px',
              fontWeight: 500,
              borderRadius: '6px',
              cursor: isLocked ? 'pointer' : 'grab',
              userSelect: 'none',
              transition: 'background-color 0.15s ease, color 0.15s ease, opacity 0.15s ease',
              color: isActive ? '#fff' : 'var(--text-tertiary)',
              backgroundColor: isActive
                ? 'var(--brand-primary)'
                : isDragOver
                  ? 'var(--bg-tertiary)'
                  : 'transparent',
              opacity: isDragging ? 0.4 : 1,
            }}
          >
            {TAB_LABELS[tabId]}
          </div>
        );
      })}
    </div>
  );
};

export default DraggableTabs;
