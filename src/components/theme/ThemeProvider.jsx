// src/components/theme/ThemeProvider.jsx
// React context provider for theming. Wraps the entire popup app.
// Loads the saved theme from chrome.storage on mount, applies CSS variables
// via themeManager, and keeps in sync when storage changes externally.
// Exposes: theme ("dark"|"light"), currentTheme (color object),
// toggleTheme(), applyCustomTheme(), and achievement color constants.

import React, { createContext, useContext, useEffect, useState } from "react";
import { achievementTriggers } from "../../utils/achievementTriggers";
import themeManager from "../../utils/themeManager";

const ThemeContext = createContext(null);

// Hook to consume theme context; throws if used outside ThemeProvider
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState("dark");   // Mode string derived from applied theme
  const [currentTheme, setCurrentTheme] = useState(themeManager.DEFAULT_THEME); // Full color object

  // Xbox-green achievement toast colors (constant across themes)
  const achievementColors = React.useMemo(
    () => ({
      achievementBackground: "rgba(0, 0, 0, 0.8)",
      achievementBorder: "#107c10",
      achievementGradientStart: "#107c10",
      achievementGradientEnd: "#0e0e0e",
      achievementIconBackground: "#107c10",
      achievementIcon: "#ffffff",
      achievementTitle: "#ffffff",
      achievementText: "#d4d4d8",
      achievementScore: "#ffd800",
      achievementDescription: "#a1a1aa",
      achievementProgress: "#107c10",
    }),
    []
  );

  // On mount: load saved theme, apply CSS variables, and listen for external changes
  useEffect(() => {
    const loadAndApply = async () => {
      try {
        const savedTheme = await themeManager.loadTheme();
        setCurrentTheme(savedTheme);
        const mode = themeManager.applyTheme(savedTheme);
        setTheme(mode);
      } catch (error) {
        console.error("Error loading theme:", error);
      }
    };
    loadAndApply();

    const handleStorageChange = (changes) => {
      if (changes.customTheme && changes.customTheme.newValue) {
        const newColors = changes.customTheme.newValue;
        setCurrentTheme(newColors);
        const mode = themeManager.applyTheme(newColors);
        setTheme(mode);
      }
      // Backward compat: migrate from old displaySettings.darkMode toggle
      if (changes.displaySettings && !changes.customTheme) {
        const isDark = changes.displaySettings.newValue?.darkMode ?? true;
        const preset = isDark
          ? themeManager.THEME_PRESETS.dark.colors
          : themeManager.THEME_PRESETS.light.colors;
        setCurrentTheme(preset);
        const mode = themeManager.applyTheme(preset);
        setTheme(mode);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  // Simple dark/light toggle for the settings UI; persists via themeManager
  const toggleTheme = async () => {
    try {
      const isDark = theme === "dark";
      const newPreset = isDark
        ? themeManager.THEME_PRESETS.light.colors
        : themeManager.THEME_PRESETS.dark.colors;

      setCurrentTheme(newPreset);
      const mode = themeManager.applyTheme(newPreset);
      setTheme(mode);

      // saveTheme now writes both customTheme + displaySettings atomically
      await themeManager.saveTheme(newPreset);

      await achievementTriggers.onThemeSwitch(mode);
    } catch (error) {
      console.error("Error saving theme:", error);
    }
  };

  // Apply an arbitrary color object without persisting (used by theme editor preview)
  const applyCustomTheme = async (colors) => {
    setCurrentTheme(colors);
    const mode = themeManager.applyTheme(colors);
    setTheme(mode);
  };

  const themeContextValue = React.useMemo(
    () => ({
      theme,
      currentTheme,
      toggleTheme,
      applyCustomTheme,
      ...achievementColors,
    }),
    [theme, currentTheme, achievementColors]
  );

  return (
    <ThemeContext.Provider value={themeContextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeProvider;
