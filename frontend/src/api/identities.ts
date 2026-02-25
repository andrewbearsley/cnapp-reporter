import client from './client'
import type { IdentityPageData } from '../types'

export async function getIdentities(): Promise<IdentityPageData> {
  const { data } = await client.get<IdentityPageData>('/identities')
  return data
}
