// src/components/settings/AchievementsPanel.jsx
// Displays unlocked achievements and total BuckPoints. Loads data from
// chrome.storage and listens for live unlock events via runtime messages.
// NOTE: Uses react-feather icons instead of the project's custom icon set.

import React, { useState, useEffect } from "react";
import { AlertCircle, X } from "react-feather";
import {
  achievementSystem,
  ACHIEVEMENT_TYPES,
} from "../../utils/achievementSystem";

const AchievementsPanel = ({ onClose }) => {
  const [achievements, setAchievements] = useState(null); // null = loading
  const [error, setError] = useState(null);

  // Load achievement data from storage and subscribe to live updates
  useEffect(() => {
    const loadData = async () => {
      try {
        // VERBOSE: These console.log calls (and the redundant storage reads
        // below) are debug leftovers -- consider removing in production.
        console.log("Loading achievement data...");
        // Wait for storage updates to complete
        await new Promise((resolve) =>
          chrome.storage.local.get("achievements", resolve)
        );

        const progress = await achievementSystem.getProgress();
        console.log("Achievement progress:", progress);
        console.log(
          "Raw storage data:",
          await new Promise((resolve) =>
            chrome.storage.local.get("achievements", resolve)
          )
        );
        if (!progress || typeof progress !== "object") {
          throw new Error("Invalid achievements data format");
        }

        // Reads storage a second time to guarantee freshness
        const storageData = await new Promise((resolve) =>
          chrome.storage.local.get("achievements", resolve)
        );
        console.log(
          "Raw chrome.storage achievements:",
          storageData.achievements
        );

        // Compute total gamerscore by summing all unlocked achievement points
        setAchievements({
          unlocked: storageData.achievements?.unlocked || {},
          stats: storageData.achievements?.stats || {},
          totalGamerscore: Object.values(
            storageData.achievements?.unlocked || {}
          ).reduce((total, achievement) => total + achievement.gamerscore, 0),
        });
      } catch (err) {
        console.error("Error loading achievements:", err);
        setError(err.message || "Failed to load achievements");
      }
    };

    const handleAchievementUnlocked = async () => {
      await loadData();
    };

    // Handle runtime messages from other contexts (e.g., background worker)
    const handleStorageUpdate = (message) => {
      if (message.type === "achievementUpdate") {
        console.log("Received achievement update:", message.achievements);
        setAchievements({
          unlocked: message.achievements.unlocked || {},
          stats: message.achievements.stats || {},
          totalGamerscore: Object.values(
            message.achievements.unlocked || {}
          ).reduce((total, achievement) => total + achievement.gamerscore, 0),
        });
      }
    };

    loadData();

    // Listen for achievement unlock events
    document.addEventListener("achievementUnlocked", handleAchievementUnlocked);
    // Listen for storage updates from other contexts
    chrome.runtime.onMessage.addListener(handleStorageUpdate);

    return () => {
      document.removeEventListener(
        "achievementUnlocked",
        handleAchievementUnlocked
      );
      chrome.runtime.onMessage.removeListener(handleStorageUpdate);
    };
  }, []);

  // Guard: bail early if achievement config failed to load (broken install)
  if (!ACHIEVEMENT_TYPES || !Object.keys(ACHIEVEMENT_TYPES || {}).length) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm">
        <div
          className="rounded-lg p-6 max-w-md text-center"
          style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-primary)" }}
        >
          <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--error-color)" }} />
          <h3 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
            Achievements Unavailable
          </h3>
          <p style={{ color: "var(--text-tertiary)" }}>
            Failed to load achievements configuration. Please reinstall the
            extension.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm">
        <div
          className="rounded-lg p-6 max-w-md text-center"
          style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-primary)" }}
        >
          <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--error-color)" }} />
          <h3 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
            Failed to Load Achievements
          </h3>
          <p style={{ color: "var(--text-tertiary)" }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!achievements) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm">
        <div
          className="animate-pulse rounded-lg p-6 max-w-md text-center"
          style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-primary)" }}
        >
          <div className="w-12 h-12 rounded-full mx-auto mb-4" style={{ backgroundColor: "var(--bg-secondary)" }} />
          <div className="h-4 rounded w-3/4 mx-auto mb-2" style={{ backgroundColor: "var(--bg-secondary)" }} />
          <div className="h-3 rounded w-1/2 mx-auto" style={{ backgroundColor: "var(--bg-secondary)" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm">
      <div
        className="rounded-lg p-6 max-w-md w-full relative"
        style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-primary)" }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg transition-colors"
          style={{ color: "var(--text-tertiary)" }}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            Achievements
          </h2>

          {/* Main achievements content goes here */}
          {achievements && (
            <div className="space-y-2">
              <div className="mb-4 text-center">
                <div className="text-2xl font-bold" style={{ color: "var(--success-color)" }}>
                  {achievements.totalGamerscore}
                </div>
                <div className="text-sm" style={{ color: "var(--text-tertiary)" }}>
                  Total BuckPoints Earned
                </div>
              </div>

              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {/* Show unlocked achievements */}
                {Object.values(ACHIEVEMENT_TYPES)
                  .filter(
                    (achievement) => achievements.unlocked[achievement.id]
                  )
                  .map((achievement) => (
                    <div
                      key={achievement.id}
                      className="p-4 rounded-lg"
                      style={{
                        backgroundColor: "var(--success-bg)",
                        border: "1px solid var(--success-color)",
                        borderOpacity: 0.2,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">{achievement.icon}</div>
                        <div className="flex-1">
                          <h3 className="font-medium" style={{ color: "var(--text-primary)" }}>
                            {achievement.title}
                          </h3>
                          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
                            {achievement.description}
                          </p>
                        </div>
                        <div className="text-sm" style={{ color: "var(--success-color)" }}>Unlocked</div>
                      </div>
                    </div>
                  ))}

                {/* Show locked achievements count */}
                <div className="text-sm" style={{ color: "var(--text-tertiary)" }}>
                  {
                    Object.values(ACHIEVEMENT_TYPES).filter(
                      (achievement) => !achievements.unlocked[achievement.id]
                    ).length
                  }{" "}
                  achievements remaining
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AchievementsPanel;
