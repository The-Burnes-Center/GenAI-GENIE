import { useMemo, useState } from 'react'
import { ChartBar } from '@phosphor-icons/react'
import { useAdminUsage } from '../../api/admin-ops'
import { useBootstrap } from '../../api/bootstrap'
import type { UsageReport } from '../../api/types'
import { PageHead, SectionTitle } from '../../components/admin/PageHead'
import { QueryError, TableSkeleton } from '../../components/admin/states'
import { UsageChart } from '../../components/admin/UsageChart'
import { dayRows, modelRows, userRows } from '../../components/admin/usage-rows'
import { UsageByTable, UsageDayTable } from '../../components/admin/UsageTables'
import {
  DEFAULT_RANGE_DAYS, formatCount, lastDays, localToday, presetRange, validateRange, type DateRange, type RangePreset,
} from '../../components/admin/usage-range'
import { Button, EmptyState, TextField } from '../../components/ui'

const PRESETS: Array<{ id: RangePreset; label: string }> = [
  { id: 'last7', label: 'Last 7 days' },
  { id: 'last30', label: 'Last 30 days' },
  { id: 'month', label: 'This month' },
]

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <b className="block text-h1 font-semibold tabular-nums">{formatCount(value)}</b>
      <span className="text-ink-2">{label}</span>
    </div>
  )
}

function Report({ report }: { report: UsageReport }) {
  const models = useBootstrap().data?.models
  const labels = useMemo(() => new Map((models ?? []).map((model) => [model.modelId, model.label])), [models])
  if (report.byDay.length === 0 || report.totals.requests === 0) {
    return <EmptyState icon={<ChartBar />} title="No usage in this range">Try a longer range. Messages show up here after people use Genie.</EmptyState>
  }
  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-6 pb-2">
        <Stat value={report.totals.requests} label="Messages" />
        <Stat value={report.totals.inputTokens} label="Input tokens" />
        <Stat value={report.totals.outputTokens} label="Output tokens" />
      </div>
      <p className="mb-4 text-small text-ink-3">Tokens are the pieces of text models read and write. Providers bill by them.</p>
      <section aria-labelledby="usage-daily" className="rounded-lg border border-edge bg-surface p-4">
        <h2 id="usage-daily" className="mb-3 text-ui font-semibold">Messages per day</h2>
        <UsageChart rows={dayRows(report)} />
        <details className="mt-3">
          <summary className="cursor-pointer text-accent underline underline-offset-4">Show the numbers as a table</summary>
          <div className="mt-3"><UsageDayTable rows={dayRows(report)} /></div>
        </details>
      </section>
      <SectionTitle>By model</SectionTitle>
      <UsageByTable label="Usage by model" nameHeader="Model" rows={modelRows(report, labels)} />
      <SectionTitle>By person</SectionTitle>
      <UsageByTable label="Usage by person" nameHeader="Email" rows={userRows(report)} />
    </>
  )
}

export function AdminUsagePage() {
  const today = useMemo(() => localToday(), [])
  const [range, setRange] = useState<DateRange>(() => lastDays(DEFAULT_RANGE_DAYS, today))
  const problem = validateRange(range, today)
  const usage = useAdminUsage(problem ? '' : range.from, problem ? '' : range.to)

  return (
    <>
      <PageHead title="Usage" lead="Messages, people and model use. Pick a range of up to 92 days." />
      <div className="mb-4 flex flex-wrap items-start gap-3">
        <TextField label="From" type="date" value={range.from} onChange={(from) => setRange((r) => ({ ...r, from }))} />
        <TextField label="To" type="date" value={range.to} onChange={(to) => setRange((r) => ({ ...r, to }))} errorMessage={problem ?? undefined} />
        <div className="flex flex-wrap gap-2 self-end" role="group" aria-label="Quick ranges">
          {PRESETS.map((preset) => (
            <Button key={preset.id} size="sm" onPress={() => setRange(presetRange(preset.id, today))}>{preset.label}</Button>
          ))}
        </div>
      </div>
      {!problem && usage.isPending && <TableSkeleton label="Loading usage" rows={3} />}
      {!problem && usage.isError && <QueryError what="usage" error={usage.error} onRetry={() => void usage.refetch()} />}
      {!problem && usage.data && <Report report={usage.data} />}
    </>
  )
}
