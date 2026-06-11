import { useCallback, useEffect, useMemo, useState } from 'react'
import { Play, Settings, TimerReset } from 'lucide-react'
import './App.css'
import { PlayerPanel } from './components/PlayerPanel'
import { VideoStage } from './components/VideoStage'
import { SettingsModal } from './components/SettingsModal'
import { api, stateSocketUrl } from './lib/api'
import { formatDuration } from './lib/format'
import type { AppState, SettingsState } from './types'

const defaultSettings: SettingsState = {
  hourly_rate_mxn: '120',
  camera_source_type: 'usb',
  camera_device: 'default',
  demo_mode_enabled: 'true',
  buffer_minutes: '30',
  segment_seconds: '5',
  video_resolution: '1280x720',
  video_fps: '30',
  allow_negative_scores: 'false',
}

const fallbackState: AppState = {
  match: null,
  latest_match: null,
  history: [],
  settings: defaultSettings,
  video: {
    status: 'idle',
    mode: 'idle',
    message: 'Conectando con el backend.',
    available_seconds: 0,
    ffmpeg_available: false,
  },
}

function App() {
  const [state, setState] = useState<AppState>(fallbackState)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  const [displayDuration, setDisplayDuration] = useState(0)

  const match = state.match
  const isActive = match?.status === 'active'

  const playerOne = useMemo(
    () => ({
      name: match?.player_1_name ?? 'Jugador 1',
      score: match?.player_1_score ?? 0,
      active: match?.current_turn === 1,
    }),
    [match],
  )

  const playerTwo = useMemo(
    () => ({
      name: match?.player_2_name ?? 'Jugador 2',
      score: match?.player_2_score ?? 0,
      active: match?.current_turn === 2,
    }),
    [match],
  )

  const commitState = useCallback((nextState: AppState, replaceVideo = false) => {
    setDisplayDuration(nextState.match?.duration_seconds ?? 0)
    setState((current) => {
      if (!replaceVideo && current.video.mode === 'replay' && nextState.video.mode !== 'replay') {
        return { ...nextState, video: current.video }
      }
      return nextState
    })
  }, [])

  const runAction = useCallback(async (action: () => Promise<AppState>, replaceVideo = false) => {
    try {
      setConnectionError('')
      const nextState = await action()
      commitState(nextState, replaceVideo)
      return nextState
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'No se pudo completar la accion.')
      return null
    }
  }, [commitState])

  useEffect(() => {
    let closed = false
    void runAction(api.current)
    void runAction(api.startVideo, true)

    const socket = new WebSocket(stateSocketUrl())
    socket.onmessage = (event) => {
      if (closed) return
      commitState(JSON.parse(event.data) as AppState)
      setConnectionError('')
    }
    socket.onerror = () => {
      if (!closed) setConnectionError('WebSocket sin conexion; usando respuestas REST.')
    }

    return () => {
      closed = true
      socket.close()
    }
  }, [commitState, runAction])

  useEffect(() => {
    if (!isActive) return
    const interval = window.setInterval(() => {
      setDisplayDuration((current) => current + 1)
    }, 1000)

    return () => window.clearInterval(interval)
  }, [isActive, match?.id])

  async function handlePrimaryMatchAction() {
    if (!match) {
      await runAction(api.startMatch)
      return
    }
    if (!window.confirm('Cerrar este set y preparar uno nuevo?')) {
      return
    }
    await runAction(api.newSet)
  }

  async function handleSaveSettings(settings: SettingsState) {
    const nextState = await runAction(() => api.saveSettings(settings))
    if (nextState) {
      setSettingsOpen(false)
      await runAction(api.stopVideo, true)
      await runAction(api.startVideo, true)
    }
  }

  return (
    <main className="scoreboard-app">
      <div className="top-status">
        <div className="top-actions">
          <button type="button" className="primary-action" onClick={handlePrimaryMatchAction}>
            {match ? (
              <TimerReset aria-hidden="true" size={20} />
            ) : (
              <Play aria-hidden="true" size={20} />
            )}
            {match ? 'Nuevo set' : 'INICIAR'}
          </button>
          <button type="button" aria-label="Ajustes" onClick={() => setSettingsOpen(true)}>
            <Settings aria-hidden="true" size={20} />
          </button>
        </div>
      </div>

      <div className="scoreboard-grid">
        <PlayerPanel
          playerNumber={1}
          name={playerOne.name}
          score={playerOne.score}
          active={playerOne.active}
          tone="light"
          disabled={!match}
          onScore={(playerNumber, delta) => void runAction(() => api.score(playerNumber, delta))}
          onRename={(playerNumber, name) => void runAction(() => api.rename(playerNumber, name))}
        />

        <section className="center-stack">
          <VideoStage video={state.video} />
          <div className="meter timer-under-video">
            <span>Tiempo</span>
            <strong>{formatDuration(displayDuration)}</strong>
          </div>
          {(connectionError || state.video.status === 'error') && (
            <div className="error-line">{connectionError || state.video.message}</div>
          )}
        </section>

        <PlayerPanel
          playerNumber={2}
          name={playerTwo.name}
          score={playerTwo.score}
          active={playerTwo.active}
          tone="gold"
          disabled={!match}
          onScore={(playerNumber, delta) => void runAction(() => api.score(playerNumber, delta))}
          onRename={(playerNumber, name) => void runAction(() => api.rename(playerNumber, name))}
        />
      </div>

      <SettingsModal
        open={settingsOpen}
        settings={state.settings}
        onClose={() => setSettingsOpen(false)}
        onSave={(settings) => void handleSaveSettings(settings)}
      />
    </main>
  )
}

export default App
