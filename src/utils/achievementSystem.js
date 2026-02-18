// src/utils/achievementSystem.js
// Achievement system -- manages unlocking, tracking progress, and persisting
// achievement state to chrome.storage.local. Notifications are queued and
// shown sequentially with a 5-second delay between each.

// Achievement definitions: id, display info, and gamerscore value
const ACHIEVEMENTS = {
  THEME_SWITCHER: {
    id: "THEME_SWITCHER",
    title: "Blinded by the Light",
    description: "Switch to light mode once (why would you do this?)",
    gamerscore: 10,
    icon: "🌓",
  },
  FIRST_CHAT: {
    id: "FIRST_CHAT",
    title: "Chatterbox",
    description: "Send your first chat message",
    gamerscore: 20,
    icon: "💬",
  },
  CREDITS_WATCHER: {
    id: "CREDITS_WATCHER",
    title: "Roll Credits!",
    description: "Watch the credits all the way through",
    gamerscore: 15,
    icon: "🎬",
  },
  CHAT_MUTE: {
    id: "CHAT_MUTE",
    title: "Silent Treatment",
    description: "Yea I get it no hard feelings",
    gamerscore: 10,
    icon: "🔇",
  },
  FULL_MUTE: {
    id: "FULL_MUTE",
    title: "Library Mode",
    description: "Ok.. I mean it only took me like 3 hours to make that",
    gamerscore: 20,
    icon: "🤫",
  },
  DRAG_MASTER: {
    id: "DRAG_MASTER",
    title: "Drag and Drop Pro",
    description: "Use the draggable component feature",
    gamerscore: 15,
    icon: "🖱️",
  },
  TEMPLATE_CREATOR: {
    id: "TEMPLATE_CREATOR",
    title: "Template Titan",
    description: "Create a template",
    gamerscore: 25,
    icon: "📝",
  },
  TICKET_SOLVER: {
    id: "TICKET_SOLVER",
    title: "Ticket Terminator",
    description: "Solve 1 ticket",
    gamerscore: 10,
    icon: "🎟️",
  },
  TICKET_MASTER: {
    id: "TICKET_MASTER",
    title: "Ticket Master",
    description: "Solve 30 tickets",
    gamerscore: 30,
    icon: "🎫",
  },
  TICKET_CHAMPION: {
    id: "TICKET_CHAMPION",
    title: "Ticket Champion",
    description: "Solve 60 tickets",
    gamerscore: 50,
    icon: "🏆",
  },
  TICKET_LEGEND: {
    id: "TICKET_LEGEND",
    title: "Ticket Legend",
    description: "Solve 100 tickets",
    gamerscore: 100,
    icon: "🌟",
  },
  SKU_LOOKUP: {
    id: "SKU_LOOKUP",
    title: "SKU Sleuth",
    description: "Use the SKU lookup feature",
    gamerscore: 15,
    icon: "🔍",
  },
  KONAMI_CODE: {
    id: "KONAMI_CODE",
    title: "Cheat Code Master",
    description: "Enter the Konami code",
    gamerscore: 30,
    icon: "🎮",
  },
  TEMPLATE_USER: {
    id: "TEMPLATE_USER",
    title: "Copy Paste Pro",
    description: "Copy 10 templates",
    gamerscore: 15,
    icon: "📋",
  },
  TEMPLATE_POWER_USER: {
    id: "TEMPLATE_POWER_USER",
    title: "Template Machine",
    description: "Copy 100 templates",
    gamerscore: 40,
    icon: "🏭",
  },
  SEND_STREAK_10: {
    id: "SEND_STREAK_10",
    title: "On a Roll",
    description: "Send 10 replies in one day",
    gamerscore: 20,
    icon: "🔥",
  },
  SEND_STREAK_30: {
    id: "SEND_STREAK_30",
    title: "Reply Warrior",
    description: "Send 30 replies in one day",
    gamerscore: 50,
    icon: "⚔️",
  },
  ONBOARDING_COMPLETE: {
    id: "ONBOARDING_COMPLETE",
    title: "Orientation Day",
    description: "Complete Buck's onboarding tour",
    gamerscore: 15,
    icon: "🎓",
  },
  BUCK_CARETAKER: {
    id: "BUCK_CARETAKER",
    title: "Buck's Caretaker",
    description: "Feed Buck 10 times",
    gamerscore: 15,
    icon: "🍎",
  },
  BUCK_BESTIE: {
    id: "BUCK_BESTIE",
    title: "Buck's Bestie",
    description: "Pet Buck 50 times",
    gamerscore: 25,
    icon: "💕",
  },
  FASHIONISTA: {
    id: "FASHIONISTA",
    title: "Fashionista",
    description: "Buy your first accessory for Buck",
    gamerscore: 20,
    icon: "👒",
  },
  BIG_SPENDER: {
    id: "BIG_SPENDER",
    title: "Big Spender",
    description: "Spend 500 coins total",
    gamerscore: 30,
    icon: "💰",
  },
  FACE_STRETCHER: {
    id: "FACE_STRETCHER",
    title: "Face Stretcher",
    description: "Find the hidden easter egg",
    gamerscore: 15,
    icon: "🤪",
  },
  COMPLETIONIST: {
    id: "COMPLETIONIST",
    title: "Completionist",
    description: "Unlock all achievements",
    gamerscore: 100,
    icon: "🏅",
  },
};

