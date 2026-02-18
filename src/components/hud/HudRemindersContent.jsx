// HUD panel wrapper for the shared reminder form + list
import React, { useState, useEffect, useRef } from "react";
import ReminderForm from "../reminders/ReminderForm";
import ReminderList from "../reminders/ReminderList";

const HudRemindersContent = () => {
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

  return (
    <div>
      <div style={{ paddingBottom: "8px", marginBottom: "8px", borderBottom: "1px solid var(--border-primary)" }}>
        <ReminderForm reminders={reminders} setReminders={setReminders} />
      </div>
      <ReminderList reminders={reminders} setReminders={setReminders} />
    </div>
  );
};

export default HudRemindersContent;
