/**
 * Background Service Worker (Chrome MV3)
 *
 * Handles all background tasks for the BuckBuddy extension:
 *  - Extension lifecycle (install, startup, alarms)
 *  - Daily login streak tracking with coin rewards
 *  - Break reminder scheduling and Buck tamagotchi hunger decay
 *  - Message routing for tracking (FedEx/USPS), SKU lookup, reminders, stats, coins
 *  - Agent performance stats (sends, template copies, resolved tickets)
 *  - Reminder system (schedule, cancel, snooze, fire notifications)
 *  - GME coin economy (earn from streaks, sends, ticket resolutions)
 */

import { achievementSystem } from '../utils/achievementSystem';
import { achievementTriggers } from '../utils/achievementTriggers';
import fedexApi from '../services/tracking/fedexApi';
import uspsApi from '../services/tracking/uspsApi';
import gamestopScraper from '../services/lookup/gamestopScraper';
import { SHOP_CATALOG, CONSUMABLE_CATEGORIES, computeMood } from '../config/shopCatalog';

// ─── Installation ────────────────────────────────────────────────────────────

// First-run and update handler: sets defaults for settings, tamagotchi, and coin balance.
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed/updated:', details.reason);

  await initializeAchievementSystem();

  // Request notification and background permissions if not already granted
  chrome.permissions.contains(
    { permissions: ['notifications', 'background'] },
    (result) => {
      if (!result) {
        chrome.permissions.request({
          permissions: ['notifications', 'background'],
        });
      }
    }
  );

  // Seed default notification and feature-flag settings on first install
  chrome.storage.local.get(
    ['notificationSettings', 'featureSettings'],
    (result) => {
      const updates = {};
      if (!result.notificationSettings) updates.notificationSettings = { enabled: true };
      if (!result.featureSettings) updates.featureSettings = {
        trackingEnabled: true,
        skuLookupEnabled: true,
        notepadEnabled: true,
        remindersEnabled: true,
        notificationSoundEnabled: true,
      };

      if (Object.keys(updates).length > 0) {
        chrome.storage.local.set(updates);
      }
    }
  );

  // Seed Buck tamagotchi state, inventory, and starting coin balance (100 coins)
  chrome.storage.local.get(['buck_tamagotchi_state', 'gme_coin_balance', 'buck_inventory'], (result) => {
    const updates = {};
    if (!result.buck_tamagotchi_state) {
      updates.buck_tamagotchi_state = {
        hunger: 80,
        happiness: 70,
        lastFedTimestamp: Date.now(),
        lastUpdateTimestamp: Date.now(),
        isOnVacation: false,
        vacationStartTimestamp: null,
        daysAtZero: 0,
        equippedItems: { hat: null, eyewear: null, outfit: null, held: null },
        totalTimesFed: 0,
        totalTimesPet: 0,
        lastPetTimestamp: 0,
        totalCoinsSpent: 0,
      };
    } else if (!result.buck_tamagotchi_state.equippedItems) {
      // Migrate from old equippedAccessory to new equippedItems slots
      updates.buck_tamagotchi_state = {
        ...result.buck_tamagotchi_state,
        equippedItems: { hat: null, eyewear: null, outfit: null, held: null },
        totalTimesPet: result.buck_tamagotchi_state.totalTimesPet || 0,
        lastPetTimestamp: result.buck_tamagotchi_state.lastPetTimestamp || 0,
        totalCoinsSpent: result.buck_tamagotchi_state.totalCoinsSpent || 0,
      };
      delete updates.buck_tamagotchi_state.equippedAccessory;
    }
    if (!result.buck_inventory) {
      updates.buck_inventory = { ownedItems: [] };
    }
    if (result.gme_coin_balance === undefined) {
      updates.gme_coin_balance = 100; // Starting bonus
    }
    if (Object.keys(updates).length > 0) {
      chrome.storage.local.set(updates);
    }
  });

  // Start break alarms and restore reminder alarms on install/update too
  setupBreakAlarms();
  reregisterReminderAlarms();
});

// ─── Startup ─────────────────────────────────────────────────────────────────

// Runs each time the browser launches. Handles streak, stats cleanup, alarms.
chrome.runtime.onStartup.addListener(async () => {
  console.log('Extension starting up...');

  await initializeAchievementSystem();

  // Award coins if the agent's login streak continues
  try {
    await handleDailyStreak();
  } catch (error) {
    console.error('Failed to handle daily streak:', error);
  }

  // Drop daily stats >90 days old and weekly stats >1 year old
  try {
    await pruneOldStats();
  } catch (error) {
    console.error('Failed to prune old stats:', error);
  }

  // Start the 1-minute recurring alarm for breaks and hunger decay
  setupBreakAlarms();

  // Restore any pending reminder alarms lost when the service worker stopped
  reregisterReminderAlarms();
});

// ─── Achievement System ──────────────────────────────────────────────────────

