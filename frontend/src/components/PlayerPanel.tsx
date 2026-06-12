import type { KeyboardEvent } from 'react'
import type { PlayerNumber } from '../types'

interface PlayerPanelProps {
  playerNumber: PlayerNumber
  name: string
  score: number
  active: boolean
  tone: 'light' | 'gold'
  disabled: boolean
  onScore: (playerNumber: PlayerNumber, delta: number) => void
  onRename: (playerNumber: PlayerNumber, name: string) => void
}

const quickActions = [2, 3, 5, -1]

export function PlayerPanel({
  playerNumber,
  name,
  score,
  active,
  tone,
  disabled,
  onScore,
  onRename,
}: PlayerPanelProps) {
  function handleNameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.currentTarget.blur()
    }
  }

  return (
    <section className={`player-shell player-${playerNumber} ${tone} ${active ? 'is-active' : ''}`}>
      <div className="player-heading">
        <input
          aria-label={`Nombre jugador ${playerNumber}`}
          className="player-name"
          defaultValue={name}
          disabled={disabled}
          onBlur={(event) => onRename(playerNumber, event.currentTarget.value)}
          onKeyDown={handleNameKeyDown}
        />
      </div>

      <button
        type="button"
        className="score-tile"
        disabled={disabled}
        onClick={() => onScore(playerNumber, 1)}
        aria-label={`Sumar 1 punto al jugador ${playerNumber}`}
        title="Sumar 1 punto"
      >
        {score}
      </button>

      <div className="score-actions" aria-label={`Acciones jugador ${playerNumber}`}>
        {quickActions.map((delta) => (
          <button
            key={delta}
            type="button"
            disabled={disabled}
            onClick={() => onScore(playerNumber, delta)}
          >
            {delta > 0 ? `+${delta}` : delta}
          </button>
        ))}
      </div>
    </section>
  )
}
