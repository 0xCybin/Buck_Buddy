// src/utils/achievementTriggers.js
// Thin wrapper functions that translate user actions into achievement unlocks.
// Each trigger is safe to call repeatedly -- the underlying achievementSystem
// is idempotent and silently skips already-unlocked achievements.
//
// NOTE: Some triggers referenced elsewhere (onNightTimeUsage, onSoundSettingsChange,
// onLunchBreak) are not defined here. Calling them will throw at runtime.

import { achievementSystem } from "./achievementSystem";

export const achievementTriggers = {
  // Only fires for light mode -- "why would you do this?" achievement
  onThemeSwitch: async (newTheme) => {
    try {
      if (newTheme === "light") {
        const progress = await achievementSystem.getProgress();
        if (!progress.achievements["THEME_SWITCHER"]) {
          await achievementSystem.unlockAchievement("THEME_SWITCHER");
          await achievementSystem.updateStat("themeSwitches", 1);
        }
      }
    } catch (error) {
      console.error("Error updating theme switch achievement:", error);
    }
  },

  onCreditsWatched: async () => {
    try {
      await achievementSystem.unlockAchievement("CREDITS_WATCHER");
    } catch (error) {
      console.error("Error unlocking credits achievement:", error);
    }
  },

  onFullMute: async () => {
    try {
      await achievementSystem.unlockAchievement("FULL_MUTE");
    } catch (error) {
      console.error("Error updating full mute achievement:", error);
    }
  },

  onDragUsed: async () => {
    try {
      await achievementSystem.unlockAchievement("DRAG_MASTER");
    } catch (error) {
      console.error("Error updating drag achievement:", error);
    }
  },

  onTemplateCreated: async () => {
    try {
      await achievementSystem.unlockAchievement("TEMPLATE_CREATOR");
    } catch (error) {
      console.error("Error updating template achievement:", error);
    }
  },

  // Increments ticket stat by `count` and checks ticket milestones
  onTicketSolved: async (count) => {
    try {
      await achievementSystem.updateStat("ticketsSolved", count);
      const progress = await achievementSystem.getProgress();
      if (
        progress.stats.ticketsSolved >= 1 &&
        !progress.achievements["TICKET_SOLVER"]
      ) {
        await achievementSystem.unlockAchievement("TICKET_SOLVER");
      }
    } catch (error) {
      console.error("Error updating ticket achievements:", error);
    }
  },

  // Sets ticket count to an absolute value (for manual override from settings)
  updateManualTicketCount: async (count) => {
    try {
      console.log(`Updating ticket count to: ${count}`);

      // Update the stat and check achievements
      await achievementSystem.updateStat("ticketsSolved", count);
      console.log("Ticket count updated in storage");

      // Get current progress
      const progress = await achievementSystem.getProgress();
      console.log("Current progress:", progress);

      // Check if achievement should be unlocked
      if (
        progress.stats.ticketsSolved >= 1 &&
        !progress.achievements["TICKET_SOLVER"]
      ) {
        console.log("Attempting to unlock TICKET_SOLVER achievement");
        await achievementSystem.unlockAchievement("TICKET_SOLVER");
        console.log("TICKET_SOLVER achievement unlocked");
      }

      return progress.stats.ticketsSolved;
    } catch (error) {
      console.error("Error updating manual ticket count:", error);
      throw error;
    }
  },

  // Overwrites templateCopies stat to the caller's running total, then checks
  // thresholds. Calls updateStat(0) first to ensure the stat key exists.
  onTemplateCopied: async (totalCopies) => {
    try {
      await achievementSystem.updateStat("templateCopies", 0);
      const result = await achievementSystem.storage.get("achievements");
      result.achievements.stats.templateCopies = totalCopies;
      await achievementSystem.storage.set({ achievements: result.achievements });
      await achievementSystem._checkStatAchievements("templateCopies", totalCopies);
    } catch (error) {
      console.error("Error checking template copy achievements:", error);
    }
  },

  // Checks daily reply count against streak thresholds (10, 30)
  onDailySendCount: async (dailySends) => {
    try {
      await achievementSystem._checkStatAchievements("dailySends", dailySends);
    } catch (error) {
      console.error("Error checking daily send achievements:", error);
    }
  },

  onSkuLookup: async () => {
    try {
      await achievementSystem.unlockAchievement("SKU_LOOKUP");
    } catch (error) {
      console.error("Error updating SKU lookup achievement:", error);
    }
  },

  onKonamiCode: async () => {
    try {
      await achievementSystem.unlockAchievement("KONAMI_CODE");
    } catch (error) {
      console.error("Error updating Konami code achievement:", error);
    }
  },

  onOnboardingComplete: async () => {
    try {
      await achievementSystem.unlockAchievement("ONBOARDING_COMPLETE");
    } catch (error) {
      console.error("Error unlocking onboarding achievement:", error);
    }
  },

  // Tamagotchi achievements
  onBuckFed: async (totalTimesFed) => {
    try {
      if (totalTimesFed >= 10) {
        await achievementSystem.unlockAchievement("BUCK_CARETAKER");
      }
    } catch (error) {
      console.error("Error checking feed achievement:", error);
    }
  },

  onBuckPet: async (totalTimesPet) => {
    try {
      if (totalTimesPet >= 50) {
        await achievementSystem.unlockAchievement("BUCK_BESTIE");
      }
    } catch (error) {
      console.error("Error checking pet achievement:", error);
    }
  },

  onShopPurchase: async () => {
    try {
      // No-op; specific achievements triggered by onFirstAccessory/onBigSpender
    } catch (error) {
      console.error("Error checking shop achievement:", error);
    }
  },

  onFirstAccessory: async () => {
    try {
      await achievementSystem.unlockAchievement("FASHIONISTA");
    } catch (error) {
      console.error("Error unlocking fashionista achievement:", error);
    }
  },

  onBigSpender: async () => {
    try {
      await achievementSystem.unlockAchievement("BIG_SPENDER");
    } catch (error) {
      console.error("Error unlocking big spender achievement:", error);
    }
  },

  // Called when a lunch break starts (no achievement mapped yet, safe no-op)
  onLunchBreak: async () => {
    // Placeholder for future lunch-break achievement
  },

  // Called during night-time usage check from background alarm
  onNightTimeUsage: async () => {
    // Placeholder for future night-owl achievement
  },

  onFaceStretchFound: async () => {
    try {
      await achievementSystem.unlockAchievement("FACE_STRETCHER");
    } catch (error) {
      console.error("Error unlocking face stretcher achievement:", error);
    }
  },

  // Entry point -- call once when the popup mounts to hydrate storage and replay pending
  initializeAchievements: async () => {
    try {
      await achievementSystem.initialize();
      console.log("Achievement system initialized");
    } catch (error) {
      console.error("Error initializing achievement system:", error);
    }
  },

  checkProgress: async () => {
    try {
      const progress = await achievementSystem.getProgress();
      console.log("Achievement progress:", progress);
      return progress;
    } catch (error) {
      console.error("Error checking achievement progress:", error);
      return null;
    }
  },
};
