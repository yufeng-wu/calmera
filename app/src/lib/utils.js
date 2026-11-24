// lib/utils.js

export function formatDate(dateString) {
  // format date nicely
  // example: from this 👉 2025-05-20 to this 👉 May 20, 2025
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatTime(dateString) {
  if (!dateString) return "";

  let date;
  // If the string doesn't contain 'T', assume it's a time-only string like "14:30:00"
  if (typeof dateString === "string" && !dateString.includes("T")) {
    // Prepend today's date so the Date constructor can parse it reliably.
    const todayIso = new Date().toISOString().split("T")[0];
    date = new Date(`${todayIso}T${dateString}`);
  } else {
    date = new Date(dateString);
  }

  if (isNaN(date.getTime())) return ""; // invalid date safeguard

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// Returns an ISO-8601 string representing local time *with* timezone offset
// e.g. "2025-06-24T15:20:00+08:00". Meals are filed under this local day and time,
// never shifted to UTC.
export function getLocalTimeWithOffset(date = new Date()) {
  const ts = date instanceof Date ? date : new Date(date);
  const tzOffsetMinutes = ts.getTimezoneOffset();
  const localDate = new Date(ts.getTime() - tzOffsetMinutes * 60000);
  const sign = tzOffsetMinutes <= 0 ? "+" : "-";
  const absOffset = Math.abs(tzOffsetMinutes);
  const offsetHours = String(Math.floor(absOffset / 60)).padStart(2, "0");
  const offsetMinutes = String(absOffset % 60).padStart(2, "0");
  return `${localDate
    .toISOString()
    .slice(0, -1)}${sign}${offsetHours}:${offsetMinutes}`;
}
