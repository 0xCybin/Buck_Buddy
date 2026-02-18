// Shared reminder list with urgency colors and done/delete actions
import React from "react";
import { Bell, Trash2, Check, Clock } from "../../icons";
import SoundButton from "../common/SoundButton";
import { getUrgencyStyle, getUrgencyLabel } from "./reminderUtils";

const ReminderList = ({ reminders, setReminders }) => {
  const handleRemove = async (id) => {
    const updated = reminders.filter((r) => r.id !== id);
    setReminders(updated);
    await chrome.storage.local.set({ reminders: updated });
    chrome.runtime.sendMessage({ type: "CANCEL_REMINDER", reminderId: id });
  };

  const sorted = [...reminders].sort(
    (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
  );

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2" style={{ color: "var(--text-tertiary)" }}>
        <Bell className="w-10 h-10" />
        <p className="text-sm">No reminders yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sorted.map((r) => {
        const urgency = getUrgencyStyle(r.dateTime);
        return (
          <div
            key={r.id}
            className="rounded-lg p-3 border-l-4"
            style={{
              borderLeftColor: urgency.borderColor,
              backgroundColor: urgency.backgroundColor,
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                  {r.text}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="w-3 h-3" style={{ color: "var(--text-tertiary)" }} />
                  <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                    {new Date(r.dateTime).toLocaleString([], {
                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                  <span className="text-xs font-medium" style={{ color: urgency.borderColor }}>
                    {getUrgencyLabel(r.dateTime)}
                  </span>
                  {r.snoozed && (
                    <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>(snoozed)</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <SoundButton
                  onClick={() => handleRemove(r.id)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: "var(--success-color, #22c55e)" }}
                  title="Done"
                >
                  <Check className="w-4 h-4" />
                </SoundButton>
                <SoundButton
                  onClick={() => handleRemove(r.id)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: "var(--error-color)" }}
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </SoundButton>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ReminderList;
