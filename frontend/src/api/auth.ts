import client from './client'

export async function getAuthStatus(): Promise<{ setup_required: boolean }> {
  const { data } = await client.get('/auth/status')
  return data
}

export async function login(username: string, password: string): Promise<string> {
  const { data } = await client.post('/auth/login', { username, password })
  return data.access_token
}

export async function setup(username: string, password: string): Promise<string> {
  const { data } = await client.post('/auth/setup', { username, password })
  return data.access_token
}
