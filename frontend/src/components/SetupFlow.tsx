import modeSelectionBackground from '../assets/mode-selection.png'
import playerSelectionBackground from '../assets/player-selection.png'

type SetupStep = 'mode' | 'players'

interface SetupFlowProps {
  step: SetupStep
  onEasy: () => void
  onSelectPlayers: (playerCount: 2 | 3 | 4) => void
}

export function SetupFlow({ step, onEasy, onSelectPlayers }: SetupFlowProps) {
  if (step === 'mode') {
    return (
      <main
        className="setup-screen mode-screen"
        style={{ backgroundImage: `url("${modeSelectionBackground}")` }}
      >
        <div className="mode-actions" aria-label="Seleccionar modo de juego">
          <button type="button" onClick={onEasy}>
            FÁCIL
          </button>
          <button type="button" aria-disabled="true">
            AVANZADO
          </button>
        </div>
      </main>
    )
  }

  return (
    <main
      className="setup-screen player-selection-screen"
      style={{ backgroundImage: `url("${playerSelectionBackground}")` }}
    >
      <section className="player-selection-panel">
        <h1>¿CUÁNTOS JUGADORES VAN A JUGAR?</h1>
        <div className="player-count-options">
          {[2, 3, 4].map((playerCount) => (
            <button
              key={playerCount}
              type="button"
              aria-label={`${playerCount} jugadores`}
              onClick={() => onSelectPlayers(playerCount as 2 | 3 | 4)}
            >
              {playerCount}
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}
