// Compact list of recent tickets (last 20) with relative timestamps
import React, { useState, useEffect } from "react";
import { Clock } from "../../icons";

const TicketHistory = () => {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    chrome.storage.local.get("ticketHistory", (result) => {
      setHistory(result.ticketHistory || []);
    });

    const handleChange = (changes, area) => {
      if (area === "local" && changes.ticketHistory) {
        setHistory(changes.ticketHistory.newValue || []);
      }
    };
    chrome.storage.onChanged.addListener(handleChange);
    return () => chrome.storage.onChanged.removeListener(handleChange);
  }, []);

  if (history.length === 0) return null;

  const relativeTime = (ts) => {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div>
      <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "1px", color: "var(--text-tertiary)" }}>
        RECENT TICKETS
      </span>
      <div
        className="mt-1.5 rounded-lg overflow-hidden"
        style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border-primary)" }}
      >
        {history.slice().reverse().map((entry, i) => (
          <div
            key={entry.ticketId + "-" + i}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "6px 10px",
              borderBottom: i < history.length - 1 ? "1px solid var(--border-primary)" : "none",
              gap: "8px",
            }}
          >
            <a
              href={`https://gamestop.freshdesk.com/a/tickets/${entry.ticketId}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: "11px",
                fontFamily: "monospace",
                color: "var(--brand-primary)",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              #{entry.ticketId}
            </a>
            {entry.note && (
              <span style={{
                flex: 1,
                fontSize: "10px",
                color: "var(--text-tertiary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                minWidth: 0,
              }}>
                {entry.note}
              </span>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
              {entry.actionCount > 0 && (
                <span style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>
                  {entry.actionCount} {entry.actionCount === 1 ? "reply" : "replies"}
                </span>
              )}
              <span style={{ fontSize: "10px", color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: "2px" }}>
                <Clock className="w-3 h-3" />
                {relativeTime(entry.lastAction)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TicketHistory;
