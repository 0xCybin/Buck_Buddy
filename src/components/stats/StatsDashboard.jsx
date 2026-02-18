// src/components/stats/StatsDashboard.jsx
// Stats dashboard showing today's counts, a weekly bar chart, all-time totals,
// and an achievements summary with gamerscore. Data comes from chrome.storage
// (agent_stats, streak_data, achievements) and stays in sync via onChanged.
//
// NOTE: getWeekDays() only returns Mon-Fri. Weekend work is not shown.
// BUG: The "achievementUnlocked" DOM event listener (line ~72) is not
// cleaned up if loadAchievements changes identity across renders.

import React, { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import SoundButton from "../common/SoundButton";
import AchievementsPanel from "../settings/AchievementsPanel";
import TicketHistory from "./TicketHistory";
import {
  achievementSystem,
  ACHIEVEMENT_TYPES,
} from "../../utils/achievementSystem";

const StatsDashboard = ({ ticketId }) => {
  const [stats, setStats] = useState(null);
  const [streakData, setStreakData] = useState({ currentDays: 0, longestStreak: 0 });
  const [achievements, setAchievements] = useState(null);
  const [showAchievements, setShowAchievements] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch agent stats from background via message passing
  const fetchStats = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: "GET_AGENT_STATS" });
      if (response?.success) {
        setStats(response.agentStats);
        setStreakData(response.streakData);
      }
    } catch (e) {
      console.error("Failed to fetch agent stats:", e);
    } finally {
      setLoading(false);
    }
  };

  // Load unlocked achievements and compute total gamerscore
  const loadAchievements = async () => {
    try {
      const storageData = await new Promise((resolve) =>
        chrome.storage.local.get("achievements", resolve)
      );
      const unlocked = storageData.achievements?.unlocked || {};
      setAchievements({
        unlocked,
        totalGamerscore: Object.values(unlocked).reduce(
          (total, a) => total + a.gamerscore, 0
        ),
      });
    } catch (e) {
      console.error("Failed to load achievements:", e);
    }
  };

  // Load initial data and subscribe to storage + DOM achievement events
  useEffect(() => {
    fetchStats();
    loadAchievements();

    // Live-update stats/achievements when storage changes from any context
    const handleStorageChange = (changes, area) => {
      if (area === "local" && changes.agent_stats) {
        setStats(changes.agent_stats.newValue);
      }
      if (area === "local" && changes.streak_data) {
        setStreakData(changes.streak_data.newValue);
      }
      if (area === "local" && changes.achievements) {
        const unlocked = changes.achievements.newValue?.unlocked || {};
        setAchievements({
          unlocked,
          totalGamerscore: Object.values(unlocked).reduce(
            (total, a) => total + a.gamerscore, 0
          ),
        });
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);

    // BUG: This listener is never removed if loadAchievements identity changes
    const handleAchievementEvent = () => loadAchievements();
    document.addEventListener("achievementUnlocked", handleAchievementEvent);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
      document.removeEventListener("achievementUnlocked", handleAchievementEvent);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand" />
      </div>
    );
  }

  const todayKey = new Date().toISOString().split("T")[0];
  const today = stats?.daily?.[todayKey] || { sendCount: 0, templateCopies: 0, resolvedTickets: 0 };
  const allTime = stats?.allTime || {
    sendCount: 0, freshdeskSends: 0, outlookSends: 0,
    templateCopies: 0, resolvedTickets: 0, firstTrackedDate: todayKey,
  };

  // Bar chart data -- Mon-Fri only (weekends excluded)
  const weekDays = getWeekDays();
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const weekCounts = weekDays.map((d) => stats?.daily?.[d]?.sendCount || 0);
  const maxWeekCount = Math.max(...weekCounts, 1);

  // Best day
  const bestDay = getBestDay(stats?.daily);

  // Average replies per day
  const daysSinceFirst = Math.max(1, Math.ceil(
    (Date.now() - new Date(allTime.firstTrackedDate).getTime()) / (1000 * 60 * 60 * 24)
  ));
  const avgPerDay = allTime.sendCount > 0 ? (allTime.sendCount / daysSinceFirst).toFixed(1) : "0.0";

  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  return (
    <div className="space-y-3">
      {/* Today Header */}
      <div className="flex items-center justify-between">
        <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "1px", color: "var(--text-tertiary)" }}>
          TODAY
        </span>
        <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>{dateLabel}</span>
      </div>

      {/* Today's stat cards */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Replies" value={today.sendCount} />
        <StatCard label="Templates" value={today.templateCopies} />
      </div>

      {/* This Week */}
      <div>
        <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "1px", color: "var(--text-tertiary)" }}>
          THIS WEEK
        </span>
        <div
          className="mt-1.5 rounded-lg p-2.5"
          style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border-primary)" }}
        >
          <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "60px", overflow: "hidden" }}>
            {weekDays.map((dayKey, i) => {
              const count = weekCounts[i];
              const isFuture = dayKey > todayKey;
              const barHeight = count > 0 ? Math.max(8, (count / maxWeekCount) * 52) : 4;
              return (
                <div key={dayKey} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                  <div
                    style={{
                      width: "100%",
                      height: `${barHeight}px`,
                      borderRadius: "3px",
                      backgroundColor: isFuture
                        ? "var(--border-primary)"
                        : dayKey === todayKey
                          ? "var(--brand-primary)"
                          : "var(--brand-primary)",
                      opacity: isFuture ? 0.3 : dayKey === todayKey ? 1 : 0.6,
                      transition: "height 0.3s ease",
                    }}
                  />
                  <span style={{ fontSize: "9px", color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%", whiteSpace: "nowrap" }}>
                    {isFuture ? "--" : count}
                  </span>
                  <span style={{ fontSize: "9px", color: "var(--text-tertiary)", fontWeight: dayKey === todayKey ? 700 : 400 }}>
                    {dayNames[i]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* All Time */}
      <div>
        <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "1px", color: "var(--text-tertiary)" }}>
          ALL TIME
        </span>
        <div
          className="mt-1.5 rounded-lg p-2.5 space-y-1"
          style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border-primary)" }}
        >
          <StatRow label="Total Replies" value={allTime.sendCount} />
          <StatRow label="  Freshdesk" value={allTime.freshdeskSends} indent />
          <StatRow label="  Outlook" value={allTime.outlookSends} indent />
          <StatRow label="Templates Used" value={allTime.templateCopies} />
          <StatRow label="Avg Replies/Day" value={avgPerDay} />
          {allTime.handleTimes?.length > 0 && (
            <StatRow label="Avg Handle Time" value={formatHandleTime(
              Math.round(allTime.handleTimes.reduce((a, b) => a + b, 0) / allTime.handleTimes.length)
            )} />
          )}
          {bestDay && (
            <StatRow label="Best Day" value={`${bestDay.count} (${bestDay.label})`} />
          )}
        </div>
      </div>

      {/* Recent Tickets */}
      <TicketHistory />

      {/* Achievements */}
      {achievements && (
        <div>
          <SoundButton
            onClick={() => setShowAchievements(true)}
            className="w-full mt-1.5 flex items-center justify-between rounded-lg p-2.5 transition-colors"
            style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border-primary)" }}
          >
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4" style={{ color: "var(--brand-primary)" }} />
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>
                Achievements
              </span>
            </div>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--success-color)" }}>
              {achievements.totalGamerscore} BP
            </span>
          </SoundButton>
        </div>
      )}

      {showAchievements && (
        <AchievementsPanel onClose={() => setShowAchievements(false)} />
      )}
    </div>
  );
};

