// src/components/settings/BreakTimeSettings.jsx
// Controlled form for configuring break1, break2, and lunch schedules.
// Receives values and change handlers from SettingsModal (parent owns state).

import React from "react";
import { Clock } from "../../icons";

const BreakTimeSettings = ({
  breakTimes,       // { break1, break2, lunch } -- HH:MM strings
  breakDurations,   // { break1, break2, lunch } -- durations in minutes
  onBreakTimeChange,
  onBreakDurationChange,
}) => {
  // Shared input styling via CSS custom properties
  const inputStyle = {
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-primary)",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} />
        <h3 className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          Break Times
        </h3>
      </div>
      <div className="grid gap-4">
        {/* First Break */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>
              1st Break Time
            </label>
            <input
              type="time"
              value={breakTimes.break1}
              onChange={(e) => onBreakTimeChange("break1", e.target.value)}
              className="w-full rounded-lg px-3 py-2 focus:outline-none focus:ring-2"
              style={{ ...inputStyle, '--tw-ring-color': 'var(--brand-primary)' }}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>
              Duration (mins)
            </label>
            <input
              type="number"
              value={breakDurations.break1}
              onChange={(e) => onBreakDurationChange("break1", parseInt(e.target.value, 10) || 0)}
              min="1"
              max="60"
              className="w-full rounded-lg px-3 py-2 focus:outline-none focus:ring-2"
              style={{ ...inputStyle, '--tw-ring-color': 'var(--brand-primary)' }}
            />
          </div>
        </div>

        {/* Second Break */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>
              2nd Break Time
            </label>
            <input
              type="time"
              value={breakTimes.break2}
              onChange={(e) => onBreakTimeChange("break2", e.target.value)}
              className="w-full rounded-lg px-3 py-2 focus:outline-none focus:ring-2"
              style={{ ...inputStyle, '--tw-ring-color': 'var(--brand-primary)' }}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>
              Duration (mins)
            </label>
            <input
              type="number"
              value={breakDurations.break2}
              onChange={(e) => onBreakDurationChange("break2", parseInt(e.target.value, 10) || 0)}
              min="1"
              max="60"
              className="w-full rounded-lg px-3 py-2 focus:outline-none focus:ring-2"
              style={{ ...inputStyle, '--tw-ring-color': 'var(--brand-primary)' }}
            />
          </div>
        </div>

        {/* Lunch Break */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>
              Lunch Break Time
            </label>
            <input
              type="time"
              value={breakTimes.lunch}
              onChange={(e) => onBreakTimeChange("lunch", e.target.value)}
              className="w-full rounded-lg px-3 py-2 focus:outline-none focus:ring-2"
              style={{ ...inputStyle, '--tw-ring-color': 'var(--brand-primary)' }}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--text-tertiary)" }}>
              Duration (mins)
            </label>
            <input
              type="number"
              value={breakDurations.lunch}
              onChange={(e) => onBreakDurationChange("lunch", parseInt(e.target.value, 10) || 0)}
              min="1"
              max="60"
              className="w-full rounded-lg px-3 py-2 focus:outline-none focus:ring-2"
              style={{ ...inputStyle, '--tw-ring-color': 'var(--brand-primary)' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BreakTimeSettings;
