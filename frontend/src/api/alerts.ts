import client from './client'
import type { AlertPageData } from '../types'

export async function getAlerts(minSeverity?: string): Promise<AlertPageData> {
  const params = minSeverity ? { min_severity: minSeverity } : {}
  const { data } = await client.get('/alerts', { params })
  return data
}
