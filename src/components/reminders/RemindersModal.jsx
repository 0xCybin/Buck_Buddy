// Modal wrapper for the shared reminder form + list
import React, { useState, useEffect, useRef } from "react";
import { X, Bell } from "../../icons";
import SoundButton from "../common/SoundButton";
import ReminderForm from "./ReminderForm";
import ReminderList from "./ReminderList";

const RemindersModal = ({ isOpen, onClose }) => {
  const [reminders, setReminders] = useState([]);
  const [, setTick] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    chrome.storage.local.get("reminders", (result) => {
      setReminders(result.reminders || []);
    });

    const handleChange = (changes, area) => {
      if (area === "local" && changes.reminders) {
        setReminders(changes.reminders.newValue || []);
      }
    };
    chrome.storage.onChanged.addListener(handleChange);
    intervalRef.current = setInterval(() => setTick((t) => t + 1), 30000);

    return () => {
      chrome.storage.onChanged.removeListener(handleChange);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 overflow-hidden">
      <div
        className="rounded-lg w-full max-w-lg mx-4 flex flex-col max-h-[85vh]"
        style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-primary)" }}
      >
        {/* Header */}
        <div className="p-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border-primary)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5" style={{ color: "var(--brand-primary)" }} />
              <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                Reminders
              </h2>
            </div>
            <SoundButton
              onClick={onClose}
              className="p-1 rounded-lg transition-colors"
              style={{ color: "var(--text-tertiary)" }}
            >
              <X className="w-5 h-5" />
            </SoundButton>
          </div>
        </div>

        {/* Form */}
        <div className="p-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border-primary)" }}>
          <ReminderForm reminders={reminders} setReminders={setReminders} />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto min-h-0 p-4">
          <ReminderList reminders={reminders} setReminders={setReminders} />
        </div>
      </div>
    </div>
  );
};

export default RemindersModal;
