export const storeTimeZone = process.env.STORE_TIME_ZONE?.trim() || "UTC";

function partsAt(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: storeTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function localMidnightToUtc(year: number, month: number, day: number) {
  const localMidnight = Date.UTC(year, month - 1, day);
  let timestamp = localMidnight;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const local = partsAt(new Date(timestamp));
    const representedAsUtc = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
    );
    const adjustment = representedAsUtc - localMidnight;
    if (adjustment === 0) break;
    timestamp -= adjustment;
  }
  return new Date(timestamp);
}

export function getStoreDayRange(now = new Date()) {
  const today = partsAt(now);
  const tomorrow = new Date(Date.UTC(today.year, today.month - 1, today.day + 1));
  return {
    start: localMidnightToUtc(today.year, today.month, today.day),
    end: localMidnightToUtc(
      tomorrow.getUTCFullYear(),
      tomorrow.getUTCMonth() + 1,
      tomorrow.getUTCDate(),
    ),
  };
}

export function getStoreDayRangeForDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
  return {
    start: localMidnightToUtc(year, month, day),
    end: localMidnightToUtc(
      tomorrow.getUTCFullYear(),
      tomorrow.getUTCMonth() + 1,
      tomorrow.getUTCDate(),
    ),
  };
}

export function formatStoreDateTime(date: Date) {
  return new Intl.DateTimeFormat("en", {
    timeZone: storeTimeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
