// Shared reminder creation form (text + date + time + submit)
import React, { useState } from "react";
import { Plus } from "lucide-react";
import SoundButton from "../common/SoundButton";

const ReminderForm = ({ reminders, setReminders }) => {
  const [text, setText] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [error, setError] = useState("");

  const todayStr = new Date().toISOString().slice(0, 10);

  const handleAdd = async () => {
    setError("");
    if (!text.trim() || !date || !time) {
      setError("All fields are required.");
      return;
    }

    const dateTime = new Date(`${date}T${time}`);
    if (isNaN(dateTime.getTime())) {
      setError("Invalid date or time.");
      return;
    }
    if (dateTime.getTime() <= Date.now()) {
      setError("Reminder must be in the future.");
      return;
    }

    const reminder = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      text: text.trim(),
      dateTime: dateTime.toISOString(),
      createdAt: new Date().toISOString(),
      snoozed: false,
    };

    const updated = [...reminders, reminder];
    setReminders(updated);
    await chrome.storage.local.set({ reminders: updated });
    chrome.runtime.sendMessage({ type: "SCHEDULE_REMINDER", reminder });

    setText("");
    setDate("");
    setTime("");
  };

  const inputStyle = {
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-primary)",
  };

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        placeholder="What do you need to remember?"
        className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
        style={inputStyle}
      />
      <div className="flex gap-2">
        <input
          type="date"
          value={date}
          min={todayStr}
          onChange={(e) => setDate(e.target.value)}
          className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none"
          style={inputStyle}
        />
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none"
          style={inputStyle}
        />
      </div>
      {error && (
        <p className="text-xs" style={{ color: "var(--error-color)" }}>{error}</p>
      )}
      <SoundButton
        onClick={handleAdd}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium text-white transition-colors"
        style={{ backgroundColor: "var(--brand-primary)" }}
      >
        <Plus className="w-4 h-4" />
        Add Reminder
      </SoundButton>
    </div>
  );
};

export default ReminderForm;
