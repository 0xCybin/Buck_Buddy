// Site badge with branded colors per platform
import React from 'react';

const SITE_CONFIG = {
  outlook: { label: 'Outlook', color: '#4da3e8', bg: 'rgba(0, 120, 212, 0.15)', border: 'rgba(0, 120, 212, 0.3)' },
  freshdesk: { label: 'Freshdesk', color: '#34d399', bg: 'rgba(24, 169, 98, 0.15)', border: 'rgba(24, 169, 98, 0.3)' },
  powerbi: { label: 'Power BI', color: '#f6c543', bg: 'rgba(246, 197, 67, 0.15)', border: 'rgba(246, 197, 67, 0.3)' },
  sterling: { label: 'Sterling', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.15)', border: 'rgba(96, 165, 250, 0.3)' },
};

const SiteWidget = ({ dataSite, tooltip }) => {
  if (!dataSite) return null;

  const cfg = SITE_CONFIG[dataSite] || SITE_CONFIG.freshdesk;

  return (
    <div
      title={tooltip}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: '10px',
        fontSize: '10px',
        fontWeight: 600,
        letterSpacing: '0.3px',
        backgroundColor: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
        flexShrink: 0,
        cursor: tooltip ? 'help' : 'default',
      }}
    >
      {cfg.label}
    </div>
  );
};

export default SiteWidget;
