import client from './client'
import type { Instance, InstanceCreate } from '../types'

export async function listInstances(): Promise<Instance[]> {
  const { data } = await client.get('/instances')
  return data
}

export async function createInstance(payload: InstanceCreate): Promise<Instance> {
  const { data } = await client.post('/instances', payload)
  return data
}

export async function updateInstance(id: number, payload: Partial<InstanceCreate> & { is_enabled?: boolean }): Promise<Instance> {
  const { data } = await client.put(`/instances/${id}`, payload)
  return data
}

export async function deleteInstance(id: number): Promise<void> {
  await client.delete(`/instances/${id}`)
}

export async function testInstanceConnection(id: number): Promise<{ success: boolean; message: string }> {
  const { data } = await client.post(`/instances/${id}/test`)
  return data
}

export async function syncInstance(id: number): Promise<{ success: boolean; status: string; alerts: number; host_vulns: number; compliance: number; error: string | null }> {
  const { data } = await client.post(`/instances/${id}/sync`)
  return data
}

export async function testNewConnection(payload: InstanceCreate): Promise<{ success: boolean; message: string }> {
  const { data } = await client.post('/instances/test-connection', payload)
  return data
}
