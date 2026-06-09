import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pause, Play, RotateCcw, Settings, TimerReset, Undo2 } from 'lucide-react'
import './App.css'
import { PlayerPanel } from './components/PlayerPanel'
import { ReplayControls } from './components/ReplayControls'
import { VideoStage } from './components/VideoStage'
import { MatchSummaryModal } from './components/MatchSummaryModal'
import { SettingsModal } from './components/SettingsModal'
import { api, stateSocketUrl } from './lib/api'
import { formatDuration, formatMoney } from './lib/format'
import type { AppState, MatchState, SettingsState } from './types'

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
  const [summary, setSummary] = useState<MatchState | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [isPlaying, setIsPlaying] = useState(true)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [seekCommand, setSeekCommand] = useState<{ id: number; seconds: number } | null>(null)
  const [connectionError, setConnectionError] = useState('')

  const match = state.match
  const isActive = match?.status === 'active'
  const isPaused = match?.status === 'paused'
  const duration = match?.duration_seconds ?? 0
  const totalCost = match?.total_cost ?? 0

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

  async function handleStartPauseResume() {
    if (!match) {
      await runAction(api.startMatch)
    } else if (isActive) {
      await runAction(api.pauseMatch)
    } else {
      await runAction(api.resumeMatch)
    }
  }

  async function handleEndMatch() {
    if (!window.confirm('Finalizar la partida actual?')) return
    const nextState = await runAction(api.endMatch)
    setSummary(nextState?.summary ?? nextState?.latest_match ?? null)
  }

  async function handleResetScore() {
    if (!window.confirm('Reiniciar el marcador?')) return
    await runAction(api.resetScore)
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
        <div className="meter">
          <span>Tiempo</span>
          <strong>{formatDuration(duration)}</strong>
        </div>
        <div className="meter">
          <span>Mesa</span>
          <strong>{formatMoney(totalCost)}</strong>
        </div>
        <div className="top-actions">
          <button type="button" className="primary-action" onClick={handleStartPauseResume}>
            {isActive ? <Pause aria-hidden="true" size={20} /> : <Play aria-hidden="true" size={20} />}
            {!match ? 'Iniciar' : isPaused ? 'Reanudar' : 'Pausar'}
          </button>
          <button type="button" onClick={() => void handleEndMatch()} disabled={!match}>
            <TimerReset aria-hidden="true" size={20} />
            Finalizar
          </button>
          <button
            type="button"
            aria-label="Deshacer"
            onClick={() => void runAction(api.undo)}
            disabled={!match}
          >
            <Undo2 aria-hidden="true" size={20} />
          </button>
          <button
            type="button"
            aria-label="Reiniciar marcador"
            onClick={() => void handleResetScore()}
            disabled={!match}
          >
            <RotateCcw aria-hidden="true" size={20} />
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
          disabled={false}
          onScore={(playerNumber, delta) => void runAction(() => api.score(playerNumber, delta))}
          onRename={(playerNumber, name) => void runAction(() => api.rename(playerNumber, name))}
          onTurn={(playerNumber) => void runAction(() => api.setTurn(playerNumber))}
        />

        <section className="center-stack">
          <VideoStage
            video={state.video}
            isPlaying={isPlaying}
            playbackRate={playbackRate}
            zoom={zoom}
            seekCommand={seekCommand}
            onPanReset={() => setZoom(1)}
          />
          <ReplayControls
            isPlaying={isPlaying}
            playbackRate={playbackRate}
            zoom={zoom}
            canStopVideo={Boolean(state.video.running)}
            onLive={() => {
      setPlaybackRate(1)
      setIsPlaying(true)
      void runAction(api.live, true)
    }}
    onReplay={(windowKey) => {
      setIsPlaying(true)
      void runAction(() => api.replay(windowKey), true)
    }}
            onTogglePlay={() => setIsPlaying((current) => !current)}
            onRate={setPlaybackRate}
            onSeek={(seconds) => setSeekCommand({ id: Date.now(), seconds })}
            onZoom={setZoom}
            onResetZoom={() => setZoom(1)}
            onStopVideo={() => void runAction(api.stopVideo, true)}
          />
          <div className="event-strip">
            {state.history.length === 0 ? (
              <span>Sin cambios de marcador</span>
            ) : (
              state.history.slice(0, 5).map((event) => (
                <span key={event.id}>
                  J{event.player_number} {event.delta > 0 ? '+' : ''}
                  {event.delta}
                  {' -> '}
                  {event.new_score}
                </span>
              ))
            )}
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
          disabled={false}
          onScore={(playerNumber, delta) => void runAction(() => api.score(playerNumber, delta))}
          onRename={(playerNumber, name) => void runAction(() => api.rename(playerNumber, name))}
          onTurn={(playerNumber) => void runAction(() => api.setTurn(playerNumber))}
        />
      </div>

      <SettingsModal
        open={settingsOpen}
        settings={state.settings}
        onClose={() => setSettingsOpen(false)}
        onSave={(settings) => void handleSaveSettings(settings)}
      />
      <MatchSummaryModal summary={summary} onClose={() => setSummary(null)} />
    </main>
  )
}

export default App
