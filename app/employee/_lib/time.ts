export const EMPLOYEE_TIME_ZONE = "America/Chicago";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function centralToday() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EMPLOYEE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function partsInZone(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EMPLOYEE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const map = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour,
    minute: map.minute,
    second: map.second,
  };
}

export function centralMidnightToUtc(dateText: string) {
  const [year, month, day] = dateText.split("-").map(Number);
  const desiredAsUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
  let guess = new Date(desiredAsUtc);

  for (let i = 0; i < 3; i += 1) {
    const actual = partsInZone(guess);
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );

    guess = new Date(guess.getTime() + (desiredAsUtc - actualAsUtc));
  }

  return guess;
}

export function addCalendarDays(dateText: string, days: number) {
  const [year, month, day] = dateText.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));

  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate(),
  )}`;
}

export function todayBounds() {
  const today = centralToday();

  return {
    today,
    start: centralMidnightToUtc(today),
    endExclusive: centralMidnightToUtc(addCalendarDays(today, 1)),
  };
}

export function formatCentralTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: EMPLOYEE_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatCentralDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: EMPLOYEE_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function formatCentralDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: EMPLOYEE_TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function durationHours(
  startValue: string,
  endValue: string | null,
  now = new Date(),
) {
  const start = new Date(startValue).getTime();
  const end = endValue ? new Date(endValue).getTime() : now.getTime();

  return Math.max(0, end - start) / 3_600_000;
}

export function clippedDurationHours(
  startValue: string,
  endValue: string | null,
  rangeStart: Date,
  rangeEndExclusive: Date,
  now = new Date(),
) {
  const start = Math.max(
    new Date(startValue).getTime(),
    rangeStart.getTime(),
  );

  const end = Math.min(
    endValue ? new Date(endValue).getTime() : now.getTime(),
    rangeEndExclusive.getTime(),
  );

  return Math.max(0, end - start) / 3_600_000;
}

export function formatHours(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function elapsedLabel(value: string) {
  const ms = Math.max(0, Date.now() - new Date(value).getTime());
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}
