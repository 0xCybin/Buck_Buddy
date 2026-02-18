# BuckBuddy2 Full Codebase Audit Report

**Date:** 2026-02-15
**Scope:** Full project review - bugs, dead code, improvements, feature ideas, accessibility

---

## CRITICAL ISSUES (Fix Immediately)

| # | Issue | File | Lines | Details |
|---|-------|------|-------|---------|
| 1 | **Hardcoded API keys in source code** | `src/config/apiKeys.js` | 4-30 | FedEx key+secret, USPS key+secret, DeepSeek key all plaintext in version control. Keys are also duplicated (lines 1-14 and 18-30). Anyone with repo access can use these credentials. |
| 2 | **Break overlay never unmounts** | `src/content/breakOverlayInjector.js` | 18-30 | React root created but reference is never saved to `overlayContainer._root`. When `BREAK_ENDED` fires, it checks `overlayContainer._root` which is always undefined. Multiple overlays accumulate in memory. |
| 3 | **Missing achievement trigger functions** | `src/utils/achievementTriggers.js` | -- | Three functions are called but never defined: `onNightTimeUsage()` (background.js:219), `onSoundSettingsChange()` (soundUtils.js:129), `onLunchBreak()` (breakManager.js:79). All silently fail. |
| 4 | **TalkingMessage always shows current time** | `src/components/chat/TalkingMessage.jsx` | 182 | Uses `new Date()` instead of the message's actual timestamp. Every message displays "now" regardless of when it was sent. |


---

## HIGH PRIORITY BUGS

| # | Issue | File | Lines | Details |
|---|-------|------|-------|---------|
| 7 | **TOGGLE_POPUP has no handler** | `src/content/contentScript.js` | 326 | Content script sends `TOGGLE_POPUP` message on Ctrl+Shift+B, but background.js has no handler for it. Keyboard shortcut silently fails. |
| 8 | **16+ event listeners never cleaned up** | `src/content/contentScript.js` | multiple | MutationObservers, hashchange listeners, keydown listeners, chrome.runtime.onMessage listeners (added twice at lines 21 and 361) -- none are ever removed. Memory leaks accumulate over time. |
| 9 | **HudOverlay renderContent missing dependency** | `src/components/hud/HudOverlay.jsx` | 523 | `renderContent` callback missing `isLocked` in dependency array. Causes stale closures when lock state changes. |
| 10 | **Deprecated Chrome API** | `src/utils/achievementSystem.js` | 263 | Uses `chrome.extension.getViews()` which is deprecated in MV3. Should use messaging or other patterns. |
| 11 | **AchievementsPanel imports wrong icons** | `src/components/settings/AchievementsPanel.jsx` | 2 | Imports from `react-feather` instead of custom icons from `../../icons`. |
| 12 | **Race condition in data extraction** | `src/content/contentScript.js` | 337-341 | `setTimeout` with 1500ms delay means rapid ticket switching causes multiple storeCurrentData calls that can overwrite fresh data with stale data. |
| 13 | **Break notification window too narrow** | `src/background/background.js` | 287 | `Math.abs(currentMinutes - breakMinutes) < 1` only triggers within ~59 seconds of exact time. Should use a wider window (2-5 minutes). |
| 14 | **HUD theme load race condition** | `src/content/hudInjector.js` | 38-40 | If `loadTheme()` rejects, `applyTheme(undefined)` still executes. No error handling around async theme load. |

---

## DEAD CODE

| # | What | File | Lines | Details |
|---|------|------|-------|---------|
| 15 | `TRACK_PACKAGE` handler | `src/background/background.js` | 320 | Handler exists but real tracking uses `FEDEX_TRACK` and `USPS_TRACK`. This message type is never sent. |
| 16 | `handleTrackPackage()` function | `src/background/background.js` | 415-419 | Implemented but never called. |
| 17 | Removed AI/KB feature comments | `src/background/background.js` | 1-7 | Comments documenting removed features serve no purpose. |
| 18 | Duplicate SKU search branches | `src/components/dataDisplay/DataGroup.js` | 91-95 | `isPSA` conditional has identical URLs in both branches. PSA-specific logic is dead. |
| 19 | Break overlay unmount code | `src/content/breakOverlayInjector.js` | 29-30 | `_root` is never set, so the unmount block never executes. |
| 20 | Unreachable chat migration | `src/popup/PopupApp.jsx` | 178 | Chat-to-buck tab migration logic has unreachable condition. |
| 21 | `sleepyBuck` keyframes duplicated | `src/styles/main.css` + animations.css | 178-190 | Same animation defined in two files. |
| 22 | Unused CSS classes | `src/styles/main.css` | 192-239 | `.sleepy-buck` and `.hover-glow:hover` are never referenced by any component. |
| 23 | Verbose logging in production | `src/components/settings/AchievementsPanel.jsx` | 15-28, 37-40 | Multiple `console.log` statements left in. |
| 24 | Render-time logging | `src/components/dataDisplay/DraggableDataGroups.jsx` | 29-44 | Detailed console logs fire on every single render. Performance issue + console spam. |
| 25 | Unused `jimp` dependency | `package.json` | 28 | Listed in devDependencies but never imported anywhere. |
| 26 | Unused `Monitor` import | `src/popup/PopupApp.jsx` | 38 | Imported from lucide-react but barely/not used. |

---

## MEDIUM PRIORITY IMPROVEMENTS

