import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { AppState } from './types'

const baseState: AppState = {
  match: {
    id: 'match-1',
    player_1_name: 'Jugador 1',
    player_2_name: 'Jugador 2',
    player_1_score: 8,
    player_2_score: 6,
    current_turn: 1,
    started_at: new Date().toISOString(),
    ended_at: null,
    duration_seconds: 62,
    hourly_rate: 120,
    hourly_rate_mxn: 120,
    total_cost: 2.07,
    status: 'active',
  },
  latest_match: null,
  history: [],
  settings: {
    hourly_rate_mxn: '120',
    camera_source_type: 'usb',
    camera_device: 'default',
    demo_mode_enabled: 'true',
    buffer_minutes: '30',
    segment_seconds: '5',
    video_resolution: '1280x720',
    video_fps: '30',
    allow_negative_scores: 'false',
  },
  video: {
    status: 'idle',
    running: false,
    mode: 'idle',
    message: 'Video listo',
    available_seconds: 0,
  },
}

class MockWebSocket {
  static instances: MockWebSocket[] = []
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: (() => void) | null = null

  constructor() {
    MockWebSocket.instances.push(this)
  }

  close = vi.fn()
}

describe('App', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    MockWebSocket.instances = []
    vi.stubGlobal('WebSocket', MockWebSocket)
    vi.stubGlobal('confirm', vi.fn(() => true))
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => baseState,
      })),
    )
  })

  it('renders the scoreboard state from the backend', async () => {
    const { container } = render(<App />)

    expect(await screen.findByDisplayValue('Jugador 1')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Jugador 2')).toBeInTheDocument()
    expect(screen.getByText('00:01:02')).toBeInTheDocument()
    expect(container.querySelector('.center-stack .timer-under-video')).toHaveTextContent('00:01:02')
    expect(container.querySelector('.top-status .meter')).not.toBeInTheDocument()
    expect(screen.queryByText('Mesa')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Sumar 1 punto al jugador 1')).toHaveTextContent('8')
    expect(screen.getByLabelText('Sumar 1 punto al jugador 2')).toHaveTextContent('6')
    expect(screen.queryByRole('button', { name: '+1' })).not.toBeInTheDocument()
  })

  it('advances the timer without score actions', async () => {
    render(<App />)

    expect(await screen.findByText('00:01:02')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('00:01:03')).toBeInTheDocument(), {
      timeout: 2000,
    })
  })

  it('sends score changes to the API', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.mocked(fetch)
    render(<App />)

    await screen.findByDisplayValue('Jugador 1')
    await user.click(screen.getAllByRole('button', { name: '+2' })[0])

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/score/player/1',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ delta: 2 }),
        }),
      )
    })
  })

  it('adds one point when the large score panel is clicked', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.mocked(fetch)
    render(<App />)

    const scorePanel = await screen.findByLabelText('Sumar 1 punto al jugador 1')
    await user.click(scorePanel)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/score/player/1',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ delta: 1 }),
        }),
      )
    })
  })

  it('starts a new set from the single match button', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockImplementation(async (input) => ({
      ok: true,
      json: async () =>
        String(input).endsWith('/api/match/new-set')
          ? { ...baseState, match: null }
          : baseState,
    }) as Response)
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Nuevo set' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/match/new-set',
        expect.objectContaining({ method: 'POST' }),
      )
    })
    expect(screen.queryByRole('button', { name: 'Finalizar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pausar' })).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'INICIAR' })).toBeInTheDocument()
  })

  it('shows only the integrated bottom video controls', async () => {
    const { container } = render(<App />)

    await screen.findByDisplayValue('Jugador 1')
    expect(screen.queryByRole('button', { name: /-30s/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Controles de zoom')).not.toBeInTheDocument()
    expect(container.querySelector('media-control-bar')).toBeInTheDocument()
  })
})
