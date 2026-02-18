// Ticket elapsed timer widget pill (monospace, stable width)
import React from 'react';

const TimerWidget = ({ ticketElapsed, lastTicketId }) => {
  if (!lastTicketId || ticketElapsed <= 0) return null;

  const minutes = Math.floor(ticketElapsed / 60);
  const seconds = String(ticketElapsed % 60).padStart(2, '0');

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: '10px',
        fontSize: '11px',
        fontFamily: 'monospace',
        fontVariantNumeric: 'tabular-nums',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        color: 'var(--text-secondary)',
        flexShrink: 0,
      }}
    >
      {minutes}:{seconds}
    </div>
  );
};

export default TimerWidget;