// Loads achievement definitions and unlocked state from storage.
async function initializeAchievementSystem() {
  try {
    console.log('Initializing achievement system...');
    await achievementSystem.initialize();
    console.log('Achievement system initialized successfully');
  } catch (error) {
    console.error('Failed to initialize achievement system:', error);
  }
}

// ─── Daily Streak ────────────────────────────────────────────────────────────

// Determines whether the agent's streak continues, resets, or bridges a weekend gap.
// Awards escalating coin bonuses (25/50/75/100) plus a 200-coin bonus every 7 days.
async function handleDailyStreak() {
  const result = await chrome.storage.local.get(['streak_data', 'gme_coin_balance']);
  const streak = result.streak_data || {
    currentDays: 0,
    lastActiveDate: null,
    longestStreak: 0,
    weekStartDate: null,
  };
  const coins = result.gme_coin_balance || 0;

  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  if (streak.lastActiveDate === today) {
    return; // Already logged today
  }

  let streakBonus = 0;

  if (streak.lastActiveDate === yesterday) {
    // Consecutive day
    streak.currentDays++;
  } else if (streak.lastActiveDate && streak.lastActiveDate !== yesterday) {
    // Gap detected -- allow it if the last active day was Friday or Saturday
    // and the gap is <= 3 days (covers Fri->Mon or Sat->Mon weekend absences).
    const lastDate = new Date(streak.lastActiveDate);
    const dayOfWeek = lastDate.getDay();
    const daysGap = Math.floor((Date.now() - lastDate.getTime()) / 86400000);

    if (daysGap <= 3 && (dayOfWeek === 5 || dayOfWeek === 6)) {
      streak.currentDays++;
    } else {
      streak.currentDays = 1;
    }
  } else {
    streak.currentDays = 1;
  }

  // Calculate streak bonus
  if (streak.currentDays >= 5) streakBonus = 100;
  else if (streak.currentDays >= 4) streakBonus = 75;
  else if (streak.currentDays >= 3) streakBonus = 50;
  else if (streak.currentDays >= 2) streakBonus = 25;

  // Weekly bonus at day 7
  if (streak.currentDays % 7 === 0) streakBonus += 200;

  streak.lastActiveDate = today;
  streak.longestStreak = Math.max(streak.longestStreak, streak.currentDays);

  await chrome.storage.local.set({
    streak_data: streak,
    gme_coin_balance: coins + streakBonus,
  });

  if (streakBonus > 0) {
    // Log transaction
    const txResult = await chrome.storage.local.get('coin_transactions');
    const transactions = txResult.coin_transactions || [];
    transactions.push({
      type: 'earn',
      source: 'streak',
      amount: streakBonus,
      timestamp: Date.now(),
    });
    // Cap transaction history at 200 entries to limit storage growth
    await chrome.storage.local.set({
      coin_transactions: transactions.slice(-200),
    });

    console.log(`Daily streak: Day ${streak.currentDays}, +${streakBonus} coins`);
  }
}

// ─── Alarm Listener (top-level for MV3) ─────────────────────────────────────

// MUST be registered at the top level of the service worker so Chrome can
// dispatch alarm events even when the worker wakes up outside of onStartup.
chrome.alarms.onAlarm.addListener(async (alarm) => {
  // Reminder alarms use a "reminder_<id>" naming convention
  if (alarm.name.startsWith('reminder_')) {
    await fireReminderNotification(alarm.name.replace('reminder_', ''));
    return;
  }

  if (alarm.name === 'checkBreakTime') {
    const now = new Date();
    const hours = now.getHours();

    // Night time usage achievement
    if (hours >= 0 && hours < 5) {
      try {
        await achievementTriggers.onNightTimeUsage();
      } catch (error) {
        console.error('Error triggering night time achievement:', error);
      }
    }

    // Check break reminders
    try {
      const result = await chrome.storage.local.get('break_schedule');
      const schedule = result.break_schedule;
      if (schedule?.enabled) {
        checkBreakReminders(schedule, now);
      }
    } catch (error) {
      console.error('Error checking break schedule:', error);
    }

    // Periodically decay Buck's hunger (background)
    try {
      await decayBuckHunger();
    } catch (error) {
      console.error('Error decaying Buck hunger:', error);
    }
  }
});

// ─── Break Alarms ────────────────────────────────────────────────────────────

// Creates a 1-minute recurring alarm aligned to the top of each minute.
function setupBreakAlarms() {
  chrome.alarms.clear('checkBreakTime');

  // Align first fire to the next minute boundary for consistent timing
  chrome.alarms.create('checkBreakTime', {
    periodInMinutes: 1,
    when: Date.now() + (60 - new Date().getSeconds()) * 1000,
  });
}

