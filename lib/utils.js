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
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// Returns an ISO-8601 string representing local time *with* timezone offset
// e.g. "2025-06-24T15:20:00+08:00". Useful when backend must store
// the client's local timestamp rather than UTC.
export function getLocalTimeWithOffset() {
  const now = new Date();
  const tzOffsetMinutes = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - tzOffsetMinutes * 60000);
  const sign = tzOffsetMinutes <= 0 ? "+" : "-";
  const absOffset = Math.abs(tzOffsetMinutes);
  const offsetHours = String(Math.floor(absOffset / 60)).padStart(2, "0");
  const offsetMinutes = String(absOffset % 60).padStart(2, "0");
  return `${localDate
    .toISOString()
    .slice(0, -1)}${sign}${offsetHours}:${offsetMinutes}`;
}
