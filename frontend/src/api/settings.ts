import client from './client'
import type { UserSettings } from '../types'

export async function getSettings(): Promise<UserSettings> {
  const { data } = await client.get('/settings')
  return data
}

export async function updateSettings(payload: Partial<UserSettings>): Promise<UserSettings> {
  const { data } = await client.put('/settings', payload)
  return data
}