// Reduces Buck's hunger by ~4% per hour and happiness by ~2% per hour.
// If hunger stays at 0 for 3+ days, Buck goes on vacation.
async function decayBuckHunger() {
  const result = await chrome.storage.local.get('buck_tamagotchi_state');
  const state = result.buck_tamagotchi_state;
  if (!state) return;

  const now = Date.now();
  const minutesSinceUpdate = (now - state.lastUpdateTimestamp) / (1000 * 60);

  // Throttle decay to avoid excessive writes on rapid alarm fires
  if (minutesSinceUpdate < 5) return;

  const hoursSinceUpdate = minutesSinceUpdate / 60;
  const hungerDecay = hoursSinceUpdate * 4; // 4% per hour
  const happinessDecay = hoursSinceUpdate * 2; // 2% per hour (half of hunger)
  const newHunger = Math.max(0, state.hunger - hungerDecay);
  const newHappiness = Math.max(0, (state.happiness || 70) - happinessDecay);

  // Check vacation
  let isOnVacation = state.isOnVacation;
  let daysAtZero = state.daysAtZero;
  if (newHunger === 0 && !isOnVacation) {
    const daysSinceLastFed = (now - state.lastFedTimestamp) / (1000 * 60 * 60 * 24);
    daysAtZero = Math.floor(daysSinceLastFed);
    if (daysAtZero >= 3) isOnVacation = true;
  }

  await chrome.storage.local.set({
    buck_tamagotchi_state: {
      ...state,
      hunger: newHunger,
      happiness: newHappiness,
      lastUpdateTimestamp: now,
      isOnVacation,
      daysAtZero,
    },
  });
}

// Fires a Chrome notification when the current time matches a scheduled break,
// and sends a 2-minute advance warning to all tabs.
function checkBreakReminders(schedule, now) {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (schedule.breaks) {
    schedule.breaks.forEach((breakTime) => {
      const breakMinutes = breakTime.hour * 60 + breakTime.minute;
      const diff = breakMinutes - currentMinutes;

      // 2-minute warning
      if (diff === 2) {
        broadcastToTabs({ type: 'BREAK_WARNING', minutes: 2 });
      }

      // Exact match: fire the break notification
      if (Math.abs(diff) < 1) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('assets/buck/Buck_128.png'),
          title: '🐰 Break Time!',
          message: `Buck says: Time for your ${breakTime.duration}-minute break! Take care of yourself!`,
        });
      }
    });
  }
}

// Sends a message to all open tabs (best-effort, ignores errors)
async function broadcastToTabs(message) {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, message).catch(() => {});
    }
  } catch (e) {
    console.warn('Failed to broadcast to tabs:', e);
  }
}

// ─── FedEx Tracking (kept as-is) ─────────────────────────────────────────────

// Converts a FedEx location object (city/state/country) to a display string.
function formatLocation(location) {
  if (!location) return 'Location unavailable';
  if (typeof location === 'string') return location;

  const parts = [];
  if (location.city) parts.push(location.city);
  if (location.stateOrProvinceCode) parts.push(location.stateOrProvinceCode);
  if (location.countryCode && location.countryCode !== 'US') {
    parts.push(location.countryName || location.countryCode);
  }

  return parts.length > 0 ? parts.join(', ') : 'Location unavailable';
}

// ─── Message Handler ─────────────────────────────────────────────────────────

