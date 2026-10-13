// Zone facts read from the browser rather than assumed. Two sections need
// them (the nav clock and the "you are here" line in the method example), so
// they live here once.

const tzNow = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

/** "Asia/Manila" -> "Manila". A zone with no region part answers itself. */
export const zoneCity = (): string => {
  const tz = tzNow();
  return tz.includes("/") ? tz.split("/").pop()!.replace(/_/g, " ") : tz;
};

/** 'GMT+08:00' becomes 'UTC+8', and a half hour zone keeps its minutes. */
export const zoneOffset = (): string => {
  const tz = tzNow();
  if (tz === "UTC") return "UTC";
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZoneName: "longOffset" })
      .formatToParts(new Date())
      .find((x) => x.type === "timeZoneName");
    const m = part && part.value.match(/GMT([+-])(\d{1,2}):?(\d{2})?/);
    if (!m) return zoneCity();
    return "UTC" + m[1] + m[2] + (m[3] && m[3] !== "00" ? ":" + m[3] : "");
  } catch {
    return zoneCity();
  }
};

/** "Manila · UTC+8", or just "UTC" for a reader on it. */
export const zoneLabel = (): string =>
  tzNow() === "UTC" ? "UTC" : zoneCity() + " \u00b7 " + zoneOffset();
