/**
 * themeManager.js -- Theme management utility (no React dependency).
 * Handles loading, applying, saving, import/export, and per-user custom themes.
 * All color values are 6-digit hex strings (#RRGGBB).
 * Theme state is persisted in chrome.storage.local under "customTheme" and "userThemes".
 */

// ─── Default Theme (GameStop Classic Dark) ──────────────────────────────────

const DEFAULT_THEME = {
  primaryColor: '#dc2626',
  secondaryColor: '#3f3f46',
  backgroundColor: '#18181b',
  textColor: '#ffffff',
  cardColor: '#27272a',
  successColor: '#22c55e',
  warningColor: '#eab308',
  errorColor: '#ef4444',
};

// ─── Theme Presets ──────────────────────────────────────────────────────────

const THEME_PRESETS = {
  dark: {
    name: 'Dark',
    colors: { ...DEFAULT_THEME },
  },
  light: {
    name: 'Light',
    colors: {
      primaryColor: '#dc2626',
      secondaryColor: '#d4d4d8',
      backgroundColor: '#ffffff',
      textColor: '#18181b',
      cardColor: '#f4f4f5',
      successColor: '#16a34a',
      warningColor: '#ca8a04',
      errorColor: '#dc2626',
    },
  },
};

// ─── Color Utilities ────────────────────────────────────────────────────────