// Central message router. Content scripts and popup send messages here.
// Every async case returns true to keep the sendResponse channel open.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.type) {
    // DEAD CODE: This handler is never reached in practice. Real tracking
    // goes through FEDEX_TRACK or USPS_TRACK after carrier detection.
    case 'TRACK_PACKAGE':
      handleTrackPackage(request.trackingNumber)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;

    case 'FEDEX_TRACK':
      fedexApi
        .trackPackage(request.trackingNumber)
        .then((data) => sendResponse({ success: true, data }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;

    case 'USPS_TRACK':
      uspsApi
        .trackPackage(request.trackingNumber)
        .then((data) => sendResponse({ success: true, data }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;

    case 'GAMESTOP_SKU_LOOKUP':
      gamestopScraper
        .lookupProduct(request.sku)
        .then((data) => sendResponse({ success: true, data }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;

    // Weather: fetch geo + forecast from background to avoid extension origin 403s.
    // Tries multiple free geo APIs in order until one works.
    case 'FETCH_WEATHER':
      (async () => {
        try {
          let lat, lon, city;

          // Try geo APIs in order until one succeeds
          const geoApis = [
            {
              url: 'https://ipwho.is/',
              parse: (d) => d.success && d.latitude && d.longitude
                ? { lat: d.latitude, lon: d.longitude, city: d.city || '' }
                : null,
            },
            {
              url: 'https://get.geojs.io/v1/ip/geo.json',
              parse: (d) => d.latitude && d.longitude
                ? { lat: parseFloat(d.latitude), lon: parseFloat(d.longitude), city: d.city || '' }
                : null,
            },
            {
              url: 'https://ipapi.co/json/',
              parse: (d) => d.latitude && d.longitude
                ? { lat: d.latitude, lon: d.longitude, city: d.city || '' }
                : null,
            },
          ];

          for (const api of geoApis) {
            try {
              const res = await fetch(api.url);
              if (!res.ok) continue;
              const data = await res.json();
              const parsed = api.parse(data);
              if (parsed) {
                lat = parsed.lat;
                lon = parsed.lon;
                city = parsed.city;
                break;
              }
            } catch (_) {
              // Try next API
            }
          }

          if (!lat || !lon) {
            sendResponse({ success: false, error: 'All geo APIs failed' });
            return;
          }

          const wxRes = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=auto`
          );
          const wx = await wxRes.json();
          if (!wx.current) {
            sendResponse({ success: false, error: 'No weather data' });
            return;
          }
          sendResponse({
            success: true,
            data: {
              temp: Math.round(wx.current.temperature_2m),
              code: wx.current.weather_code,
              city: city,
            },
          });
        } catch (e) {
          sendResponse({ success: false, error: e.message });
        }
      })();
      return true;

    // GME stock price via Yahoo Finance chart API
    case 'FETCH_GME_STOCK':
      (async () => {
        try {
          const res = await fetch(
            'https://query1.finance.yahoo.com/v8/finance/chart/GME?interval=1d&range=1d'
          );
          if (!res.ok) throw new Error(`Yahoo Finance ${res.status}`);
          const json = await res.json();
          const meta = json?.chart?.result?.[0]?.meta;
          if (!meta?.regularMarketPrice) throw new Error('No stock data');

          const price = meta.regularMarketPrice;
          const prevClose = meta.previousClose || meta.chartPreviousClose || price;
          const change = price - prevClose;
          const changePct = prevClose ? (change / prevClose) * 100 : 0;

          sendResponse({
            success: true,
            data: { price, prevClose, change, changePct },
          });
        } catch (e) {
          sendResponse({ success: false, error: e.message });
        }
      })();
      return true;

    case 'SCHEDULE_REMINDER':
      handleScheduleReminder(request.reminder)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;

    case 'CANCEL_REMINDER':
      handleCancelReminder(request.reminderId)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;

    case 'SNOOZE_REMINDER':
      handleSnoozeReminder(request.reminderId, request.minutes || 5)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;

    case 'TRACK_SEND':
      handleTrackSend(request.source, request.sendType)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;

    case 'TRACK_TEMPLATE_COPY':
      handleTrackTemplateCopy()
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;

    case 'GET_AGENT_STATS':
      handleGetAgentStats()
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;

    case 'AWARD_COINS':
      handleAwardCoins(request.amount, request.source)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;

    case 'GET_COIN_BALANCE':
      chrome.storage.local.get('gme_coin_balance', (result) => {
        sendResponse({ success: true, balance: result.gme_coin_balance || 0 });
      });
      return true;

    // ─── Tamagotchi Handlers ──────────────────────────────────────────────
    case 'GET_TAMAGOTCHI_STATE':
      handleGetTamagotchiState()
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;

    case 'FEED_BUCK':
      handleFeedBuck(request.itemId)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;

    case 'PET_BUCK':
      handlePetBuck()
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;

    case 'BUY_ITEM':
      handleBuyItem(request.itemId)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;

    case 'EQUIP_ITEM':
      handleEquipItem(request.itemId, request.slot)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;

    default:
      return false;
  }
});

// Adds coins to the balance and logs the transaction (capped at 200 entries).
async function handleAwardCoins(amount, source) {
  const result = await chrome.storage.local.get('gme_coin_balance');
  const current = result.gme_coin_balance || 0;
  const newBalance = current + amount;

  await chrome.storage.local.set({ gme_coin_balance: newBalance });

  // Log transaction
  const txResult = await chrome.storage.local.get('coin_transactions');
  const transactions = txResult.coin_transactions || [];
  transactions.push({ type: 'earn', source, amount, timestamp: Date.now() });
  await chrome.storage.local.set({ coin_transactions: transactions.slice(-200) });

  return { success: true, balance: newBalance };
}

// DEAD CODE: This function is never called in the current codebase.
// The TRACK_PACKAGE message type that routes here is also dead code.
// Actual tracking is handled by fedexApi.trackPackage / uspsApi.trackPackage.
async function handleTrackPackage(trackingNumber) {
  console.log('Tracking package:', trackingNumber);
  return { success: true, trackingNumber, status: 'Tracking lookup initiated' };
}

// ─── Tamagotchi Handlers ──────────────────────────────────────────────────────

// Returns the full tamagotchi state including coin balance, inventory, and computed mood.
async function handleGetTamagotchiState() {
  const result = await chrome.storage.local.get([
    'buck_tamagotchi_state', 'gme_coin_balance', 'buck_inventory',
  ]);
  const state = result.buck_tamagotchi_state || {
    hunger: 80, happiness: 70, lastFedTimestamp: Date.now(),
    lastUpdateTimestamp: Date.now(), isOnVacation: false,
    vacationStartTimestamp: null, daysAtZero: 0,
    equippedItems: { hat: null, eyewear: null, outfit: null, held: null },
    totalTimesFed: 0, totalTimesPet: 0, lastPetTimestamp: 0, totalCoinsSpent: 0,
  };
  const inventory = result.buck_inventory || { ownedItems: [] };
  const coins = result.gme_coin_balance || 0;
  const mood = computeMood(state.hunger, state.happiness, state.isOnVacation);

  return {
    success: true,
    state,
    coinBalance: coins,
    inventory,
    mood,
  };
}

// Feeds Buck with a shop item. Consumables are used immediately; validates coins.
async function handleFeedBuck(itemId) {
  const item = SHOP_CATALOG[itemId];
  if (!item) return { success: false, error: 'Item not found' };
  if (!CONSUMABLE_CATEGORIES.includes(item.category)) {
    return { success: false, error: 'Item is not consumable' };
  }

  const result = await chrome.storage.local.get([
    'buck_tamagotchi_state', 'gme_coin_balance', 'coin_transactions',
  ]);
  const state = result.buck_tamagotchi_state;
  const coins = result.gme_coin_balance || 0;

  if (!state) return { success: false, error: 'No tamagotchi state' };
  if (coins < item.cost) return { success: false, error: 'Not enough coins' };

  // Apply food effects
  state.hunger = Math.min(100, state.hunger + (item.hungerRestore || 0));
  state.happiness = Math.min(100, (state.happiness || 70) + (item.happinessBoost || 0));
  state.lastFedTimestamp = Date.now();
  state.lastUpdateTimestamp = Date.now();
  state.totalTimesFed = (state.totalTimesFed || 0) + 1;
  state.totalCoinsSpent = (state.totalCoinsSpent || 0) + item.cost;

  // If Buck was on vacation, bring them back when fed
  if (state.isOnVacation) {
    state.isOnVacation = false;
    state.daysAtZero = 0;
  }

  const newBalance = coins - item.cost;

  // Log transaction
  const transactions = result.coin_transactions || [];
  transactions.push({
    type: 'spend', source: 'feed', amount: item.cost,
    itemId: item.id, timestamp: Date.now(),
  });

  await chrome.storage.local.set({
    buck_tamagotchi_state: state,
    gme_coin_balance: newBalance,
    coin_transactions: transactions.slice(-200),
  });

  // Trigger achievements
  try {
    await achievementTriggers.onBuckFed(state.totalTimesFed);
    if (state.totalCoinsSpent >= 500) {
      await achievementTriggers.onBigSpender();
    }
  } catch (e) {
    console.error('Error checking feed achievements:', e);
  }

  return {
    success: true,
    state,
    coinBalance: newBalance,
    mood: computeMood(state.hunger, state.happiness, state.isOnVacation),
  };
}

// Pets Buck: +5 happiness with 30s cooldown.
async function handlePetBuck() {
  const result = await chrome.storage.local.get('buck_tamagotchi_state');
  const state = result.buck_tamagotchi_state;
  if (!state) return { success: false, error: 'No tamagotchi state' };

  const now = Date.now();
  const lastPet = state.lastPetTimestamp || 0;
  const cooldownMs = 30 * 1000;

  if (now - lastPet < cooldownMs) {
    const remaining = Math.ceil((cooldownMs - (now - lastPet)) / 1000);
    return { success: false, error: 'Cooldown', cooldownRemaining: remaining };
  }

  state.happiness = Math.min(100, (state.happiness || 70) + 5);
  state.lastPetTimestamp = now;
  state.lastUpdateTimestamp = now;
  state.totalTimesPet = (state.totalTimesPet || 0) + 1;

  await chrome.storage.local.set({ buck_tamagotchi_state: state });

  // Trigger achievements
  try {
    await achievementTriggers.onBuckPet(state.totalTimesPet);
  } catch (e) {
    console.error('Error checking pet achievements:', e);
  }

  return {
    success: true,
    state,
    mood: computeMood(state.hunger, state.happiness, state.isOnVacation),
  };
}

// Buys an item from the shop. Consumables are fed immediately, accessories go to inventory.
async function handleBuyItem(itemId) {
  const item = SHOP_CATALOG[itemId];
  if (!item) return { success: false, error: 'Item not found' };

  const result = await chrome.storage.local.get([
    'buck_tamagotchi_state', 'gme_coin_balance', 'buck_inventory', 'coin_transactions',
  ]);
  const state = result.buck_tamagotchi_state;
  const coins = result.gme_coin_balance || 0;
  const inventory = result.buck_inventory || { ownedItems: [] };

  if (!state) return { success: false, error: 'No tamagotchi state' };
  if (coins < item.cost) return { success: false, error: 'Not enough coins' };

  // If it's a consumable, feed immediately
  if (CONSUMABLE_CATEGORIES.includes(item.category)) {
    return handleFeedBuck(itemId);
  }

  // Accessory: check if already owned
  if (inventory.ownedItems.includes(itemId)) {
    return { success: false, error: 'Already owned' };
  }

  inventory.ownedItems.push(itemId);
  const newBalance = coins - item.cost;
  state.totalCoinsSpent = (state.totalCoinsSpent || 0) + item.cost;

  // Log transaction
  const transactions = result.coin_transactions || [];
  transactions.push({
    type: 'spend', source: 'shop', amount: item.cost,
    itemId: item.id, timestamp: Date.now(),
  });

  await chrome.storage.local.set({
    buck_tamagotchi_state: state,
    gme_coin_balance: newBalance,
    buck_inventory: inventory,
    coin_transactions: transactions.slice(-200),
  });

  // Trigger achievements
  try {
    await achievementTriggers.onShopPurchase();
    if (inventory.ownedItems.length === 1) {
      await achievementTriggers.onFirstAccessory();
    }
    if (state.totalCoinsSpent >= 500) {
      await achievementTriggers.onBigSpender();
    }
  } catch (e) {
    console.error('Error checking shop achievements:', e);
  }

  return {
    success: true,
    state,
    coinBalance: newBalance,
    inventory,
    mood: computeMood(state.hunger, state.happiness, state.isOnVacation),
  };
}

// Equips or unequips an accessory. Pass null itemId to unequip a slot.
async function handleEquipItem(itemId, slot) {
  const result = await chrome.storage.local.get(['buck_tamagotchi_state', 'buck_inventory']);
  const state = result.buck_tamagotchi_state;
  const inventory = result.buck_inventory || { ownedItems: [] };

  if (!state) return { success: false, error: 'No tamagotchi state' };

  // Ensure equippedItems structure exists
  if (!state.equippedItems) {
    state.equippedItems = { hat: null, eyewear: null, outfit: null, held: null };
  }

  if (itemId === null) {
    // Unequip slot
    if (slot && state.equippedItems[slot] !== undefined) {
      state.equippedItems[slot] = null;
    }
  } else {
    // Validate ownership
    if (!inventory.ownedItems.includes(itemId)) {
      return { success: false, error: 'Item not owned' };
    }
    const item = SHOP_CATALOG[itemId];
    if (!item || !item.slot) return { success: false, error: 'Not an equippable item' };

    // Equip in the correct slot
    state.equippedItems[item.slot] = { id: item.id, asset: item.asset, name: item.name };
  }

  await chrome.storage.local.set({ buck_tamagotchi_state: state });

  return {
    success: true,
    state,
    mood: computeMood(state.hunger, state.happiness, state.isOnVacation),
  };
}

// ─── Agent Stats Tracking ─────────────────────────────────────────────────────

// Returns a zeroed-out stats object used for each daily/weekly bucket.
function createDayStats() {
  return { sendCount: 0, freshdeskSends: 0, outlookSends: 0, templateCopies: 0, resolvedTickets: 0 };
}

// Returns the top-level stats structure with allTime, daily, and weekly buckets.
function createDefaultStats() {
  return {
    allTime: {
      sendCount: 0,
      freshdeskSends: 0,
      outlookSends: 0,
      templateCopies: 0,
      resolvedTickets: 0,
      firstTrackedDate: new Date().toISOString().split('T')[0],
    },
    daily: {},
    weekly: {},
  };
}

function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

// Returns the ISO date string of the Monday that starts the given week.
function getWeekStartDate(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

// Removes daily stats older than 90 days and weekly stats older than 1 year.
async function pruneOldStats() {
  const result = await chrome.storage.local.get('agent_stats');
  const stats = result.agent_stats;
  if (!stats) return;

  const now = Date.now();
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
  const oneYearMs = 365 * 24 * 60 * 60 * 1000;
  let changed = false;

  // Prune daily entries older than 90 days
  if (stats.daily) {
    for (const key of Object.keys(stats.daily)) {
      if (now - new Date(key).getTime() > ninetyDaysMs) {
        delete stats.daily[key];
        changed = true;
      }
    }
  }

  // Prune weekly entries older than 1 year
  if (stats.weekly) {
    for (const key of Object.keys(stats.weekly)) {
      if (now - new Date(key).getTime() > oneYearMs) {
        delete stats.weekly[key];
        changed = true;
      }
    }
  }

  if (changed) {
    await chrome.storage.local.set({ agent_stats: stats });
    console.log('Pruned old agent stats entries');
  }
}

// Lazily initializes the daily and weekly bucket if they don't exist yet.
function ensurePeriodStats(stats, dayKey, weekKey) {
  if (!stats.daily[dayKey]) stats.daily[dayKey] = createDayStats();
  if (!stats.weekly[weekKey]) stats.weekly[weekKey] = createDayStats();
}

// Records a Freshdesk or Outlook send across all three stat buckets (allTime/daily/weekly).
// Awards 5 coins per send, plus 10 bonus coins if the ticket was resolved/closed.
// Also triggers achievement checks for daily send counts and ticket solves.
async function handleTrackSend(source, sendType) {
  const result = await chrome.storage.local.get(['agent_stats', 'gme_coin_balance']);
  const stats = result.agent_stats || createDefaultStats();
  const dayKey = getTodayKey();
  const weekKey = getWeekStartDate();
  ensurePeriodStats(stats, dayKey, weekKey);

  // Increment total and per-source send counts across all three time buckets
  const sourceField = source === 'outlook' ? 'outlookSends' : 'freshdeskSends';
  for (const bucket of [stats.allTime, stats.daily[dayKey], stats.weekly[weekKey]]) {
    bucket.sendCount++;
    bucket[sourceField]++;
  }

  // If resolved/closed, also count as resolved ticket and record handle time
  const isResolved = sendType === 'send_resolved' || sendType === 'send_closed';
  if (isResolved) {
    for (const bucket of [stats.allTime, stats.daily[dayKey], stats.weekly[weekKey]]) {
      bucket.resolvedTickets++;
    }

    // Record handle time if we have an active ticket timer
    try {
      const timerResult = await chrome.storage.local.get('currentTicketTimer');
      if (timerResult.currentTicketTimer?.startTime) {
        const elapsed = Math.floor((Date.now() - timerResult.currentTicketTimer.startTime) / 1000);
        if (elapsed > 0 && elapsed < 86400) { // Sanity check: max 24 hours
          if (!stats.daily[dayKey].handleTimes) stats.daily[dayKey].handleTimes = [];
          stats.daily[dayKey].handleTimes.push(elapsed);

          if (!stats.allTime.handleTimes) stats.allTime.handleTimes = [];
          stats.allTime.handleTimes.push(elapsed);
          // Cap at 500 entries to limit growth
          if (stats.allTime.handleTimes.length > 500) {
            stats.allTime.handleTimes = stats.allTime.handleTimes.slice(-500);
          }
        }
        await chrome.storage.local.remove('currentTicketTimer');
      }
    } catch (e) {
      console.warn('Failed to record handle time:', e);
    }
  }

  // Award coins: 5 per send, +10 bonus for resolved/closed
  let coinsEarned = 5;
  if (isResolved) coinsEarned += 10;
  const currentCoins = result.gme_coin_balance || 0;

  await chrome.storage.local.set({
    agent_stats: stats,
    gme_coin_balance: currentCoins + coinsEarned,
  });

  // Log coin transaction (capped at 200 entries to limit storage growth)
  const txResult = await chrome.storage.local.get('coin_transactions');
  const transactions = txResult.coin_transactions || [];
  transactions.push({ type: 'earn', source: 'send', amount: coinsEarned, timestamp: Date.now() });
  await chrome.storage.local.set({ coin_transactions: transactions.slice(-200) });

  // Trigger achievement checks
  try {
    if (isResolved) {
      await achievementTriggers.onTicketSolved(1);
    }
    await achievementTriggers.onDailySendCount(stats.daily[dayKey].sendCount);
  } catch (e) {
    console.error('Error checking send achievements:', e);
  }

  // Update ticket history for the multi-ticket dashboard
  try {
    const timerData = await chrome.storage.local.get(['currentTicketTimer', 'ticketHistory', 'ticketNotes']);
    const ticketId = timerData.currentTicketTimer?.ticketId;
    if (ticketId) {
      const history = timerData.ticketHistory || [];
      const existing = history.find((h) => h.ticketId === ticketId);
      const noteText = timerData.ticketNotes?.[ticketId]?.text || '';

      if (existing) {
        existing.lastAction = Date.now();
        existing.actionCount = (existing.actionCount || 0) + 1;
        existing.status = isResolved ? 'resolved' : 'open';
        if (noteText) existing.note = noteText;
      } else {
        history.push({
          ticketId,
          site: source,
          firstSeen: Date.now(),
          lastAction: Date.now(),
          actionCount: 1,
          status: isResolved ? 'resolved' : 'open',
          note: noteText,
        });
      }

      // Prune to 20 entries (FIFO)
      const pruned = history.slice(-20);
      await chrome.storage.local.set({ ticketHistory: pruned });
    }
  } catch (e) {
    console.warn('Failed to update ticket history:', e);
  }

  console.log(`Tracked send: ${source}/${sendType}, +${coinsEarned} coins`);
  return { success: true };
}

// Increments template copy count across all stat buckets and triggers achievements.
async function handleTrackTemplateCopy() {
  const result = await chrome.storage.local.get('agent_stats');
  const stats = result.agent_stats || createDefaultStats();
  const dayKey = getTodayKey();
  const weekKey = getWeekStartDate();
  ensurePeriodStats(stats, dayKey, weekKey);

  for (const bucket of [stats.allTime, stats.daily[dayKey], stats.weekly[weekKey]]) {
    bucket.templateCopies++;
  }

  await chrome.storage.local.set({ agent_stats: stats });

  // Trigger achievement check
  try {
    await achievementTriggers.onTemplateCopied(stats.allTime.templateCopies);
  } catch (e) {
    console.error('Error checking template achievements:', e);
  }

  console.log(`Tracked template copy, total: ${stats.allTime.templateCopies}`);
  return { success: true };
}

// Returns all agent stats, streak data, and daily solve count for the popup dashboard.
async function handleGetAgentStats() {
  const result = await chrome.storage.local.get(['agent_stats', 'streak_data', 'daily_solve_count']);
  return {
    success: true,
    agentStats: result.agent_stats || createDefaultStats(),
    streakData: result.streak_data || { currentDays: 0, longestStreak: 0 },
    dailySolveCount: result.daily_solve_count || { count: 0, date: getTodayKey() },
  };
}

// ─── Reminder System ──────────────────────────────────────────────────────────

// Ensures the reminder is in storage (skips if already saved by the frontend)
// and creates a Chrome alarm to fire at the scheduled time.
async function handleScheduleReminder(reminder) {
  const result = await chrome.storage.local.get('reminders');
  const reminders = result.reminders || [];

  // The frontend saves optimistically before sending this message, so only
  // add to storage if it's not already there (avoids duplicates).
  if (!reminders.some((r) => r.id === reminder.id)) {
    reminders.push(reminder);
    await chrome.storage.local.set({ reminders });
  }

  // Create alarm for this reminder
  const when = new Date(reminder.dateTime).getTime();
  if (when > Date.now()) {
    chrome.alarms.create(`reminder_${reminder.id}`, { when });
  }

  return { success: true };
}

// Removes a reminder from storage and clears its associated Chrome alarm.
async function handleCancelReminder(reminderId) {
  const result = await chrome.storage.local.get('reminders');
  const reminders = (result.reminders || []).filter((r) => r.id !== reminderId);
  await chrome.storage.local.set({ reminders });
  await chrome.alarms.clear(`reminder_${reminderId}`);
  await updateReminderBadge();
  return { success: true };
}

// Pushes a reminder's fire time forward by the given number of minutes.
async function handleSnoozeReminder(reminderId, minutes) {
  const result = await chrome.storage.local.get('reminders');
  const reminders = result.reminders || [];
  const idx = reminders.findIndex((r) => r.id === reminderId);

  if (idx === -1) return { success: false, error: 'Reminder not found' };

  const newTime = Date.now() + minutes * 60 * 1000;
  reminders[idx].dateTime = new Date(newTime).toISOString();
  reminders[idx].snoozed = true;
  await chrome.storage.local.set({ reminders });

  chrome.alarms.create(`reminder_${reminderId}`, { when: newTime });
  await updateReminderBadge();
  return { success: true };
}

// Updates the extension toolbar badge to show the count of overdue reminders.
// Shows a red badge with the count when overdue, clears when none are overdue.
async function updateReminderBadge() {
  try {
    const result = await chrome.storage.local.get('reminders');
    const reminders = result.reminders || [];
    const now = Date.now();
    const overdueCount = reminders.filter(
      (r) => new Date(r.dateTime).getTime() <= now
    ).length;

    chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
    chrome.action.setBadgeText({ text: overdueCount > 0 ? String(overdueCount) : '' });
  } catch (error) {
    console.error('Failed to update reminder badge:', error);
  }
}

// Keep the badge in sync whenever reminders change in storage (covers all paths).
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.reminders) {
    updateReminderBadge();
  }
});

// Shows a Chrome notification with Done/Snooze action buttons for a fired reminder.
async function fireReminderNotification(reminderId) {
  const result = await chrome.storage.local.get('reminders');
  const reminders = result.reminders || [];
  const reminder = reminders.find((r) => r.id === reminderId);

  if (!reminder) return;

  chrome.notifications.create(`reminder_notif_${reminderId}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('assets/buck/Buck_128.png'),
    title: '🔔 Reminder',
    message: reminder.text,
    buttons: [{ title: '✅ Done' }, { title: '⏰ Snooze (5 min)' }],
    requireInteraction: true,
  });

  await updateReminderBadge();
}

// Re-creates Chrome alarms for all future reminders and fires notifications
// for any that were missed (e.g. browser was closed when they were due).
async function reregisterReminderAlarms() {
  try {
    const result = await chrome.storage.local.get('reminders');
    const reminders = result.reminders || [];
    const now = Date.now();

    for (const reminder of reminders) {
      const when = new Date(reminder.dateTime).getTime();
      if (when > now) {
        chrome.alarms.create(`reminder_${reminder.id}`, { when });
      } else {
        // Overdue — fire the notification now so the user doesn't miss it
        await fireReminderNotification(reminder.id);
      }
    }

    // Set badge for any overdue reminders (fireReminderNotification already
    // updates it, but this covers the case where all are future-only).
    await updateReminderBadge();
  } catch (error) {
    console.error('Failed to re-register reminder alarms:', error);
  }
}

// Handles "Done" (button 0) and "Snooze 5 min" (button 1) clicks on reminder notifications.
chrome.notifications.onButtonClicked.addListener(async (notifId, buttonIndex) => {
  if (!notifId.startsWith('reminder_notif_')) return;

  const reminderId = notifId.replace('reminder_notif_', '');
  chrome.notifications.clear(notifId);

  if (buttonIndex === 0) {
    // Done — remove the reminder
    await handleCancelReminder(reminderId);
  } else if (buttonIndex === 1) {
    // Snooze 5 minutes
    await handleSnoozeReminder(reminderId, 5);
  }
});