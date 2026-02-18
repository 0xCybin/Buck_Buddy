// Today's ticket send count pulled from agent_stats daily bucket
import React, { useState, useEffect } from 'react';

const pillStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: '2px 8px',
  borderRadius: '10px',
  fontSize: '11px',
  backgroundColor: 'var(--bg-secondary)',
  border: '1px solid var(--border-primary)',
  color: 'var(--text-secondary)',
  flexShrink: 0,
  cursor: 'default',
};

const TicketCountWidget = () => {
  const [sends, setSends] = useState(0);

  const loadStats = async () => {
    try {
      const resp = await chrome.runtime.sendMessage({ type: 'GET_AGENT_STATS' });
      if (!resp?.success) return;
      const todayKey = new Date().toISOString().split('T')[0];
      const today = resp.agentStats?.daily?.[todayKey];
      setSends(today?.sendCount || 0);
    } catch (e) {
      console.warn('TicketCountWidget load failed:', e);
    }
  };

  useEffect(() => {
    loadStats();

    // Refresh when storage changes (new send tracked)
    const handler = (changes, area) => {
      if (area === 'local' && changes.agent_stats) loadStats();
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, []);

  return (
    <div title="Replies sent today" style={pillStyle}>
      <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {sends}
      </span>
      <span style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>
        {sends === 1 ? 'reply' : 'replies'}
      </span>
    </div>
  );
};

export default TicketCountWidget;