class AchievementSystem {
  constructor() {
    this.storage = chrome.storage.local;
    this.notificationQueue = []; // FIFO queue for pending toast notifications
    this.isShowingNotification = false;
  }

  // Drains the notification queue one at a time, with a 5s gap for the toast animation
  async _processNotificationQueue() {
    if (this.isShowingNotification || this.notificationQueue.length === 0) {
      return;
    }

    this.isShowingNotification = true;
    const achievement = this.notificationQueue.shift();

    const sound = new Audio(
      chrome.runtime.getURL("assets/sounds/Achievement Notification Sound.mp3")
    );
    await sound.play();

    this._showNotification(achievement);

    setTimeout(async () => {
      this.isShowingNotification = false;
      this._processNotificationQueue();
    }, 5000);
  }

  // Loads or creates the achievement state in storage, replays any pending
  // achievements that were earned while the popup was closed
  async initialize() {
    console.log("Initializing achievement storage...");
    const result = await this.storage.get("achievements");
    console.log("Initial storage state:", result);

    const dateKey = new Date().toISOString().split("T")[0]; // YYYY-MM-DD for daily stats

    if (!result.achievements) {
      console.log("No achievements found, initializing new storage");
      const initialData = {
        achievements: {
          unlocked: {},
          pending: [],
          stats: {
            themeSwitches: 0,
            ticketsSolved: 0,
          },
          dailyStats: {
            [dateKey]: {
              ticketsSolved: 0,
            },
          },
        },
      };
      await this.storage.set(initialData);
      console.log("Storage initialized with:", initialData);
    } else {
      console.log("Existing achievements found:", result.achievements);

      // Ensure stats exist and have default values
      if (!result.achievements.stats) {
        result.achievements.stats = {
          themeSwitches: 0,
          ticketsSolved: 0,
        };
      }

      // Initialize pending achievements array if it doesn't exist
      if (!result.achievements.pending) {
        result.achievements.pending = [];
      }

      // Show any pending achievements
      if (result.achievements.pending.length > 0) {
        for (const achievementId of result.achievements.pending) {
          const achievement = ACHIEVEMENTS[achievementId];
          if (achievement && !result.achievements.unlocked[achievementId]) {
            // Queue each pending achievement
            this.notificationQueue.push(achievement);
            result.achievements.unlocked[achievementId] = {
              unlockedAt: new Date().toISOString(),
              gamerscore: achievement.gamerscore,
            };
          }
        }
        result.achievements.pending = [];
        // Start processing the queue
        this._processNotificationQueue();
      }

      // Initialize daily stats if new day
      if (!result.achievements.dailyStats) {
        result.achievements.dailyStats = {};
      }
      if (!result.achievements.dailyStats[dateKey]) {
        result.achievements.dailyStats[dateKey] = {
          ticketsSolved: 0,
        };
      }

      await this.storage.set({ achievements: result.achievements });
    }
  }

