/**
 * index.js -- Entry point for the popup window.
 *
 * Mounts the React app into the #root element from popup.html.
 * Applies the user's saved theme before the first paint to prevent FOUC,
 * then wraps PopupApp in ThemeProvider for runtime theme switching.
 */

import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "../components/theme/ThemeProvider";
import PopupApp from "./PopupApp";
import themeManager from "../utils/themeManager";
import "../styles/main.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element not found");
}

// Scope all popup styles under .buck-buddy-popup to avoid leaking into pages
container.classList.add("buck-buddy-popup");

// Load and apply saved theme before React renders to avoid a flash of wrong colors
(async () => {
  try {
    const theme = await themeManager.loadTheme();
    themeManager.applyTheme(theme);
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "dark");
  }
})();

const root = createRoot(container);

root.render(
  <ThemeProvider>
    <PopupApp />
  </ThemeProvider>
);
