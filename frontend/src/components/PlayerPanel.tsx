import type { KeyboardEvent } from 'react'
import { CircleDot } from 'lucide-react'

type PlayerNumber = 1 | 2

interface PlayerPanelProps {
  playerNumber: PlayerNumber
  name: string
  score: number
  active: boolean
  tone: 'light' | 'gold'
  disabled: boolean
  onScore: (playerNumber: PlayerNumber, delta: number) => void
  onRename: (playerNumber: PlayerNumber, name: string) => void
  onTurn: (playerNumber: PlayerNumber) => void
}

const quickActions = [1, 2, 3, 5, -1]

export function PlayerPanel({
  playerNumber,
  name,
  score,
  active,
  tone,
  disabled,
  onScore,
  onRename,
  onTurn,
}: PlayerPanelProps) {
  function handleNameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.currentTarget.blur()
    }
  }

  return (
    <section className={`player-shell ${tone} ${active ? 'is-active' : ''}`}>
      <div className="player-heading">
        <input
          aria-label={`Nombre jugador ${playerNumber}`}
          className="player-name"
          defaultValue={name}
          onBlur={(event) => onRename(playerNumber, event.currentTarget.value)}
          onKeyDown={handleNameKeyDown}
        />
        <button
          className="turn-chip"
          type="button"
          title="Asignar turno"
          onClick={() => onTurn(playerNumber)}
        >
          <CircleDot aria-hidden="true" size={18} />
          Turno
        </button>
      </div>

      <button
        type="button"
        className="score-tile"
        onClick={() => onTurn(playerNumber)}
        aria-label={`Puntaje jugador ${playerNumber}`}
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

