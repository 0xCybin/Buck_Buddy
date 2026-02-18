// Weather widget pill. Fetches weather via background service worker to avoid
// extension origin 403s from free geo/weather APIs. Cached 30 min.
import React, { useState, useEffect, useRef } from 'react';

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Map WMO weather codes to short labels
const weatherLabel = (code) => {
  if (code === 0) return 'Clear';
  if (code <= 3) return 'Cloudy';
  if (code <= 48) return 'Fog';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Showers';
  if (code <= 86) return 'Snow';
  return 'Storms';
};

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
};

const WeatherWidget = () => {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    loadWeather();
    return () => { mounted.current = false; };
  }, []);

  const loadWeather = async () => {
    setLoading(true);
    setError(false);

    try {
      // Check cache first
      const { weatherCache } = await chrome.storage.local.get('weatherCache');
      if (weatherCache?.temp != null && (Date.now() - weatherCache.fetchedAt) < CACHE_TTL) {
        if (mounted.current) {
          setWeather(weatherCache);
          setLoading(false);
        }
        return;
      }

      // Fetch via background service worker (avoids chrome-extension:// origin blocks)
      const resp = await chrome.runtime.sendMessage({ type: 'FETCH_WEATHER' });

      if (!resp?.success) {
        throw new Error(resp?.error || 'Weather fetch failed');
      }

      const data = { ...resp.data, fetchedAt: Date.now() };

      if (mounted.current) {
        setWeather(data);
        setLoading(false);
      }
      await chrome.storage.local.set({ weatherCache: data });
    } catch (e) {
      console.warn('Weather fetch failed:', e);
      if (mounted.current) {
        setError(true);
        setLoading(false);
      }
    }
  };

  if (loading) {
    return (
      <div style={{ ...pillStyle, cursor: 'default' }}>
        <span style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>--°F</span>
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div
        onClick={loadWeather}
        title="Click to retry"
        style={{ ...pillStyle, cursor: 'pointer', color: 'var(--text-tertiary)' }}
      >
        <span style={{ fontSize: '10px' }}>Weather unavailable</span>
      </div>
    );
  }

  return (
    <div title={weather.city || 'Current weather'} style={{ ...pillStyle, cursor: 'default' }}>
      <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {weather.temp}°F
      </span>
      <span style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>
        {weatherLabel(weather.code)}
      </span>
    </div>
  );
};

export default WeatherWidget;
