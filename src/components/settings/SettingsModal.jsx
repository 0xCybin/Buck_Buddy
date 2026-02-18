// src/components/settings/SettingsModal.jsx
// Main settings modal. Contains tabbed panels for general, breaks, audio,
// feedback, and credits. Persists all settings to chrome.storage.local.

import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  ToggleLeft,
  ToggleRight,
  Layout,
  Film,
  RotateCcw,
  MessageSquarePlus,
} from "lucide-react";
import { X, AlertCircle, Volume2, Clock } from "../../icons";
import { useTheme } from "../theme/ThemeProvider";
import { soundManager } from "../../utils/soundUtils";
import { achievementTriggers } from "../../utils/achievementTriggers";
import Credits from "./Credits";
import BreakTimeSettings from "./BreakTimeSettings";
import SoundButton from "../common/SoundButton";
import ThemeSettingsPanel from "./ThemeSettingsPanel";
import FeedbackPanel from "./FeedbackPanel";

const SettingsModal = ({ isOpen, onClose }) => {
  const { theme, toggleTheme } = useTheme();

  // -- UI state --
  const [status, setStatus] = useState(null);
  const [showSaveOverlay, setShowSaveOverlay] = useState(false);
  const [currentTab, setCurrentTab] = useState("general");
  const [showThemeSettings, setShowThemeSettings] = useState(false);

  // -- Break schedule state --
  const [breakTimes, setBreakTimes] = useState({
    break1: "",
    break2: "",
    lunch: "",
  });
  const [breakDurations, setBreakDurations] = useState({
    break1: 15,
    break2: 15,
    lunch: 30,
  });

  // -- Audio state --
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundVolume, setSoundVolume] = useState(50);

  // -- Feature toggle state (persisted in featureSettings) --
  const [desktopNotifications, setDesktopNotifications] = useState(true);
  const [trackingEnabled, setTrackingEnabled] = useState(true);
  const [skuLookupEnabled, setSkuLookupEnabled] = useState(true);
  const [notepadEnabled, setNotepadEnabled] = useState(true);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [notificationSoundEnabled, setNotificationSoundEnabled] = useState(true);
  const [hudMode, setHudMode] = useState(false);
  const [widgetBarEnabled, setWidgetBarEnabled] = useState(true);

  // Load all persisted settings on mount
  useEffect(() => {
    const loadAudioSettings = async () => {
      try {
        const soundState = soundManager.getSoundState();
        setSoundEnabled(soundState.enabled);
        setSoundVolume(Math.round(soundState.volume * 100));
      } catch (error) {
        console.error("Error loading sound manager:", error);
      }
    };

    const loadSettings = async () => {
      try {
        const result = await chrome.storage.local.get([
          "breakTimes",
          "breakDurations",
          "soundSettings",
          "notificationSettings",
          "featureSettings",
        ]);

        if (result.breakTimes) setBreakTimes(result.breakTimes);
        if (result.breakDurations) setBreakDurations(result.breakDurations);

        setDesktopNotifications(result.notificationSettings?.enabled ?? true);

        if (result.featureSettings) {
          setTrackingEnabled(result.featureSettings.trackingEnabled ?? true);
          setSkuLookupEnabled(result.featureSettings.skuLookupEnabled ?? true);
          setNotepadEnabled(result.featureSettings.notepadEnabled ?? true);
          setRemindersEnabled(result.featureSettings.remindersEnabled ?? true);
          setNotificationSoundEnabled(result.featureSettings.notificationSoundEnabled ?? true);
          setHudMode(result.featureSettings.hudMode ?? false);
          setWidgetBarEnabled(result.featureSettings.widgetBarEnabled ?? true);
        }
      } catch (error) {
        console.error("Error loading settings:", error);
        setStatus({ type: "error", message: "Failed to load settings" });
      }
    };

    loadSettings();
    loadAudioSettings();
  }, []);

  // Toggle sound and fire achievement if user fully mutes
  const handleSoundToggle = async (enabled) => {
    setSoundEnabled(enabled);
    await soundManager.toggle(enabled);

    if (!enabled) {
      await achievementTriggers.onFullMute();
    }
  };

  const handleVolumeChange = async (newVolume) => {
    setSoundVolume(newVolume);
    await soundManager.updateVolume(newVolume / 100);
  };

  // Validate and persist all settings to chrome.storage.local.
  // NOTE: The chrome.storage.local.set call (lines 116-137) has no individual
  // error handling -- a failure there falls through to the outer catch block.
  const handleSaveSettings = async () => {
    try {
      // Validate HH:MM format for break times
      for (const [key, value] of Object.entries(breakTimes)) {
        if (value && !/^\d{2}:\d{2}$/.test(value)) {
          throw new Error(`Invalid time format for ${key}`);
        }
      }

      await chrome.storage.local.set({
        breakTimes,
        breakDurations,
        soundSettings: {
          enabled: soundEnabled,
          volume: soundVolume / 100,
        },
        notificationSettings: {
          enabled: desktopNotifications,
        },
        featureSettings: {
          trackingEnabled,
          skuLookupEnabled,
          notepadEnabled,
          remindersEnabled,
          notificationSoundEnabled,
          hudMode,
          widgetBarEnabled,
        },
      });

      await soundManager.toggle(soundEnabled);
      await soundManager.updateVolume(soundVolume / 100);

      setShowSaveOverlay(true);
      setTimeout(() => {
        setShowSaveOverlay(false);
        onClose();
      }, 1500);
    } catch (error) {
      console.error("Error saving settings:", error);
      setStatus({
        type: "error",
        message: error.message || "Failed to save settings",
      });
    }
  };

  // Tab definitions for the settings sidebar/nav
  const tabs = [
    { id: "general", label: "General", icon: Layout },
    { id: "breaks", label: "Breaks", icon: Clock },
    { id: "audio", label: "Audio", icon: Volume2 },
    { id: "feedback", label: "Feedback", icon: MessageSquarePlus },
    { id: "credits", label: "Credits", icon: Film },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 overflow-hidden">
      <div
        className="rounded-lg w-full max-w-2xl mx-4 flex flex-col max-h-[85vh]"
        style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-primary)" }}
      >
        <div
          className="p-4 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--border-primary)" }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              Settings
            </h2>
            <SoundButton
              onClick={onClose}
              className="p-1 rounded-lg transition-colors"
              style={{ color: "var(--text-tertiary)" }}
            >
              <X className="w-5 h-5" />
            </SoundButton>
          </div>
        </div>

        <div
          className="flex-shrink-0 overflow-x-auto"
          style={{ borderBottom: "1px solid var(--border-primary)" }}
        >
          <div className="flex">
            {tabs.map((tab) => (
              <SoundButton
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                  currentTab === tab.id ? "border-b-2" : ""
                }`}
                style={
                  currentTab === tab.id
                    ? { color: "var(--brand-primary)", borderColor: "var(--brand-primary)" }
                    : { color: "var(--text-tertiary)" }
                }
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </SoundButton>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="p-4">
            {currentTab === "general" && (
              <div className="space-y-5">
                {/* Display Settings */}
                <div>
                  <h3
                    className="text-xs font-semibold uppercase tracking-wider mb-2 px-1"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    Display
                  </h3>
                  <div
                    className="rounded-lg overflow-hidden"
                    style={{ border: "1px solid var(--border-primary)", backgroundColor: "var(--card-bg)" }}
                  >
                    <div
                      className="flex items-center justify-between px-3 py-2.5"
                      style={{ borderBottom: "1px solid var(--border-primary)" }}
                    >
                      <div>
                        <h4 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          Theme & Colors
                        </h4>
                        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                          Customize the app's color scheme
                        </p>
                      </div>
                      <SoundButton
                        onClick={() => setShowThemeSettings(true)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors text-white"
                        style={{ backgroundColor: "var(--brand-primary)" }}
                      >
                        Customize
                      </SoundButton>
                    </div>

                    <div
                      className="flex items-center justify-between px-3 py-2.5"
                      style={{ borderBottom: "1px solid var(--border-primary)" }}
                    >
                      <div>
                        <h4 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          Desktop Notifications
                        </h4>
                        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                          Break reminders and update alerts
                        </p>
                      </div>
                      <SoundButton
                        onClick={() => setDesktopNotifications(!desktopNotifications)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: desktopNotifications ? "var(--brand-primary)" : "var(--text-tertiary)" }}
                      >
                        {desktopNotifications ? (
                          <ToggleRight className="w-6 h-6" />
                        ) : (
                          <ToggleLeft className="w-6 h-6" />
                        )}
                      </SoundButton>
                    </div>

                    <div
                      className="flex items-center justify-between px-3 py-2.5"
                      style={{ borderBottom: "1px solid var(--border-primary)" }}
                    >
                      <div>
                        <h4 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          HUD Mode
                        </h4>
                        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                          Free-form draggable panels instead of tabs
                        </p>
                      </div>
                      <SoundButton
                        onClick={() => setHudMode(!hudMode)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: hudMode ? "var(--brand-primary)" : "var(--text-tertiary)" }}
                      >
                        {hudMode ? (
                          <ToggleRight className="w-6 h-6" />
                        ) : (
                          <ToggleLeft className="w-6 h-6" />
                        )}
                      </SoundButton>
                    </div>

                    <div className="flex items-center justify-between px-3 py-2.5">
                      <div>
                        <h4 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          Widget Bar
                        </h4>
                        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                          Clock, weather, and other pills at the bottom
                        </p>
                      </div>
                      <SoundButton
                        onClick={() => setWidgetBarEnabled(!widgetBarEnabled)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: widgetBarEnabled ? "var(--brand-primary)" : "var(--text-tertiary)" }}
                      >
                        {widgetBarEnabled ? (
                          <ToggleRight className="w-6 h-6" />
                        ) : (
                          <ToggleLeft className="w-6 h-6" />
                        )}
                      </SoundButton>
                    </div>
                  </div>
                </div>

                {/* Feature Toggles */}
                <div>
                  <h3
                    className="text-xs font-semibold uppercase tracking-wider mb-2 px-1"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    Features
                  </h3>
                  <div
                    className="rounded-lg overflow-hidden"
                    style={{ border: "1px solid var(--border-primary)", backgroundColor: "var(--card-bg)" }}
                  >
                    {[
                      { label: "Tracking", desc: "Package tracking lookups", state: trackingEnabled, toggle: () => setTrackingEnabled(!trackingEnabled) },
                      { label: "SKU Lookup", desc: "GameStop product lookups", state: skuLookupEnabled, toggle: () => setSkuLookupEnabled(!skuLookupEnabled) },
                      { label: "Notepad", desc: "Quick scratch notes", state: notepadEnabled, toggle: () => setNotepadEnabled(!notepadEnabled) },
                      { label: "Reminders", desc: "Timed reminder notifications", state: remindersEnabled, toggle: () => setRemindersEnabled(!remindersEnabled) },
                      { label: "Notification Sound", desc: "Play sound with reminders", state: notificationSoundEnabled, toggle: () => setNotificationSoundEnabled(!notificationSoundEnabled) },
                    ].map((item, i, arr) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between px-3 py-2.5"
                        style={i < arr.length - 1 ? { borderBottom: "1px solid var(--border-primary)" } : {}}
                      >
                        <div>
                          <h4 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                            {item.label}
                          </h4>
                          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                            {item.desc}
                          </p>
                        </div>
                        <SoundButton
                          onClick={item.toggle}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: item.state ? "var(--brand-primary)" : "var(--text-tertiary)" }}
                        >
                          {item.state ? (
                            <ToggleRight className="w-6 h-6" />
                          ) : (
                            <ToggleLeft className="w-6 h-6" />
                          )}
                        </SoundButton>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Onboarding */}
                <div>
                  <h3
                    className="text-xs font-semibold uppercase tracking-wider mb-2 px-1"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    Onboarding
                  </h3>
                  <div
                    className="rounded-lg overflow-hidden"
                    style={{ border: "1px solid var(--border-primary)", backgroundColor: "var(--card-bg)" }}
                  >
                    <div className="flex items-center justify-between px-3 py-2.5">
                      <div>
                        <h4 className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          Replay Onboarding
                        </h4>
                        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                          See Buck's intro tour again
                        </p>
                      </div>
                      <SoundButton
                        onClick={async () => {
                          await chrome.storage.local.set({ onboarding_completed: false });
                          setStatus({ type: "success", message: "Onboarding will replay on next open!" });
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                        style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border-primary)" }}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Replay
                      </SoundButton>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentTab === "breaks" && (
              <div className="space-y-6">
                <BreakTimeSettings
                  breakTimes={breakTimes}
                  breakDurations={breakDurations}
                  onBreakTimeChange={(type, value) =>
                    setBreakTimes((prev) => ({ ...prev, [type]: value }))
                  }
                  onBreakDurationChange={(type, value) =>
                    setBreakDurations((prev) => ({ ...prev, [type]: value }))
                  }
                />
              </div>
            )}

            {currentTab === "audio" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium mb-4" style={{ color: "var(--text-secondary)" }}>
                    Audio Settings
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                          Sound Effects
                        </h4>
                        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                          Enable sound effects throughout the app
                        </p>
                      </div>
                      <SoundButton
                        onClick={() => handleSoundToggle(!soundEnabled)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: soundEnabled ? "var(--brand-primary)" : "var(--text-tertiary)" }}
                      >
                        {soundEnabled ? (
                          <ToggleRight className="w-6 h-6" />
                        ) : (
                          <ToggleLeft className="w-6 h-6" />
                        )}
                      </SoundButton>
                    </div>

                    {soundEnabled && (
                      <div className="space-y-2">
                        <label className="block text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                          Volume
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={soundVolume}
                          onChange={(e) =>
                            handleVolumeChange(parseInt(e.target.value))
                          }
                          className="w-full"
                          style={{ accentColor: "var(--brand-primary)" }}
                        />
                        <div className="flex justify-between text-xs" style={{ color: "var(--text-tertiary)" }}>
                          <span>0%</span>
                          <span>{soundVolume}%</span>
                          <span>100%</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {currentTab === "feedback" && (
              <div className="space-y-6">
                <FeedbackPanel />
              </div>
            )}

            {currentTab === "credits" && (
              <div className="space-y-6">
                <Credits />
              </div>
            )}

            {status && (
              <div
                className="mt-4 flex items-center gap-2 p-3 rounded-lg"
                style={{
                  backgroundColor: status.type === "success" ? "var(--success-bg)" : "var(--error-bg)",
                  color: status.type === "success" ? "var(--success-color)" : "var(--error-color)",
                }}
              >
                {status.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                <p className="text-sm">{status.message}</p>
              </div>
            )}
          </div>
        </div>

        <div
          className="p-4 flex justify-end gap-2"
          style={{ borderTop: "1px solid var(--border-primary)" }}
        >
          <SoundButton
            onClick={onClose}
            className="px-4 py-2 rounded-lg transition-colors"
            style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)" }}
          >
            Cancel
          </SoundButton>
          <SoundButton
            onClick={handleSaveSettings}
            className="px-4 py-2 rounded-lg text-white transition-colors"
            style={{ backgroundColor: "var(--brand-primary)" }}
          >
            Save Changes
          </SoundButton>
        </div>

        {/* Save Success Overlay */}
        {showSaveOverlay && (
          <div
            className="absolute inset-0 flex items-center justify-center z-50 animate-fade-in"
            style={{ backgroundColor: "var(--bg-primary)", opacity: 0.95 }}
          >
            <div className="flex flex-col items-center gap-3">
              <CheckCircle2 className="w-12 h-12 animate-bounce" style={{ color: "var(--success-color)" }} />
              <p className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>Settings saved!</p>
            </div>
          </div>
        )}
      </div>

      {/* Theme Settings Panel */}
      {showThemeSettings && (
        <ThemeSettingsPanel onClose={() => setShowThemeSettings(false)} />
      )}
    </div>
  );
};

export default SettingsModal;
