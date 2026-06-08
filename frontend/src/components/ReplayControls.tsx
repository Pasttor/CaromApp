import {
  CircleStop,
  Maximize2,
  Minus,
  Pause,
  Play,
  Plus,
  Radio,
  Rewind,
  RotateCcw,
  Scan,
  StepBack,
  StepForward,
} from 'lucide-react'

interface ReplayControlsProps {
  isPlaying: boolean
  playbackRate: number
  zoom: number
  canStopVideo: boolean
  onLive: () => void
  onReplay: (windowKey: '30s' | '1m' | '5m' | '30m') => void
  onTogglePlay: () => void
  onRate: (rate: number) => void
  onSeek: (seconds: number) => void
  onZoom: (nextZoom: number) => void
  onResetZoom: () => void
  onStopVideo: () => void
}

const replayWindows = [
  ['30s', '-30s'],
  ['1m', '-1m'],
  ['5m', '-5m'],
  ['30m', '-30m'],
] as const

export function ReplayControls({
  isPlaying,
  playbackRate,
  zoom,
  canStopVideo,
  onLive,
  onReplay,
  onTogglePlay,
  onRate,
  onSeek,
  onZoom,
  onResetZoom,
  onStopVideo,
}: ReplayControlsProps) {
  return (
    <div className="replay-controls">
      <div className="control-row">
        <button type="button" className="live-button" onClick={onLive} title="Volver a vivo">
          <Radio aria-hidden="true" size={18} />
          Live
        </button>
        {replayWindows.map(([key, label]) => (
          <button key={key} type="button" onClick={() => onReplay(key)}>
            <Rewind aria-hidden="true" size={17} />
            {label}
          </button>
        ))}
      </div>

      <div className="control-row compact">
        <button
          type="button"
          aria-label="Retroceder 5 segundos"
          onClick={() => onSeek(-5)}
          title="Retroceder 5 segundos"
        >
          <StepBack aria-hidden="true" size={19} />
        </button>
        <button
          type="button"
          aria-label={isPlaying ? 'Pausar replay' : 'Reproducir replay'}
          onClick={onTogglePlay}
          title={isPlaying ? 'Pausar' : 'Reproducir'}
        >
          {isPlaying ? <Pause aria-hidden="true" size={20} /> : <Play aria-hidden="true" size={20} />}
        </button>
        <button
          type="button"
          aria-label="Avanzar 5 segundos"
          onClick={() => onSeek(5)}
          title="Avanzar 5 segundos"
        >
          <StepForward aria-hidden="true" size={19} />
        </button>
        {[1, 0.5, 0.25].map((rate) => (
          <button
            key={rate}
            type="button"
            className={playbackRate === rate ? 'selected' : ''}
            onClick={() => onRate(rate)}
          >
            {rate}x
          </button>
        ))}
      </div>

      <div className="control-row compact">
        <button
          type="button"
          aria-label="Alejar"
          onClick={() => onZoom(Math.max(1, zoom - 0.25))}
          title="Alejar"
        >
          <Minus aria-hidden="true" size={18} />
        </button>
        <button type="button" className="zoom-readout" onClick={onResetZoom} title="Reset zoom">
          <Scan aria-hidden="true" size={18} />
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          aria-label="Acercar"
          onClick={() => onZoom(Math.min(4, zoom + 0.25))}
          title="Acercar"
        >
          <Plus aria-hidden="true" size={18} />
        </button>
        <button type="button" aria-label="Centrar imagen" onClick={onResetZoom} title="Centrar imagen">
          <Maximize2 aria-hidden="true" size={18} />
        </button>
        <button
          type="button"
          aria-label="Detener video"
          disabled={!canStopVideo}
          onClick={onStopVideo}
          title="Detener video"
        >
          <CircleStop aria-hidden="true" size={18} />
        </button>
        <button type="button" aria-label="Restablecer zoom" onClick={onResetZoom} title="Restablecer">
          <RotateCcw aria-hidden="true" size={18} />
        </button>
      </div>
    </div>
  )
}
