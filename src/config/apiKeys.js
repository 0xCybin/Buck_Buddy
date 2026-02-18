// API key configuration for FedEx and USPS.
// Keys are injected at build time from .keys.json (gitignored),
// then seeded into chrome.storage.local on first install.

/* global __API_KEYS__ */
const buildKeys = typeof __API_KEYS__ !== 'undefined' ? __API_KEYS__ : {};

// Seed chrome.storage on first install if keys are available
if (buildKeys.fedex || buildKeys.usps) {
  chrome.storage.local.get(["apiKeys"], (result) => {
    if (!result.apiKeys?.fedex?.apiKey || !result.apiKeys?.usps?.consumerKey) {
      chrome.storage.local.set({ apiKeys: buildKeys });
    }
  });
}

// Lazy async getters: reads from storage, falls back to build-time keys
export default {
  get fedex() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["apiKeys"], (result) => {
        resolve(result.apiKeys?.fedex || buildKeys.fedex || {});
      });
    });
  },
  get usps() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["apiKeys"], (result) => {
        resolve(result.apiKeys?.usps || buildKeys.usps || {});
      });
    });
  },
};
