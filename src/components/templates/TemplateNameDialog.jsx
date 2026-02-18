// src/components/templates/TemplateNameDialog.jsx
// Simple modal dialog that prompts the user to name a template before
// pinning it to the quick-templates bar. Submit triggers onSave(name).

import React, { useState } from "react";
import { X } from "../../icons";

const TemplateNameDialog = ({ onSave, onClose }) => {
  const [name, setName] = useState("");

  // Prevent empty names; trim whitespace before passing to parent
  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div
        className="p-6 rounded-lg w-96"
        style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>
            Name Quick Template
          </h3>
          <button
            onClick={onClose}
            style={{ color: 'var(--text-secondary)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter template name"
            className="w-full rounded-lg px-4 py-2 focus:outline-none mb-4"
            style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg transition-colors"
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 rounded-lg text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TemplateNameDialog;
