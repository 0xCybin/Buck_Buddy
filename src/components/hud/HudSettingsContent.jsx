/**
 * HudSettingsContent.jsx -- Settings panel content for the HUD overlay.
 *
 * Two sections:
 * 1. Feature toggles -- enable/disable individual HUD features (persisted
 *    to chrome.storage.local under "featureSettings").
 * 2. Hidden buttons restore -- lists buttons removed via right-click context
 *    menu and lets the user bring them back.
 */
import React, { useState, useEffect } from "react";
import { ToggleLeft, ToggleRight, Eye } from "lucide-react";
import SoundButton from "../common/SoundButton";

// Feature toggle definitions rendered in the settings panel
const TOGGLES = [
  {
    key: "hudMode",
    label: "HUD Mode",
    description: "Overlay panels on your webpage",
  },
  {
    key: "trackingEnabled",
    label: "Tracking",
    description: "Package tracking button",
  },
  {
    key: "skuLookupEnabled",
    label: "SKU Lookup",
    description: "Product search button",
  },
  {
    key: "notepadEnabled",
    label: "Notepad",
    description: "Quick notes button",
  },
  {
    key: "remindersEnabled",
    label: "Reminders",
    description: "Timed reminder button",
  },
  {
    key: "notificationSoundEnabled",
    label: "Notification Sound",
    description: "Play sound with notifications",
  },
];

// All features on by default except HUD mode (opt-in)
const DEFAULT_SETTINGS = {
  trackingEnabled: true,
  skuLookupEnabled: true,
  notepadEnabled: true,
  remindersEnabled: true,
  notificationSoundEnabled: true,
  hudMode: false,
};

// Display names for items in the "Hidden Buttons" restore list
const BUTTON_LABELS = {
  data: "Data",
  templates: "Templates",
  stats: "Stats",
  buck: "Buck",
  track: "Track",
  sku: "SKU",
  notes: "Notes",
  reminders: "Reminders",
  settings: "Settings",
  lock: "Lock",
};

const HudSettingsContent = () => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);   // Brief "Saved!" flash after persisting
  const [hiddenButtons, setHiddenButtons] = useState([]);

  // Load settings and hidden-buttons list on mount, listen for external changes
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const result = await chrome.storage.local.get([
          "featureSettings",
          "hudHiddenButtons",
        ]);
        if (result.featureSettings) {
          setSettings((prev) => ({ ...prev, ...result.featureSettings }));
        }
        if (result.hudHiddenButtons) {
          setHiddenButtons(result.hudHiddenButtons);
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    };

    loadSettings();

    // Listen for storage changes (e.g., button hidden from context menu)
    const handler = (changes, area) => {
      if (area !== "local") return;
      if (changes.hudHiddenButtons) {
        setHiddenButtons(changes.hudHiddenButtons.newValue || []);
      }
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, []);

  // Toggle in local state only -- not persisted until the user clicks Save
  const handleToggle = (key) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  };

  // Persist all toggle values to chrome.storage and show a brief confirmation
  const handleSave = async () => {
    try {
      await chrome.storage.local.set({ featureSettings: settings });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error("Error saving feature settings:", error);
    }
  };

  // Re-show a single previously hidden button
  const handleRestore = async (buttonId) => {
    const updated = hiddenButtons.filter((id) => id !== buttonId);
    setHiddenButtons(updated);
    await chrome.storage.local.set({ hudHiddenButtons: updated });
  };

  // Re-show all hidden buttons at once
  const handleRestoreAll = async () => {
    setHiddenButtons([]);
    await chrome.storage.local.set({ hudHiddenButtons: [] });
  };

  return (
    <div>
      {/* Feature toggles */}
      <div
        className="p-4 rounded-lg"
        style={{
          backgroundColor: "var(--bg-secondary)",
          border: "1px solid var(--border-primary)",
        }}
      >
        <h3
          className="text-sm font-semibold mb-4"
          style={{ color: "var(--text-primary)" }}
        >
          HUD Settings
        </h3>

        <div className="space-y-3">
          {TOGGLES.map(({ key, label, description }) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <h4
                  className="text-sm font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  {label}
                </h4>
                <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                  {description}
                </p>
              </div>
              <SoundButton
                onClick={() => handleToggle(key)}
                className="p-1.5 rounded-lg transition-colors"
                style={{
                  color: settings[key]
                    ? "var(--brand-primary)"
                    : "var(--text-tertiary)",
                }}
              >
                {settings[key] ? (
                  <ToggleRight className="w-6 h-6" />
                ) : (
                  <ToggleLeft className="w-6 h-6" />
                )}
              </SoundButton>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-end gap-3">
          {saved && (
            <span
              className="text-xs font-medium"
              style={{ color: "var(--brand-primary)" }}
            >
              Saved!
            </span>
          )}
          <SoundButton
            onClick={handleSave}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            Save
          </SoundButton>
        </div>
      </div>

      {/* Hidden Buttons restore section */}
      <div
        className="mt-3 p-4 rounded-lg"
        style={{
          backgroundColor: "var(--bg-secondary)",
          border: "1px solid var(--border-primary)",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3
            className="text-sm font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Hidden Buttons
          </h3>
          {hiddenButtons.length > 1 && (
            <SoundButton
              onClick={handleRestoreAll}
              className="px-2 py-1 rounded text-xs font-medium transition-colors"
              style={{
                color: "var(--brand-primary)",
                backgroundColor: "transparent",
              }}
            >
              Restore All
            </SoundButton>
          )}
        </div>

        {hiddenButtons.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            No hidden buttons. Right-click any HUD button to remove it.
          </p>
        ) : (
          <div className="space-y-2">
            {hiddenButtons.map((id) => (
              <div
                key={id}
                className="flex items-center justify-between p-2 rounded-lg"
                style={{ backgroundColor: "var(--bg-primary)" }}
              >
                <span
                  className="text-sm font-medium"
                  style={{ color: "var(--text-primary)" }}
                >
                  {BUTTON_LABELS[id] || id}
                </span>
                <SoundButton
                  onClick={() => handleRestore(id)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    backgroundColor: "var(--brand-primary)",
                    color: "#fff",
                  }}
                >
                  <Eye className="w-3 h-3" />
                  Show
                </SoundButton>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HudSettingsContent;