  // Unlocks a single achievement. If the popup isn't visible or the action
  // navigates away (SKU_LOOKUP), the achievement is queued as "pending" in
  // storage and displayed next time the popup opens via initialize().
  async unlockAchievement(achievementId) {
    const achievement = ACHIEVEMENTS[achievementId];
    if (!achievement) return;

    console.log(`Attempting to unlock achievement: ${achievementId}`);
    const result = await this.storage.get("achievements");
    console.log("Current achievements state:", result.achievements);
    if (result.achievements.unlocked[achievementId]) {
      console.log("Achievement already unlocked, skipping");
      return;
    }

    // SKU_LOOKUP navigates to a new tab, so always defer its notification
    if (achievementId === "SKU_LOOKUP") {
      result.achievements.pending = result.achievements.pending || [];
      result.achievements.pending.push(achievementId);
      await this.storage.set({ achievements: result.achievements });
      return;
    }

    // Store other achievements as pending if popup is not visible
    const isPopupVisible = await this._isPopupVisible();
    if (!isPopupVisible) {
      result.achievements.pending = result.achievements.pending || [];
      result.achievements.pending.push(achievementId);
      await this.storage.set({ achievements: result.achievements });
      return;
    }

    // Queue the achievement notification
    this.notificationQueue.push(achievement);
    this._processNotificationQueue();

    result.achievements.unlocked[achievementId] = {
      unlockedAt: new Date().toISOString(),
      gamerscore: achievement.gamerscore,
    };

    // Auto-award COMPLETIONIST once every other achievement is unlocked
    const allAchievements = Object.keys(ACHIEVEMENTS).filter(
      (id) => id !== "COMPLETIONIST"
    );
    const unlockedAchievements = Object.keys(result.achievements.unlocked);
    const allOthersUnlocked = allAchievements.every((id) =>
      unlockedAchievements.includes(id)
    );

    if (allOthersUnlocked && !result.achievements.unlocked["COMPLETIONIST"]) {
      console.log(
        "All achievements unlocked, triggering COMPLETIONIST achievement"
      );
      await this.unlockAchievement("COMPLETIONIST");
    } else {
      // Force storage update and notify all contexts
      await this.storage.set({ achievements: result.achievements });
      chrome.storage.local.set({ achievements: result.achievements }, () => {
        chrome.storage.local.get("achievements", (result) => {
          chrome.runtime.sendMessage({
            type: "achievementUpdate",
            achievements: result.achievements,
          });
        });
      });
    }
  }

  // Increments a named stat by `value` and checks threshold-based achievements
  async updateStat(statName, value = 1) {
    console.log(`Updating stat ${statName} by ${value}`);
    const result = await this.storage.get("achievements");
    const currentValue = result.achievements.stats[statName] || 0;
    const newValue = currentValue + value;
    console.log(`Current ${statName}: ${currentValue}, New value: ${newValue}`);

    result.achievements.stats[statName] = newValue;
    await this.storage.set({ achievements: result.achievements });

    console.log(`Checking achievements for ${statName} at ${newValue}`);
    await this._checkStatAchievements(statName, newValue);

    // Force storage update and notify all contexts
    const updated = await this.storage.get("achievements");
    await this.storage.set({ achievements: updated.achievements });
    chrome.storage.local.set({ achievements: updated.achievements }, () => {
      chrome.storage.local.get("achievements", (result) => {
        chrome.runtime.sendMessage({
          type: "achievementUpdate",
          achievements: result.achievements,
        });
      });
    });
  }

