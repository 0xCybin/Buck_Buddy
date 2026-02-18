// Per-ticket one-line note. Keyed by ticketId, persists to chrome.storage.local.
// FIFO eviction at 100 notes.
import React, { useState, useEffect, useRef } from "react";
import { FileText } from "../../icons";

const MAX_NOTES = 100;

const TicketNote = ({ ticketId }) => {
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const debounceRef = useRef(null);

  // Load existing note for this ticket
  useEffect(() => {
    if (!ticketId) return;
    chrome.storage.local.get("ticketNotes", (result) => {
      const notes = result.ticketNotes || {};
      setNote(notes[ticketId]?.text || "");
    });
  }, [ticketId]);

  const saveNote = async (text) => {
    const result = await chrome.storage.local.get("ticketNotes");
    const notes = result.ticketNotes || {};

    if (text.trim()) {
      notes[ticketId] = { text: text.trim(), updatedAt: Date.now() };
    } else {
      delete notes[ticketId];
    }

    // FIFO eviction: keep only the 100 most recent notes
    const entries = Object.entries(notes);
    if (entries.length > MAX_NOTES) {
      entries.sort((a, b) => (a[1].updatedAt || 0) - (b[1].updatedAt || 0));
      const toRemove = entries.slice(0, entries.length - MAX_NOTES);
      toRemove.forEach(([key]) => delete notes[key]);
    }

    await chrome.storage.local.set({ ticketNotes: notes });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleChange = (e) => {
    setNote(e.target.value);
    // Debounce auto-save
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveNote(e.target.value), 800);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      saveNote(note);
      e.target.blur();
    }
  };

  const handleBlur = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    saveNote(note);
  };

  if (!ticketId) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "4px", padding: "2px 4px" }}>
      <FileText
        className="w-3 h-3 flex-shrink-0"
        style={{ color: saved ? "var(--success-color)" : "var(--text-tertiary)" }}
      />
      <input
        type="text"
        value={note}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder="Quick note for this ticket..."
        style={{
          flex: 1,
          fontSize: "11px",
          padding: "2px 6px",
          borderRadius: "4px",
          border: "1px solid var(--border-primary)",
          backgroundColor: "var(--bg-secondary)",
          color: "var(--text-primary)",
          outline: "none",
        }}
      />
    </div>
  );
};

export default TicketNote;
