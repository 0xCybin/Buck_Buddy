// src/components/settings/ThemeSettingsPanel.jsx
// Theme editor with annotated mini-preview, bidirectional color picker
// interaction, preset management, and JSON import/export.

import React, { useState, useEffect, useRef } from "react";
import { RotateCcw, Download, Upload, Plus } from "lucide-react";
import { X, Check, AlertCircle, Pencil, Trash2 } from "../../icons";
import themeManager from "../../utils/themeManager";
import { useTheme } from "../theme/ThemeProvider";
import SoundButton from "../common/SoundButton";

// Editable color fields
const COLOR_FIELDS = [
  { key: "backgroundColor", label: "Background" },
  { key: "cardColor", label: "Cards" },
  { key: "textColor", label: "Text" },
  { key: "secondaryColor", label: "Borders" },
  { key: "primaryColor", label: "Brand" },
];

// Small pill label that floats above active preview regions
const RegionLabel = ({ children }) => (
  <span
    className="absolute -top-2.5 left-1.5 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm z-10 pointer-events-none whitespace-nowrap"
    style={{ backgroundColor: "var(--brand-primary)", color: "#fff" }}
  >
    {children}
  </span>
);

// Condensed version of the actual extension UI with clickable regions
const MiniPreview = ({ colors, activeField, onRegionClick }) => {
  const isActive = (key) => activeField === key;
  const hl = (key) => (isActive(key) ? "theme-preview-highlight" : "");

  return (
    <div>
      <h3
        className="text-xs font-medium uppercase tracking-wider mb-2"
        style={{ color: "var(--text-tertiary)" }}
      >
        Preview
      </h3>

      {/* Background region (outer container) */}
      <div
        className={`relative rounded-lg p-3 space-y-2.5 cursor-pointer ${hl("backgroundColor")}`}
        style={{
          backgroundColor: colors.backgroundColor,
          border: `1px solid ${colors.secondaryColor}`,
        }}
        onClick={() => onRegionClick("backgroundColor")}
      >
        {isActive("backgroundColor") && <RegionLabel>Background</RegionLabel>}

        {/* Header text region */}
        <div
          className={`relative flex items-center justify-between rounded px-2 py-1.5 cursor-pointer ${hl("textColor")}`}
          onClick={(e) => {
            e.stopPropagation();
            onRegionClick("textColor");
          }}
        >
          {isActive("textColor") && <RegionLabel>Text</RegionLabel>}
          <span className="text-sm font-semibold" style={{ color: colors.textColor }}>
            Buck Buddy
          </span>
          <span className="text-xs" style={{ color: colors.textColor, opacity: 0.6 }}>
            10:30 AM
          </span>
        </div>

        {/* Border / divider region */}
        <div
          className={`relative cursor-pointer flex items-center ${hl("secondaryColor")}`}
          style={{ minHeight: 16 }}
          onClick={(e) => {
            e.stopPropagation();
            onRegionClick("secondaryColor");
          }}
        >
          {isActive("secondaryColor") && <RegionLabel>Borders</RegionLabel>}
          <div
            className="w-full rounded-full"
            style={{ height: 1, backgroundColor: colors.secondaryColor }}
          />
        </div>

        {/* Card region */}
        <div
          className={`relative rounded-lg p-2.5 cursor-pointer ${hl("cardColor")}`}
          style={{
            backgroundColor: colors.cardColor,
            border: `1px solid ${colors.secondaryColor}`,
          }}
          onClick={(e) => {
            e.stopPropagation();
            onRegionClick("cardColor");
          }}
        >
          {isActive("cardColor") && <RegionLabel>Card</RegionLabel>}
          <div className="text-xs font-semibold mb-0.5" style={{ color: colors.textColor }}>
            Order #GS-84729
          </div>
          <div className="text-[11px]" style={{ color: colors.textColor, opacity: 0.7 }}>
            Status: Shipped
          </div>
          <div className="text-[11px] mt-0.5 font-mono" style={{ color: colors.textColor, opacity: 0.5 }}>
            1Z999AA10123456784
          </div>
        </div>

        {/* Brand / button region */}
        <div
          className={`relative rounded cursor-pointer ${hl("primaryColor")}`}
          style={{ display: "inline-block" }}
          onClick={(e) => {
            e.stopPropagation();
            onRegionClick("primaryColor");
          }}
        >
          {isActive("primaryColor") && <RegionLabel>Brand</RegionLabel>}
          <span
            className="block py-1.5 px-4 rounded text-xs font-medium text-white"
            style={{ backgroundColor: colors.primaryColor }}
          >
            Track Package
          </span>
        </div>

        {/* Status badges (not editable, always use theme defaults) */}
        <div className="flex gap-2">
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-medium inline-block"
            style={{ backgroundColor: "var(--success-bg)", color: "var(--success-color)" }}
          >
            &#10003; Delivered
          </span>
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-medium inline-block"
            style={{ backgroundColor: "var(--warning-bg)", color: "var(--warning-color)" }}
          >
            &#9888; Late
          </span>
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-medium inline-block"
            style={{ backgroundColor: "var(--error-bg)", color: "var(--error-color)" }}
          >
            &#10007; Lost
          </span>
        </div>
      </div>
    </div>
  );
};

