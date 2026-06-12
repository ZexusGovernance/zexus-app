// The user's local calendar date as YYYY-MM-DD.
// Streaks/check-ins use this (sent to the server) so day boundaries follow the
// user's own timezone instead of UTC — otherwise two check-ins ~24h apart can
// collapse onto the same UTC day or skip one, breaking the streak.
export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
