export const MAX_RANGE_DAYS = 92
export const DEFAULT_RANGE_DAYS = 14

const MS_PER_DAY = 86_400_000

export interface DateRange {
  from: string
  to: string
}

export type RangePreset = 'last7' | 'last30' | 'month'

function parseDay(day: string): number {
  const [year, month, date] = day.split('-').map(Number)
  return Date.UTC(year ?? 0, (month ?? 1) - 1, date ?? 1)
}

function formatDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

// Today in the viewer's time zone as yyyy-mm-dd.
export function localToday(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function daysInclusive(from: string, to: string): number {
  return Math.round((parseDay(to) - parseDay(from)) / MS_PER_DAY) + 1
}

export function lastDays(count: number, today: string): DateRange {
  return { from: formatDay(parseDay(today) - (count - 1) * MS_PER_DAY), to: today }
}

export function presetRange(preset: RangePreset, today: string): DateRange {
  if (preset === 'last7') return lastDays(7, today)
  if (preset === 'last30') return lastDays(30, today)
  return { from: `${today.slice(0, 8)}01`, to: today }
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

// Returns a plain message when the range cannot be sent to the server, or null when it is fine.
export function validateRange(range: DateRange, today: string): string | null {
  if (!DAY_PATTERN.test(range.from) || !DAY_PATTERN.test(range.to)) return 'Choose both a start and an end date.'
  if (range.from > range.to) return 'The start date must be on or before the end date.'
  if (range.to > today) return 'The end date cannot be in the future.'
  if (daysInclusive(range.from, range.to) > MAX_RANGE_DAYS) return `Choose a range of ${MAX_RANGE_DAYS} days or fewer.`
  return null
}

export function formatDayLabel(day: string): string {
  return new Date(parseDay(day)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function formatCount(value: number): string {
  return value.toLocaleString('en-US')
}

// Large token counts read better as 3.1M than 3,100,000.
export function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${Number((value / 1_000_000).toFixed(1))}M`
  if (value >= 10_000) return `${Number((value / 1_000).toFixed(1))}K`
  return formatCount(value)
}

const AXIS_TICKS = 4

// Rounds the top of the axis up to 1, 2 or 5 times a power of ten, so ticks land on clean numbers.
export function niceMax(max: number): number {
  const step = Math.max(max, 1) / AXIS_TICKS
  const power = 10 ** Math.floor(Math.log10(step))
  const unit = [1, 2, 5, 10].find((u) => u * power >= step) ?? 10
  return unit * power * AXIS_TICKS
}

