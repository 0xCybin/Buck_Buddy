// src/services/storage/chromeStorage.js
// Thin wrapper around chrome.storage.local providing async CRUD, batch operations,
// quota tracking, and change listeners. All methods propagate errors after logging.

// Lightweight read-time validation for critical storage keys.
// Returns sensible defaults instead of corrupted data.
const VALIDATORS = {
  buck_tamagotchi_state: (val) => {
    if (!val || typeof val !== 'object') return null;
    if (typeof val.hunger !== 'number' || typeof val.happiness !== 'number') {
      console.warn('[Storage] Corrupted tamagotchi state, returning defaults');
      return { hunger: 80, happiness: 80, energy: 80, coins: 0, accessories: [], totalTimesFed: 0, totalTimesPet: 0 };
    }
    return val;
  },
  agent_stats: (val) => {
    if (!val || typeof val !== 'object' || typeof val.allTime !== 'object') {
      console.warn('[Storage] Corrupted agent_stats, returning defaults');
      return { allTime: { sends: 0, replies: 0, notes: 0, resolves: 0, closes: 0 }, daily: {} };
    }
    return val;
  },
  reminders: (val) => {
    if (!Array.isArray(val)) {
      console.warn('[Storage] Corrupted reminders, returning empty array');
      return [];
    }
    return val;
  },
  notepadNotes: (val) => {
    if (!Array.isArray(val)) {
      console.warn('[Storage] Corrupted notepadNotes, returning empty array');
      return [];
    }
    return val;
  },
};

function validateOnRead(key, value) {
  if (value === undefined) return undefined;
  const validator = VALIDATORS[key];
  return validator ? validator(value) : value;
}

class ChromeStorage {
  constructor() {
    this.storage = chrome.storage.local;
  }

  // Store a single key-value pair
  async set(key, value) {
    try {
      await this.storage.set({ [key]: value });
    } catch (error) {
      console.error("Chrome storage set error:", error);
      throw error;
    }
  }

  // Retrieve a single value by key. Validates critical keys on read.
  async get(key) {
    try {
      const result = await this.storage.get(key);
      return validateOnRead(key, result[key]);
    } catch (error) {
      console.error("Chrome storage get error:", error);
      throw error;
    }
  }

  // Remove a single key from storage
  async remove(key) {
    try {
      await this.storage.remove(key);
    } catch (error) {
      console.error("Chrome storage remove error:", error);
      throw error;
    }
  }

  // Wipe all data from chrome.storage.local
  async clear() {
    try {
      await this.storage.clear();
    } catch (error) {
      console.error("Chrome storage clear error:", error);
      throw error;
    }
  }

  // Get all key-value pairs. Passing null to chrome.storage.get returns everything.
  async getAll() {
    try {
      return await this.storage.get(null);
    } catch (error) {
      console.error("Chrome storage getAll error:", error);
      throw error;
    }
  }

  // Returns bytes used and remaining quota (chrome.storage.local has a 10MB default limit)
  async getBytesInUse() {
    try {
      const bytesInUse = await this.storage.getBytesInUse(null);
      return {
        bytesInUse,
        bytesRemaining: chrome.storage.local.QUOTA_BYTES - bytesInUse,
      };
    } catch (error) {
      console.error("Chrome storage getBytesInUse error:", error);
      throw error;
    }
  }

  // Batch store multiple key-value pairs in one call
  async setMultiple(items) {
    try {
      await this.storage.set(items);
    } catch (error) {
      console.error("Chrome storage setMultiple error:", error);
      throw error;
    }
  }

  // Retrieve multiple keys at once. Returns an object of key-value pairs.
  async getMultiple(keys) {
    try {
      return await this.storage.get(keys);
    } catch (error) {
      console.error("Chrome storage getMultiple error:", error);
      throw error;
    }
  }

  // Subscribe to storage changes. Only fires for "local" area, not "sync" or "session".
  addChangeListener(callback) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local") {
        callback(changes);
      }
    });
  }

  // Check if a key exists (returns true if value is not undefined)
  async hasKey(key) {
    const result = await this.get(key);
    return result !== undefined;
  }
}

export default ChromeStorage;
