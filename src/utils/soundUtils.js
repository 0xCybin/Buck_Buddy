// src/utils/soundUtils.js
// Singleton sound manager for UI audio feedback. Pre-loads Audio elements for
// button clicks, page transitions, and achievement notifications. Persists
// enabled/volume settings to chrome.storage.local.

class SoundManager {
  constructor() {
    // Pool of button click sounds (randomly selected on play)
    this.buttonSounds = [
      new Audio(chrome.runtime.getURL("assets/sounds/Select_1.mp3")),
    ];

    // One sound per tab/page; stats reuses the data sound
    this.pageSounds = {
      templates: new Audio(
        chrome.runtime.getURL("assets/sounds/Template_Page.mp3")
      ),
      buck: new Audio(chrome.runtime.getURL("assets/sounds/Chat_Page.mp3")),
      data: new Audio(chrome.runtime.getURL("assets/sounds/Data_Page.mp3")),
      stats: new Audio(chrome.runtime.getURL("assets/sounds/Data_Page.mp3")),
    };

    this.achievementSound = new Audio(
      chrome.runtime.getURL("assets/sounds/Achievement Notification Sound.mp3")
    );

    this.enabled = true;
    this.volume = 0.5;

    // Apply default volume to all pre-loaded sounds (including achievement)
    [...this.buttonSounds, ...Object.values(this.pageSounds), this.achievementSound].forEach(
      (sound) => {
        sound.volume = this.volume;
      }
    );

    this.loadSettings(); // Async -- stored volume applied once resolved
  }

  // Hydrates enabled/volume from storage. Called in constructor but async,
  // so there is a brief window where default values are used.
  async loadSettings() {
    try {
      const result = await chrome.storage.local.get("soundSettings");
      if (result.soundSettings) {
        this.enabled = result.soundSettings.enabled ?? true;
        this.volume = result.soundSettings.volume ?? 0.5;
        this.updateVolume(this.volume);
      }
    } catch (error) {
      console.error("Error loading sound settings:", error);
    }
  }

  // Applies volume to all Audio elements and persists to storage
  async updateVolume(volume) {
    this.volume = volume;
    [...this.buttonSounds, ...Object.values(this.pageSounds), this.achievementSound].forEach(
      (sound) => {
        sound.volume = volume;
      }
    );

    // Save volume setting to storage
    try {
      const result = await chrome.storage.local.get("soundSettings");
      const currentSettings = result.soundSettings || {};
      await chrome.storage.local.set({
        soundSettings: {
          ...currentSettings,
          volume: volume,
        },
      });
    } catch (error) {
      console.error("Error saving volume setting:", error);
    }
  }

  // Picks a random sound from the button pool and plays it from the start
  playRandomButtonSound() {
    if (!this.enabled) return;
    const randomIndex = Math.floor(Math.random() * this.buttonSounds.length);
    const sound = this.buttonSounds[randomIndex];
    sound.currentTime = 0; // Reset so rapid clicks don't overlap
    sound.play().catch((error) => {
      console.warn("Sound playback failed:", error);
    });
  }

  playPageSound(page) {
    if (!this.enabled) return;
    const sound = this.pageSounds[page];
    if (sound) {
      sound.currentTime = 0;
      sound.play().catch((error) => {
        console.warn("Sound playback failed:", error);
      });
    }
  }

  playAchievementSound() {
    if (!this.enabled) return;
    this.achievementSound.currentTime = 0;
    this.achievementSound.play().catch((error) => {
      console.warn("Achievement sound playback failed:", error);
    });
  }

  // Persists toggle state and triggers mute-related achievements.
  // BUG: calls achievementTriggers.onSoundSettingsChange which is not defined
  // in achievementTriggers.js -- will throw at runtime when muting.
  async toggle(enabled) {
    this.enabled = enabled;

    try {
      const result = await chrome.storage.local.get("soundSettings");
      const currentSettings = result.soundSettings || {};
      await chrome.storage.local.set({
        soundSettings: {
          ...currentSettings,
          enabled: enabled,
        },
      });

    } catch (error) {
      console.error("Error saving sound enabled setting:", error);
    }
  }

  getSoundState() {
    return {
      enabled: this.enabled,
      volume: this.volume,
    };
  }
}

// Singleton -- instantiated once, shared across the popup
export const soundManager = new SoundManager();

// React hook that exposes sound actions without importing the singleton directly
export function useSoundEffect() {
  return {
    playButton: () => soundManager.playRandomButtonSound(),
    playPageTransition: (page) => soundManager.playPageSound(page),
    playAchievement: () => soundManager.playAchievementSound(),
  };
}
