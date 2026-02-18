// Shared urgency helpers for reminder displays

// Border/bg colors based on time remaining
export const getUrgencyStyle = (dateTime) => {
  const diff = new Date(dateTime).getTime() - Date.now();
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * oneHour;

  if (diff < oneHour) {
    return {
      borderColor: "var(--error-color)",
      backgroundColor: "var(--error-bg, rgba(239,68,68,0.1))",
    };
  }
  if (diff < oneDay) {
    return {
      borderColor: "var(--warning-color, #f59e0b)",
      backgroundColor: "var(--warning-bg, rgba(245,158,11,0.1))",
    };
  }
  return {
    borderColor: "var(--success-color, #22c55e)",
    backgroundColor: "var(--success-bg, rgba(34,197,94,0.1))",
  };
};

// Human-readable countdown label
export const getUrgencyLabel = (dateTime) => {
  const diff = new Date(dateTime).getTime() - Date.now();
  if (diff < 0) return "Overdue";

  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m left`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h left`;
  const days = Math.floor(hours / 24);
  return `${days}d left`;
};
