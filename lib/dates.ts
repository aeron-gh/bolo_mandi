// Times are stored in UTC ("YYYY-MM-DD HH:MM:SS"); people see India time (UTC + 5:30).
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const INDIA_OFFSET_MS = 330 * 60_000;

function toIndia(utc: string): Date {
  return new Date(Date.parse(`${utc.replace(" ", "T")}Z`) + INDIA_OFFSET_MS);
}

// "2026-11-19 17:45:00" -> "19 Nov, 11:15 pm"
export function indiaDateTime(utc: string): string {
  const d = toIndia(utc);
  const hour = d.getUTCHours() % 12 || 12;
  const minute = String(d.getUTCMinutes()).padStart(2, "0");
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${hour}:${minute} ${d.getUTCHours() < 12 ? "am" : "pm"}`;
}

// "2026-11-21" -> "21 Nov 2026"
export function indiaDayLabel(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return `${date} ${MONTHS[month - 1]} ${year}`;
}
