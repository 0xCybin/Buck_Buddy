// "Updated Xm ago" staleness indicator widget pill
import React from 'react';

const FreshnessWidget = ({ relativeTime, lastUpdateTimestamp, tooltip }) => {
  if (!relativeTime) return null;

  const isStale = lastUpdateTimestamp &&
    (Date.now() - new Date(lastUpdateTimestamp).getTime()) > 5 * 60 * 1000;

  return (
    <div
      title={tooltip}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: '10px',
        fontSize: '10px',
        fontWeight: isStale ? 600 : 400,
        backgroundColor: isStale ? 'rgba(234, 179, 8, 0.15)' : 'var(--bg-secondary)',
        border: `1px solid ${isStale ? 'rgba(234, 179, 8, 0.3)' : 'var(--border-primary)'}`,
        color: isStale ? '#eab308' : 'var(--text-tertiary)',
        flexShrink: 0,
        cursor: tooltip ? 'help' : 'default',
      }}
    >
      {relativeTime}
    </div>
  );
};

export default FreshnessWidget;
