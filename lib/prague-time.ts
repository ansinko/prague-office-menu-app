const TZ = 'Europe/Prague';

const isoFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const longFmt = new Intl.DateTimeFormat('cs-CZ', {
  timeZone: TZ,
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

const hourFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hour: '2-digit',
  hourCycle: 'h23',
});

const weekdayFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  weekday: 'short',
});

const hmsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const SHORT_WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

export function pragueIsoDate(d: Date = new Date()): string {
  return isoFmt.format(d);
}

export function pragueLongDate(d: Date = new Date()): string {
  const parts = Object.fromEntries(
    longFmt.formatToParts(d).map((p) => [p.type, p.value]),
  );
  return `${parts.weekday} ${parts.day}. ${parts.month} ${parts.year}`;
}

export function pragueHour(d: Date = new Date()): number {
  return Number(hourFmt.format(d));
}

export function pragueDayIndex(d: Date = new Date()): number {
  return SHORT_WEEKDAY_TO_INDEX[weekdayFmt.format(d)] ?? 0;
}

export function isPragueWeekend(d: Date = new Date()): boolean {
  const i = pragueDayIndex(d);
  return i === 0 || i === 6;
}

export function secondsUntilPragueMidnight(d: Date = new Date()): number {
  const parts = hmsFmt.formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const elapsed = get('hour') * 3600 + get('minute') * 60 + get('second');
  return 24 * 3600 - elapsed + 60;
}
