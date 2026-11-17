import type { UsageReport, UsageTotals } from '../../api/types'

// What the usage charts and tables draw: the totals plus the one label each grouping is shown by.
export interface UsageRow extends UsageTotals {
  key: string
}

export function dayRows(report: UsageReport): UsageRow[] {
  return report.byDay.map(({ day, ...totals }) => ({ key: day, ...totals }))
}

// Models are shown by catalog label when it is known; the report itself only carries the model id.
export function modelRows(report: UsageReport, labels: ReadonlyMap<string, string> = new Map()): UsageRow[] {
  return report.byModel.map(({ modelId, ...totals }) => ({ key: labels.get(modelId) ?? modelId, ...totals }))
}

// People are shown by email; a row with none falls back to the account id.
export function userRows(report: UsageReport): UsageRow[] {
  return report.byUser.map(({ sub, email, ...totals }) => ({ key: email || sub, ...totals }))
}
