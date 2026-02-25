import client from './client'
import type { VulnPageData } from '../types'

export async function getVulnerabilities(): Promise<VulnPageData> {
  const { data } = await client.get('/vulnerabilities')
  return data
}
