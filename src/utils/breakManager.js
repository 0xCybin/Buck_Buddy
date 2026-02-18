// src/utils/breakManager.js
// Manages timed break and lunch sessions. Stores the active break in
// chrome.storage.local so state survives popup close/reopen. Broadcasts
// BREAK_TIME_START / BREAK_ENDED messages so the overlay injector and
// other extension pages can react.

import { achievementTriggers } from "./achievementTriggers";

class BreakManager {
  constructor() {
    this.BREAK_DURATION = 15;   // minutes
    this.LUNCH_DURATION = 30;   // minutes
    this.initialized = false;
    this.lastCheckTime = null;  // dedup guard for checkBreakTime
  }

  // Cleans up any expired break from a previous session
  async initialize() {
    if (this.initialized) return;

    try {
      const currentBreak = await this.getCurrentBreak();
      if (currentBreak && Date.now() > currentBreak.endTime) {
        await this.endBreak();
      }

      this.initialized = true;
    } catch (error) {
      console.error("Error initializing break manager:", error);
    }
  }

  // Starts a break timer, persists state, broadcasts to all extension contexts,
  // and schedules an automatic end via setTimeout.
  // NOTE: setTimeout won't fire if the service worker goes idle (MV3 limitation).
  async startBreak(type = "break") {
    try {
      const duration =
        type === "lunch" ? this.LUNCH_DURATION : this.BREAK_DURATION;
      const startTime = Date.now();
      const endTime = startTime + duration * 60 * 1000;

      const breakState = {
        type,
        startTime,
        endTime,
        duration,
        isActive: true,
        id: `${type}-${startTime}`, // Add unique ID for each break
      };

      // Store break state
      await chrome.storage.local.set({
        currentBreak: breakState,
      });

      // Reset overlay dismissal so the break screen shows again
      await chrome.storage.local.remove("overlayDismissed");

      // Auto-end the break when duration elapses
      setTimeout(
        () => {
          this.endBreak();
        },
        duration * 60 * 1000
      );

      // Broadcast to all extension pages
      chrome.runtime
        .sendMessage({
          type: "BREAK_TIME_START",
          breakType: type,
          breakState,
        })
        .catch(() => {
          // Ignore error if no listeners
        });

      // Increment lifetime break counter for potential future achievements
      const result = await chrome.storage.local.get("breakCount");
      const breakCount = (result.breakCount || 0) + 1;
      await chrome.storage.local.set({ breakCount });

      // BUG: achievementTriggers.onLunchBreak is not defined -- will throw
      try {
        if (type === "lunch") {
          await achievementTriggers.onLunchBreak();
        }
      } catch (error) {
        console.error("Error triggering break achievements:", error);
      }

      return breakState;
    } catch (error) {
      console.error("Error starting break:", error);
      throw error;
    }
  }

  // Clears stored break state and notifies listeners that the break is over
  async endBreak() {
    try {
      await chrome.storage.local.remove(["currentBreak", "overlayDismissed"]);

      // Broadcast break end
      chrome.runtime
        .sendMessage({
          type: "BREAK_ENDED",
        })
        .catch(() => {
          // Ignore error if no listeners
        });
    } catch (error) {
      console.error("Error ending break:", error);
    }
  }

  // Returns the active break state, or null if none/expired
  async getCurrentBreak() {
    try {
      const result = await chrome.storage.local.get("currentBreak");
      const breakState = result.currentBreak;

      if (!breakState) return null;

      if (Date.now() > breakState.endTime) {
        await this.endBreak();
        return null;
      }

      return breakState;
    } catch (error) {
      console.error("Error getting break state:", error);
      return null;
    }
  }

  // Called on each clock tick (HH:MM string). Compares against user-configured
  // break times and auto-starts a break when a match is found.
  async checkBreakTime(currentTime) {
    if (currentTime === this.lastCheckTime) return; // Skip duplicate ticks
    this.lastCheckTime = currentTime;

    try {
      const result = await chrome.storage.local.get([
        "breakTimes",
        "currentBreak",
      ]);

      if (result.currentBreak && Date.now() > result.currentBreak.endTime) {
        await this.endBreak();
      }

      // Match current clock time against saved break schedule
      const breakTimes = result.breakTimes || {};
      Object.entries(breakTimes).forEach(([type, time]) => {
        if (time === currentTime) {
          this.startBreak(type.includes("lunch") ? "lunch" : "break");
        }
      });
    } catch (error) {
      console.error("Error checking break time:", error);
    }
  }

  // Returns seconds remaining for the given break, or 0 if inactive/expired
  calculateTimeRemaining(breakState) {
    if (!breakState || !breakState.isActive) return 0;
    const remaining = Math.max(0, breakState.endTime - Date.now());
    return Math.floor(remaining / 1000);
  }
}

export const breakManager = new BreakManager();
