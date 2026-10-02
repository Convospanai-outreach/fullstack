// No User or Team timezone field exists yet, so the Action Inbox "today" counts and the
// daily digest window both use this zone.
export const DEFAULT_TIMEZONE = "Asia/Kolkata";

type LocalParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function localParts(date: Date, timeZone: string): LocalParts {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
    }).formatToParts(date);
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

function offsetMs(date: Date, timeZone: string) {
    const p = localParts(date, timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

export function localHour(date: Date, timeZone = DEFAULT_TIMEZONE) {
    return localParts(date, timeZone).hour;
}

// The local calendar date as a UTC-midnight Date, which is what a Prisma @db.Date column stores.
export function localDate(date: Date, timeZone = DEFAULT_TIMEZONE) {
    const p = localParts(date, timeZone);
    return new Date(Date.UTC(p.year, p.month - 1, p.day));
}

// [start, end) of the local day `dayOffset` days from `date` (0 = today, -1 = yesterday).
export function localDayRange(date: Date, dayOffset = 0, timeZone = DEFAULT_TIMEZONE) {
    const p = localParts(date, timeZone);
    const startGuess = Date.UTC(p.year, p.month - 1, p.day + dayOffset);
    const endGuess = Date.UTC(p.year, p.month - 1, p.day + dayOffset + 1);
    return {
        start: new Date(startGuess - offsetMs(new Date(startGuess), timeZone)),
        end: new Date(endGuess - offsetMs(new Date(endGuess), timeZone)),
    };
}

// [start, end) of the local calendar month containing `date`, plus where `date` falls in it.
export function localMonth(date: Date, timeZone = DEFAULT_TIMEZONE) {
    const p = localParts(date, timeZone);
    const startGuess = Date.UTC(p.year, p.month - 1, 1);
    const endGuess = Date.UTC(p.year, p.month, 1);
    return {
        start: new Date(startGuess - offsetMs(new Date(startGuess), timeZone)),
        end: new Date(endGuess - offsetMs(new Date(endGuess), timeZone)),
        dayOfMonth: p.day,
        daysInMonth: new Date(Date.UTC(p.year, p.month, 0)).getUTCDate(),
    };
}

// The instant it is `hour`:00 local time on a local calendar date (month 1-12; a day past the
// end of the month rolls over, like Date.UTC).
export function localTimeOn(year: number, month: number, day: number, hour: number, timeZone = DEFAULT_TIMEZONE) {
    const guess = Date.UTC(year, month - 1, day, hour);
    const first = guess - offsetMs(new Date(guess), timeZone);
    return new Date(guess - offsetMs(new Date(first), timeZone));
}
