/**
 * hudInjector.js
 *
 * Content script that injects a HUD (heads-up display) overlay into the
 * Freshdesk page. Uses Shadow DOM to isolate extension styles from the
 * host page. The HUD is toggled on/off via the `hudMode` flag inside
 * chrome.storage.local featureSettings.
 *
 * BUG: If themeManager.loadTheme() rejects, the catch block logs the
 * error but mountHud() continues to create the React root -- the HUD
 * renders with whatever default/stale theme CSS vars happen to exist.
 * This is handled gracefully enough, but worth noting.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import HudOverlay from '../components/hud/HudOverlay';
import themeManager from '../utils/themeManager';

console.log('[Buck Buddy] HUD injector loaded');

// -- DOM setup: outer container lives in the main document --
const hudContainer = document.createElement('div');
hudContainer.id = 'buck-buddy-hud';
document.body.appendChild(hudContainer);

// Shadow DOM isolates our Tailwind / main.css from the Freshdesk page
const shadow = hudContainer.attachShadow({ mode: 'open' });

// Inject extension stylesheet into the shadow root (scoped, no leakage)
const styleLink = document.createElement('link');
styleLink.rel = 'stylesheet';
styleLink.href = chrome.runtime.getURL('main.css');
shadow.appendChild(styleLink);

// Inner render target -- React mounts here, not on hudContainer directly
const renderDiv = document.createElement('div');
renderDiv.id = 'buck-buddy-hud-root';
renderDiv.className = 'buck-buddy-popup';
renderDiv.setAttribute('data-theme', 'dark'); // default until theme loads
shadow.appendChild(renderDiv);

// Module-level root ref so mount/unmount can coordinate
let root = null;

// -- Mount: load theme, create React root, render HudOverlay --
async function mountHud() {
  if (root) return; // guard against double-mount
  hudContainer.classList.add('active');

  // Theme CSS vars are set on document.documentElement; shadow DOM inherits them.
  // BUG: on rejection the HUD still mounts with stale/default theme vars.
  try {
    const theme = await themeManager.loadTheme();
    themeManager.applyTheme(theme);
    // Derive light/dark mode for Tailwind's data-theme selector
    const isDark = themeManager.getLuminance(theme.backgroundColor) < 0.5;
    renderDiv.setAttribute('data-theme', isDark ? 'dark' : 'light');
  } catch (e) {
    console.error('[Buck Buddy] Failed to apply HUD theme:', e);
  }

  root = createRoot(renderDiv);
  root.render(<HudOverlay />);
  console.log('[Buck Buddy] HUD mounted');
}

// -- Unmount: tear down React root and hide container --
function unmountHud() {
  if (!root) return;
  root.unmount();
  root = null;
  hudContainer.classList.remove('active');
  console.log('[Buck Buddy] HUD unmounted');
}

// -- Initial state check: auto-mount if hudMode was already enabled --
chrome.storage.local.get('featureSettings', (result) => {
  if (result.featureSettings?.hudMode) {
    mountHud();
  }
});

// -- Storage listener: mount/unmount on hudMode toggle, live-update theme --
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;

  // React to hudMode being toggled in settings
  if (changes.featureSettings) {
    const newSettings = changes.featureSettings.newValue;
    if (newSettings?.hudMode) {
      mountHud();
    } else {
      unmountHud();
    }
  }

  // Live theme update: re-apply CSS vars and recalculate dark/light mode
  if (changes.customTheme?.newValue) {
    themeManager.applyTheme(changes.customTheme.newValue);
    const isDark = themeManager.getLuminance(changes.customTheme.newValue.backgroundColor) < 0.5;
    renderDiv.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }
});

// -- DOM persistence guard: re-attach container if Freshdesk removes it --
const observer = new MutationObserver(() => {
  if (!document.body.contains(hudContainer)) {
    document.body.appendChild(hudContainer);
  }
});
observer.observe(document.body, { childList: true });
