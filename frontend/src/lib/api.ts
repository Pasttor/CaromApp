import type { AppState, SettingsState } from '../types'

export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

export function mediaUrl(path?: string | null): string | null {
  if (!path) return null
  if (path.startsWith('http')) return path
  return `${API_BASE}${path}`
}

export function stateSocketUrl(): string {
  const url = new URL(API_BASE)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = '/ws/state'
  url.search = ''
  return url.toString()
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    ...options,
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || `HTTP ${response.status}`)
  }

  return response.json() as Promise<T>
}

export const api = {
  current: () => request<AppState>('/api/match/current'),
  startMatch: () => request<AppState>('/api/match/start', { method: 'POST' }),
  pauseMatch: () => request<AppState>('/api/match/pause', { method: 'POST' }),
  resumeMatch: () => request<AppState>('/api/match/resume', { method: 'POST' }),
  endMatch: () => request<AppState>('/api/match/end', { method: 'POST' }),
  score: (playerNumber: 1 | 2, delta: number) =>
    request<AppState>(`/api/score/player/${playerNumber}`, {
      method: 'POST',
      body: JSON.stringify({ delta }),
    }),
  undo: () => request<AppState>('/api/score/undo', { method: 'POST' }),
  resetScore: () => request<AppState>('/api/score/reset', { method: 'POST' }),
  rename: (playerNumber: 1 | 2, name: string) =>
    request<AppState>(`/api/score/player/${playerNumber}/name`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),
  setTurn: (currentTurn: 1 | 2) =>
    request<AppState>('/api/score/turn', {
      method: 'PATCH',
      body: JSON.stringify({ current_turn: currentTurn }),
    }),
  saveSettings: (settings: SettingsState) =>
    request<AppState>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
  startVideo: () => request<AppState>('/api/video/start', { method: 'POST' }),
  stopVideo: () => request<AppState>('/api/video/stop', { method: 'POST' }),
  live: () => request<AppState>('/api/replay/live'),
  replay: (windowKey: '30s' | '1m' | '5m' | '30m') =>
    request<AppState>(`/api/replay/last/${windowKey}`),
}
