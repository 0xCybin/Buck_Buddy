// src/components/clock/Clock.jsx
// Real-time clock with configurable display modes.
// Updates every second. Also triggers breakManager.checkBreakTime()
// once per minute (deduped via lastCheckRef) to fire break notifications.

import React, { useState, useEffect, useRef } from "react";
import { breakManager } from "../../utils/breakManager";

const CLOCK_MODES = {
  "full-12h": { time: true, date: true, hour12: true },
  "full-24h": { time: true, date: true, hour12: false },
  "time-12h": { time: true, date: false, hour12: true },
  "time-24h": { time: true, date: false, hour12: false },
  "date":     { time: false, date: true, hour12: true },
};

const Clock = ({ mode = "full-12h" }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const lastCheckRef = useRef("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now);

      // Only check break schedule once per minute change
      const currentTimeStr = `${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes()
      ).padStart(2, "0")}`;

      if (lastCheckRef.current !== currentTimeStr) {
        lastCheckRef.current = currentTimeStr;
        breakManager.checkBreakTime(currentTimeStr);
      }
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    breakManager.initialize();

    return () => clearInterval(timer);
  }, []);

  const config = CLOCK_MODES[mode] || CLOCK_MODES["full-12h"];

  const timeStr = config.time
    ? currentTime.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: config.hour12,
      })
    : null;

  const dateStr = config.date
    ? currentTime.toLocaleDateString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      {timeStr && (
        <time style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
          {timeStr}
        </time>
      )}
      {timeStr && dateStr && (
        <span style={{ color: "var(--text-tertiary)", fontSize: "13px" }}>·</span>
      )}
      {dateStr && (
        <time style={{ fontSize: "13px", color: "var(--text-tertiary)" }}>
          {dateStr}
        </time>
      )}
    </div>
  );
};

export default Clock;