  // Maps stat values to achievement thresholds and unlocks when crossed
  async _checkStatAchievements(statName, value) {
    if (statName === "themeSwitches" && value === 1) {
      const result = await this.storage.get("achievements");
      console.log("Checking theme switch achievement:", result.achievements);
      if (!result.achievements?.unlocked?.["THEME_SWITCHER"]) {
        console.log("Unlocking THEME_SWITCHER achievement");
        await this.unlockAchievement("THEME_SWITCHER");
      }
    }

    if (statName === "ticketsSolved") {
      const result = await this.storage.get("achievements");

      // Check ticket count achievements
      if (value >= 1 && !result.achievements?.unlocked?.["TICKET_SOLVER"]) {
        await this.unlockAchievement("TICKET_SOLVER");
      }
      if (value >= 30 && !result.achievements?.unlocked?.["TICKET_MASTER"]) {
        await this.unlockAchievement("TICKET_MASTER");
      }
      if (value >= 60 && !result.achievements?.unlocked?.["TICKET_CHAMPION"]) {
        await this.unlockAchievement("TICKET_CHAMPION");
      }
      if (value >= 100 && !result.achievements?.unlocked?.["TICKET_LEGEND"]) {
        await this.unlockAchievement("TICKET_LEGEND");
      }
    }

    if (statName === "templateCopies") {
      const result = await this.storage.get("achievements");
      if (value >= 10 && !result.achievements?.unlocked?.["TEMPLATE_USER"]) {
        await this.unlockAchievement("TEMPLATE_USER");
      }
      if (value >= 100 && !result.achievements?.unlocked?.["TEMPLATE_POWER_USER"]) {
        await this.unlockAchievement("TEMPLATE_POWER_USER");
      }
    }

    if (statName === "dailySends") {
      const result = await this.storage.get("achievements");
      if (value >= 10 && !result.achievements?.unlocked?.["SEND_STREAK_10"]) {
        await this.unlockAchievement("SEND_STREAK_10");
      }
      if (value >= 30 && !result.achievements?.unlocked?.["SEND_STREAK_30"]) {
        await this.unlockAchievement("SEND_STREAK_30");
      }
    }
  }

  // Fires a DOM custom event that the AchievementToast component listens for
  _showNotification(achievement) {
    document.dispatchEvent(
      new CustomEvent("achievementUnlocked", {
        detail: achievement,
      })
    );
  }

  async getProgress() {
    const result = await this.storage.get("achievements");
    return {
      achievements: result.achievements.unlocked,
      stats: result.achievements.stats,
      totalGamerscore: Object.values(result.achievements.unlocked).reduce(
        (total, achievement) => total + achievement.gamerscore,
        0
      ),
    };
  }

  // Check if the popup is currently open using MV3-compatible API
  async _isPopupVisible() {
    try {
      if (chrome.runtime.getContexts) {
        const contexts = await chrome.runtime.getContexts({ contextTypes: ['POPUP'] });
        return contexts.length > 0;
      }
      // Fallback: assume popup is visible if we're running in a document context
      return typeof document !== 'undefined' && document.visibilityState === 'visible';
    } catch (error) {
      console.error("Error checking popup visibility:", error);
      return false;
    }
  }

  // Overwrites the ticket count stat directly (used for manual/external sync)
  async forceSyncTicketCount(count) {
    try {
      console.log(`Force syncing ticket count to: ${count}`);
      const result = await this.storage.get("achievements");

      if (!result.achievements) {
        await this.initialize();
      }

      result.achievements.stats.ticketsSolved = count;
      await this.storage.set({ achievements: result.achievements });
      console.log("Ticket count force synced successfully");

      // Check if achievement should be unlocked
      if (count >= 1 && !result.achievements.unlocked["TICKET_SOLVER"]) {
        await this.unlockAchievement("TICKET_SOLVER");
      }
    } catch (error) {
      console.error("Error force syncing ticket count:", error);
      throw error;
    }
  }
}

export const achievementSystem = new AchievementSystem();
export const ACHIEVEMENT_TYPES = ACHIEVEMENTS;
