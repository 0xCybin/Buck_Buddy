// src/components/templates/CreateTemplateButton.jsx
// Expandable inline form for creating new templates. Supports template variable
// insertion (e.g., {Order Number}) at cursor position, and pasting screenshots
// from the clipboard. Triggers the "template created" achievement on successful save.

import React, { useState, useRef } from "react";
import { Plus, Save, ChevronDown, Image as ImageIcon } from "lucide-react";
import { AlertCircle, X, Check } from "../../icons";
import ResponseStorage from "../../services/storage/responseStorage";
import { achievementTriggers } from "../../utils/achievementTriggers";
import { TEMPLATE_VARIABLES } from "../../utils/templateVariables";
import { compressImage, MAX_IMAGES_PER_TEMPLATE } from "../../utils/imageCompression";

const CreateTemplateButton = ({ onTemplateSaved }) => {
  const [isOpen, setIsOpen] = useState(false);   // collapsed vs expanded form
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");           // comma-separated tag string
  const [attachments, setAttachments] = useState([]); // [{id, dataUrl, width, height}]
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showVariables, setShowVariables] = useState(false);
  const textareaRef = useRef(null);               // for cursor-position variable insertion
  const responseStorage = new ResponseStorage();

  // Insert a variable placeholder at the textarea's current cursor position
  const insertVariable = (placeholder) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const varText = `{${placeholder}}`;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = content.slice(0, start) + varText + content.slice(end);
    setContent(newContent);
    // Wait one frame so React flushes the state update before restoring cursor
    requestAnimationFrame(() => {
      textarea.focus();
      const cursorPos = start + varText.length;
      textarea.setSelectionRange(cursorPos, cursorPos);
    });
  };

  // Handle paste events on the textarea -- detect images and compress them
  const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();

        if (attachments.length >= MAX_IMAGES_PER_TEMPLATE) {
          setError(`Maximum ${MAX_IMAGES_PER_TEMPLATE} images per template`);
          setTimeout(() => setError(""), 3000);
          return;
        }

        try {
          const blob = item.getAsFile();
          if (!blob) return;

          const compressed = await compressImage(blob);
          const newIndex = attachments.length + 1;
          const newAttachment = {
            id: `img_${Date.now()}`,
            dataUrl: compressed.dataUrl,
            width: compressed.width,
            height: compressed.height,
          };

          setAttachments(prev => [...prev, newAttachment]);

          // Insert placeholder at cursor
          const textarea = textareaRef.current;
          const placeholder = `[Screenshot ${newIndex}]`;
          if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const newContent = content.slice(0, start) + placeholder + content.slice(end);
            setContent(newContent);
            requestAnimationFrame(() => {
              textarea.focus();
              const cursorPos = start + placeholder.length;
              textarea.setSelectionRange(cursorPos, cursorPos);
            });
          } else {
            setContent(prev => prev + placeholder);
          }
        } catch (err) {
          console.error('Error compressing pasted image:', err);
          setError('Failed to process pasted image');
          setTimeout(() => setError(""), 3000);
        }
        return; // Only handle the first image
      }
    }
  };

  // Remove an attachment and its placeholder from the content
  const removeAttachment = (index) => {
    const placeholderToRemove = `[Screenshot ${index + 1}]`;
    let newContent = content.replace(placeholderToRemove, '');

    // Re-number remaining placeholders
    const newAttachments = attachments.filter((_, i) => i !== index);
    for (let i = index + 1; i < attachments.length; i++) {
      newContent = newContent.replace(
        `[Screenshot ${i + 1}]`,
        `[Screenshot ${i}]`
      );
    }

    setContent(newContent);
    setAttachments(newAttachments);
  };

  // Validate, persist to ResponseStorage, fire achievement, and notify parent
  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError("");

      if (!content.trim()) {
        setError("Template content cannot be empty");
        return;
      }

      // Estimate storage size for templates with images
      if (attachments.length > 0) {
        const estimatedSize = JSON.stringify(attachments).length;
        if (estimatedSize > 5 * 1024 * 1024) { // 5MB warning
          setError("Template images are too large. Try using smaller screenshots.");
          return;
        }
      }

      // Create template object
      const template = {
        content: content.trim(),
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        timestamp: new Date().toISOString(),
      };

      // Include attachments if present
      if (attachments.length > 0) {
        template.attachments = attachments;
        template.hasImages = true;
      }

      // Save template
      const saveResult = await responseStorage.saveResponse(template);

      if (saveResult) {
        setSuccess("Template saved successfully!");
        setTimeout(() => setSuccess(""), 3000);
        setContent("");
        setTags("");
        setAttachments([]);
        await achievementTriggers.onTemplateCreated();
        if (onTemplateSaved) onTemplateSaved();
      } else {
        throw new Error("Failed to save template");
      }
    } catch (error) {
      console.error("Error saving template:", error);
      setError(error.message || "Failed to save template");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}>
      <div className="p-3" style={{ borderBottom: '1px solid var(--border-primary)' }}>
        <h3 className="text-sm font-medium text-center" style={{ color: 'var(--text-secondary)' }}>
          Create Template
        </h3>
      </div>

      <div className="p-4">
        {!isOpen ? (
          <button
            onClick={() => setIsOpen(true)}
            className="w-full py-2.5 px-4 rounded-md transition-colors flex items-center justify-center gap-2 font-medium"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
          >
            <Plus className="w-4 h-4" />
            Create New Template
          </button>
        ) : (
          <div className="space-y-4">
            {/* Template content */}
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Template Content
              </label>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onPaste={handlePaste}
                placeholder="Enter your template content... Paste screenshots with Ctrl+V"
                className="w-full h-32 rounded-lg p-3 focus:outline-none focus:ring-2 resize-none focus:ring-[var(--brand-primary)]"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
              />
            </div>

            {/* Image Thumbnails */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((att, i) => (
                  <div
                    key={att.id}
                    className="relative group rounded-md overflow-hidden"
                    style={{ border: '1px solid var(--border-primary)', width: '80px', height: '60px' }}
                  >
                    <img
                      src={att.dataUrl}
                      alt={`Screenshot ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => removeAttachment(i)}
                        className="p-1 rounded-full"
                        style={{ backgroundColor: 'var(--error-color)', color: '#fff' }}
                        title="Remove screenshot"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] bg-black/60 py-0.5" style={{ color: 'var(--text-secondary)' }}>
                      Screenshot {i + 1}
                    </span>
                  </div>
                ))}
                {attachments.length < MAX_IMAGES_PER_TEMPLATE && (
                  <span className="text-xs self-center ml-1" style={{ color: 'var(--text-tertiary)' }}>
                    {MAX_IMAGES_PER_TEMPLATE - attachments.length} more allowed
                  </span>
                )}
              </div>
            )}

            {/* Available Variables */}
            <div>
              <button
                type="button"
                onClick={() => setShowVariables(!showVariables)}
                className="flex items-center gap-1 text-xs transition-colors"
                style={{ color: 'var(--text-secondary)' }}
              >
                <ChevronDown
                  className="w-3 h-3 transition-transform"
                  style={{ transform: showVariables ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                />
                Available Variables
              </button>
              {showVariables && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {TEMPLATE_VARIABLES.map(({ placeholder }) => (
                    <button
                      key={placeholder}
                      type="button"
                      onClick={() => insertVariable(placeholder)}
                      className="px-2 py-0.5 text-xs rounded transition-colors"
                      style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                    >
                      {`{${placeholder}}`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Tags</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g., refund, shipping, vgc"
                className="w-full rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
              />
            </div>

            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--error-color)' }}>
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {/* Success message */}
            {success && (
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--success-color)' }}>
                <Check className="w-4 h-4 flex-shrink-0" />
                <p>{success}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsOpen(false);
                  setContent("");
                  setTags("");
                  setAttachments([]);
                  setError("");
                }}
                className="px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
              >
                <X className="w-4 h-4" />
                Cancel
              </button>

              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 rounded-lg text-white transition-colors flex items-center gap-2 disabled:opacity-50 btn-brand"
              >
                {isSaving ? (
                  <>
                    <Check className="w-4 h-4" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Template
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateTemplateButton;
