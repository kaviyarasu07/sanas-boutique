/**
 * The one place the app's date display format lives. Every screen, receipt and CSV shows dates as
 * dd/mm/yyyy (and times as 12-hour, e.g. 04:35 pm). The API still sends and receives ISO
 * yyyy-MM-dd; only what people see and type changes.
 */

/** Mantine DateInput display / typing format (dayjs tokens). Set as the theme default for every DateInput. */
export const DATE_INPUT_FORMAT = 'DD/MM/YYYY'

const pad = (n: number) => String(n).padStart(2, '0')
const dmy = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`

/** Calendar date from the API ("2026-10-11") -> "11/10/2026"; also accepts a full timestamp. '—' when empty. */
export function fmtDate(value: string | null | undefined): string {
  if (!value) return '—'
  // A bare yyyy-MM-dd is a calendar day: build it in local time, never via UTC (would shift the day).
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : dmy(d)
}

/** Timestamp from the API -> "11/10/2026, 04:35 pm" in the browser's local time. */
export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  const h = d.getHours()
  return `${dmy(d)}, ${pad(h % 12 || 12)}:${pad(d.getMinutes())} ${h < 12 ? 'am' : 'pm'}`
}

/** Calendar date with the weekday, for headings: "Sunday, 11/10/2026". */
export function fmtDateWithDay(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value)
  return `${d.toLocaleDateString('en-IN', { weekday: 'long' })}, ${fmtDate(value)}`
}
