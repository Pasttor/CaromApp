import { useCallback, useEffect, useState } from 'react'
import { Play, Settings, TimerReset } from 'lucide-react'
import './App.css'
import { PlayerPanel } from './components/PlayerPanel'
import { SetupFlow } from './components/SetupFlow'
import { VideoStage } from './components/VideoStage'
import { SettingsModal } from './components/SettingsModal'
import { api, stateSocketUrl } from './lib/api'
import { formatDuration } from './lib/format'
import type {
  AppState,
  MatchState,
  PlayerCount,
  PlayerNumber,
  SettingsState,
} from './types'

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
  const [screen, setScreen] = useState<'mode' | 'players' | 'scoreboard'>('mode')
  const [selectedPlayerCount, setSelectedPlayerCount] = useState<PlayerCount>(2)
  const [state, setState] = useState<AppState>(fallbackState)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [connectionError, setConnectionError] = useState('')
  const [displayDuration, setDisplayDuration] = useState(0)

  const match = state.match
  const isActive = match?.status === 'active'

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
    if (screen !== 'scoreboard') return
    void runAction(api.startVideo, true)
  }, [runAction, screen])

  useEffect(() => {
    if (!isActive) return
    const interval = window.setInterval(() => {
      setDisplayDuration((current) => current + 1)
    }, 1000)

    return () => window.clearInterval(interval)
  }, [isActive, match?.id])

  async function handlePrimaryMatchAction() {
    if (!match) {
      await runAction(() => api.startMatch(selectedPlayerCount))
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

  function playerName(matchState: MatchState | null, playerNumber: PlayerNumber) {
    if (!matchState) return `Jugador ${playerNumber}`
    return matchState[`player_${playerNumber}_name`]
  }

  function playerScore(matchState: MatchState | null, playerNumber: PlayerNumber) {
    if (!matchState) return 0
    return matchState[`player_${playerNumber}_score`]
  }

  const visiblePlayerCount = match?.player_count ?? selectedPlayerCount
  const players = Array.from(
    { length: visiblePlayerCount },
    (_, index) => (index + 1) as PlayerNumber,
  )

  function renderPlayer(playerNumber: PlayerNumber) {
    return (
      <PlayerPanel
        key={playerNumber}
        playerNumber={playerNumber}
        name={playerName(match, playerNumber)}
        score={playerScore(match, playerNumber)}
        active={match?.current_turn === playerNumber}
        tone={playerNumber % 2 === 0 ? 'gold' : 'light'}
        disabled={!match}
        onScore={(number, delta) => void runAction(() => api.score(number, delta))}
        onRename={(number, name) => void runAction(() => api.rename(number, name))}
      />
    )
  }

  if (screen !== 'scoreboard') {
    return (
      <SetupFlow
        step={screen}
        onEasy={() => setScreen('players')}
        onSelectPlayers={(playerCount) => {
          setSelectedPlayerCount(playerCount)
          setScreen('scoreboard')
        }}
      />
    )
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

      <div
        className={`scoreboard-grid players-${visiblePlayerCount} ${
          visiblePlayerCount > 2 ? 'is-multiplayer' : ''
        }`}
      >
        {renderPlayer(players[0])}

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

        {players.slice(1).map(renderPlayer)}
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