| # | Issue | File | Details |
|---|-------|------|---------|
| 27 | **Duplicate reminder UI code** | `HudRemindersContent.jsx` & `RemindersModal.jsx` | Identical reminder list rendering logic in two files. Should extract shared component. |
| 28 | **Inconsistent chrome.storage patterns** | Multiple files | Mix of callback-based and promise-based chrome.storage usage. Should standardize. |
| 29 | **No error handling on storage calls** | `src/components/settings/SettingsModal.jsx` | Lines 116-137: Multiple `chrome.storage.local` calls with no error handling. |
| 30 | **Note IDs use Math.random()** | `NotepadModal.jsx`, `HudNotesContent.jsx` | Could theoretically collide. Should use `crypto.randomUUID()` or `Date.now()`. |
| 31 | **Missing web_accessible_resources** | `manifest.json` | `hud.css` not listed as web accessible resource. May not load in all contexts. |
| 32 | **Selector brittleness** | `src/content/contentScript.js` | 15+ deep Freshdesk selectors (like `cf_order_number`) will break if Freshdesk updates their UI. No fallback logging. |
| 33 | **Z-index stacking issues** | `src/styles/hud.css` | HUD uses `999998`, break overlay uses `999999`. Could obscure critical Freshdesk UI elements. |
| 34 | **Tailwind + theme overrides mixing** | `src/styles/themes/light.css` | Selectors like `[data-theme="light"] .bg-zinc-800.text-zinc-100` create maintenance nightmare. |
| 35 | **Volume initialization race** | `src/utils/soundUtils.js` | 25-29: Volume checked before async storage load completes. |
| 36 | **Redundant volume logic** | `src/utils/soundUtils.js` | 130 & 133: Both lines do the same thing. |
| 37 | **Address masking edge case** | `src/utils/securityUtils.js` | 57-58: Assumes address has 2+ words. Short addresses could produce wrong output. |
| 38 | **Stats dashboard hardcoded weekdays** | `src/components/stats/StatsDashboard.jsx` | 97: Only shows Mon-Fri, doesn't account for weekend work. |
| 39 | **OnboardingOverlay sprite preload** | `src/components/onboarding/OnboardingOverlay.jsx` | 602-606: Preloads ALL sprites on every render instead of once on mount. |
| 40 | **Template filtering not memoized** | `src/components/templates/TemplatesPage.jsx` | 237: Filters templates on every render without `useMemo`. |
| 41 | **Achievement event listener leak** | `src/components/stats/StatsDashboard.jsx` | 71: Listener added but never cleaned up on remount. |
| 42 | **GameStop scraper race condition** | `src/services/lookup/gamestopScraper.js` | 264-277: If tab closes before load completes, listener dangles. |
| 43 | **Overly complex scraper regex** | `src/services/lookup/gamestopScraper.js` | 147: Fragile regex for JSON extraction could match malformed data. |
| 44 | **Storage key naming inconsistency** | Multiple files | Mix of snake_case (`gme_coin_balance`) and camelCase (`lastTicketData`). Not breaking but inconsistent. |

---

## FEATURE IDEAS

| # | Feature | Component | Details |
|---|---------|-----------|---------|
| 45 | **Keyboard shortcuts in popup** | PopupApp.jsx | Ctrl+T for Track, Ctrl+S for SKU lookup, etc. |
| 46 | **Chat history export** | BuckChat.jsx | Save/export conversation history. |
| 47 | **Bulk data copy** | DataGroup.js | "Select all" button to copy all extracted data with custom delimiter. |
| 48 | **Template categories/folders** | TemplatesPage.jsx | Organize templates into folders beyond just tags. |
| 49 | **Custom tab names** | DraggableTabs.jsx | Let users rename tabs. |
| 50 | **Date range picker for stats** | StatsDashboard.jsx | Custom date ranges instead of just current week. |
| 51 | **HUD preset layouts** | HudOverlay.jsx | Minimal, full, compact layout presets. |
| 52 | **Settings backup/restore** | SettingsModal.jsx | Export/import all settings as JSON. |
| 53 | **Achievement progress bars** | AchievementsPanel.jsx | Show progress toward next unlock, not just locked/unlocked. |
| 54 | **Multi-tracking comparison** | TrackingPreview.js | View multiple tracking numbers side-by-side. |
| 55 | **Notepad search** | NotepadModal.jsx | Search/filter notes (TemplatesPage has search, notepad doesn't). |
| 56 | **Section-skip in onboarding** | OnboardingOverlay.jsx | Let users skip individual tutorial sections. |
| 57 | **HUD full layout reset** | HudOverlay.jsx | Reset all HUD positions to defaults, not just restore hidden buttons. |
| 58 | **Keyboard tab navigation** | DraggableTabs.jsx | Arrow keys to switch between tabs. |
| 59 | **Enter key form submission** | SkuLookupModal.jsx, TrackingLookupModal.jsx | Both modals force button click instead of supporting Enter key. |

---

## ACCESSIBILITY ISSUES

| # | Issue | File |
|---|-------|------|
| 60 | Missing `aria-labels` on icon-only buttons | HudPanel, TrackingPreview, ProductPreview |
| 61 | No keyboard navigation support | OnboardingOverlay.jsx |
| 62 | Missing `role="tablist"` | DraggableTabs.jsx |
| 63 | Achievement toast not announced to screen readers | AchievementToast.jsx |
| 64 | Color-only urgency indicators | RemindersModal.jsx, HudRemindersContent.jsx |

---

## Summary

| Category | Count |
|----------|-------|
| Critical Issues | 6 |
| High Priority Bugs | 8 |
| Dead Code | 12 |
| Medium Priority Improvements | 18 |
| Feature Ideas | 15 |
| Accessibility Issues | 5 |
| **Total Findings** | **64** |
