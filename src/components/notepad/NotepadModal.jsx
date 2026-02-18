// src/components/notepad/NotepadModal.jsx
// Full-screen modal for creating, editing, and deleting text notes.
// Notes are persisted in chrome.storage.local under "notepadNotes".
// Supports export to .txt file. Two views: list and single-note editor.
//
// NOTE: Uses Math.random() for note IDs (Date.now + random suffix).
// Not cryptographically unique but sufficient for local-only storage.

import React, { useState, useEffect } from "react";
import { ArrowLeft, Plus, Download } from "lucide-react";
import { X, Trash2, FileText } from "../../icons";
import SoundButton from "../common/SoundButton";

const NotepadModal = ({ isOpen, onClose }) => {
  const [notes, setNotes] = useState([]);
  const [activeNoteId, setActiveNoteId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  // Hydrate notes from storage on mount
  useEffect(() => {
    chrome.storage.local.get("notepadNotes", (result) => {
      setNotes(result.notepadNotes || []);
    });
  }, []);

  // Persist updated notes array to both state and storage
  const saveNotes = (updated) => {
    setNotes(updated);
    chrome.storage.local.set({ notepadNotes: updated });
  };

  const handleNewNote = () => {
    const note = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: "",
      content: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [note, ...notes];
    saveNotes(updated);
    setActiveNoteId(note.id);
    setEditTitle("");
    setEditContent("");
  };

  const handleOpenNote = (note) => {
    setActiveNoteId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
    setShowDeleteConfirm(null);
  };

  const handleSaveNote = () => {
    const updated = notes.map((n) =>
      n.id === activeNoteId
        ? { ...n, title: editTitle.trim() || "Untitled", content: editContent, updatedAt: new Date().toISOString() }
        : n
    );
    saveNotes(updated);
    setActiveNoteId(null);
  };

  const handleDeleteNote = (id) => {
    const updated = notes.filter((n) => n.id !== id);
    saveNotes(updated);
    setShowDeleteConfirm(null);
    if (activeNoteId === id) setActiveNoteId(null);
  };

  // Export current note as a downloadable .txt file via blob URL
  const handleExportNote = () => {
    const title = editTitle.trim() || "Untitled";
    const text = `${title}\n${"=".repeat(title.length)}\n\n${editContent}`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString([], { month: "short", day: "numeric" }) +
      " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const getPreview = (content) => {
    if (!content) return "Empty note";
    return content.length > 60 ? content.slice(0, 60) + "..." : content;
  };

  // Sort notes by most recently updated for the list view
  const sorted = [...notes].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  if (!isOpen) return null;

  const activeNote = activeNoteId ? notes.find((n) => n.id === activeNoteId) : null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 overflow-hidden">
      <div
        className="rounded-lg w-full max-w-lg mx-4 flex flex-col max-h-[85vh]"
        style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-primary)" }}
      >
        {/* Header */}
        <div
          className="p-4 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--border-primary)" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {activeNote && (
                <SoundButton
                  onClick={handleSaveNote}
                  className="p-1 rounded-lg transition-colors"
                  style={{ color: "var(--text-tertiary)" }}
                  title="Back to notes"
                >
                  <ArrowLeft className="w-5 h-5" />
                </SoundButton>
              )}
              <FileText className="w-5 h-5" style={{ color: "var(--brand-primary)" }} />
              <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                {activeNote ? "Edit Note" : "Notes"}
              </h2>
            </div>
            <SoundButton
              onClick={() => { if (activeNote) handleSaveNote(); onClose(); }}
              className="p-1 rounded-lg transition-colors"
              style={{ color: "var(--text-tertiary)" }}
            >
              <X className="w-5 h-5" />
            </SoundButton>
          </div>
        </div>

        {activeNote ? (
          /* ─── Edit View ─── */
          <>
            <div className="flex-1 p-4 overflow-hidden flex flex-col min-h-0 gap-3">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Note title..."
                className="w-full rounded-lg px-3 py-2 text-sm font-medium focus:outline-none"
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-primary)",
                }}
              />
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="Write your note..."
                className="w-full flex-1 rounded-lg p-3 text-sm resize-none focus:outline-none min-h-[180px]"
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-primary)",
                }}
              />
            </div>

            {/* Edit footer */}
            <div
              className="p-4 flex items-center justify-between flex-shrink-0"
              style={{ borderTop: "1px solid var(--border-primary)" }}
            >
              <SoundButton
                onClick={handleExportNote}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)" }}
                disabled={!editContent}
              >
                <Download className="w-3.5 h-3.5" />
                Export
              </SoundButton>
              <SoundButton
                onClick={handleSaveNote}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
                style={{ backgroundColor: "var(--brand-primary)" }}
              >
                Save
              </SoundButton>
            </div>
          </>
        ) : (
          /* ─── List View ─── */
          <>
            <div className="flex-1 overflow-y-auto min-h-0 p-4">
              {sorted.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2" style={{ color: "var(--text-tertiary)" }}>
                  <FileText className="w-10 h-10" />
                  <p className="text-sm">No notes yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sorted.map((note) => (
                    <div
                      key={note.id}
                      className="rounded-lg p-3 cursor-pointer transition-colors"
                      style={{
                        backgroundColor: "var(--bg-secondary)",
                        border: "1px solid var(--border-primary)",
                      }}
                      onClick={() => handleOpenNote(note)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                            {note.title || "Untitled"}
                          </p>
                          <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-tertiary)" }}>
                            {getPreview(note.content)}
                          </p>
                          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
                            {formatDate(note.updatedAt)}
                          </p>
                        </div>
                        <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          {showDeleteConfirm === note.id ? (
                            <div className="flex items-center gap-1">
                              <SoundButton
                                onClick={() => handleDeleteNote(note.id)}
                                className="px-2 py-1 rounded text-xs font-medium text-white"
                                style={{ backgroundColor: "var(--error-color)" }}
                              >
                                Delete
                              </SoundButton>
                              <SoundButton
                                onClick={() => setShowDeleteConfirm(null)}
                                className="px-2 py-1 rounded text-xs font-medium"
                                style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
                              >
                                No
                              </SoundButton>
                            </div>
                          ) : (
                            <SoundButton
                              onClick={() => setShowDeleteConfirm(note.id)}
                              className="p-1.5 rounded-lg transition-colors"
                              style={{ color: "var(--text-tertiary)" }}
                              title="Delete note"
                            >
                              <Trash2 className="w-4 h-4" />
                            </SoundButton>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* List footer */}
            <div
              className="p-4 flex-shrink-0"
              style={{ borderTop: "1px solid var(--border-primary)" }}
            >
              <SoundButton
                onClick={handleNewNote}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium text-white transition-colors"
                style={{ backgroundColor: "var(--brand-primary)" }}
              >
                <Plus className="w-4 h-4" />
                New Note
              </SoundButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default NotepadModal;
