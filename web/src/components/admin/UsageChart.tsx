import type { UsageRow } from './usage-rows'
import { formatCount, formatDayLabel, niceMax } from './usage-range'

const WIDTH = 680
const HEIGHT = 220
const LEFT = 40
const BOTTOM = 26
const TOP = 8
const MAX_LABELS = 8
const TICKS = 4

// One series, one color, direct labels. The accessible name states the busiest day; a table sits beside it.
export function UsageChart({ rows }: { rows: UsageRow[] }) {
  const peak = rows.reduce((best, row) => (row.requests > best.requests ? row : best), rows[0] as UsageRow)
  const top = niceMax(peak.requests)
  const bandWidth = (WIDTH - LEFT) / rows.length
  const y = (value: number) => TOP + (HEIGHT - TOP - BOTTOM) * (1 - value / top)
  const labelEvery = Math.ceil(rows.length / MAX_LABELS)

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" className="block h-auto w-full overflow-visible"
      aria-label={`Messages per day. Busiest day: ${formatDayLabel(peak.key)} with ${formatCount(peak.requests)} messages.`}>
      {Array.from({ length: TICKS + 1 }, (_, i) => (top / TICKS) * i).map((tick) => (
        <g key={tick}>
          <line x1={LEFT} x2={WIDTH} y1={y(tick)} y2={y(tick)} style={{ stroke: 'var(--color-edge)' }} />
          <text x={LEFT - 6} y={y(tick) + 4} textAnchor="end" style={{ fill: 'var(--color-ink-2)', fontSize: 11 }}>{formatCount(tick)}</text>
        </g>
      ))}
      {rows.map((row, index) => (
        <g key={row.key}>
          <rect x={LEFT + index * bandWidth + bandWidth * 0.18} width={bandWidth * 0.64} y={y(row.requests)}
            height={HEIGHT - BOTTOM - y(row.requests)} rx={2} style={{ fill: 'var(--color-accent)' }} />
          {index % labelEvery === 0 && (
            <text x={LEFT + index * bandWidth + bandWidth / 2} y={HEIGHT - 8} textAnchor="middle" style={{ fill: 'var(--color-ink-2)', fontSize: 11 }}>
              {formatDayLabel(row.key)}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}