// Convert hex color to HSL object {h: 0-360, s: 0-100, l: 0-100}
function hexToHSL(hex) {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic (gray)
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

// Convert HSL values back to a hex color string
function hslToHex(h, s, l) {
  h /= 360;
  s /= 100;
  l /= 100;

  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  const toHex = (x) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Shift lightness by `percent` (positive = lighter, negative = darker), clamped to [0,100]
function adjustBrightness(hex, percent) {
  const hsl = hexToHSL(hex);
  hsl.l = Math.max(0, Math.min(100, hsl.l + percent));
  return hslToHex(hsl.h, hsl.s, hsl.l);
}

// Convert hex to an rgba() CSS string with the given alpha
function hexToRgba(hex, alpha) {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Relative luminance (0 = black, 1 = white) per ITU-R BT.709
function getLuminance(hex) {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// ─── Core Functions ─────────────────────────────────────────────────────────

// Apply theme colors as CSS custom properties on :root and set data-theme attribute.
// Returns "dark" or "light" based on background luminance.
function applyTheme(theme) {
  const colors = theme || DEFAULT_THEME;
  const root = document.documentElement;

  // Brand colors -- secondary/hover are auto-derived from primaryColor
  root.style.setProperty('--brand-primary', colors.primaryColor);
  root.style.setProperty('--brand-secondary', adjustBrightness(colors.primaryColor, 10));
  root.style.setProperty('--brand-hover', adjustBrightness(colors.primaryColor, -10));

  // Background colors
  root.style.setProperty('--bg-primary', colors.backgroundColor);
  root.style.setProperty('--bg-secondary', adjustBrightness(colors.backgroundColor, 5));
  root.style.setProperty('--bg-tertiary', adjustBrightness(colors.backgroundColor, 12));

  // Text colors
  root.style.setProperty('--text-primary', colors.textColor);
  root.style.setProperty('--text-secondary', adjustBrightness(colors.textColor, -15));
  root.style.setProperty('--text-tertiary', adjustBrightness(colors.textColor, -30));

  // Card / interactive colors
  root.style.setProperty('--card-bg', colors.cardColor);
  root.style.setProperty('--hover-bg', adjustBrightness(colors.cardColor, 8));
  root.style.setProperty('--active-bg', adjustBrightness(colors.cardColor, 15));

  // Border colors
  root.style.setProperty('--border-primary', colors.secondaryColor);
  root.style.setProperty('--border-secondary', adjustBrightness(colors.secondaryColor, 8));

  // Status colors
  root.style.setProperty('--success-color', colors.successColor);
  root.style.setProperty('--success-bg', hexToRgba(colors.successColor, 0.2));
  root.style.setProperty('--warning-color', colors.warningColor);
  root.style.setProperty('--warning-bg', hexToRgba(colors.warningColor, 0.2));
  root.style.setProperty('--error-color', colors.errorColor);
  root.style.setProperty('--error-bg', hexToRgba(colors.errorColor, 0.2));

  // Auto-detect dark/light mode from background luminance for CSS selectors.
  // Only set on :root -- setting on body too causes light.css rules to override
  // the inline custom properties (body has no inline styles, so the CSS wins).
  const isDark = getLuminance(colors.backgroundColor) < 0.5;
  const themeMode = isDark ? 'dark' : 'light';
  root.setAttribute('data-theme', themeMode);

  return themeMode;
}

// Load saved theme from storage; falls back to DEFAULT_THEME if nothing stored.
async function loadTheme() {
  try {
    const result = await chrome.storage.local.get(['customTheme', 'displaySettings']);

    if (result.customTheme) {
      return result.customTheme;
    }

    // Migrate legacy darkMode boolean from older versions
    if (result.displaySettings) {
      const isDark = result.displaySettings.darkMode ?? true;
      return isDark ? THEME_PRESETS.dark.colors : THEME_PRESETS.light.colors;
    }

    return { ...DEFAULT_THEME };
  } catch (error) {
    console.error('Error loading theme:', error);
    return { ...DEFAULT_THEME };
  }
}

// Persist theme to chrome.storage.local. Writes customTheme + displaySettings atomically.
async function saveTheme(theme) {
  try {
    const isDark = getLuminance(theme.backgroundColor) < 0.5;
    // Write both in one atomic call so the storage listener doesn't
    // see displaySettings change without customTheme and revert to a preset
    await chrome.storage.local.set({
      customTheme: theme,
      displaySettings: { darkMode: isDark },
    });
  } catch (error) {
    console.error('Error saving theme:', error);
  }
}

// Reset to DEFAULT_THEME, save, and apply in one step
async function resetTheme() {
  const theme = { ...DEFAULT_THEME };
  await saveTheme(theme);
  applyTheme(theme);
  return theme;
}

function exportTheme(theme) {
  return JSON.stringify(theme, null, 2);
}

// Parse and validate a theme from JSON string or object. Returns null on failure.
function importTheme(json) {
  try {
    const parsed = typeof json === 'string' ? JSON.parse(json) : json;
    // Every color key must be present and a valid 6-digit hex
    const required = ['primaryColor', 'secondaryColor', 'backgroundColor', 'textColor', 'cardColor', 'successColor', 'warningColor', 'errorColor'];
    const hexRegex = /^#[0-9a-fA-F]{6}$/;

    for (const key of required) {
      if (!parsed[key] || !hexRegex.test(parsed[key])) {
        throw new Error(`Invalid or missing color: ${key}`);
      }
    }

    return parsed;
  } catch (error) {
    console.error('Error importing theme:', error);
    return null;
  }
}

// ─── User Custom Themes (saved to "userThemes" array in storage) ────────────

async function loadUserThemes() {
  try {
    const result = await chrome.storage.local.get('userThemes');
    return result.userThemes || [];
  } catch (error) {
    console.error('Error loading user themes:', error);
    return [];
  }
}

// Append a new user theme; uses Date.now() as a unique ID
async function saveUserTheme(name, colors) {
  const themes = await loadUserThemes();
  const entry = { id: Date.now(), name, colors: { ...colors } };
  themes.push(entry);
  await chrome.storage.local.set({ userThemes: themes });
  return entry;
}

async function updateUserTheme(id, name, colors) {
  const themes = await loadUserThemes();
  const idx = themes.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  themes[idx] = { ...themes[idx], name, colors: { ...colors } };
  await chrome.storage.local.set({ userThemes: themes });
  return themes[idx];
}

async function deleteUserTheme(id) {
  const themes = await loadUserThemes();
  const filtered = themes.filter((t) => t.id !== id);
  await chrome.storage.local.set({ userThemes: filtered });
}

export default {
  DEFAULT_THEME,
  THEME_PRESETS,
  applyTheme,
  loadTheme,
  saveTheme,
  resetTheme,
  exportTheme,
  importTheme,
  getLuminance,
  loadUserThemes,
  saveUserTheme,
  updateUserTheme,
  deleteUserTheme,
};