// Compact color swatch tile: clickable box + label
const ColorSwatch = ({ field, value, isActive, onChange, onActivate }) => {
  const colorRef = useRef(null);

  return (
    <div
      id={`color-row-${field.key}`}
      className="flex flex-col items-center gap-1 cursor-pointer"
      onClick={() => {
        onActivate(field.key);
        colorRef.current?.click();
      }}
    >
      <div
        className="relative w-10 h-10 rounded-lg transition-all"
        style={{
          backgroundColor: value,
          border: isActive ? "2px solid var(--brand-primary)" : "2px solid var(--border-secondary)",
          boxShadow: isActive ? "0 0 0 2px var(--brand-primary)" : "none",
        }}
      >
        <input
          ref={colorRef}
          type="color"
          value={value}
          onChange={(e) => onChange(field.key, e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onFocus={() => onActivate(field.key)}
        />
      </div>
      <span className="text-[10px] font-medium" style={{ color: "var(--text-secondary)" }}>
        {field.label}
      </span>
    </div>
  );
};

const ThemeSettingsPanel = ({ onClose }) => {
  const { applyCustomTheme } = useTheme();

  // colors: current working copy; savedColors: snapshot for cancel/revert
  const [colors, setColors] = useState(themeManager.DEFAULT_THEME);
  const [savedColors, setSavedColors] = useState(themeManager.DEFAULT_THEME);
  const [activePreset, setActivePreset] = useState("dark");
  const [userThemes, setUserThemes] = useState([]);

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [themeName, setThemeName] = useState("");
  const [status, setStatus] = useState(null);
  const [activeField, setActiveField] = useState(null);
  const fileInputRef = useRef(null);

  // Load saved theme + user custom themes on mount
  useEffect(() => {
    const load = async () => {
      const theme = await themeManager.loadTheme();
      setColors(theme);
      setSavedColors(theme);

      const customs = await themeManager.loadUserThemes();
      setUserThemes(customs);

      const detected = detectActivePreset(theme, customs);
      setActivePreset(detected);
    };
    load();
  }, []);

  const detectActivePreset = (theme, customs) => {
    for (const [key, preset] of Object.entries(themeManager.THEME_PRESETS)) {
      if (colorsMatch(theme, preset.colors)) return key;
    }
    for (const custom of customs) {
      if (colorsMatch(theme, custom.colors)) return `custom_${custom.id}`;
    }
    return null;
  };

  const colorsMatch = (a, b) => {
    return Object.keys(themeManager.DEFAULT_THEME).every(
      (k) => a[k]?.toLowerCase() === b[k]?.toLowerCase()
    );
  };

  const showStatus = (type, message) => {
    setStatus({ type, message });
    setTimeout(() => setStatus(null), 2000);
  };

  // Apply a built-in preset immediately and persist
  const handlePreset = async (presetKey) => {
    const preset = themeManager.THEME_PRESETS[presetKey].colors;
    const updated = { ...preset };
    setColors(updated);
    setSavedColors(updated);
    applyCustomTheme(updated);
    await themeManager.saveTheme(updated);
    setActivePreset(presetKey);
    setEditorOpen(false);
    setEditingId(null);
  };

  const handleCustomPreset = async (custom) => {
    const updated = { ...custom.colors };
    setColors(updated);
    setSavedColors(updated);
    applyCustomTheme(updated);
    await themeManager.saveTheme(updated);
    setActivePreset(`custom_${custom.id}`);
    setEditorOpen(false);
    setEditingId(null);
  };

  const handleDeleteCustom = async (e, id) => {
    e.stopPropagation();
    await themeManager.deleteUserTheme(id);
    const updated = await themeManager.loadUserThemes();
    setUserThemes(updated);

    if (activePreset === `custom_${id}`) {
      handlePreset("dark");
    }
    if (editingId === id) {
      setEditorOpen(false);
      setEditingId(null);
    }
  };

  const handleEditCustom = (e, custom) => {
    e.stopPropagation();
    setColors({ ...custom.colors });
    setThemeName(custom.name);
    setEditingId(custom.id);
    setEditorOpen(true);
  };

  const handleNewTheme = () => {
    setEditingId(null);
    setThemeName("");
    setEditorOpen(true);
  };

  const handleColorChange = (key, value) => {
    setColors({ ...colors, [key]: value });
  };

  const handleSaveCustom = async () => {
    const name = themeName.trim();
    if (!name) {
      showStatus("error", "Enter a theme name");
      return;
    }

    let newActiveId;
    if (editingId) {
      await themeManager.updateUserTheme(editingId, name, colors);
      newActiveId = editingId;
      showStatus("success", `"${name}" updated!`);
    } else {
      const entry = await themeManager.saveUserTheme(name, colors);
      newActiveId = entry.id;
      showStatus("success", `"${name}" saved!`);
    }

    // Apply globally only on save
    applyCustomTheme(colors);

    const updated = await themeManager.loadUserThemes();
    setUserThemes(updated);
    setSavedColors({ ...colors });
    await themeManager.saveTheme(colors);
    setActivePreset(`custom_${newActiveId}`);
    setEditorOpen(false);
    setEditingId(null);
    setThemeName("");
  };

  const handleReset = async () => {
    const theme = await themeManager.resetTheme();
    setColors(theme);
    setSavedColors(theme);
    applyCustomTheme(theme);
    setActivePreset("dark");
    setEditorOpen(false);
    setEditingId(null);
    showStatus("success", "Reset to default");
  };

  const handleExport = () => {
    const json = themeManager.exportTheme(colors);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `buckbuddy-theme-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showStatus("success", "Theme exported!");
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const imported = themeManager.importTheme(ev.target.result);
      if (imported) {
        setColors(imported);
        setEditorOpen(true);
        setEditingId(null);
        setThemeName("");
        setActivePreset(null);
        showStatus("success", "Theme imported — name and save it");
      } else {
        showStatus("error", "Invalid theme file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleClose = () => {
    if (editorOpen) setColors(savedColors);
    onClose();
  };

  // Clicking a preview region scrolls to the matching color picker row
  const handlePreviewClick = (key) => {
    setActiveField(key);
    const row = document.getElementById(`color-row-${key}`);
    if (row) row.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm">
      <div
        className="rounded-lg w-full max-w-md mx-4 max-h-[85vh] flex flex-col"
        style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-primary)" }}
      >
        {/* Header */}
        <div
          className="p-4 flex items-center justify-between flex-shrink-0"
          style={{ borderBottom: "1px solid var(--border-primary)" }}
        >
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Theme & Colors
          </h2>
          <SoundButton
            onClick={handleClose}
            className="p-1 rounded-lg transition-colors"
            style={{ color: "var(--text-tertiary)" }}
          >
            <X className="w-5 h-5" />
          </SoundButton>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
          {/* Preset chips */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(themeManager.THEME_PRESETS).map(([key, preset]) => (
              <SoundButton
                key={key}
                onClick={() => handlePreset(key)}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                style={{
                  backgroundColor:
                    activePreset === key ? "var(--brand-primary)" : "var(--bg-secondary)",
                  color: activePreset === key ? "#fff" : "var(--text-primary)",
                  border:
                    activePreset === key
                      ? "2px solid var(--brand-primary)"
                      : "2px solid var(--border-primary)",
                }}
              >
                {preset.name}
              </SoundButton>
            ))}

            {userThemes.map((custom) => {
              const isActive = activePreset === `custom_${custom.id}`;
              const isEditing = editingId === custom.id && editorOpen;
              return (
                <div key={custom.id} className="relative group flex items-center">
                  <SoundButton
                    onClick={() => handleCustomPreset(custom)}
                    className="pl-3 pr-1.5 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1"
                    style={{
                      backgroundColor: isActive || isEditing ? "var(--brand-primary)" : "var(--bg-secondary)",
                      color: isActive || isEditing ? "#fff" : "var(--text-primary)",
                      border: isActive || isEditing
                        ? "2px solid var(--brand-primary)"
                        : "2px solid var(--border-primary)",
                    }}
                  >
                    {custom.name}
                    <span className="flex items-center gap-0.5 ml-1">
                      <button
                        onClick={(e) => handleEditCustom(e, custom)}
                        className="p-0.5 rounded transition-opacity opacity-50 hover:opacity-100"
                        title="Edit theme"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteCustom(e, custom.id)}
                        className="p-0.5 rounded transition-opacity opacity-50 hover:opacity-100"
                        title="Delete theme"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  </SoundButton>
                </div>
              );
            })}

            <SoundButton
              onClick={handleNewTheme}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1"
              style={{
                backgroundColor: editorOpen && !editingId ? "var(--brand-primary)" : "var(--bg-secondary)",
                color: editorOpen && !editingId ? "#fff" : "var(--text-tertiary)",
                border: editorOpen && !editingId
                  ? "2px solid var(--brand-primary)"
                  : "2px dashed var(--border-primary)",
              }}
            >
              <Plus className="w-3 h-3" />
              New
            </SoundButton>
          </div>

          {/* Editor section */}
          {editorOpen && (
            <div className="space-y-3">
              {/* Preview */}
              <MiniPreview
                colors={colors}
                activeField={activeField}
                onRegionClick={handlePreviewClick}
              />

              {/* Color swatches row */}
              <div className="flex justify-between px-1">
                {COLOR_FIELDS.map((field) => (
                  <ColorSwatch
                    key={field.key}
                    field={field}
                    value={colors[field.key]}
                    isActive={activeField === field.key}
                    onChange={handleColorChange}
                    onActivate={setActiveField}
                  />
                ))}
              </div>

              {/* Name + Save */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={themeName}
                  onChange={(e) => setThemeName(e.target.value)}
                  placeholder="Theme name..."
                  maxLength={24}
                  className="flex-1 px-3 py-1.5 rounded-lg text-sm outline-none"
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-primary)",
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveCustom();
                  }}
                />
                <SoundButton
                  onClick={handleSaveCustom}
                  className="px-4 py-1.5 rounded-lg text-white text-sm font-medium flex items-center gap-1.5"
                  style={{ backgroundColor: "var(--brand-primary)" }}
                >
                  <Check className="w-4 h-4" />
                  {editingId ? "Update" : "Save"}
                </SoundButton>
              </div>
            </div>
          )}

          {/* Status */}
          {status && (
            <div
              className="flex items-center gap-2 p-2 rounded-lg text-sm"
              style={{
                backgroundColor: status.type === "success" ? "var(--success-bg)" : "var(--error-bg)",
                color: status.type === "success" ? "var(--success-color)" : "var(--error-color)",
              }}
            >
              {status.type === "success" ? (
                <Check className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              {status.message}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="p-4 flex-shrink-0 flex items-center gap-1"
          style={{ borderTop: "1px solid var(--border-primary)" }}
        >
          <SoundButton
            onClick={handleReset}
            className="p-2 rounded-lg transition-colors"
            style={{ color: "var(--text-tertiary)", backgroundColor: "var(--bg-secondary)" }}
            title="Reset to default"
          >
            <RotateCcw className="w-4 h-4" />
          </SoundButton>
          <SoundButton
            onClick={handleExport}
            className="p-2 rounded-lg transition-colors"
            style={{ color: "var(--text-tertiary)", backgroundColor: "var(--bg-secondary)" }}
            title="Export theme"
          >
            <Download className="w-4 h-4" />
          </SoundButton>
          <SoundButton
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-lg transition-colors"
            style={{ color: "var(--text-tertiary)", backgroundColor: "var(--bg-secondary)" }}
            title="Import theme"
          >
            <Upload className="w-4 h-4" />
          </SoundButton>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
        </div>
      </div>
    </div>
  );
};

export default ThemeSettingsPanel;
