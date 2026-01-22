import type { ChartData } from '../../../types/chart'

export function sliceByMonths(data: ChartData[], months: number): ChartData[] {
  return data.slice(-months)
}
