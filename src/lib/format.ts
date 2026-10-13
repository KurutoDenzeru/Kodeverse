// Display formatting shared by every section: money, counts, dates, ages.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_MS = 86400000;

export { DAYS, MONTHS, DAY_MS };

/** '-' rather than an em dash: this page bans that character in visible copy. */
export const money = (v: number | null | undefined): string =>
  v == null
    ? "-"
    : v < 0
      ? "unlimited"
      : "$" + (v < 1 ? String(+v.toFixed(4)) : String(+v.toFixed(2)));

export const reqText = (v: number | null | undefined): string =>
  v == null ? "-" : v === -1 ? "unlimited" : v.toLocaleString("en-US");

export const pad2 = (n: number): string => String(n).padStart(2, "0");

/** How old the figures are, said in words. The absolute date is exact and
 *  nobody reads it, so the gap is given as well. */
export const ageText = (fetchedAt: string, now = Date.now()): { hours: number; text: string } => {
  const hours = Math.max(0, (now - new Date(fetchedAt).getTime()) / 36e5);
  const text =
    hours < 1
      ? "less than an hour ago"
      : hours < 2
        ? "an hour ago"
        : hours < 48
          ? Math.round(hours) + " hours ago"
          : Math.round(hours / 24) + " days ago";
  return { hours, text };
};

/** "Wed, 30 Sep 2026 17:16:52 GMT" is exact and unreadable at a glance. This
 *  is the same moment in a shape that scans. The exact value stays in the
 *  title and in the datetime attribute for anyone who needs it. */
export const whenLabel = (iso: string, now = new Date()): string => {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const age = Math.round(
    (midnight - Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())) / DAY_MS,
  );
  const time = pad2(d.getUTCHours()) + ":" + pad2(d.getUTCMinutes()) + " UTC";
  const year = d.getUTCFullYear() === now.getUTCFullYear() ? "" : " " + d.getUTCFullYear();
  if (age === 0) return "Today, " + time;
  if (age === 1) return "Yesterday, " + time;
  if (age > 1 && age < 7) return DAYS[d.getUTCDay()] + " " + d.getUTCDate() + ", " + time;
  return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + year + ", " + time;
};
