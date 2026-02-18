// Live GME stock price widget. Fetched via background service worker
// from Yahoo Finance. Cached 5 min. Green/red based on daily change.
import React, { useState, useEffect, useRef } from 'react';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const pillStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: '2px 8px',
  borderRadius: '10px',
  fontSize: '11px',
  backgroundColor: 'var(--bg-secondary)',
  border: '1px solid var(--border-primary)',
  flexShrink: 0,
};

const GmeStockWidget = () => {
  const [stock, setStock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    loadStock();
    return () => { mounted.current = false; };
  }, []);

  const loadStock = async () => {
    setLoading(true);
    setError(false);

    try {
      // Check cache
      const { gmeStockCache } = await chrome.storage.local.get('gmeStockCache');
      if (gmeStockCache?.price && (Date.now() - gmeStockCache.fetchedAt) < CACHE_TTL) {
        if (mounted.current) {
          setStock(gmeStockCache);
          setLoading(false);
        }
        return;
      }

      // Fetch via background to avoid origin blocks
      const resp = await chrome.runtime.sendMessage({ type: 'FETCH_GME_STOCK' });

      if (!resp?.success) throw new Error(resp?.error || 'Stock fetch failed');

      const data = { ...resp.data, fetchedAt: Date.now() };

      if (mounted.current) {
        setStock(data);
        setLoading(false);
      }
      await chrome.storage.local.set({ gmeStockCache: data });
    } catch (e) {
      console.warn('GME stock fetch failed:', e);
      if (mounted.current) {
        setError(true);
        setLoading(false);
      }
    }
  };

  if (loading) {
    return (
      <div style={{ ...pillStyle, color: 'var(--text-tertiary)', cursor: 'default' }}>
        <span style={{ fontSize: '10px' }}>GME --</span>
      </div>
    );
  }

  if (error || !stock) {
    return (
      <div
        onClick={loadStock}
        title="Click to retry"
        style={{ ...pillStyle, color: 'var(--text-tertiary)', cursor: 'pointer' }}
      >
        <span style={{ fontSize: '10px' }}>GME --</span>
      </div>
    );
  }

  const isUp = stock.change >= 0;
  const changeColor = isUp ? '#22c55e' : '#ef4444';
  const arrow = isUp ? '\u25B2' : '\u25BC';
  const pctStr = `${isUp ? '+' : ''}${stock.changePct.toFixed(2)}%`;

  return (
    <div
      title={`GME $${stock.price.toFixed(2)} (${pctStr})`}
      style={{ ...pillStyle, cursor: 'default' }}
    >
      <span style={{ fontWeight: 600, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
        GME ${stock.price.toFixed(2)}
      </span>
      <span style={{ color: changeColor, fontSize: '10px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {arrow} {pctStr}
      </span>
    </div>
  );
};

export default GmeStockWidget;
