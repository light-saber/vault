const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Compact relative date for note lists: "now", "12m", "3h", "Tue", "Mar 4". */
export function relativeDate(ms: number, now: number = Date.now()): string {
  if (!ms) return "";
  const diff = now - ms;
  if (diff < MINUTE) return "now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`;
  const date = new Date(ms);
  if (diff < 7 * DAY) {
    return date.toLocaleDateString(undefined, { weekday: "short" });
  }
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
}

/** Day heading for the Pulse feed: "Today", "Yesterday", "Wednesday, June 3". */
export function dayHeading(ms: number, now: number = Date.now()): string {
  const date = new Date(ms);
  const today = new Date(now);
  const startOf = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOf(today) - startOf(date)) / DAY);
  if (dayDiff === 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: dayDiff > 300 ? "numeric" : undefined,
  });
}

export function timeOfDay(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
