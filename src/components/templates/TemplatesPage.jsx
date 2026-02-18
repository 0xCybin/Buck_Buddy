// src/components/templates/TemplatesPage.jsx
// Full template management view: quick-access pinned templates at the top,
// searchable saved template list, import/export, create new, and a preview modal.
// Templates are persisted via ResponseStorage; quick templates live in chrome.storage.

import React, { useState, useEffect } from "react";
import {
  FileDown,
  FileUp,
  Pin,
  PinOff,
  Plus,
  ChevronDown,
} from "lucide-react";
import {
  Search,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  ChevronRight,
  Star,
  X,
} from "../../icons";
import { Image as ImageIcon } from "lucide-react";
import ResponseStorage from "../../services/storage/responseStorage";
import { copyTemplateToClipboard } from "../../utils/templateClipboard";
import { resolveTemplateVariables } from "../../utils/templateVariables";
import TemplateNameDialog from "./TemplateNameDialog";
import QuickTemplates from "./QuickTemplates";
import CreateTemplateButton from "./CreateTemplateButton";

const TemplatesPage = ({ quickTemplates, setQuickTemplates, ticketData }) => {
  // -- Template list state --
  const [templates, setTemplates] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  // -- UI feedback state --
  const [copiedId, setCopiedId] = useState(null);   // tracks which template's copy button is active
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // -- Filter state --
  const [selectedTags, setSelectedTags] = useState([]);

  // -- Dialog state --
  const [templateToName, setTemplateToName] = useState(null);    // template awaiting a quick-template name
  const [expandedTemplate, setExpandedTemplate] = useState(null); // template shown in preview modal

  const responseStorage = new ResponseStorage();

  // Fetch saved templates on mount
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const savedResponses = await responseStorage.getSavedResponses();
      setTemplates(savedResponses || []);
    } catch (err) {
      console.error("Error loading templates:", err);
      setError("Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (window.confirm("Are you sure you want to delete this template?")) {
      try {
        setError(null);
        const deleteResult = await responseStorage.deleteResponse(id);
        if (deleteResult) {
          await loadTemplates();
          setSuccess("Template deleted successfully!");
          setTimeout(() => setSuccess(null), 3000);

          // Remove from quick templates if pinned
          const quickTemplate = quickTemplates.find((qt) => qt.id === id);
          if (quickTemplate) {
            handleToggleQuickTemplate(quickTemplate);
          }
        } else {
          throw new Error("Failed to delete template");
        }
      } catch (err) {
        console.error("Error deleting template:", err);
        setError("Failed to delete template");
      }
    }
  };

  // Resolve template variables (e.g., {Order Number}) with ticket data, then copy
  const handleCopyTemplate = async (template) => {
    try {
      await copyTemplateToClipboard(template, ticketData);
      chrome.runtime.sendMessage({ type: 'TRACK_TEMPLATE_COPY' }).catch(() => {});
      setError(null);
      setCopiedId(template.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Error copying template:", err);
      setError("Failed to copy template");
    }
  };

  // Pin or unpin a template from the quick-access bar (max 12)
  const handleToggleQuickTemplate = async (template) => {
    try {
      const isQuickTemplate = quickTemplates.some(
        (qt) => qt.id === template.id
      );

      if (isQuickTemplate) {
        const updatedTemplates = quickTemplates.filter(
          (qt) => qt.id !== template.id
        );
        await chrome.storage.local.set({ quickTemplates: updatedTemplates });
        setQuickTemplates(updatedTemplates);
        setSuccess("Removed from quick templates");
        setTimeout(() => setSuccess(null), 3000);
      } else if (quickTemplates.length < 12) {
        setTemplateToName(template);
      } else {
        setError("Maximum of 12 quick templates allowed");
        setTimeout(() => setError(null), 3000);
      }
    } catch (err) {
      console.error("Error updating quick templates:", err);
      setError("Failed to update quick templates");
    }
  };

  // Callback from TemplateNameDialog -- assigns a name and persists the quick template
  const handleSaveQuickTemplate = async (name) => {
    try {
      if (!templateToName) return;

      const namedTemplate = {
        ...templateToName,
        id: `qt_${Date.now()}`,
        name,
      };
      const updatedTemplates = [...quickTemplates, namedTemplate];
      await chrome.storage.local.set({ quickTemplates: updatedTemplates });
      setQuickTemplates(updatedTemplates);
      setSuccess("Added to quick templates");
      setTimeout(() => setSuccess(null), 3000);
      setTemplateToName(null);
    } catch (err) {
      console.error("Error saving quick template:", err);
      setError("Failed to save quick template");
    }
  };

  // Serialize all saved templates to JSON and trigger a file download
  const handleExportTemplates = async () => {
    try {
      const templatesData = await responseStorage.getSavedResponses();

      if (templatesData.length === 0) {
        setError("No templates to export");
        return;
      }

      const blob = new Blob([JSON.stringify(templatesData, null, 2)], {
        type: "application/json",
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `buck_templates_${new Date().toISOString().split("T")[0]}.json`;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccess("Templates exported successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error exporting templates:", err);
      setError("Failed to export templates");
    }
  };

  // Read a JSON file, validate array structure, and merge into storage
  const handleImportTemplates = async (event) => {
    try {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const fileContent = e.target.result;
          const imported = JSON.parse(fileContent);

          if (!Array.isArray(imported)) {
            throw new Error("Invalid template format - Expected an array");
          }

          if (imported.length === 0) {
            throw new Error("No templates found in import file");
          }

          imported.forEach((template, index) => {
            if (!template.content) {
              throw new Error(
                `Invalid template at index ${index}: missing content`
              );
            }
            // Validate image attachments if present
            if (template.attachments) {
              if (!Array.isArray(template.attachments)) {
                throw new Error(`Invalid template at index ${index}: attachments must be an array`);
              }
              for (const att of template.attachments) {
                if (!att.dataUrl || !att.width || !att.height) {
                  throw new Error(`Invalid template at index ${index}: invalid attachment data`);
                }
              }
            }
          });

          const importResult = await responseStorage.importResponses(imported);
          if (!importResult) {
            throw new Error("Failed to import templates");
          }

          await loadTemplates();

          setSuccess(`Successfully imported ${imported.length} templates!`);
          setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
          console.error("Error processing import:", err);
          setError(err.message || "Invalid template file format");
        }
      };

      reader.onerror = () => {
        console.error("File reading error:", reader.error);
        setError("Failed to read import file");
      };

      reader.readAsText(file);
    } catch (err) {
      console.error("Error importing templates:", err);
      setError("Failed to import templates");
    } finally {
      event.target.value = "";
    }
  };

  const handleUnpinQuickTemplate = async (template) => {
    const updatedTemplates = quickTemplates.filter(
      (qt) => qt.id !== template.id
    );
    await chrome.storage.local.set({ quickTemplates: updatedTemplates });
    setQuickTemplates(updatedTemplates);
  };

  // Collect all unique tags across templates
  const allTags = [...new Set(templates.flatMap((t) => t.tags || []))].sort();

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // Filter by text search AND selected tags (AND logic)
  const filteredTemplates = templates.filter((template) => {
    const matchesSearch = template.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTags = selectedTags.length === 0 ||
      selectedTags.every((tag) => template.tags?.includes(tag));
    return matchesSearch && matchesTags;
  });

  const formatDate = (dateString) => {
    const options = {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    };
    return new Date(dateString).toLocaleString(undefined, options);
  };

  const handlePreviewCopy = async () => {
    if (!expandedTemplate) return;
    try {
      await copyTemplateToClipboard(expandedTemplate, ticketData);
      chrome.runtime.sendMessage({ type: 'TRACK_TEMPLATE_COPY' }).catch(() => {});
      setCopiedId('preview');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Error copying template:", err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Quick Templates Section */}
      {quickTemplates.length > 0 && (
        <div className="rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}>
          <div className="p-3" style={{ borderBottom: '1px solid var(--border-primary)' }}>
            <h3 className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
              <Star className="w-4 h-4 text-brand" />
              Quick Templates
            </h3>
          </div>
          <div className="p-3">
            <div className="grid grid-cols-4 gap-2">
              {quickTemplates.map((template) => (
                <QuickTemplates
                  key={template.id}
                  template={template}
                  onPinTemplate={handleUnpinQuickTemplate}
                  ticketData={ticketData}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Saved Templates Section */}
      <div className="rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}>
        <div className="p-3" style={{ borderBottom: '1px solid var(--border-primary)' }}>
          <h3 className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Saved Templates
          </h3>
        </div>

        <div className="p-3 space-y-3">
          {/* Search + Import/Export Row */}
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
              <input
                type="text"
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg pl-9 pr-3 py-1.5 text-sm placeholder-zinc-500 focus:outline-none"
                style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)', '--focus-border-color': 'var(--brand-primary)' }}
              />
            </div>

            <button
              onClick={handleExportTemplates}
              className="p-1.5 rounded-lg transition-colors"
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
              title="Export templates"
            >
              <FileDown className="w-4 h-4" />
            </button>
            <label className="p-1.5 rounded-lg transition-colors cursor-pointer" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
              <FileUp className="w-4 h-4" />
              <input
                type="file"
                accept=".json"
                onChange={handleImportTemplates}
                className="hidden"
              />
            </label>
          </div>

          {/* Tag Filter Bar */}
          {allTags.length > 0 && (
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', overflowX: 'auto', maxHeight: '52px' }}>
              {allTags.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: active ? 600 : 400,
                      border: active ? '1px solid var(--brand-primary)' : '1px solid var(--border-primary)',
                      backgroundColor: active ? 'var(--brand-primary)' : 'var(--bg-secondary)',
                      color: active ? '#fff' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tag}
                  </button>
                );
              })}
              {selectedTags.length > 0 && (
                <button
                  onClick={() => setSelectedTags([])}
                  style={{
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    border: '1px solid var(--border-primary)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-tertiary)',
                    cursor: 'pointer',
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {/* Status Messages */}
          {error && (
            <div className="p-2 rounded-lg text-xs flex items-center gap-2"
                 style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error-color)' }}>
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {success && (
            <div className="p-2 rounded-lg text-xs flex items-center gap-2"
                 style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success-color)' }}>
              <Check className="w-3 h-3 flex-shrink-0" />
              <p>{success}</p>
            </div>
          )}

          {/* Template List */}
          {loading ? (
            <div className="flex items-center justify-center h-24">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand" />
            </div>
          ) : filteredTemplates.length > 0 ? (
            <div className="space-y-2 max-h-[280px] overflow-y-auto">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className="group rounded-lg p-3 transition-colors cursor-pointer"
                  style={{ backgroundColor: 'var(--card-bg)' }}
                  onClick={() => setExpandedTemplate(template)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm whitespace-pre-wrap flex-1 line-clamp-3" style={{ color: 'var(--text-secondary)' }}>
                      {template.content}
                    </p>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyTemplate(template);
                        }}
                        className={`p-1.5 rounded transition-colors ${
                          copiedId === template.id
                            ? ""
                            : "text-white btn-brand"
                        }`}
                        style={
                          copiedId === template.id
                            ? { backgroundColor: 'var(--success-color)', color: '#fff' }
                            : undefined
                        }
                        title={
                          copiedId === template.id
                            ? "Copied!"
                            : "Copy to clipboard"
                        }
                      >
                        {copiedId === template.id ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleQuickTemplate(template);
                        }}
                        className={`p-1.5 rounded transition-colors ${
                          quickTemplates.some((qt) => qt.id === template.id)
                            ? "text-white btn-brand"
                            : ""
                        }`}
                        style={
                          !quickTemplates.some((qt) => qt.id === template.id)
                            ? { backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }
                            : undefined
                        }
                        title={
                          quickTemplates.some((qt) => qt.id === template.id)
                            ? "Remove from quick templates"
                            : "Add to quick templates"
                        }
                      >
                        {quickTemplates.some((qt) => qt.id === template.id) ? (
                          <PinOff className="w-3.5 h-3.5" />
                        ) : (
                          <Pin className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTemplate(template.id);
                        }}
                        className="p-1.5 rounded transition-colors"
                        style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                        title="Delete template"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {formatDate(template.timestamp || template.savedAt)}
                    </span>
                    {template.hasImages && (
                      <span className="inline-flex items-center gap-0.5 text-xs text-blue-400" title="Contains screenshots">
                        <ImageIcon className="w-3 h-3" />
                        {template.attachments?.length || 0}
                      </span>
                    )}
                    {template.tags?.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-24" style={{ color: 'var(--text-tertiary)' }}>
              <Pin className="w-6 h-6 mb-2" />
              <p className="text-sm">
                {searchTerm
                  ? "No matching templates found"
                  : "No templates saved yet"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create New Template Section */}
      <CreateTemplateButton onTemplateSaved={loadTemplates} />

      {/* Template Name Dialog */}
      {templateToName && (
        <TemplateNameDialog
          onSave={handleSaveQuickTemplate}
          onClose={() => setTemplateToName(null)}
        />
      )}

      {/* Template Preview Modal */}
      {expandedTemplate && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div
            className="rounded-lg w-full max-w-lg mx-4 flex flex-col max-h-[80vh]"
            style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between p-4 flex-shrink-0"
              style={{ borderBottom: '1px solid var(--border-primary)' }}
            >
              <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Template Preview
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePreviewCopy}
                  className={`p-1.5 rounded transition-colors ${
                    copiedId === 'preview'
                      ? ''
                      : 'text-white btn-brand'
                  }`}
                  style={
                    copiedId === 'preview'
                      ? { backgroundColor: 'var(--success-color)', color: '#fff' }
                      : undefined
                  }
                  title={copiedId === 'preview' ? 'Copied!' : 'Copy to clipboard'}
                >
                  {copiedId === 'preview' ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  onClick={() => setExpandedTemplate(null)}
                  style={{ color: 'var(--text-tertiary)' }}
                  className="p-1 rounded-lg hover:opacity-80 transition-opacity"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Body -- resolved variable preview */}
            <div className="flex-1 overflow-y-auto p-4 min-h-0">
              {(() => {
                const resolved = resolveTemplateVariables(expandedTemplate.content, ticketData);
                // Find unresolved {Variable} placeholders and highlight them
                const parts = resolved.split(/(\{[^}]+\})/g);
                const hasUnresolved = parts.some((p) => /^\{[^}]+\}$/.test(p));
                return (
                  <>
                    {hasUnresolved && (
                      <div style={{
                        fontSize: '11px',
                        color: '#eab308',
                        marginBottom: '8px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(234, 179, 8, 0.1)',
                        border: '1px solid rgba(234, 179, 8, 0.2)',
                      }}>
                        Some variables could not be resolved (no ticket data available)
                      </div>
                    )}
                    <div className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                      {expandedTemplate.attachments?.length > 0
                        ? resolved.split(/(\[Screenshot \d+\])/g).map((part, i) => {
                            const match = part.match(/^\[Screenshot (\d+)\]$/);
                            if (match) {
                              const idx = parseInt(match[1], 10) - 1;
                              const att = expandedTemplate.attachments[idx];
                              if (att) {
                                return (
                                  <img key={i} src={att.dataUrl} alt={`Screenshot ${idx + 1}`}
                                    style={{ maxWidth: '100%', height: 'auto', borderRadius: '6px', margin: '8px 0', display: 'block' }} />
                                );
                              }
                            }
                            // Highlight unresolved vars within text parts
                            return part.split(/(\{[^}]+\})/g).map((sub, j) =>
                              /^\{[^}]+\}$/.test(sub)
                                ? <span key={`${i}-${j}`} style={{ color: '#eab308', fontWeight: 600 }}>{sub}</span>
                                : <span key={`${i}-${j}`}>{sub}</span>
                            );
                          })
                        : parts.map((part, i) =>
                            /^\{[^}]+\}$/.test(part)
                              ? <span key={i} style={{ color: '#eab308', fontWeight: 600 }}>{part}</span>
                              : <span key={i}>{part}</span>
                          )
                      }
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Footer */}
            <div
              className="flex items-center gap-2 flex-wrap p-4 flex-shrink-0"
              style={{ borderTop: '1px solid var(--border-primary)' }}
            >
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {formatDate(expandedTemplate.timestamp || expandedTemplate.savedAt)}
              </span>
              {expandedTemplate.tags?.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplatesPage;
