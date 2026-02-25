import client from './client'
import type { CompliancePageData } from '../types'

export async function getCompliance(): Promise<CompliancePageData> {
  const { data } = await client.get('/compliance')
  return data
}
