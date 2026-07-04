// The shop is physically in Lahore, so "open" always means Pakistan time,
// regardless of the server's or visitor's own timezone.
const TIMEZONE = "Asia/Karachi";
const OPEN_HOUR = 16; // 4:00 PM
const CLOSE_HOUR = 2; // 2:00 AM (next day)

export const BUSINESS_HOURS_LABEL = "4:00 PM – 2:00 AM";

function currentHourInTimeZone(date: Date): number {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: TIMEZONE,
    }).format(date)
  );
  return hour % 24; // some engines report midnight as 24 instead of 0
}

/** True between 4:00 PM and 2:00 AM Pakistan time (wraps past midnight). */
export function isWithinBusinessHours(date: Date = new Date()): boolean {
  const hour = currentHourInTimeZone(date);
  return hour >= OPEN_HOUR || hour < CLOSE_HOUR;
}
