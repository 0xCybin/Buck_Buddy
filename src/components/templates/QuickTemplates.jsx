// src/components/templates/QuickTemplates.jsx
// A single quick-template card. Clicking copies the resolved template content
// to the clipboard. The pin button uses a two-click confirm pattern to prevent
// accidental unpins.

import React, { useState } from "react";
import { Pin } from "lucide-react";
import { Copy, Check } from "../../icons";
import { copyTemplateToClipboard } from "../../utils/templateClipboard";

const QuickTemplates = ({ template, onPinTemplate, ticketData, hidePin }) => {
  const [copied, setCopied] = useState(false);
  const [confirmUnpin, setConfirmUnpin] = useState(false); // two-step unpin guard

  // Resolve variables and copy to clipboard; track the action via background
  const handleCopy = async () => {
    try {
      await copyTemplateToClipboard(template, ticketData);
      chrome.runtime.sendMessage({ type: 'TRACK_TEMPLATE_COPY' }).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Error copying template:", error);
    }
  };

  // First click sets confirmUnpin=true (3s timeout), second click actually unpins
  const handlePinClick = (e) => {
    e.stopPropagation();
    if (!confirmUnpin) {
      setConfirmUnpin(true);
      setTimeout(() => setConfirmUnpin(false), 3000);
      return;
    }
    setConfirmUnpin(false);
    onPinTemplate(template);
  };

  return (
    <div
      className="relative group min-h-[80px] flex flex-col justify-between transition-all"
      style={{
        backgroundColor: 'var(--card-bg)',
        border: '1px solid var(--border-primary)',
        borderRadius: '8px',
        padding: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
      }}
    >
      {!hidePin && (
        <button
          onClick={handlePinClick}
          className="absolute top-2 right-2 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
          style={{
            backgroundColor: confirmUnpin ? 'rgba(239,68,68,0.2)' : 'rgba(113,113,122,0.3)',
            border: confirmUnpin ? '1px solid rgba(239,68,68,0.4)' : '1px solid transparent',
          }}
          title={confirmUnpin ? "Click again to confirm unpin" : "Unpin template"}
        >
          <Pin
            className="w-3 h-3"
            style={{ color: confirmUnpin ? '#ef4444' : 'var(--text-tertiary)' }}
          />
        </button>
      )}

      <button
        onClick={handleCopy}
        className="w-full flex flex-col items-center gap-2"
      >
        {copied ? (
          <Check className="w-4 h-4 text-green-500" />
        ) : (
          <Copy className="w-4 h-4" style={{ color: 'var(--brand-primary)' }} />
        )}
        <span
          className="text-sm line-clamp-2 text-center"
          style={{ color: 'var(--text-primary)' }}
        >
          {template.name || "Unnamed Template"}
        </span>
      </button>
    </div>
  );
};

export default QuickTemplates;
