export type MatchStatus = 'active' | 'paused' | 'ended'

export interface MatchState {
  id: string
  player_1_name: string
  player_2_name: string
  player_1_score: number
  player_2_score: number
  current_turn: 1 | 2
  started_at: string
  ended_at?: string | null
  duration_seconds: number
  hourly_rate: number
  hourly_rate_mxn: number
  total_cost: number
  status: MatchStatus
}

export interface ScoreEvent {
  id: string
  match_id: string
  player_number: 1 | 2
  delta: number
  previous_score: number
  new_score: number
  created_at: string
}

export interface SettingsState {
  hourly_rate_mxn: string
  camera_source_type: 'usb' | 'rtsp' | 'demo'
  camera_device: string
  demo_mode_enabled: string
  buffer_minutes: string
  segment_seconds: string
  video_resolution: string
  video_fps: string
  allow_negative_scores: string
}

export interface VideoState {
  status: 'idle' | 'running' | 'error' | 'ready' | 'limited' | 'empty' | string
  running?: boolean
  mode: 'live' | 'replay' | 'idle' | string
  message: string
  ffmpeg_available?: boolean
  live_url?: string | null
  url?: string | null
  available_seconds: number
  requested_seconds?: number
}

export interface VideoDevice {
  id: string
  label: string
}

export interface VideoDevicesResponse {
  devices: VideoDevice[]
  message: string
}

export interface AppState {
  match: MatchState | null
  latest_match: MatchState | null
  history: ScoreEvent[]
  settings: SettingsState
  video: VideoState
  summary?: MatchState | null
}