const StatCard = ({ label, value }) => (
  <div
    className="rounded-lg p-2.5 text-center"
    style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border-primary)" }}
  >
    <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.1 }}>
      {value}
    </div>
    <div style={{ fontSize: "10px", color: "var(--text-tertiary)", marginTop: "2px" }}>
      {label}
    </div>
  </div>
);

const StatRow = ({ label, value, indent }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
    <span style={{
      fontSize: "11px",
      color: indent ? "var(--text-tertiary)" : "var(--text-secondary)",
      fontWeight: indent ? 400 : 500,
    }}>
      {label}
    </span>
    <span style={{
      fontSize: "11px",
      fontFamily: "monospace",
      color: "var(--text-primary)",
      fontWeight: 600,
    }}>
      {value}
    </span>
  </div>
);

// Format seconds into "Xm Ys" or "Xh Ym" for display
function formatHandleTime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ${seconds % 60}s`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}

// Return ISO date strings for Mon-Fri of the current week
function getWeekDays() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);

  const days = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

// Find the single day with the highest sendCount across all tracked days
function getBestDay(daily) {
  if (!daily) return null;
  let best = null;
  for (const [key, data] of Object.entries(daily)) {
    if (!best || data.sendCount > best.count) {
      best = { date: key, count: data.sendCount };
    }
  }
  if (!best || best.count === 0) return null;
  const d = new Date(best.date + "T12:00:00");
  const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return { count: best.count, label };
}

export default StatsDashboard;
